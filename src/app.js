// ─── Configuración ────────────────────────────────────────────────────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbzUbVdXj1ikznvHOU8o5Hp82uGrT_pVJ6gaxgkms3C2JqCD0-yk6YBzyDnmC9sY9MBmMw/exec';

// ─── Estado global ────────────────────────────────────────────────────────────
let estado = {
  rol: null, nombre: null,
  planillaActiva: 'IONA',
  planillas: [
    { id: 'IONA',     nombre: 'Iona',     tipo: 'panaderia' },
    { id: 'SAN_JUAN', nombre: 'San Juan', tipo: 'panaderia' },
    { id: 'FACTURAS', nombre: 'Facturas', tipo: 'facturas'  },
    { id: 'PASCUAL',  nombre: 'Pascual',  tipo: 'panaderia' },
  ],
  clientes: [], repartidores: [], embolsadores: [], precios: [], pedidos: [],
  devoluciones: [],
  offline: false,
};
let filtroColumnas = 'ambos'; // 'pan' | 'tortillas' | 'ambos'
let moveMode = { active: false, fromIdx: null };

// Cargar planillas personalizadas creadas por el admin
JSON.parse(localStorage.getItem('planillas_custom') || '[]').forEach(p => {
  if (!estado.planillas.some(x => x.id === p.id)) estado.planillas.push(p);
});
// Aplicar renombres guardados
const _nombresOvr = JSON.parse(localStorage.getItem('planillas_nombres') || '{}');
estado.planillas.forEach(p => { if (_nombresOvr[p.id]) p.nombre = _nombresOvr[p.id]; });

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(accion, datos = {}) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST', body: JSON.stringify({ accion, ...datos }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error);
    return json.data;
  } catch (err) {
    if (!navigator.onLine) { estado.offline = true; renderOfflineBanner(true); }
    throw err;
  }
}

async function cargarDatos() {
  const [clientes, repartidores, embolsadores, precios, pedidos, devoluciones] = await Promise.all([
    api('listar_clientes'), api('listar_repartidores'),
    api('listar_embolsadores').catch(() => []),
    api('listar_precios'),  api('listar_pedidos'),
    api('listar_devoluciones').catch(() => []),
  ]);
  estado.clientes      = clientes      || [];
  estado.repartidores  = repartidores  || [];
  estado.embolsadores  = embolsadores  || [];
  estado.precios       = precios       || [];
  estado.pedidos       = pedidos       || [];
  estado.devoluciones  = devoluciones  || [];
  localStorage.setItem('cache_clientes',     JSON.stringify(estado.clientes));
  localStorage.setItem('cache_pedidos',      JSON.stringify(estado.pedidos));
  localStorage.setItem('cache_devoluciones', JSON.stringify(estado.devoluciones));
}

function cargarDesdeCache() {
  estado.clientes     = JSON.parse(localStorage.getItem('cache_clientes')     || '[]');
  estado.pedidos      = JSON.parse(localStorage.getItem('cache_pedidos')      || '[]');
  estado.devoluciones = JSON.parse(localStorage.getItem('cache_devoluciones') || '[]');
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────
function n(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x; }
function kgPan(p)       { return n(p.frances_kg)+n(p.minon_kg)+n(p.sanguchero_kg)+n(p.negro_kg); }
function totTortillas(p){ return n(p.tort_fina)+n(p.tort_gruesa)+n(p.bollito)+n(p.cuernito_tomate); }
function totFacturas(p) { return n(p.fact_crema)+n(p.media_luna)+n(p.sacra_vigilante); }
function calcularMonto(p) {
  const pr = (prod, tipo) => { const x = estado.precios.find(r=>r.producto===prod&&r.tipo===tipo); return x?n(x.precio_unitario):0; };
  return n(p.frances_kg)*pr('pan','frances')+n(p.minon_kg)*pr('pan','minon')+
         n(p.sanguchero_kg)*pr('pan','sanguchero')+n(p.negro_kg)*pr('pan','negro')+
         n(p.tort_fina)*pr('tortilla','fina')+n(p.tort_gruesa)*pr('tortilla','gruesa')+
         n(p.bollito)*pr('tortilla','bollito')+n(p.cuernito_tomate)*pr('tortilla','cuernito_tomate')+
         n(p.fact_crema)*pr('factura','crema')+n(p.media_luna)*pr('factura','media_luna')+
         n(p.sacra_vigilante)*pr('factura','sacra_vigilante');
}

function displayNum(v) { const x = n(v); return x > 0 ? x % 1 === 0 ? String(x) : x.toFixed(1) : ''; }
function formatHora(s)  { if (!s) return ''; const d = new Date(s); return isNaN(d)?s.slice(11,16):d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}); }

// ─── Helpers de render ────────────────────────────────────────────────────────
function renderOfflineBanner(on) {
  let b = document.getElementById('offline-banner');
  if (on && !b) { b=document.createElement('div'); b.id='offline-banner'; b.className='offline-banner'; b.textContent='⚠️ Sin conexión'; document.body.prepend(b); }
  else if (!on && b) b.remove();
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function renderLogin() {
  document.querySelector('#app').innerHTML = `
    <main>
      <div class="login-screen">
        <h2>🥖 Panadería</h2>
        <p>Seleccioná tu rol</p>
        <div class="roles-grid">
          <button class="rol-btn" onclick="elegirRol('encargada')"><span class="icon">📋</span>Encargada</button>
          <button class="rol-btn" onclick="elegirRol('embolsador')"><span class="icon">📦</span>Embolsador</button>
          <button class="rol-btn" onclick="elegirRol('repartidor')"><span class="icon">🚚</span>Repartidor</button>
          <button class="rol-btn" onclick="elegirRol('admin')"><span class="icon">📊</span>Admin</button>
        </div>
      </div>
    </main>`;
}

async function elegirRol(rol) {
  let nombre = rol.charAt(0).toUpperCase() + rol.slice(1);
  if (rol === 'embolsador') {
    const ops = estado.embolsadores.length ? estado.embolsadores.map(e=>e.nombre) : ['Embolsador 1','Embolsador 2'];
    nombre = await mostrarSelector(ops);
    if (!nombre) return;
  } else if (rol === 'repartidor') {
    const ops = estado.repartidores.length ? estado.repartidores.map(r=>r.nombre) : ['Repartidor 1','Repartidor 2'];
    nombre = await mostrarSelector(ops);
    if (!nombre) return;
  }
  estado.rol = rol; estado.nombre = nombre;
  localStorage.setItem('sesion', JSON.stringify({ rol, nombre }));
  renderPantallaPrincipal();
}

function mostrarSelector(opciones) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:500';
    modal.innerHTML = `<div class="card" style="width:90%;max-width:320px">
      <p style="font-weight:600;margin-bottom:12px">¿Cuál es tu nombre?</p>
      ${opciones.map(o=>`<button class="btn btn-ghost btn-full" style="margin-bottom:8px" data-v="${o}">${o}</button>`).join('')}
      <button class="btn btn-ghost btn-full" data-v="">Cancelar</button>
    </div>`;
    modal.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { modal.remove(); resolve(b.dataset.v || null); }));
    document.body.append(modal);
  });
}

