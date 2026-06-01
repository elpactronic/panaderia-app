// ─── Configuración ────────────────────────────────────────────────────────────
const API_URL = 'https://script.google.com/macros/s/AKfycbw0yJF2VItE5LhApJvOVIVR6-_g8xd3aNTt0PLw-K9xNz0mjLhyCQM3NGzwgvUjAs-9Qw/exec';

// ─── Estado global ────────────────────────────────────────────────────────────
let estado = {
  rol: null, nombre: null,
  clientes: [], repartidores: [], precios: [], pedidos: [],
  offline: false,
};
let filtroColumnas = 'ambos'; // 'pan' | 'tortillas' | 'ambos'
let dragState = null;

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
  const [clientes, repartidores, precios, pedidos] = await Promise.all([
    api('listar_clientes'), api('listar_repartidores'),
    api('listar_precios'),  api('listar_pedidos'),
  ]);
  estado.clientes     = clientes     || [];
  estado.repartidores = repartidores || [];
  estado.precios      = precios      || [];
  estado.pedidos      = pedidos      || [];
  localStorage.setItem('cache_clientes', JSON.stringify(estado.clientes));
  localStorage.setItem('cache_pedidos',  JSON.stringify(estado.pedidos));
}

function cargarDesdeCache() {
  estado.clientes = JSON.parse(localStorage.getItem('cache_clientes') || '[]');
  estado.pedidos  = JSON.parse(localStorage.getItem('cache_pedidos')  || '[]');
}

// ─── Cálculos ─────────────────────────────────────────────────────────────────
function n(v) { const x = parseFloat(v); return isNaN(x) ? 0 : x; }
function kgPan(p)       { return n(p.frances_kg)+n(p.minon_kg)+n(p.sanguchero_kg)+n(p.negro_kg); }
function totTortillas(p){ return n(p.tort_fina)+n(p.tort_gruesa)+n(p.bollito)+n(p.cuernito_tomate); }
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
    nombre = await mostrarSelector(['Embolsador 1', 'Embolsador 2']);
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

// ─── PLANILLA ─────────────────────────────────────────────────────────────────
function clientesIONA() {
  return estado.clientes
    .filter(c => c.grupo === 'IONA')
    .sort((a, b) => (n(a.orden) || 999) - (n(b.orden) || 999));
}
function pedidoDeCliente(cid) { return estado.pedidos.find(p => p.cliente_id === cid) || null; }

