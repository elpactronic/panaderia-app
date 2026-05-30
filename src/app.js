// ─── Configuración ────────────────────────────────────────────────────────────
// Reemplazar con la URL de tu Web App de Google Apps Script después de deployar
const API_URL = 'https://script.google.com/macros/s/AKfycbwIsWlobSL769-usr7lU4dDZd_1PGIOS7ltoOahqbpUctCVi4yv_ft4GkUIAPIZ6toHZw/exec';

const GRUPOS = ['IONA', 'SanJuan', 'Pascual', 'Milton', 'Gaston', 'Mariana', 'PedidosChicos'];
const HOY = new Date().toISOString().slice(0, 10);

// ─── Estado global ────────────────────────────────────────────────────────────
let estado = {
  rol: null,
  nombre: null,
  clientes: [],
  repartidores: [],
  precios: [],
  pedidos: [],
  fecha: HOY,
  offline: false,
  pendientesSync: [],
};

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(accion, datos = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ accion, ...datos }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    return json.data;
  } catch (err) {
    if (!navigator.onLine) {
      estado.offline = true;
      renderOfflineBanner(true);
    }
    throw err;
  }
}

async function cargarDatos() {
  const [clientes, repartidores, precios, pedidos] = await Promise.all([
    api('listar_clientes'),
    api('listar_repartidores'),
    api('listar_precios'),
    api('listar_pedidos', { fecha: estado.fecha }),
  ]);
  estado.clientes     = clientes     || [];
  estado.repartidores = repartidores || [];
  estado.precios      = precios      || [];
  estado.pedidos      = pedidos      || [];

  // Guardar en localStorage para uso offline
  localStorage.setItem('cache_pedidos_' + estado.fecha, JSON.stringify(estado.pedidos));
  localStorage.setItem('cache_clientes', JSON.stringify(estado.clientes));
}

function cargarDesdeCache() {
  estado.clientes = JSON.parse(localStorage.getItem('cache_clientes') || '[]');
  estado.pedidos  = JSON.parse(localStorage.getItem('cache_pedidos_' + estado.fecha) || '[]');
}

// ─── Cálculo de montos ────────────────────────────────────────────────────────
function calcularMonto(pedido) {
  const precio = (producto, tipo) => {
    const p = estado.precios.find(x => x.producto === producto && x.tipo === tipo);
    return p ? Number(p.precio_unitario) : 0;
  };
  return (
    (pedido.frances_kg      || 0) * precio('pan', 'frances')    +
    (pedido.minon_kg        || 0) * precio('pan', 'minon')       +
    (pedido.sanguchero_kg   || 0) * precio('pan', 'sanguchero')  +
    (pedido.negro_kg        || 0) * precio('pan', 'negro')       +
    (pedido.tort_fina       || 0) * precio('tortilla', 'fina')   +
    (pedido.tort_gruesa     || 0) * precio('tortilla', 'gruesa') +
    (pedido.bollito         || 0) * precio('tortilla', 'bollito')+
    (pedido.cuernito_tomate || 0) * precio('tortilla', 'cuernito_tomate') +
    (pedido.fact_crema      || 0) * precio('factura', 'crema')   +
    (pedido.media_luna      || 0) * precio('factura', 'media_luna') +
    (pedido.sacra_vigilante || 0) * precio('factura', 'sacra_vigilante')
  );
}

function resumenPedido(p) {
  const partes = [];
  if (p.frances_kg      > 0) partes.push(`Francés ${p.frances_kg}kg`);
  if (p.minon_kg        > 0) partes.push(`Miñón ${p.minon_kg}kg`);
  if (p.sanguchero_kg   > 0) partes.push(`Sanguchero ${p.sanguchero_kg}kg`);
  if (p.negro_kg        > 0) partes.push(`Negro ${p.negro_kg}kg`);
  if (p.tort_fina       > 0) partes.push(`T.Fina ×${p.tort_fina}`);
  if (p.tort_gruesa     > 0) partes.push(`T.Gruesa ×${p.tort_gruesa}`);
  if (p.bollito         > 0) partes.push(`Bollito ×${p.bollito}`);
  if (p.cuernito_tomate > 0) partes.push(`C-T ×${p.cuernito_tomate}`);
  if (p.fact_crema      > 0) partes.push(`Crema ×${p.fact_crema}`);
  if (p.media_luna      > 0) partes.push(`M.Luna ×${p.media_luna}`);
  if (p.sacra_vigilante > 0) partes.push(`S-V ×${p.sacra_vigilante}`);
  return partes;
}