function cerrarSesion() {
  localStorage.removeItem('sesion');
  estado.rol = null; estado.nombre = null;
  renderLogin();
}

// ─── ROUTER ───────────────────────────────────────────────────────────────────
async function renderPantallaPrincipal() {
  document.querySelector('#app').innerHTML = '<div class="spinner"></div>';
  try { await cargarDatos(); } catch { cargarDesdeCache(); }
  renderPlanilla();
}

function setFiltro(f) { filtroColumnas = f; renderPlanilla(); }

function setPlanilla(grupo) {
  estado.planillaActiva = grupo;
  filtroColumnas = 'ambos';
  const s = JSON.parse(localStorage.getItem('sesion') || '{}');
  localStorage.setItem('sesion', JSON.stringify({ ...s, planillaActiva: grupo }));
  renderPlanilla();
}

// ─── PLANILLA ─────────────────────────────────────────────────────────────────
function clientesDePlanilla() {
  return estado.clientes
    .filter(c => c.grupo === estado.planillaActiva)
    .sort((a, b) => (n(a.orden) || 999) - (n(b.orden) || 999));
}
function pedidoDeCliente(cid) { return estado.pedidos.find(p => p.cliente_id === cid) || null; }

function renderPlanilla() {
  const clientes    = clientesDePlanilla();
  const cidsActivos = new Set(clientes.map(c => c.id));
  const esEnc       = estado.rol === 'encargada';
  const esEmb     = estado.rol === 'embolsador';
  const esRep     = estado.rol === 'repartidor';
  const esAdmin   = estado.rol === 'admin';

  const tipo      = (estado.planillas.find(p=>p.id===estado.planillaActiva)||{}).tipo || 'panaderia';
  const esFact    = tipo === 'facturas';
  const showPan   = !esFact && filtroColumnas !== 'tortillas';
  const showTort  = !esFact && filtroColumnas !== 'pan';

  // Totales de la planilla
  const activos = estado.pedidos.filter(p => p.status !== 'cancelado' && cidsActivos.has(p.cliente_id));
  const tots = {
    kg:   activos.reduce((s,p)=>s+kgPan(p),0),
    fran: activos.reduce((s,p)=>s+n(p.frances_kg),0),
    min:  activos.reduce((s,p)=>s+n(p.minon_kg),0),
    san:  activos.reduce((s,p)=>s+n(p.sanguchero_kg),0),
    neg:  activos.reduce((s,p)=>s+n(p.negro_kg),0),
    f:    activos.reduce((s,p)=>s+n(p.tort_fina),0),
    g:    activos.reduce((s,p)=>s+n(p.tort_gruesa),0),
    b:    activos.reduce((s,p)=>s+n(p.bollito),0),
    ct:   activos.reduce((s,p)=>s+n(p.cuernito_tomate),0),
    tort: activos.reduce((s,p)=>s+totTortillas(p),0),
  };
  const totsF = {
    crema:  activos.reduce((s,p)=>s+n(p.fact_crema),0),
    medlun: activos.reduce((s,p)=>s+n(p.media_luna),0),
    sacrvg: activos.reduce((s,p)=>s+n(p.sacra_vigilante),0),
    total:  activos.reduce((s,p)=>s+totFacturas(p),0),
  };

  const cancelados    = estado.pedidos.filter(p=>p.status==='cancelado'&&cidsActivos.has(p.cliente_id)).length;
  const devNoRevisadas = estado.devoluciones.filter(d=>(d.revisado==='no'||d.revisado===false)&&cidsActivos.has(d.cliente_id)).length;

  document.querySelector('#app').innerHTML = `
    <div id="app-inner">
      <header>
        <h1>${(estado.planillas.find(p=>p.id===estado.planillaActiva)||{nombre:estado.planillaActiva}).nombre}</h1>
        ${!esFact ? `<div class="toggle-filtro">
          <button class="${filtroColumnas==='pan'?'active':''}" onclick="setFiltro('pan')">Pan</button>
          <button class="${filtroColumnas==='tortillas'?'active':''}" onclick="setFiltro('tortillas')">Tort.</button>
          <button class="${filtroColumnas==='ambos'?'active':''}" onclick="setFiltro('ambos')">Todo</button>
        </div>` : ''}
        ${(esEnc||esAdmin) ? `<button class="btn-icon" title="Gestionar personal" onclick="abrirModalPersonal()">👥</button>` : ''}
        ${esAdmin ? `<button class="btn-icon" title="PDF" onclick="exportarPDF()">📄</button>` : ''}
        ${esAdmin ? `<button class="btn-icon" title="Excel" onclick="exportarExcel()">📊</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="cerrarSesion()">Salir</button>
      </header>

      <div class="planilla-tabs-bar">
        ${estado.planillas.map(p=>`<button class="planilla-tab${p.id===estado.planillaActiva?' active':''}" onclick="setPlanilla('${p.id}')">${p.nombre}</button>`).join('')}
        ${esAdmin ? `<button class="planilla-tab planilla-tab-gear" onclick="abrirModalGestionPlanillas()" title="Gestionar planillas">⚙️</button>` : ''}
      </div>
      ${devNoRevisadas>0 && (esEnc||esAdmin) ? `<div class="alerta alerta-devolucion" style="margin:6px 8px 0;cursor:pointer" onclick="abrirNotificacionesDevoluciones()">↩ ${devNoRevisadas} devolución(es) sin revisar — <span style="text-decoration:underline;font-size:.85em">ver</span></div>` : ''}
      ${cancelados>0 ? `<div class="alerta alerta-danger" style="margin:6px 8px 0">🚫 ${cancelados} pedido(s) cancelado(s)</div>` : ''}
      <div class="rol-badge-bar">👤 ${estado.nombre}</div>

      <div class="planilla-scroll">
        <table class="planilla" id="planilla-tabla">
          <thead><tr>
            <th class="th-drag">#</th>
            <th class="th-cliente sticky-col">Cliente</th>
            ${esFact ? `
              <th class="th-num">Crema</th>
              <th class="th-num">Med-Luna</th>
              <th class="th-num">Sacr-Vig</th>
              <th class="th-num">Total</th>
            ` : `
              ${showPan ? `
                <th class="th-num">Kg</th>
                <th class="th-num">Fra</th>
                <th class="th-num">Miñ</th>
                <th class="th-num">San</th>
                <th class="th-num">Neg</th>
              ` : ''}
              ${showTort ? `
                <th class="th-num">F</th>
                <th class="th-num">G</th>
                <th class="th-num">B</th>
                <th class="th-num">C-T</th>
                <th class="th-num">Tot</th>
              ` : ''}
            `}
            <th class="th-estado">Estado</th>
          </tr></thead>
          <tbody id="planilla-body">
            ${clientes.map((c, i) => renderFila(c, pedidoDeCliente(c.id), i, showPan, showTort)).join('')}
          </tbody>
          <tfoot><tr class="fila-total">
            <td></td>
            <td class="sticky-col" style="font-weight:700;font-size:.75rem">TOTAL</td>
            ${esFact ? `
              <td>${displayNum(totsF.crema)}</td>
              <td>${displayNum(totsF.medlun)}</td>
              <td>${displayNum(totsF.sacrvg)}</td>
              <td>${displayNum(totsF.total)}</td>
            ` : `
              ${showPan ? `
                <td>${displayNum(tots.kg)}</td>
                <td>${displayNum(tots.fran)}</td>
                <td>${displayNum(tots.min)}</td>
                <td>${displayNum(tots.san)}</td>
                <td>${displayNum(tots.neg)}</td>
              ` : ''}
              ${showTort ? `
                <td>${tots.f||''}</td>
                <td>${tots.g||''}</td>
                <td>${tots.b||''}</td>
                <td>${tots.ct||''}</td>
                <td>${tots.tort||''}</td>
              ` : ''}
            `}
            <td></td>
          </tr></tfoot>
        </table>
      </div>

      ${(esEnc||esAdmin) ? `
        <div class="planilla-bottom-bar">
          ${esEnc ? `<button class="btn btn-primary" onclick="abrirModalCliente(null)">+ Cliente</button>` : ''}
          <button class="btn btn-danger" onclick="cerrarDia()">🔒 Cerrar Día</button>
        </div>
      ` : ''}
    </div>
    <div id="modal-container"></div>`;

  if (esEnc) initDragAndDrop();
}

function renderFila(cliente, pedido, idx, showPan, showTort) {
  const esEnc  = estado.rol === 'encargada';
  const esEmb  = estado.rol === 'embolsador';
  const esRep  = estado.rol === 'repartidor';
  const esFact = ((estado.planillas.find(p=>p.id===estado.planillaActiva)||{}).tipo||'panaderia') === 'facturas';
  const st     = pedido ? pedido.status : 'sin_pedido';
  const cid    = cliente.id;

  function tdEdit(campo, val) {
    const v = displayNum(val);
    if (esEnc) return `<td class="td-edit" data-cid="${cid}" data-campo="${campo}" onclick="activarEdicion(this)">${v}</td>`;
    return `<td class="td-num">${v}</td>`;
  }

  // Estado + acciones
  let estadoCell = '';
  if (st === 'sin_pedido') {
    estadoCell = '<span class="badge badge-sin_pedido">—</span>';
  } else if (st === 'pendiente') {
    estadoCell = '<span class="badge badge-pendiente">Pendiente</span>';
    if (esEmb) estadoCell += ` <button class="btn-xs btn-primary" onclick="tomarPedido('${pedido.id}')">Tomar</button>`;
    if (esEnc) estadoCell += ` <button class="btn-xs btn-ghost" onclick="cancelarPedidoFila('${pedido.id}','${cliente.nombre}')">✕</button>`;
  } else if (st === 'en_proceso') {
    estadoCell = `<span class="badge badge-en_proceso">📦 ${pedido.embolsador||''}</span>`;
    if (esEmb && pedido.embolsador === estado.nombre)
      estadoCell += ` <button class="btn-xs btn-success" onclick="completarPedido('${pedido.id}')">Listo</button>`;
    if (esEnc) estadoCell += ` <button class="btn-xs btn-ghost" onclick="cancelarPedidoFila('${pedido.id}','${cliente.nombre}')">✕</button>`;
  } else if (st === 'embolsado') {
    estadoCell = `<span class="badge badge-embolsado">✅ ${pedido.embolsador||''}</span>`;
    if (esRep) estadoCell += ` <button class="btn-xs btn-success" onclick="marcarEntregado('${pedido.id}')">Entregado</button>`;
    if (esRep || esEnc) estadoCell += ` <button class="btn-xs btn-devolucion" onclick="abrirModalDevolucion('${pedido.id}')">↩</button>`;
  } else if (st === 'entregado') {
    const devs = estado.devoluciones.filter(d=>d.pedido_id===pedido.id);
    estadoCell = `<span class="badge badge-entregado">🚚 ${pedido.repartidor_entrega||''}</span>`;
    if (devs.length) estadoCell += ` <span class="badge badge-devolucion">↩${devs.length}</span>`;
    if (esRep || esEnc) estadoCell += ` <button class="btn-xs btn-devolucion" onclick="abrirModalDevolucion('${pedido.id}')">↩</button>`;
  } else if (st === 'cancelado') {
    estadoCell = '<span class="badge badge-cancelado">Cancelado</span>';
  }

  const rowClass = ['planilla-fila',
    st === 'cancelado'  ? 'fila-cancelada'  : '',
    st === 'embolsado'  ? 'fila-embolsada'  : '',
    st === 'en_proceso' ? 'fila-en-proceso' : '',
    st === 'entregado'  ? 'fila-entregada'  : '',
  ].join(' ');

  const p = pedido || {};
  return `
    <tr class="${rowClass}" data-idx="${idx}" data-cid="${cid}">
      <td class="td-drag ${esEnc?'td-drag-enc':''}" data-idx="${idx}" ${esEnc?`onclick="tapMover(${idx})"`:''}>${idx+1}${esEnc?'<br><span style="font-size:.6rem;opacity:.6">✥</span>':''}</td>
      <td class="td-cliente sticky-col">${cliente.nombre}</td>
      ${esFact ? `
        ${tdEdit('fact_crema',      p.fact_crema)}
        ${tdEdit('media_luna',      p.media_luna)}
        ${tdEdit('sacra_vigilante', p.sacra_vigilante)}
        <td class="td-num">${pedido ? displayNum(totFacturas(p)) : ''}</td>
      ` : `
        ${showPan ? `
          <td class="td-kg">${pedido ? displayNum(kgPan(p)) : ''}</td>
          ${tdEdit('frances_kg',    p.frances_kg)}
          ${tdEdit('minon_kg',      p.minon_kg)}
          ${tdEdit('sanguchero_kg', p.sanguchero_kg)}
          ${tdEdit('negro_kg',      p.negro_kg)}
        ` : ''}
        ${showTort ? `
          ${tdEdit('tort_fina',       p.tort_fina)}
          ${tdEdit('tort_gruesa',     p.tort_gruesa)}
          ${tdEdit('bollito',         p.bollito)}
          ${tdEdit('cuernito_tomate', p.cuernito_tomate)}
          <td class="td-num">${pedido ? displayNum(totTortillas(p)) : ''}</td>
        ` : ''}
      `}
      <td class="td-estado">${estadoCell}</td>
    </tr>`;
}

// ─── Edición inline (encargada) ───────────────────────────────────────────────
function activarEdicion(td) {
  if (td.querySelector('input')) return;
  const val = td.textContent.trim();
  td.innerHTML = `<input type="number" min="0" step="0.5" value="${val}" style="width:3rem;text-align:center;background:var(--card);color:var(--text);border:1px solid var(--accent);border-radius:4px;padding:2px 4px">`;
  const input = td.querySelector('input');
  input.focus(); input.select();
  input.addEventListener('blur',  () => guardarCelda(td, input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { td.textContent = val; } });
}

async function guardarCelda(td, nuevoVal) {
  const cid   = td.dataset.cid;
  const campo = td.dataset.campo;
  const valor = parseFloat(nuevoVal) || 0;
  td.textContent = displayNum(valor);

  const pedido  = pedidoDeCliente(cid);
  const cliente = estado.clientes.find(c => c.id === cid);
  const hora    = new Date().toISOString();

  try {
    if (pedido) {
      await api('actualizar_pedido', { id: pedido.id, [campo]: valor });
      pedido[campo] = valor;
    } else {
      const datos = {
        fecha: new Date().toISOString().slice(0, 10),
        cliente_id: cid,
        grupo: estado.planillaActiva,
        frances_kg: 0, minon_kg: 0, sanguchero_kg: 0, negro_kg: 0,
        tort_fina: 0, tort_gruesa: 0, bollito: 0, cuernito_tomate: 0,
        fact_crema: 0, media_luna: 0, sacra_vigilante: 0,
        monto_total: 0, notas: '',
        tomado_por: estado.nombre, hora_tomado: hora,
        [campo]: valor,
      };
      const res = await api('crear_pedido', datos);
      estado.pedidos.push({ id: res.id, cliente_id: cid, status: 'pendiente', ...datos });
    }
    // Actualizar celdas derivadas (Kg total, Tot tortillas) en la misma fila
    actualizarCeldasDerivadas(td.closest('tr'), pedidoDeCliente(cid) || { [campo]: valor });
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  }
}

function actualizarCeldasDerivadas(tr, pedido) {
  const tdKg = tr.querySelector('.td-kg');
  if (tdKg) tdKg.textContent = displayNum(kgPan(pedido));
  const tds = [...tr.querySelectorAll('td')];
  const last = tds[tds.length - 2]; // columna Tot tortillas (antes de Estado)
  // Recalcular Kg y Tot en base a los inputs actuales de la fila
  const vals = {};
  tr.querySelectorAll('.td-edit').forEach(td => { vals[td.dataset.campo] = n(td.textContent); });
  if (tdKg) tdKg.textContent = displayNum(kgPan(vals));
}

// ─── Embolsador ───────────────────────────────────────────────────────────────
async function tomarPedido(id) {
  try {
    await api('actualizar_pedido', {
      id, status: 'en_proceso',
      expected_status: 'pendiente', // falla si ya fue tomado por otro
      embolsador: estado.nombre,
      hora_embolsado: new Date().toISOString(),
    });
    await renderPantallaPrincipal();
  } catch (err) {
    if (err.message.includes('ya fue tomado') || err.message.includes('expected_status')) {
      alert('⚠️ Este pedido ya fue tomado por otro embolsador.');
    } else {
      alert('Error: ' + err.message);
    }
    await renderPantallaPrincipal();
  }
}

async function completarPedido(id) {
  try {
    await api('actualizar_pedido', { id, status: 'embolsado' });
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Repartidor ───────────────────────────────────────────────────────────────
async function marcarEntregado(id) {
  try {
    await api('actualizar_pedido', { id, status: 'entregado', repartidor_entrega: estado.nombre, hora_entrega: new Date().toISOString() });
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Encargada: cancelar y clientes ──────────────────────────────────────────
async function cancelarPedidoFila(id, nombre) {
  if (!confirm(`¿Cancelar pedido de ${nombre}?`)) return;
  try {
    await api('cancelar_pedido', { id });
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

function abrirModalCliente(clienteId) {
  const c = clienteId ? estado.clientes.find(x => x.id === clienteId) : null;
  const modal = document.createElement('div');
  modal.id = 'modal-cliente';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:flex-start;justify-content:center;z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:700;color:var(--accent)">${c ? 'Editar Cliente' : 'Nuevo Cliente'}</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-cliente').remove()">✕</button>
      </div>
      <div class="form-group">
        <label>Nombre *</label>
        <input id="mc-nombre" type="text" value="${c?.nombre||''}" placeholder="Nombre o alias del cliente">
      </div>
      <div class="form-group">
        <label>WhatsApp</label>
        <input id="mc-tel" type="tel" value="${c?.telefono||''}" placeholder="Ej: 3516001234">
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <input id="mc-dir" type="text" value="${c?.direccion||''}" placeholder="Calle y número">
      </div>
      <div class="form-group">
        <label>GPS (link Google Maps o coordenadas)</label>
        <input id="mc-gps" type="text" value="${c?.gps||''}" placeholder="https://maps.google.com/...">
      </div>
      <div class="form-group">
        <label>Planilla</label>
        <select id="mc-planilla" style="width:100%;background:var(--card);border:1px solid #2a4a6a;border-radius:8px;padding:9px 12px;color:var(--text);font-size:.9rem">
          ${estado.planillas.map(p=>`<option value="${p.id}" ${(c?.grupo||estado.planillaActiva)===p.id?'selected':''}>${p.nombre}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick="guardarCliente('${c?.id||''}')">Guardar</button>
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
}