function renderPlanilla() {
  const clientes  = clientesIONA();
  const esEnc     = estado.rol === 'encargada';
  const esEmb     = estado.rol === 'embolsador';
  const esRep     = estado.rol === 'repartidor';
  const esAdmin   = estado.rol === 'admin';

  const showPan   = filtroColumnas !== 'tortillas';
  const showTort  = filtroColumnas !== 'pan';

  // Totales de la planilla
  const activos = estado.pedidos.filter(p => p.status !== 'cancelado');
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

  const cancelados = estado.pedidos.filter(p=>p.status==='cancelado').length;

  document.querySelector('#app').innerHTML = `
    <div id="app-inner">
      <header>
        <h1>Planilla IONA</h1>
        <div class="toggle-filtro">
          <button class="${filtroColumnas==='pan'?'active':''}" onclick="setFiltro('pan')">Pan</button>
          <button class="${filtroColumnas==='tortillas'?'active':''}" onclick="setFiltro('tortillas')">Tort.</button>
          <button class="${filtroColumnas==='ambos'?'active':''}" onclick="setFiltro('ambos')">Todo</button>
        </div>
        <button class="btn-icon" title="PDF" onclick="exportarPDF()">📄</button>
        <button class="btn-icon" title="Excel" onclick="exportarExcel()">📊</button>
        <button class="btn btn-ghost btn-sm" onclick="cerrarSesion()">Salir</button>
      </header>

      ${cancelados>0 ? `<div class="alerta alerta-danger" style="margin:6px 8px 0">🚫 ${cancelados} pedido(s) cancelado(s)</div>` : ''}
      <div class="rol-badge-bar">👤 ${estado.nombre}</div>

      <div class="planilla-scroll">
        <table class="planilla" id="planilla-tabla">
          <thead><tr>
            ${esEnc ? '<th class="th-drag"></th>' : ''}
            <th class="th-cliente sticky-col">Cliente</th>
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
            <th class="th-estado">Estado</th>
          </tr></thead>
          <tbody id="planilla-body">
            ${clientes.map((c, i) => renderFila(c, pedidoDeCliente(c.id), i, showPan, showTort)).join('')}
          </tbody>
          <tfoot><tr class="fila-total">
            ${esEnc ? '<td></td>' : ''}
            <td class="sticky-col" style="font-weight:700;font-size:.75rem">TOTAL</td>
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
  const esEnc = estado.rol === 'encargada';
  const esEmb = estado.rol === 'embolsador';
  const esRep = estado.rol === 'repartidor';
  const st    = pedido ? pedido.status : 'sin_pedido';
  const cid   = cliente.id;

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
  } else if (st === 'entregado') {
    estadoCell = `<span class="badge badge-entregado">🚚 ${pedido.repartidor_entrega||estado.nombre}</span>`;
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
      ${esEnc ? `<td class="td-drag" data-idx="${idx}">☰</td>` : ''}
      <td class="td-cliente sticky-col">${cliente.nombre}</td>
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
    await api('actualizar_pedido', { id, status: 'en_proceso', embolsador: estado.nombre, hora_embolsado: new Date().toISOString() });
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
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
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:500;overflow-y:auto';
  modal.innerHTML = `
    <div class="card" style="width:90%;max-width:400px;margin:16px auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="font-weight:700">${c ? 'Editar Cliente' : 'Nuevo Cliente'}</span>
        <button class="btn btn-ghost btn-sm" onclick="this.closest('#modal-cliente').remove()">✕</button>
      </div>
      <div class="form-group">
        <label>Nombre</label>
        <input id="mc-nombre" type="text" value="${c?.nombre||''}">
      </div>
      <div class="form-group">
        <label>Grupo</label>
        <select id="mc-grupo">
          ${['IONA','SanJuan','Pascual','Milton','Gaston','Mariana','PedidosChicos'].map(g=>`<option ${(c?.grupo||'IONA')===g?'selected':''}>${g}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Repartidor</label>
        <select id="mc-rep">
          ${estado.repartidores.map(r=>`<option value="${r.id}" ${c?.repartidor_id===r.id?'selected':''}>${r.nombre}</option>`).join('')}
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
    id: id || undefined,
    nombre,
    grupo:        document.getElementById('mc-grupo').value,
    repartidor_id:document.getElementById('mc-rep').value,
    retira_local: false,
  };
  try {
    await api('guardar_cliente', datos);
    document.getElementById('modal-container').innerHTML = '';
    await renderPantallaPrincipal();
  } catch (err) { alert('Error: ' + err.message); }
}

// ─── Drag & Drop (solo encargada) ─────────────────────────────────────────────
function initDragAndDrop() {
  const tbody = document.getElementById('planilla-body');
  if (!tbody) return;

  let dragIdx = null, overIdx = null, ghost = null;

  tbody.querySelectorAll('.td-drag').forEach(handle => {
    handle.addEventListener('touchstart', e => {
      dragIdx = parseInt(handle.dataset.idx);
      const tr = handle.closest('tr');
      tr.classList.add('dragging');
      ghost = tr.cloneNode(true);
      ghost.style.cssText = 'position:fixed;opacity:.6;pointer-events:none;z-index:999;background:var(--card);width:' + tr.offsetWidth + 'px';
      document.body.append(ghost);
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchmove', e => {
      if (ghost === null) return;
      const t = e.touches[0];
      ghost.style.left = t.clientX + 'px';
      ghost.style.top  = (t.clientY - 20) + 'px';
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const tr = el?.closest('tr[data-idx]');
      if (tr) {
        overIdx = parseInt(tr.dataset.idx);
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
        tr.classList.add('drag-over');
      }
      e.preventDefault();
    }, { passive: false });

    handle.addEventListener('touchend', async () => {
      if (ghost) { ghost.remove(); ghost = null; }
      tbody.querySelectorAll('tr').forEach(r => { r.classList.remove('dragging', 'drag-over'); });
      if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) {
        await confirmarReorden(dragIdx, overIdx);
      }
      dragIdx = null; overIdx = null;
    });
  });
}

async function confirmarReorden(fromIdx, toIdx) {
  const clientes = clientesIONA();
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
  const clientes = clientesIONA();
  const headers = ['Cliente','Kg Pan','Francés','Miñón','Sanguchero','Negro','Tort.Fina','Tort.Gruesa','Bollito','Cuernito-Tomate','Total Tort.','Estado','Embolsador','Repartidor'];
  const filas = clientes.map(c => {
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

  // Fila de totales
  const activos = estado.pedidos.filter(p=>p.status!=='cancelado');
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

  const csv = '﻿' + [headers, ...filas].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `planilla_IONA_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Cerrar día ───────────────────────────────────────────────────────────────
async function cerrarDia() {
  const clientes = clientesIONA();
  if (!clientes.length) { alert('No hay clientes en la planilla'); return; }

  // Modal para elegir qué clientes mantener
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:500;overflow-y:auto;padding:16px';
  modal.innerHTML = `
    <div class="card" style="max-width:480px;margin:0 auto">
      <h2 style="color:var(--accent);margin-bottom:4px">Cerrar Día</h2>
      <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px">
        Marcá los clientes que querés conservar para mañana con sus cantidades actuales.
      </p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn btn-ghost btn-sm" onclick="toggleTodos(true)">Marcar todos</button>
        <button class="btn btn-ghost btn-sm" onclick="toggleTodos(false)">Desmarcar todos</button>
      </div>
      <div id="lista-mantener">
        ${clientes.map(c => {
          const p = pedidoDeCliente(c.id);
          const resumen = p ? `${displayNum(kgPan(p))}kg pan` + (totTortillas(p) > 0 ? ` · ${totTortillas(p)} tort.` : '') : 'Sin pedido';
          return `
            <label style="display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--card);cursor:pointer">
              <input type="checkbox" data-cid="${c.id}" ${p?'checked':''} style="width:18px;height:18px">
              <span style="flex:1">${c.nombre}</span>
              <span style="font-size:.8rem;color:var(--text-muted)">${resumen}</span>
            </label>`;
        }).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="exportarExcel()">📊 Descargar Excel</button>
        <button class="btn btn-ghost" onclick="exportarPDF()">📄 Descargar PDF</button>
        <button class="btn btn-danger" style="flex:1" onclick="confirmarCierreDia()">Cerrar y limpiar</button>
        <button class="btn btn-ghost btn-full" onclick="this.closest('[style]').remove()">Cancelar</button>
      </div>
    </div>`;
  document.getElementById('modal-container').innerHTML = '';
  document.getElementById('modal-container').append(modal);
}

function toggleTodos(val) {
  document.querySelectorAll('#lista-mantener input[type=checkbox]').forEach(cb => cb.checked = val);
}

async function confirmarCierreDia() {
  const mantener = [...document.querySelectorAll('#lista-mantener input:checked')].map(cb => cb.dataset.cid);
  if (!confirm(`¿Confirmar cierre del día?\n${mantener.length} cliente(s) se mantendrán para mañana.`)) return;

  try {
    const resultado = await api('cerrar_dia', { mantener_ids: mantener });
    const num = String(resultado.cierre_num).padStart(3, '0');
    // Descarga automática del backup
    descargarCSVCierre(resultado.pedidos, `pedidos_${num}.csv`);
    document.getElementById('modal-container').innerHTML = '';
    alert(`✅ Día cerrado. Backup: pedidos_${num}.csv`);
    await renderPantallaPrincipal();
  } catch (err) { alert('Error al cerrar: ' + err.message); }
}

function descargarCSVCierre(pedidos, nombre) {
  if (!pedidos?.length) return;
  const hs = Object.keys(pedidos[0]);
  const csv = '﻿' + [hs, ...pedidos.map(p => hs.map(h => `"${p[h]??''}"`))].map(r=>r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href=url; a.download=nombre; a.click(); URL.revokeObjectURL(url);
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
  api('listar_repartidores').then(r => { estado.repartidores = r || []; }).catch(() => {});
  renderPantallaPrincipal();
} else {
  api('listar_repartidores').then(r => { estado.repartidores = r || []; }).catch(() => {});
  renderLogin();
}

Object.assign(window, {
  elegirRol, cerrarSesion, setFiltro,
  activarEdicion, tomarPedido, completarPedido,
  marcarEntregado, cancelarPedidoFila, abrirModalCliente, guardarCliente,
  confirmarReorden, exportarPDF, exportarExcel,
  cerrarDia, toggleTodos, confirmarCierreDia,
});