function totalKgPan(pedidos) {
  return pedidos.reduce((s, p) => s +
    (Number(p.frances_kg) || 0) + (Number(p.minon_kg) || 0) +
    (Number(p.sanguchero_kg) || 0) + (Number(p.negro_kg) || 0), 0);
}

function totalTortillas(pedidos) {
  return pedidos.reduce((s, p) => s +
    (Number(p.tort_fina) || 0) + (Number(p.tort_gruesa) || 0) +
    (Number(p.bollito) || 0) + (Number(p.cuernito_tomate) || 0), 0);
}

function totalFacturas(pedidos) {
  return pedidos.reduce((s, p) => s +
    (Number(p.fact_crema) || 0) + (Number(p.media_luna) || 0) +
    (Number(p.sacra_vigilante) || 0), 0);
}

// ─── Helpers de render ────────────────────────────────────────────────────────
function renderOfflineBanner(mostrar) {
  let banner = document.getElementById('offline-banner');
  if (mostrar && !banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.textContent = '⚠️ Sin conexión — trabajando con datos guardados';
    document.body.prepend(banner);
  } else if (!mostrar && banner) {
    banner.remove();
  }
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

function productosHTML(pedido) {
  return resumenPedido(pedido)
    .map(t => `<span class="producto-tag">${t}</span>`)
    .join('');
}

function nombreCliente(clienteId) {
  const c = estado.clientes.find(x => x.id === clienteId);
  return c ? c.nombre : clienteId;
}

function grupoCliente(clienteId) {
  const c = estado.clientes.find(x => x.id === clienteId);
  return c ? c.grupo : '';
}

// ─── Pantalla LOGIN ───────────────────────────────────────────────────────────
function renderLogin() {
  document.querySelector('#app').innerHTML = `
    <main>
      <div class="login-screen">
        <h2>🥖 Panadería</h2>
        <p>Seleccioná tu rol para continuar</p>
        <div class="roles-grid">
          <button class="rol-btn" onclick="elegirRol('encargada')">
            <span class="icon">📋</span>
            Encargada
          </button>
          <button class="rol-btn" onclick="elegirRol('embolsador')">
            <span class="icon">📦</span>
            Embolsador
          </button>
          <button class="rol-btn" onclick="elegirRol('repartidor')">
            <span class="icon">🚚</span>
            Repartidor
          </button>
          <button class="rol-btn" onclick="elegirRol('admin')">
            <span class="icon">📊</span>
            Admin
          </button>
        </div>
      </div>
    </main>`;
}

async function elegirRol(rol) {
  let nombre = rol.charAt(0).toUpperCase() + rol.slice(1);

  if (rol === 'embolsador' || rol === 'repartidor') {
    const opciones = rol === 'repartidor'
      ? estado.repartidores.map(r => r.nombre)
      : ['Embolsador 1', 'Embolsador 2', 'Embolsador 3'];

    nombre = await mostrarSelectorNombre(opciones, rol);
    if (!nombre) return;
  }

  estado.rol    = rol;
  estado.nombre = nombre;
  localStorage.setItem('sesion', JSON.stringify({ rol, nombre }));
  renderPantallaPrincipal();
}

function mostrarSelectorNombre(opciones, rol) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,.7);
      display:flex;align-items:center;justify-content:center;z-index:300`;
    modal.innerHTML = `
      <div class="card" style="width:90%;max-width:360px">
        <p style="margin-bottom:16px;font-weight:600">¿Cuál es tu nombre?</p>
        ${opciones.map(o => `
          <button class="btn btn-ghost btn-full" style="margin-bottom:8px;text-align:left"
            onclick="this.closest('[style]').resolve('${o}')">${o}</button>
        `).join('')}
        <button class="btn btn-ghost btn-full" onclick="this.closest('[style]').resolve(null)">
          Cancelar
        </button>
      </div>`;
    modal._resolve = resolve;
    modal.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.textContent === 'Cancelar' ? null : btn.textContent.trim();
        modal.remove();
        resolve(val);
      });
    });
    document.body.append(modal);
  });
}

// ─── Header ───────────────────────────────────────────────────────────────────
function renderHeader(titulo) {
  return `
    <header>
      <h1>${titulo}</h1>
      <span class="rol-badge">${estado.nombre}</span>
      <button class="btn btn-ghost btn-sm" onclick="cerrarSesion()">Salir</button>
    </header>`;
}

function cerrarSesion() {
  localStorage.removeItem('sesion');
  estado.rol = null; estado.nombre = null;
  renderLogin();
}

// ─── Pantalla principal (router) ──────────────────────────────────────────────
async function renderPantallaPrincipal() {
  document.querySelector('#app').innerHTML = `<div class="spinner"></div>`;
  try {
    await cargarDatos();
  } catch {
    cargarDesdeCache();
  }

  switch (estado.rol) {
    case 'encargada':  renderEncargada(); break;
    case 'embolsador': renderEmbolsador(); break;
    case 'repartidor': renderRepartidor(); break;
    case 'admin':      renderAdmin();      break;
  }
}

// ─── PANTALLA ENCARGADA ───────────────────────────────────────────────────────
let encargadaBusqueda = '';
let encargadaFiltroStatus = 'todos';
let pedidoEditando = null;

function renderEncargada() {
  const pedidosFiltrados = estado.pedidos.filter(p =>
    encargadaFiltroStatus === 'todos' || p.status === encargadaFiltroStatus
  );

  const cancelados = estado.pedidos.filter(p => p.status === 'cancelado').length;

  document.querySelector('#app').innerHTML = `
    ${renderHeader('📋 Toma de Pedidos')}
    <main>
      <button class="btn btn-primary btn-full" style="margin-bottom:16px"
        onclick="abrirFormPedido(null)">+ Nuevo Pedido</button>

      ${cancelados > 0 ? `<div class="alerta alerta-warning">
        ⚠️ Hay ${cancelados} pedido(s) cancelado(s) hoy
      </div>` : ''}

      <div class="tabs">
        ${['todos','pendiente','en_proceso','embolsado','cancelado'].map(s => `
          <button class="tab ${encargadaFiltroStatus === s ? 'active' : ''}"
            onclick="filtrarEncargada('${s}')">
            ${s === 'todos' ? 'Todos' : s.replace('_',' ')}
          </button>`).join('')}
      </div>

      ${pedidosFiltrados.length === 0
        ? '<p style="color:var(--text-muted);text-align:center;padding:32px">Sin pedidos</p>'
        : pedidosFiltrados.map(p => tarjetaPedidoEncargada(p)).join('')
      }
    </main>
    ${renderTotalesBar(estado.pedidos.filter(p => p.status !== 'cancelado'))}
    <div id="modal-pedido"></div>`;
}

function filtrarEncargada(status) {
  encargadaFiltroStatus = status;
  renderEncargada();
}

function tarjetaPedidoEncargada(p) {
  const nombre = nombreCliente(p.cliente_id);
  const grupo  = grupoCliente(p.cliente_id);
  const monto  = calcularMonto(p);
  const esCancelado = p.status === 'cancelado';

  return `
    <div class="pedido-card ${p.status}">
      <div class="card-header">
        <div>
          <div class="pedido-cliente">${nombre}</div>
          <div style="font-size:.75rem;color:var(--text-muted)">${grupo} · ${p.hora_pedido ? new Date(p.hora_pedido).toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}) : ''}</div>
        </div>
        ${badge(p.status)}
      </div>
      <div class="pedido-productos">${productosHTML(p)}</div>
      ${p.notas ? `<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">📝 ${p.notas}</div>` : ''}
      ${monto > 0 ? `<div style="font-size:.85rem;color:var(--accent);margin-bottom:8px">💰 $${monto.toFixed(2)}</div>` : ''}
      <div class="pedido-actions">
        ${!esCancelado ? `
          <button class="btn btn-ghost btn-sm" onclick="abrirFormPedido('${p.id}')">✏️ Editar</button>
          <button class="btn btn-danger btn-sm" onclick="confirmarCancelar('${p.id}', '${nombre}')">🚫 Cancelar</button>
        ` : ''}
      </div>
    </div>`;
}

function renderTotalesBar(pedidos) {
  const kgPan      = totalKgPan(pedidos).toFixed(1);
  const tortillas  = totalTortillas(pedidos);
  const facturas   = totalFacturas(pedidos);
  const dinero     = pedidos.reduce((s, p) => s + calcularMonto(p), 0).toFixed(2);

  return `
    <div class="totales-bar">
      <div class="total-item"><div class="val">${kgPan}kg</div><div class="lbl">Pan</div></div>
      <div class="total-item"><div class="val">${tortillas}</div><div class="lbl">Tortillas</div></div>
      <div class="total-item"><div class="val">${facturas}</div><div class="lbl">Facturas</div></div>
      <div class="total-item"><div class="val">$${dinero}</div><div class="lbl">Total</div></div>
    </div>`;
}

// ─── Formulario de pedido ─────────────────────────────────────────────────────
function abrirFormPedido(pedidoId) {
  pedidoEditando = pedidoId ? estado.pedidos.find(p => p.id === pedidoId) : null;
  const v = pedidoEditando || {};
  const clienteSeleccionado = pedidoId ? (estado.clientes.find(c => c.id === v.cliente_id) || {}) : {};

  document.getElementById('modal-pedido').innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.8);overflow-y:auto;z-index:200">
      <div class="card" style="margin:16px;max-width:500px;margin-inline:auto">
        <div class="card-header">
          <span class="card-title">${pedidoId ? 'Editar Pedido' : 'Nuevo Pedido'}</span>
          <button class="btn btn-ghost btn-sm" onclick="cerrarModal()">✕</button>
        </div>

        ${!pedidoId ? `
          <div class="form-group">
            <label>Cliente</label>
            <div class="search-box">
              <input id="buscar-cliente" type="text" placeholder="Buscar cliente..."
                autocomplete="off" oninput="buscarCliente(this.value)">
              <div id="dropdown-clientes" class="dropdown" style="display:none"></div>
            </div>
          </div>
          <input type="hidden" id="cliente-id-sel" value="">
        ` : `<div style="font-weight:700;font-size:1.1rem;margin-bottom:16px">${clienteSeleccionado.nombre || v.cliente_id}</div>`}

        <div class="seccion-titulo">Pan (kg)</div>
        <div class="productos-grid">
          ${campoNum('frances_kg',    'Francés',    v.frances_kg)}
          ${campoNum('minon_kg',      'Miñón',      v.minon_kg)}
          ${campoNum('sanguchero_kg', 'Sanguchero', v.sanguchero_kg)}
          ${campoNum('negro_kg',      'Negro',      v.negro_kg)}
        </div>

        <div class="seccion-titulo">Tortillas (unidades)</div>
        <div class="productos-grid">
          ${campoNum('tort_fina',       'Fina',           v.tort_fina)}
          ${campoNum('tort_gruesa',     'Gruesa',         v.tort_gruesa)}
          ${campoNum('bollito',         'Bollito',        v.bollito)}
          ${campoNum('cuernito_tomate', 'Cuernito-Tomate',v.cuernito_tomate)}
        </div>

        <div class="seccion-titulo">Facturas (unidades)</div>
        <div class="productos-grid">
          ${campoNum('fact_crema',      'Crema',              v.fact_crema)}
          ${campoNum('media_luna',      'Media Luna',         v.media_luna)}
          ${campoNum('sacra_vigilante', 'Sacramento-Vigilante',v.sacra_vigilante)}
        </div>

        <div class="form-group" style="margin-top:16px">
          <label>Notas (opcional)</label>
          <input type="text" id="notas" value="${v.notas || ''}" placeholder="Indicaciones especiales...">
        </div>

        <button class="btn btn-primary btn-full" style="margin-top:8px"
          onclick="guardarPedido(${pedidoId ? `'${pedidoId}'` : 'null'})">
          ${pedidoId ? 'Guardar Cambios' : 'Registrar Pedido'}
        </button>
      </div>
    </div>`;
}