async function guardarCliente(id) {
  const nombre = document.getElementById('mc-nombre').value.trim();
  if (!nombre) { alert('Ingresá el nombre'); return; }
  const datos = {
    id:           id || undefined,
    nombre,
    grupo:        document.getElementById('mc-planilla')?.value || estado.planillaActiva,
    retira_local: false,
    telefono:     document.getElementById('mc-tel')?.value.trim() || '',
    direccion:    document.getElementById('mc-dir')?.value.trim() || '',
    gps:          document.getElementById('mc-gps')?.value.trim() || '',
  };
  try {
    await api('guardar_cliente', datos);
    document.getElementById('modal-container').innerHTML = '';
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Reordenar por tap (solo encargada) ───────────────────────────────────────
function initDragAndDrop() { /* no-op, replaced by tapMover */ }

function tapMover(idx) {
  if (!moveMode.active) {
    // Primer tap: seleccionar fila origen
    moveMode = { active: true, fromIdx: idx };
    document.querySelectorAll('tr[data-idx]').forEach(tr => tr.classList.remove('move-source','move-target'));
    document.querySelector(`tr[data-idx="${idx}"]`)?.classList.add('move-source');
    // Resaltar todas las demás como destino posible
    document.querySelectorAll(`tr[data-idx]:not([data-idx="${idx}"])`).forEach(tr => tr.classList.add('move-target'));
    return;
  }
  if (moveMode.fromIdx === idx) {
    // Tap en la misma fila: cancelar
    cancelarMover();
    return;
  }
  // Segundo tap: confirmar movimiento
  const from = moveMode.fromIdx;
  cancelarMover();
  confirmarReorden(from, idx);
}

function cancelarMover() {
  moveMode = { active: false, fromIdx: null };
  document.querySelectorAll('tr[data-idx]').forEach(tr => tr.classList.remove('move-source','move-target'));
}

async function confirmarReorden(fromIdx, toIdx) {
  const clientes = clientesDePlanilla();
  const from = clientes[fromIdx];
  const to   = clientes[toIdx];
  if (!from || !to) return;
  if (!confirm(`¿Mover "${from.nombre}" ${fromIdx < toIdx ? 'después' : 'antes'} de "${to.nombre}"?`)) return;

  // Reordenar array
  const arr = [...clientes];
  const [moved] = arr.splice(fromIdx, 1);
  arr.splice(toIdx, 0, moved);

  // Asignar nuevos valores de orden
  const actualizados = arr.map((c, i) => ({ id: c.id, orden: i + 1 }));
  try {
    await api('reordenar_clientes', { clientes: actualizados });
    // Actualizar estado local
    actualizados.forEach(({ id, orden }) => {
      const c = estado.clientes.find(x => x.id === id);
      if (c) c.orden = orden;
    });
    renderPlanilla();
  } catch (err) { alert('Error al reordenar: ' + err.message); }
}

// ─── Exportar ─────────────────────────────────────────────────────────────────
function exportarPDF() {
  window.print();
}

function exportarExcel() {
  const clientes = clientesDePlanilla();
  const tipo     = (estado.planillas.find(p=>p.id===estado.planillaActiva)||{}).tipo || 'panaderia';
  const cids     = new Set(clientes.map(c=>c.id));
  const activos  = estado.pedidos.filter(p=>p.status!=='cancelado'&&cids.has(p.cliente_id));

  let headers, filas;

  if (tipo === 'facturas') {
    headers = ['Cliente','Crema','Media Luna','Sacra-Vigilante','Total Facturas','Estado'];
    filas = clientes.map(c => {
      const p = pedidoDeCliente(c.id) || {};
      return [
        c.nombre,
        displayNum(p.fact_crema), displayNum(p.media_luna), displayNum(p.sacra_vigilante),
        displayNum(totFacturas(p)),
        p.status || '—',
      ].map(v => String(v));
    });
    filas.push([
      'TOTAL',
      displayNum(activos.reduce((s,p)=>s+n(p.fact_crema),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.media_luna),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.sacra_vigilante),0)),
      displayNum(activos.reduce((s,p)=>s+totFacturas(p),0)),
      '',
    ]);
  } else {
    headers = ['Cliente','Kg Pan','Francés','Miñón','Sanguchero','Negro','Tort.Fina','Tort.Gruesa','Bollito','Cuernito-Tomate','Total Tort.','Estado','Embolsador','Repartidor'];
    filas = clientes.map(c => {
      const p = pedidoDeCliente(c.id) || {};
      return [
        c.nombre,
        displayNum(kgPan(p)),
        displayNum(p.frances_kg), displayNum(p.minon_kg),
        displayNum(p.sanguchero_kg), displayNum(p.negro_kg),
        displayNum(p.tort_fina), displayNum(p.tort_gruesa),
        displayNum(p.bollito), displayNum(p.cuernito_tomate),
        displayNum(totTortillas(p)),
        p.status || '—',
        p.embolsador || '', p.repartidor_entrega || '',
      ].map(v => String(v));
    });
    filas.push([
      'TOTAL',
      displayNum(activos.reduce((s,p)=>s+kgPan(p),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.frances_kg),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.minon_kg),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.sanguchero_kg),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.negro_kg),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.tort_fina),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.tort_gruesa),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.bollito),0)),
      displayNum(activos.reduce((s,p)=>s+n(p.cuernito_tomate),0)),
      displayNum(activos.reduce((s,p)=>s+totTortillas(p),0)),
      '', '', '',
    ]);
  }

  const csv = '﻿' + [headers, ...filas].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `planilla_${estado.planillaActiva}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Cerrar día ───────────────────────────────────────────────────────────────
async function cerrarDia() {
  const clientes = clientesDePlanilla();
  if (!clientes.length) { alert('No hay clientes en la planilla'); return; }

  const modal = document.createElement('div');
  modal.id = 'modal-cierre';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div class="card" style="max-width:480px;margin:0 auto">
      <h2 style="color:var(--accent);margin-bottom:4px">Cerrar Día — ${(estado.planillas.find(p=>p.id===estado.planillaActiva)||{nombre:estado.planillaActiva}).nombre}</h2>
      <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:12px">
        Elegí qué clientes mantener para mañana.
      </p>
      ${estado.rol === 'admin' ? `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-ghost" style="flex:1" onclick="exportarExcel()">📊 Excel</button>
        <button class="btn btn-ghost" style="flex:1" onclick="exportarPDFSinModal()">📄 PDF</button>
      </div>` : ''}
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:8px">Clientes para mañana:</p>
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <button class="btn btn-ghost btn-sm" onclick="toggleTodos(true)">Marcar todos</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleTodos(false)">Desmarcar todos</button>
      </div>
      <div id="lista-mantener" style="max-height:40vh;overflow-y:auto">
        ${clientes.map(c => {
          const p = pedidoDeCliente(c.id);
          const resumen = p ? `${displayNum(kgPan(p))}kg pan` + (totTortillas(p) > 0 ? ` · ${totTortillas(p)} tort.` : '') : 'Sin pedido';
          return `
            <label style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--card);cursor:pointer">
              <input type="checkbox" data-cid="${c.id}" ${p?'checked':''} style="width:18px;height:18px">
              <span style="flex:1">${c.nombre}</span>
              <span style="font-size:.78rem;color:var(--text-muted)">${resumen}</span>
            </label>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-ghost" style="flex:1" onclick="cerrarModalCierre()">Cancelar (Esc)</button>
        <button class="btn btn-danger" style="flex:1" onclick="confirmarCierreDia()">Limpiar lista</button>
      </div>
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);

  // Escape para cerrar
  const onEsc = e => { if (e.key === 'Escape') { cerrarModalCierre(); document.removeEventListener('keydown', onEsc); } };
  document.addEventListener('keydown', onEsc);
}