function campoNum(name, label, val) {
  return `
    <div class="form-group">
      <label>${label}</label>
      <input type="number" id="${name}" min="0" step="0.5" value="${val || ''}">
    </div>`;
}

function buscarCliente(query) {
  const dropdown = document.getElementById('dropdown-clientes');
  if (query.length < 1) { dropdown.style.display = 'none'; return; }

  const matches = estado.clientes
    .filter(c => c.nombre.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8);

  if (matches.length === 0) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = matches.map(c => `
    <div class="dropdown-item" onclick="seleccionarCliente('${c.id}', '${c.nombre}')">
      ${c.nombre}
      <div class="grupo">${c.grupo}</div>
    </div>`).join('');
  dropdown.style.display = 'block';
}

function seleccionarCliente(id, nombre) {
  document.getElementById('buscar-cliente').value = nombre;
  document.getElementById('cliente-id-sel').value = id;
  document.getElementById('dropdown-clientes').style.display = 'none';
}

function leerNum(id) {
  const v = parseFloat(document.getElementById(id)?.value);
  return isNaN(v) ? 0 : v;
}

async function guardarPedido(pedidoId) {
  const clienteId = pedidoId
    ? estado.pedidos.find(p => p.id === pedidoId)?.cliente_id
    : document.getElementById('cliente-id-sel')?.value;

  if (!clienteId) { alert('Seleccioná un cliente'); return; }

  const datos = {
    fecha:            estado.fecha,
    cliente_id:       clienteId,
    frances_kg:       leerNum('frances_kg'),
    minon_kg:         leerNum('minon_kg'),
    sanguchero_kg:    leerNum('sanguchero_kg'),
    negro_kg:         leerNum('negro_kg'),
    tort_fina:        leerNum('tort_fina'),
    tort_gruesa:      leerNum('tort_gruesa'),
    bollito:          leerNum('bollito'),
    cuernito_tomate:  leerNum('cuernito_tomate'),
    fact_crema:       leerNum('fact_crema'),
    media_luna:       leerNum('media_luna'),
    sacra_vigilante:  leerNum('sacra_vigilante'),
    notas:            document.getElementById('notas')?.value || '',
  };
  datos.monto_total = calcularMonto(datos);

  try {
    if (pedidoId) {
      await api('actualizar_pedido', { id: pedidoId, ...datos });
    } else {
      await api('crear_pedido', datos);
    }
    cerrarModal();
    await renderPantallaPrincipal();
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  }
}