function cerrarModalCierre() {
  document.getElementById('modal-cierre')?.remove();
}

function exportarPDFSinModal() {
  // Ocultar modal temporalmente para imprimir la planilla limpia
  const modal = document.getElementById('modal-cierre');
  if (modal) modal.style.display = 'none';
  window.print();
  if (modal) modal.style.display = '';
}

function toggleTodos(val) {
  document.querySelectorAll('#lista-mantener input[type=checkbox]').forEach(cb => cb.checked = val);
}

async function confirmarCierreDia() {
  const mantener = [...document.querySelectorAll('#lista-mantener input:checked')].map(cb => cb.dataset.cid);
  if (!confirm(`¿Confirmar cierre del día?\n${mantener.length} cliente(s) se mantendrán para mañana.`)) return;

  try {
    await api('cerrar_dia', { mantener_ids: mantener, grupo: estado.planillaActiva });
    document.getElementById('modal-container').innerHTML = '';
    alert('✅ Día cerrado.');
    await renderPantallaPrincipal();
  } catch (err) { alert('Error al cerrar: ' + err.message); }
}

// ─── Gestionar Personal ───────────────────────────────────────────────────────
function abrirModalPersonal() {
  renderModalPersonal('embolsadores');
}

function renderModalPersonal(tab) {
  const esEmb = tab === 'embolsadores';
  const lista = esEmb ? estado.embolsadores : estado.repartidores;
  const accionGuardar   = esEmb ? 'guardar_embolsador'  : 'guardar_repartidor';
  const accionEliminar  = esEmb ? 'eliminar_embolsador' : 'eliminar_repartidor';
  const listaKey        = esEmb ? 'embolsadores'        : 'repartidores';

  const modal = document.createElement('div');
  modal.id = 'modal-personal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto';
  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:400px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-weight:700;color:var(--accent)">👥 Personal</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-personal').remove()">✕</button>
      </div>
      <div class="tabs" style="margin-bottom:14px">
        <button class="tab ${esEmb?'active':''}" onclick="renderModalPersonal('embolsadores')">Embolsadores</button>
        <button class="tab ${!esEmb?'active':''}" onclick="renderModalPersonal('repartidores')">Repartidores</button>
      </div>
      <div id="lista-personal">
        ${lista.map(p => `
          <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--card)">
            <span style="flex:1">${p.nombre}</span>
            <button class="btn-xs btn-ghost" onclick="editarPersonal('${p.id}','${p.nombre}','${tab}')">✏️</button>
            <button class="btn-xs btn-danger" onclick="eliminarPersonal('${p.id}','${p.nombre}','${tab}')">🗑</button>
          </div>`).join('') || '<p style="color:var(--text-muted);font-size:.85rem;padding:8px 0">Sin registros</p>'}
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <input id="nuevo-personal-nombre" type="text" placeholder="Nombre..." style="flex:1;background:var(--card);border:1px solid var(--accent);border-radius:8px;padding:8px 12px;color:var(--text)">
        <button class="btn btn-primary" onclick="agregarPersonal('${tab}')">+ Agregar</button>
      </div>
    </div>`;

  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
}

async function agregarPersonal(tab) {
  const nombre = document.getElementById('nuevo-personal-nombre')?.value.trim();
  if (!nombre) { alert('Ingresá un nombre'); return; }
  const accion = tab === 'embolsadores' ? 'guardar_embolsador' : 'guardar_repartidor';
  try {
    const res = await api(accion, { nombre });
    const key = tab === 'embolsadores' ? 'embolsadores' : 'repartidores';
    estado[key].push({ id: res.id, nombre });
    renderModalPersonal(tab);
  } catch (err) { alert('Error: ' + err.message); }
}

async function editarPersonal(id, nombreActual, tab) {
  const nuevo = prompt('Nuevo nombre:', nombreActual);
  if (!nuevo || nuevo === nombreActual) return;
  const accion = tab === 'embolsadores' ? 'guardar_embolsador' : 'guardar_repartidor';
  try {
    await api(accion, { id, nombre: nuevo });
    const key = tab === 'embolsadores' ? 'embolsadores' : 'repartidores';
    const item = estado[key].find(x => x.id === id);
    if (item) item.nombre = nuevo;
    renderModalPersonal(tab);
  } catch (err) { alert('Error: ' + err.message); }
}

async function eliminarPersonal(id, nombre, tab) {
  if (!confirm(`¿Eliminar "${nombre}"?`)) return;
  const accion = tab === 'embolsadores' ? 'eliminar_embolsador' : 'eliminar_repartidor';
  try {
    await api(accion, { id });
    const key = tab === 'embolsadores' ? 'embolsadores' : 'repartidores';
    estado[key] = estado[key].filter(x => x.id !== id);
    renderModalPersonal(tab);
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Devoluciones ────────────────────────────────────────────────────────────
function abrirModalDevolucion(pedidoId) {
  const pedido  = estado.pedidos.find(p => p.id === pedidoId);
  const cliente = estado.clientes.find(c => c.id === pedido?.cliente_id);
  if (!pedido || !cliente) return;

  function campoDevRow(label, campo, original) {
    if (!n(original)) return '';
    return `
      <tr>
        <td style="padding:6px 4px;font-size:.85rem">${label}</td>
        <td style="padding:6px 4px;text-align:center;color:var(--accent)">${displayNum(original)}</td>
        <td style="padding:6px 4px">
          <input type="number" id="dev_${campo}" min="0" max="${n(original)}" step="0.5"
            style="width:4rem;text-align:center;background:var(--card);color:var(--text);border:1px solid var(--accent);border-radius:4px;padding:3px 6px">
        </td>
      </tr>`;
  }

  const modal = document.createElement('div');
  modal.id = 'modal-devolucion';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div class="card" style="max-width:420px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-weight:700;color:var(--accent)">↩ Devolución — ${cliente.nombre}</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-devolucion').remove()">✕</button>
      </div>
      <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:12px">Ingresá las cantidades devueltas (máx = pedido original)</p>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="text-align:left;font-size:.75rem;color:var(--text-muted);padding:4px">Producto</th>
          <th style="font-size:.75rem;color:var(--text-muted);padding:4px">Pedido</th>
          <th style="font-size:.75rem;color:var(--text-muted);padding:4px">Devuelve</th>
        </tr></thead>
        <tbody>
          ${campoDevRow('Francés (kg)',    'frances_kg',         pedido.frances_kg)}
          ${campoDevRow('Miñón (kg)',      'minon_kg',           pedido.minon_kg)}
          ${campoDevRow('Sanguchero (kg)', 'sanguchero_kg',      pedido.sanguchero_kg)}
          ${campoDevRow('Negro (kg)',      'negro_kg',           pedido.negro_kg)}
          ${campoDevRow('T. Fina',         'tort_fina',          pedido.tort_fina)}
          ${campoDevRow('T. Gruesa',       'tort_gruesa',        pedido.tort_gruesa)}
          ${campoDevRow('Bollito',         'bollito',            pedido.bollito)}
          ${campoDevRow('Cuernito-Tomate', 'cuernito_tomate',    pedido.cuernito_tomate)}
          ${campoDevRow('Fact. Crema',     'fact_crema',         pedido.fact_crema)}
          ${campoDevRow('Media Luna',      'media_luna',         pedido.media_luna)}
          ${campoDevRow('Sacra-Vigilante', 'sacra_vigilante',    pedido.sacra_vigilante)}
        </tbody>
      </table>
      <div class="form-group" style="margin-top:12px">
        <label>Motivo (opcional)</label>
        <input type="text" id="dev_motivo" placeholder="Ej: no le gustó el sanguchero...">
      </div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('modal-devolucion').remove()">Cancelar</button>
        <button class="btn btn-warning" style="flex:1" onclick="confirmarDevolucion('${pedidoId}')">Registrar devolución</button>
      </div>
    </div>`;

  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
}

async function confirmarDevolucion(pedidoId) {
  const pedido = estado.pedidos.find(p => p.id === pedidoId);
  if (!pedido) return;

  const campos = ['frances_kg','minon_kg','sanguchero_kg','negro_kg',
                  'tort_fina','tort_gruesa','bollito','cuernito_tomate',
                  'fact_crema','media_luna','sacra_vigilante'];
  const devCampos = ['frances_dev','minon_dev','sanguchero_dev','negro_dev',
                     'tort_fina_dev','tort_gruesa_dev','bollito_dev','cuernito_tomate_dev',
                     'fact_crema_dev','media_luna_dev','sacra_vigilante_dev'];

  const datos = { pedido_id: pedidoId, cliente_id: pedido.cliente_id, motivo: document.getElementById('dev_motivo')?.value || '' };
  let totalDev = 0;

  campos.forEach((campo, i) => {
    const input = document.getElementById('dev_' + campo);
    const val = input ? n(input.value) : 0;
    datos[devCampos[i]] = val;
    totalDev += val;
  });

  if (totalDev === 0) { alert('Ingresá al menos una cantidad a devolver'); return; }

  datos.monto_devolucion = 0; // Se puede calcular con precios si están cargados
  datos.devuelto_por = estado.nombre;
  datos.rol_devuelto = estado.rol;

  try {
    await api('registrar_devolucion', datos);
    document.getElementById('modal-devolucion')?.remove();
    alert('✅ Devolución registrada. La encargada y el administrador serán notificados.');
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Notificaciones de devoluciones ──────────────────────────────────────────
function abrirNotificacionesDevoluciones() {
  const cids = new Set(clientesDePlanilla().map(c => c.id));
  const devs = estado.devoluciones.filter(d =>
    (d.revisado === 'no' || d.revisado === false) && cids.has(d.cliente_id)
  );
  if (!devs.length) return;

  function productosDev(d) {
    return [
      ['Francés',    d.frances_dev],    ['Miñón',     d.minon_dev],
      ['Sanguchero', d.sanguchero_dev], ['Negro',     d.negro_dev],
      ['T.Fina',     d.tort_fina_dev],  ['T.Gruesa',  d.tort_gruesa_dev],
      ['Bollito',    d.bollito_dev],    ['Cuernito-T',d.cuernito_tomate_dev],
      ['F.Crema',    d.fact_crema_dev], ['Med-Luna',  d.media_luna_dev],
      ['Sacra-Vig',  d.sacra_vigilante_dev],
    ].filter(([_,v]) => n(v) > 0)
     .map(([lbl,v]) => `<b>${displayNum(v)}</b> ${lbl}`)
     .join(' · ');
  }

  const modal = document.createElement('div');
  modal.id = 'modal-notif-devoluciones';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div style="max-width:480px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <span style="font-weight:700;color:var(--warning);font-size:1rem">↩ Devoluciones pendientes (${devs.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-notif-devoluciones').remove()">✕</button>
      </div>
      ${devs.map(d => {
        const cliente = estado.clientes.find(c => c.id === d.cliente_id);
        const hora    = String(d.hora_devolucion || d.fecha || '').slice(0, 16).replace('T', ' ');
        const prods   = productosDev(d);
        return `
          <div style="background:var(--surface);border-radius:10px;padding:14px;margin-bottom:12px;border-left:4px solid var(--warning)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
              <div>
                <div style="font-weight:700;font-size:.95rem">${cliente?.nombre || d.cliente_id}</div>
                <div style="font-size:.75rem;color:var(--text-muted)">${hora}${d.devuelto_por ? ' · ' + d.devuelto_por + ' (' + (d.rol_devuelto||'') + ')' : ''}</div>
              </div>
              <button class="btn-xs btn-success" style="white-space:nowrap" onclick="revisarDevolucion('${d.id}')">✓ Revisado</button>
            </div>
            ${prods ? `<div style="font-size:.82rem;margin-bottom:${d.motivo?'6':'0'}px">${prods}</div>` : ''}
            ${d.motivo ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:4px;font-style:italic">"${d.motivo}"</div>` : ''}
          </div>`;
      }).join('')}
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
}

async function revisarDevolucion(id) {
  try {
    await api('marcar_devolucion_revisada', { id });
    const dev = estado.devoluciones.find(d => d.id === id);
    if (dev) dev.revisado = 'si';
    document.getElementById('modal-notif-devoluciones')?.remove();
    const cids = new Set(clientesDePlanilla().map(c => c.id));
    const pendientes = estado.devoluciones.filter(d =>
      (d.revisado === 'no' || d.revisado === false) && cids.has(d.cliente_id)
    );
    if (pendientes.length) {
      abrirNotificacionesDevoluciones();
    } else {
      renderPlanilla();
    }
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Gestionar planillas (admin) ──────────────────────────────────────────────
const _PLANILLAS_DEFAULT = new Set(['IONA','SAN_JUAN','FACTURAS','PASCUAL']);

function abrirModalGestionPlanillas() {
  const modal = document.createElement('div');
  modal.id = 'modal-gestion-planillas';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div class="card" style="max-width:460px;margin:0 auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:700;color:var(--accent)">⚙️ Gestionar Planillas</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-gestion-planillas').remove()">✕</button>
      </div>
      <div id="gp-lista">
        ${estado.planillas.map(p => `
          <div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--card)">
            <span style="flex:1;font-size:.9rem">${p.nombre}</span>
            <span style="font-size:.68rem;padding:2px 8px;border-radius:10px;font-weight:600;
              background:${p.tipo==='facturas'?'#1a3a5c':'#1a3a1a'};
              color:${p.tipo==='facturas'?'#6bb8ff':'#4caf50'}">
              ${p.tipo==='facturas'?'Facturas':'Panadería'}
            </span>
            <button class="btn-xs btn-ghost" onclick="editarNombrePlanilla('${p.id}')">✏️</button>
            ${!_PLANILLAS_DEFAULT.has(p.id) ? `<button class="btn-xs btn-danger" onclick="eliminarPlanilla('${p.id}')">🗑</button>` : ''}
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;border-top:1px solid var(--card);padding-top:14px">
        <p style="font-size:.8rem;color:var(--text-muted);margin-bottom:10px;font-weight:600">Nueva planilla</p>
        <div class="form-group">
          <label>Nombre *</label>
          <input id="gp-nombre" type="text" placeholder="Ej: San Pedro, Mercado Norte...">
        </div>
        <div class="form-group">
          <label>Tipo</label>
          <select id="gp-tipo" style="width:100%;background:var(--card);border:1px solid #2a4a6a;border-radius:8px;padding:9px 12px;color:var(--text);font-size:.9rem">
            <option value="panaderia">Panadería — pan + tortillas</option>
            <option value="facturas">Facturas — crema, med-luna, sacr-vig</option>
          </select>
        </div>
        <button class="btn btn-primary btn-full" onclick="crearPlanillaDesdeGestion()">+ Crear planilla</button>
      </div>
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
  setTimeout(() => document.getElementById('gp-nombre')?.focus(), 50);
  document.getElementById('gp-nombre')?.addEventListener('keydown', e => { if (e.key === 'Enter') crearPlanillaDesdeGestion(); });
}

function editarNombrePlanilla(id) {
  const p = estado.planillas.find(x => x.id === id);
  if (!p) return;
  const nuevo = prompt('Nuevo nombre:', p.nombre)?.trim();
  if (!nuevo || nuevo === p.nombre) return;
  p.nombre = nuevo;
  const overrides = JSON.parse(localStorage.getItem('planillas_nombres') || '{}');
  overrides[id] = nuevo;
  localStorage.setItem('planillas_nombres', JSON.stringify(overrides));
  const custom = JSON.parse(localStorage.getItem('planillas_custom') || '[]');
  const ci = custom.findIndex(x => x.id === id);
  if (ci >= 0) { custom[ci].nombre = nuevo; localStorage.setItem('planillas_custom', JSON.stringify(custom)); }
  abrirModalGestionPlanillas();
  if (estado.planillaActiva === id) renderPlanilla();
}

function eliminarPlanilla(id) {
  const p = estado.planillas.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`¿Eliminar la planilla "${p.nombre}"?\nLos clientes asignados quedarán sin planilla hasta reasignarlos.`)) return;
  estado.planillas = estado.planillas.filter(x => x.id !== id);
  const custom = JSON.parse(localStorage.getItem('planillas_custom') || '[]');
  localStorage.setItem('planillas_custom', JSON.stringify(custom.filter(x => x.id !== id)));
  if (estado.planillaActiva === id) setPlanilla(estado.planillas[0]?.id || 'IONA');
  abrirModalGestionPlanillas();
}

function crearPlanillaDesdeGestion() {
  const nombre = document.getElementById('gp-nombre')?.value.trim();
  if (!nombre) { alert('Ingresá un nombre'); return; }
  const id = nombre.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  if (!id) { alert('Nombre inválido'); return; }
  if (estado.planillas.some(p => p.id === id)) { alert('Ya existe una planilla con ese nombre'); return; }
  const tipo  = document.getElementById('gp-tipo')?.value || 'panaderia';
  const nueva = { id, nombre, tipo };
  estado.planillas.push(nueva);
  const custom = JSON.parse(localStorage.getItem('planillas_custom') || '[]');
  custom.push(nueva);
  localStorage.setItem('planillas_custom', JSON.stringify(custom));
  abrirModalGestionPlanillas();
}

function abrirModalNuevaPlanilla() {
  const modal = document.createElement('div');
  modal.id = 'modal-nueva-planilla';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:500;padding:16px';
  modal.innerHTML = `
    <div class="card" style="width:100%;max-width:360px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:700;color:var(--accent)">Nueva Planilla</span>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('modal-nueva-planilla').remove()">✕</button>
      </div>
      <div class="form-group">
        <label>Nombre *</label>
        <input id="np-nombre" type="text" placeholder="Ej: San Pedro, Mercado Norte...">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select id="np-tipo" style="width:100%;background:var(--card);border:1px solid #2a4a6a;border-radius:8px;padding:9px 12px;color:var(--text);font-size:.9rem">
          <option value="panaderia">Panadería — pan + tortillas</option>
          <option value="facturas">Facturas — crema, med-luna, sacr-vig</option>
        </select>
      </div>
      <button class="btn btn-primary btn-full" onclick="guardarNuevaPlanilla()">Crear planilla</button>
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
  document.getElementById('np-nombre').focus();
  document.getElementById('np-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') guardarNuevaPlanilla(); });
}

function guardarNuevaPlanilla() {
  const nombre = document.getElementById('np-nombre')?.value.trim();
  if (!nombre) { alert('Ingresá un nombre'); return; }
  const id = nombre.toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
  if (!id) { alert('Nombre inválido'); return; }
  if (estado.planillas.some(p => p.id === id)) { alert('Ya existe una planilla con ese nombre'); return; }
  const tipo  = document.getElementById('np-tipo')?.value || 'panaderia';
  const nueva = { id, nombre, tipo };
  estado.planillas.push(nueva);
  const custom = JSON.parse(localStorage.getItem('planillas_custom') || '[]');
  custom.push(nueva);
  localStorage.setItem('planillas_custom', JSON.stringify(custom));
  document.getElementById('modal-nueva-planilla')?.remove();
  setPlanilla(id);
}

// ─── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('online',  () => { renderOfflineBanner(false); renderPantallaPrincipal(); });
window.addEventListener('offline', () => renderOfflineBanner(true));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
  navigator.serviceWorker.addEventListener('message', e => { if (e.data?.tipo==='sync') renderPantallaPrincipal(); });
}

const sesion = localStorage.getItem('sesion');
if (sesion) {
  const s = JSON.parse(sesion);
  estado.rol = s.rol; estado.nombre = s.nombre;
  if (s.planillaActiva) estado.planillaActiva = s.planillaActiva;
  api('listar_repartidores').then(r => { estado.repartidores = r || []; }).catch(() => {});
  renderPantallaPrincipal();
} else {
  api('listar_repartidores').then(r => { estado.repartidores = r || []; }).catch(() => {});
  renderLogin();
}

Object.assign(window, {
  elegirRol, cerrarSesion, setFiltro, setPlanilla,
  activarEdicion, tomarPedido, completarPedido,
  marcarEntregado, cancelarPedidoFila, abrirModalCliente, guardarCliente,
  confirmarReorden, exportarPDF, exportarExcel,
  cerrarDia, cerrarModalCierre, exportarPDFSinModal, toggleTodos, confirmarCierreDia,
  abrirModalDevolucion, confirmarDevolucion,
  abrirNotificacionesDevoluciones, revisarDevolucion,
  tapMover, cancelarMover,
  abrirModalPersonal, renderModalPersonal, agregarPersonal, editarPersonal, eliminarPersonal,
  abrirModalGestionPlanillas, editarNombrePlanilla, eliminarPlanilla, crearPlanillaDesdeGestion,
  abrirModalNuevaPlanilla, guardarNuevaPlanilla,
});