async function confirmarCancelar(id, nombre) {
  if (!confirm(`¿Cancelar el pedido de ${nombre}?`)) return;
  try {
    await api('cancelar_pedido', { id });
    await renderPantallaPrincipal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

function cerrarModal() {
  document.getElementById('modal-pedido').innerHTML = '';
}

// ─── PANTALLA EMBOLSADOR ──────────────────────────────────────────────────────
function renderEmbolsador() {
  const activos = estado.pedidos.filter(p =>
    p.status === 'pendiente' || p.status === 'en_proceso'
  );
  const cancelados = estado.pedidos.filter(p => p.status === 'cancelado');
  const misTrabajando = activos.filter(p => p.embolsador === estado.nombre);

  document.querySelector('#app').innerHTML = `
    ${renderHeader('📦 Embolsado')}
    <main>
      ${misTrabajando.length > 0 ? `
        <div class="alerta alerta-success">
          Estás trabajando en ${misTrabajando.length} pedido(s)
        </div>` : ''}

      ${cancelados.length > 0 ? `
        <div class="alerta alerta-danger">
          🚫 ${cancelados.length} pedido(s) CANCELADO(S) — NO embolsar
        </div>` : ''}

      ${activos.length === 0
        ? '<p style="color:var(--text-muted);text-align:center;padding:32px">✅ Todos los pedidos embolsados</p>'
        : GRUPOS.map(g => renderGrupoEmbolsador(g, activos)).filter(Boolean).join('')
      }

      ${cancelados.length > 0 ? `
        <div class="seccion-titulo" style="margin-top:24px">🚫 Cancelados (no embolsar)</div>
        ${cancelados.map(p => `
          <div class="pedido-card cancelado">
            <div class="pedido-cliente">${nombreCliente(p.cliente_id)}</div>
            <div style="font-size:.8rem;color:var(--danger)">CANCELADO</div>
          </div>`).join('')}
      ` : ''}
    </main>`;
}

function renderGrupoEmbolsador(grupo, pedidos) {
  const del_grupo = pedidos.filter(p => grupoCliente(p.cliente_id) === grupo);
  if (del_grupo.length === 0) return '';

  return `
    <div class="seccion-titulo">${grupo}</div>
    ${del_grupo.map(p => tarjetaEmbolsador(p)).join('')}`;
}

function tarjetaEmbolsador(p) {
  const nombre   = nombreCliente(p.cliente_id);
  const esElMio  = p.embolsador === estado.nombre;
  const enProceso = p.status === 'en_proceso';

  return `
    <div class="pedido-card ${p.status}" id="ped-${p.id}">
      <div class="card-header">
        <div>
          <div class="pedido-cliente">${nombre}</div>
          ${enProceso ? `<div style="font-size:.75rem;color:#6bb8ff">📦 ${p.embolsador}</div>` : ''}
        </div>
        ${badge(p.status)}
      </div>
      <div class="pedido-productos">${productosHTML(p)}</div>
      ${p.notas ? `<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">📝 ${p.notas}</div>` : ''}
      <div class="pedido-actions">
        ${p.status === 'pendiente' ? `
          <button class="btn btn-primary btn-sm" onclick="tomarPedido('${p.id}')">
            📦 Tomar
          </button>` : ''}
        ${enProceso && esElMio ? `
          <button class="btn btn-success btn-sm" onclick="completarPedido('${p.id}')">
            ✅ Listo
          </button>` : ''}
        ${enProceso && !esElMio ? `
          <span style="font-size:.8rem;color:var(--text-muted)">Lo está haciendo ${p.embolsador}</span>
        ` : ''}
      </div>
    </div>`;
}

async function tomarPedido(id) {
  try {
    await api('actualizar_pedido', {
      id,
      status: 'en_proceso',
      embolsador: estado.nombre,
      hora_embolsado: new Date().toISOString(),
    });
    await renderPantallaPrincipal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function completarPedido(id) {
  try {
    await api('actualizar_pedido', { id, status: 'embolsado' });
    await renderPantallaPrincipal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ─── PANTALLA REPARTIDOR ──────────────────────────────────────────────────────
function renderRepartidor() {
  const rep = estado.repartidores.find(r => r.nombre === estado.nombre);
  const clientesDelRep = estado.clientes.filter(c => c.repartidor_id === rep?.id);
  const idsClientes    = new Set(clientesDelRep.map(c => c.id));

  const misPedidos = estado.pedidos.filter(p =>
    idsClientes.has(p.cliente_id) && p.status !== 'pendiente' && p.status !== 'en_proceso'
  );

  const cancelados   = misPedidos.filter(p => p.status === 'cancelado');
  const aEntregar    = misPedidos.filter(p => p.status === 'embolsado');
  const entregados   = misPedidos.filter(p => p.status === 'entregado');
  const totalCobrar  = aEntregar.reduce((s, p) => s + calcularMonto(p), 0);
  const totalCobrado = entregados.reduce((s, p) => s + calcularMonto(p), 0);

  document.querySelector('#app').innerHTML = `
    ${renderHeader('🚚 Mi Reparto')}
    <main>
      ${cancelados.length > 0 ? `
        <div class="alerta alerta-danger">
          🚫 ${cancelados.length} pedido(s) CANCELADO(S) — no entregar
        </div>` : ''}

      <div class="card">
        <div style="display:flex;gap:24px">
          <div class="total-item">
            <div class="val">${aEntregar.length}</div>
            <div class="lbl">A entregar</div>
          </div>
          <div class="total-item">
            <div class="val">$${totalCobrar.toFixed(2)}</div>
            <div class="lbl">A cobrar</div>
          </div>
          <div class="total-item">
            <div class="val">$${totalCobrado.toFixed(2)}</div>
            <div class="lbl">Cobrado</div>
          </div>
        </div>
      </div>

      ${aEntregar.length === 0
        ? '<p style="color:var(--text-muted);text-align:center;padding:32px">Sin entregas pendientes</p>'
        : aEntregar.map(p => tarjetaRepartidor(p, false)).join('')
      }

      ${entregados.length > 0 ? `
        <div class="seccion-titulo" style="margin-top:16px">✅ Entregados</div>
        ${entregados.map(p => tarjetaRepartidor(p, true)).join('')}
      ` : ''}

      ${cancelados.length > 0 ? `
        <div class="seccion-titulo" style="margin-top:16px">🚫 Cancelados</div>
        ${cancelados.map(p => `
          <div class="pedido-card cancelado">
            <div class="pedido-cliente">${nombreCliente(p.cliente_id)}</div>
            <div style="font-size:.8rem;color:var(--danger)">NO entregar</div>
          </div>`).join('')}
      ` : ''}
    </main>`;
}

function tarjetaRepartidor(p, entregado) {
  const nombre = nombreCliente(p.cliente_id);
  const monto  = calcularMonto(p);

  return `
    <div class="pedido-card ${p.status}">
      <div class="card-header">
        <div>
          <div class="pedido-cliente">${nombre}</div>
          ${monto > 0 ? `<div style="font-size:.9rem;color:var(--accent);margin-top:2px">💰 $${monto.toFixed(2)}</div>` : ''}
        </div>
        ${badge(p.status)}
      </div>
      <div class="pedido-productos">${productosHTML(p)}</div>
      ${p.notas ? `<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:8px">📝 ${p.notas}</div>` : ''}
      ${!entregado ? `
        <button class="btn btn-success btn-sm" onclick="marcarEntregado('${p.id}')">
          ✅ Entregado y cobrado
        </button>` : ''}
    </div>`;
}

async function marcarEntregado(id) {
  try {
    await api('actualizar_pedido', { id, status: 'entregado' });
    await renderPantallaPrincipal();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ─── PANTALLA ADMIN ───────────────────────────────────────────────────────────
function renderAdmin() {
  const activos    = estado.pedidos.filter(p => p.status !== 'cancelado');
  const cancelados = estado.pedidos.filter(p => p.status === 'cancelado');

  const resumenPorRep = estado.repartidores.map(rep => {
    const clientesRep = new Set(estado.clientes.filter(c => c.repartidor_id === rep.id).map(c => c.id));
    const pedidosRep  = activos.filter(p => clientesRep.has(p.cliente_id));
    return {
      nombre:    rep.nombre,
      cantidad:  pedidosRep.length,
      entregados:pedidosRep.filter(p => p.status === 'entregado').length,
      total:     pedidosRep.reduce((s, p) => s + calcularMonto(p), 0),
      cobrado:   pedidosRep.filter(p => p.status === 'entregado').reduce((s, p) => s + calcularMonto(p), 0),
    };
  });

  const totalDia   = activos.reduce((s, p) => s + calcularMonto(p), 0);
  const totalKg    = totalKgPan(activos).toFixed(1);
  const totalTort  = totalTortillas(activos);
  const totalFact  = totalFacturas(activos);

  document.querySelector('#app').innerHTML = `
    ${renderHeader('📊 Panel Admin — ' + estado.fecha)}
    <main>
      <div class="card">
        <div class="card-title" style="margin-bottom:12px">Resumen del día</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="total-item"><div class="val">${activos.length}</div><div class="lbl">Pedidos activos</div></div>
          <div class="total-item"><div class="val">${cancelados.length}</div><div class="lbl">Cancelados</div></div>
          <div class="total-item"><div class="val">${totalKg}kg</div><div class="lbl">Pan</div></div>
          <div class="total-item"><div class="val">${totalTort}</div><div class="lbl">Tortillas</div></div>
          <div class="total-item"><div class="val">${totalFact}</div><div class="lbl">Facturas</div></div>
          <div class="total-item"><div class="val" style="color:var(--accent)">$${totalDia.toFixed(2)}</div><div class="lbl">Total esperado</div></div>
        </div>
      </div>

      <div class="seccion-titulo">Rendición por repartidor</div>
      ${resumenPorRep.map(r => `
        <div class="card">
          <div class="card-header">
            <span class="card-title">🚚 ${r.nombre}</span>
            <span style="color:var(--accent);font-weight:700">$${r.total.toFixed(2)}</span>
          </div>
          <div style="display:flex;gap:16px;font-size:.85rem;color:var(--text-muted)">
            <span>${r.cantidad} pedidos</span>
            <span>✅ ${r.entregados} entregados</span>
            <span>💰 Cobrado: $${r.cobrado.toFixed(2)}</span>
          </div>
        </div>`).join('')}

      <div class="seccion-titulo">Todos los pedidos</div>
      ${estado.pedidos.map(p => `
        <div class="pedido-card ${p.status}">
          <div class="card-header">
            <div>
              <div class="pedido-cliente">${nombreCliente(p.cliente_id)}</div>
              <div style="font-size:.75rem;color:var(--text-muted)">${grupoCliente(p.cliente_id)}</div>
            </div>
            ${badge(p.status)}
          </div>
          <div class="pedido-productos">${productosHTML(p)}</div>
          ${calcularMonto(p) > 0 ? `<div style="font-size:.85rem;color:var(--accent)">$${calcularMonto(p).toFixed(2)}</div>` : ''}
          ${p.status !== 'cancelado' ? `
            <button class="btn btn-danger btn-sm" style="margin-top:8px"
              onclick="confirmarCancelar('${p.id}', '${nombreCliente(p.cliente_id)}')">
              🚫 Cancelar
            </button>` : ''}
        </div>`).join('')}

      <button class="btn btn-ghost btn-full" style="margin-top:16px" onclick="window.print()">
        🖨️ Imprimir lista del día
      </button>
    </main>
    <div id="modal-pedido"></div>`;
}

// ─── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('online',  () => { renderOfflineBanner(false); renderPantallaPrincipal(); });
window.addEventListener('offline', () => renderOfflineBanner(true));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.tipo === 'sync') renderPantallaPrincipal();
  });
}

// Restaurar sesión si existe
const sesionGuardada = localStorage.getItem('sesion');
if (sesionGuardada) {
  const s = JSON.parse(sesionGuardada);
  estado.rol    = s.rol;
  estado.nombre = s.nombre;
  renderPantallaPrincipal();
} else {
  // Precarga de datos para el login
  api('listar_repartidores').then(r => { estado.repartidores = r || []; }).catch(() => {});
  renderLogin();
}

// Exponer funciones globales para los onclick del HTML
Object.assign(window, {
  elegirRol, cerrarSesion, filtrarEncargada,
  abrirFormPedido, cerrarModal, buscarCliente, seleccionarCliente,
  guardarPedido, confirmarCancelar, tomarPedido, completarPedido,
  marcarEntregado,
});
