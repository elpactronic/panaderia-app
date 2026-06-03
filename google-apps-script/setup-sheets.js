/**
 * PASO 1: Ejecutar esta función UNA sola vez para crear todas las hojas.
 * En Google Sheets: Extensiones → Apps Script → pegar este código → ejecutar setupPanaderia()
 */
function setupPanaderia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  crearHoja(ss, 'clientes', [
    'id', 'nombre', 'grupo', 'repartidor_id', 'retira_local', 'activo', 'telefono', 'fecha_alta', 'orden'
  ]);

  crearHoja(ss, 'repartidores', [
    'id', 'nombre'
  ]);

  crearHoja(ss, 'precios', [
    'producto', 'tipo', 'precio_unitario'
  ]);

  crearHoja(ss, 'pedidos', [
    'id', 'fecha', 'cliente_id', 'grupo',
    'frances_kg', 'minon_kg', 'sanguchero_kg', 'negro_kg',
    'tort_fina', 'tort_gruesa', 'bollito', 'cuernito_tomate',
    'fact_crema', 'media_luna', 'sacra_vigilante',
    'monto_total', 'status',
    'hora_pedido', 'embolsador', 'hora_embolsado', 'notas'
  ]);

  crearHoja(ss, 'config', [
    'clave', 'valor'
  ]);

  crearHoja(ss, 'historial', [
    'cierre_num', 'fecha_cierre', 'id', 'fecha', 'cliente_id', 'grupo',
    'frances_kg', 'minon_kg', 'sanguchero_kg', 'negro_kg',
    'tort_fina', 'tort_gruesa', 'bollito', 'cuernito_tomate',
    'fact_crema', 'media_luna', 'sacra_vigilante',
    'monto_total', 'status', 'hora_pedido', 'embolsador', 'hora_embolsado', 'notas'
  ]);

  crearHoja(ss, 'devoluciones', [
    'id', 'fecha', 'pedido_id', 'cliente_id',
    'frances_dev', 'minon_dev', 'sanguchero_dev', 'negro_dev',
    'tort_fina_dev', 'tort_gruesa_dev', 'bollito_dev', 'cuernito_tomate_dev',
    'fact_crema_dev', 'media_luna_dev', 'sacra_vigilante_dev',
    'monto_devolucion', 'motivo', 'devuelto_por', 'rol_devuelto',
    'hora_devolucion', 'revisado'
  ]);

  cargarDatosIniciales(ss);

  Logger.log('✅ Estructura creada correctamente.');
}

function crearHoja(ss, nombre, columnas) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  } else {
    hoja.clearContents();
  }
  hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
  hoja.getRange(1, 1, 1, columnas.length)
    .setBackground('#1a1a2e')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
  hoja.setFrozenRows(1);
  return hoja;
}

function cargarDatosIniciales(ss) {
  // Repartidores de ejemplo
  const hojaRep = ss.getSheetByName('repartidores');
  hojaRep.getRange('A2:B6').setValues([
    ['rep_1', 'Milton'],
    ['rep_2', 'Gaston'],
    ['rep_3', 'Mariana'],
    ['rep_4', 'Reparto General'],
    ['rep_5', 'Pascual Sucursal'],
  ]);

  // Precios de ejemplo (ajustar según precio real)
  const hojaPrecios = ss.getSheetByName('precios');
  hojaPrecios.getRange('A2:C12').setValues([
    ['pan', 'frances',    0],
    ['pan', 'minon',      0],
    ['pan', 'sanguchero', 0],
    ['pan', 'negro',      0],
    ['tortilla', 'fina',           0],
    ['tortilla', 'gruesa',         0],
    ['tortilla', 'bollito',        0],
    ['tortilla', 'cuernito_tomate',0],
    ['factura', 'crema',            0],
    ['factura', 'media_luna',       0],
    ['factura', 'sacra_vigilante',  0],
  ]);

  // Config general
  const hojaConfig = ss.getSheetByName('config');
  hojaConfig.getRange('A2:B4').setValues([
    ['hora_cierre_pedidos', '23:59'],
    ['version_app',         '1.0.0'],
    ['cierre_num',          '0'],
  ]);

  SpreadsheetApp.flush();
}

// ─── API REST ──────────────────────────────────────────────────────────────────
// Después de crear las hojas, deployar este mismo archivo como Web App:
// Implementar → Nueva implementación → Web App → Cualquiera puede acceder

function doGet(e) {
  return manejarRequest(e);
}

function doPost(e) {
  return manejarRequest(e);
}

function manejarRequest(e) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const accion = e.parameter.accion || (e.postData ? JSON.parse(e.postData.contents).accion : null);
    const datos  = e.postData ? JSON.parse(e.postData.contents) : e.parameter;

    let resultado;

    switch (accion) {
      case 'listar_clientes':     resultado = listarClientes();            break;
      case 'listar_repartidores': resultado = listarRepartidores();        break;
      case 'listar_embolsadores': resultado = listarEmbolsadores();        break;
      case 'guardar_repartidor':  resultado = guardarPersonal(datos, 'repartidores'); break;
      case 'guardar_embolsador':  resultado = guardarPersonal(datos, 'embolsadores'); break;
      case 'eliminar_repartidor': resultado = eliminarPersonal(datos.id, 'repartidores'); break;
      case 'eliminar_embolsador': resultado = eliminarPersonal(datos.id, 'embolsadores'); break;
      case 'listar_precios':      resultado = listarPrecios();             break;
      case 'listar_pedidos':      resultado = listarPedidos(datos.fecha);  break;
      case 'crear_pedido':        resultado = crearPedido(datos);          break;
      case 'actualizar_pedido':   resultado = actualizarPedido(datos);     break;
      case 'cancelar_pedido':     resultado = cancelarPedido(datos.id);    break;
      case 'guardar_cliente':     resultado = guardarCliente(datos);       break;
      case 'guardar_precio':      resultado = guardarPrecio(datos);        break;
      case 'cerrar_dia':          resultado = cerrarDia(datos.mantener_ids, datos.grupo); break;
      case 'listar_planillas':    resultado = listarPlanillas();                   break;
      case 'reordenar_clientes':  resultado = reordenarClientes(datos.clientes);   break;
      case 'registrar_devolucion':resultado = registrarDevolucion(datos);          break;
      case 'listar_devoluciones': resultado = listarDevoluciones();                break;
      case 'marcar_devolucion_revisada': resultado = marcarDevolucionRevisada(datos.id); break;
      case 'listar_historial':    resultado = listarHistorial(datos.mes);          break;
      default:
        resultado = { error: 'Acción desconocida: ' + accion };
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, data: resultado }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── Helpers de lectura ────────────────────────────────────────────────────────

function hojaAObjetos(nombre) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  const [headers, ...filas] = hoja.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return filas
    .filter(f => f.some(c => c !== ''))
    .map(fila => Object.fromEntries(headers.map((h, i) => {
      let val = fila[i];
      if (val instanceof Date) {
        val = h === 'fecha'
          ? Utilities.formatDate(val, tz, 'yyyy-MM-dd')
          : Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
      } else if (h === 'fecha' && typeof val === 'string' && val.length > 10) {
        val = val.slice(0, 10);
      }
      return [h, val];
    })));
}

function listarClientes() {
  return hojaAObjetos('clientes')
    .filter(c => c.activo !== false && c.activo !== 'FALSE')
    .sort((a, b) => (Number(a.orden) || 999) - (Number(b.orden) || 999));
}

function reordenarClientes(clientesOrdenados) {
  const hoja  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('clientes');
  const vals  = hoja.getDataRange().getValues();
  const heads = vals[0];
  const idIdx = heads.indexOf('id');
  let ordenIdx = heads.indexOf('orden');

  // Si no existe columna orden, agregarla
  if (ordenIdx < 0) {
    ordenIdx = heads.length;
    hoja.getRange(1, ordenIdx + 1).setValue('orden');
  }

  clientesOrdenados.forEach(({ id, orden }) => {
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][idIdx]) === String(id)) {
        hoja.getRange(i + 1, ordenIdx + 1).setValue(orden);
        break;
      }
    }
  });
  return { ok: true };
}

function listarRepartidores() {
  return hojaAObjetos('repartidores');
}

function listarPrecios() {
  return hojaAObjetos('precios');
}

function listarPedidos() {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pedidos');
  const [headers, ...filas] = hoja.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  return filas
    .filter(f => f.some(c => c !== ''))
    .map(fila => Object.fromEntries(headers.map((h, i) => {
      let val = fila[i];
      if (val instanceof Date) val = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
      return [h, val];
    })));
}

function obtenerOCrearHoja(ss, nombre, columnas) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.getRange(1, 1, 1, columnas.length).setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
    hoja.setFrozenRows(1);
  }
  return hoja;
}

function cerrarDia(mantenerIds, grupo) {
  mantenerIds = mantenerIds || [];
  grupo       = grupo || 'IONA';
  const ss          = SpreadsheetApp.getActiveSpreadsheet();
  const hojaPedidos = ss.getSheetByName('pedidos');
  const hojaConfig  = ss.getSheetByName('config');

  const hojaHistorial = obtenerOCrearHoja(ss, 'historial', [
    'cierre_num', 'fecha_cierre', 'id', 'fecha', 'cliente_id', 'grupo',
    'frances_kg', 'minon_kg', 'sanguchero_kg', 'negro_kg',
    'tort_fina', 'tort_gruesa', 'bollito', 'cuernito_tomate',
    'fact_crema', 'media_luna', 'sacra_vigilante',
    'monto_total', 'status', 'hora_pedido', 'embolsador', 'hora_embolsado', 'notas'
  ]);
  const tz = Session.getScriptTimeZone();

  const cfgVals = hojaConfig.getDataRange().getValues();
  let cierreNum = 1;
  for (let i = 1; i < cfgVals.length; i++) {
    if (cfgVals[i][0] === 'cierre_num') {
      cierreNum = (parseInt(cfgVals[i][1]) || 0) + 1;
      hojaConfig.getRange(i + 1, 2).setValue(cierreNum);
      break;
    }
  }

  const fechaCierre     = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");
  const [headers, ...filas] = hojaPedidos.getDataRange().getValues();
  const todosLosPedidos = filas.filter(f => f.some(c => c !== ''));

  const grupoIdx   = headers.indexOf('grupo');
  const clienteIdx = headers.indexOf('cliente_id');

  // Separar pedidos de esta planilla vs. las demás
  const pedidosGrupo = todosLosPedidos.filter(f =>
    (grupoIdx >= 0 ? String(f[grupoIdx]) : 'IONA') === grupo
  );
  const pedidosOtros = todosLosPedidos.filter(f =>
    (grupoIdx >= 0 ? String(f[grupoIdx]) : 'IONA') !== grupo
  );

  pedidosGrupo.forEach(fila => hojaHistorial.appendRow([cierreNum, fechaCierre, ...fila]));

  // Limpiar hoja: restaurar otras planillas + pedidos "mantener" reseteados
  if (hojaPedidos.getLastRow() > 1) {
    hojaPedidos.getRange(2, 1, hojaPedidos.getLastRow() - 1, hojaPedidos.getLastColumn()).clearContent();
  }
  pedidosOtros.forEach(fila => hojaPedidos.appendRow(fila));

  if (mantenerIds.length > 0) {
    pedidosGrupo
      .filter(f => mantenerIds.includes(String(f[clienteIdx])))
      .forEach(fila => {
        const nuevaFila        = [...fila];
        const statusIdx        = headers.indexOf('status');
        const embolsadorIdx    = headers.indexOf('embolsador');
        const horaEmbolsadoIdx = headers.indexOf('hora_embolsado');
        if (statusIdx >= 0)        nuevaFila[statusIdx]        = 'pendiente';
        if (embolsadorIdx >= 0)    nuevaFila[embolsadorIdx]    = '';
        if (horaEmbolsadoIdx >= 0) nuevaFila[horaEmbolsadoIdx] = '';
        hojaPedidos.appendRow(nuevaFila);
      });
  }

  // Guardar backup en carpeta backupAppPan del Drive de esta cuenta
  let backupInfo  = null;
  let backupError = null;
  try {
    backupInfo = _guardarBackupEnDrive(pedidosGrupo, headers, grupo, fechaCierre, tz);
  } catch (e) {
    backupError = e.message;
    Logger.log('Backup Drive falló: ' + e.message);
  }

  return {
    cierre_num:   cierreNum,
    fecha_cierre: fechaCierre,
    backup:       backupInfo,
    backup_error: backupError,
  };
}

function _guardarBackupEnDrive(filas, headers, grupo, fechaCierre, tz) {
  const fecha  = fechaCierre.slice(0, 10);
  const nombre = 'backup_' + grupo + '_' + fecha + '.csv';

  const headerRow = headers.map(function(h) { return '"' + String(h) + '"'; }).join(',');
  const dataRows  = filas.map(function(f) {
    return headers.map(function(_, i) {
      var val = f[i];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, tz, "yyyy-MM-dd'T'HH:mm:ss");
      }
      return '"' + String(val === null || val === undefined ? '' : val).replace(/"/g, '""') + '"';
    }).join(',');
  });

  var csv = '﻿' + [headerRow].concat(dataRows).join('\n');

  var it     = DriveApp.getFoldersByName('backupAppPan');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('backupAppPan');
  folder.createFile(nombre, csv, 'text/csv');

  return { archivo: nombre, carpeta: 'backupAppPan' };
}

// ─── Helpers de escritura ──────────────────────────────────────────────────────

function crearPedido(datos) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pedidos');
  const id = 'ped_' + Date.now();
  const ahora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss");

  const fila = [
    id,
    datos.fecha,
    datos.cliente_id,
    datos.grupo           || 'IONA',
    datos.frances_kg      || 0,
    datos.minon_kg        || 0,
    datos.sanguchero_kg   || 0,
    datos.negro_kg        || 0,
    datos.tort_fina       || 0,
    datos.tort_gruesa     || 0,
    datos.bollito         || 0,
    datos.cuernito_tomate || 0,
    datos.fact_crema      || 0,
    datos.media_luna      || 0,
    datos.sacra_vigilante || 0,
    datos.monto_total     || 0,
    'pendiente',
    ahora,
    '', // embolsador
    '', // hora_embolsado
    datos.notas || ''
  ];

  hoja.appendRow(fila);
  return { id };
}

function actualizarPedido(datos) {
  const hoja  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pedidos');
  const vals  = hoja.getDataRange().getValues();
  const heads = vals[0];
  const idIdx = heads.indexOf('id');

  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(datos.id)) {
      // Validar status esperado (evita duplicados en "Tomar")
      if (datos.expected_status) {
        const statusIdx = heads.indexOf('status');
        if (statusIdx >= 0 && vals[i][statusIdx] !== datos.expected_status) {
          throw new Error('El pedido ya fue tomado por otro embolsador');
        }
      }
      const ignorar = ['expected_status'];
      Object.entries(datos).forEach(([key, val]) => {
        if (ignorar.includes(key)) return;
        const col = heads.indexOf(key);
        if (col >= 0) hoja.getRange(i + 1, col + 1).setValue(val);
      });
      return { actualizado: datos.id };
    }
  }
  throw new Error('Pedido no encontrado: ' + datos.id);
}

function cancelarPedido(id) {
  return actualizarPedido({ id, status: 'cancelado' });
}

function guardarCliente(datos) {
  const hoja  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('clientes');
  const vals  = hoja.getDataRange().getValues();
  const heads = vals[0];
  const idIdx = heads.indexOf('id');

  if (datos.id) {
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][idIdx]) === String(datos.id)) {
        Object.entries(datos).forEach(([key, val]) => {
          const col = heads.indexOf(key);
          if (col >= 0) hoja.getRange(i + 1, col + 1).setValue(val);
        });
        return { actualizado: datos.id };
      }
    }
  }

  const id        = 'cli_' + Date.now();
  const todos     = hojaAObjetos('clientes');
  const maxOrden  = todos.reduce((m, c) => Math.max(m, Number(c.orden) || 0), 0);
  const fechaAlta = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Construir fila respetando el orden real de columnas del sheet
  const fila = heads.map(h => {
    const map = {
      id, nombre: datos.nombre || '', grupo: datos.grupo || 'IONA',
      repartidor_id: datos.repartidor_id || '', retira_local: false, activo: true,
      telefono: datos.telefono || '', fecha_alta: fechaAlta,
      orden: maxOrden + 1, direccion: datos.direccion || '', gps: datos.gps || '',
    };
    return map[h] !== undefined ? map[h] : '';
  });

  hoja.appendRow(fila);
  return { id };
}

function guardarPrecio(datos) {
  const hoja  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('precios');
  const vals  = hoja.getDataRange().getValues();
  const heads = vals[0];

  for (let i = 1; i < vals.length; i++) {
    if (vals[i][0] === datos.producto && vals[i][1] === datos.tipo) {
      hoja.getRange(i + 1, 3).setValue(datos.precio_unitario);
      return { actualizado: true };
    }
  }
  hoja.appendRow([datos.producto, datos.tipo, datos.precio_unitario]);
  return { insertado: true };
}

// ─── Devoluciones ──────────────────────────────────────────────────────────────

function registrarDevolucion(datos) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, 'devoluciones', [
    'id', 'fecha', 'pedido_id', 'cliente_id',
    'frances_dev', 'minon_dev', 'sanguchero_dev', 'negro_dev',
    'tort_fina_dev', 'tort_gruesa_dev', 'bollito_dev', 'cuernito_tomate_dev',
    'fact_crema_dev', 'media_luna_dev', 'sacra_vigilante_dev',
    'monto_devolucion', 'motivo', 'devuelto_por', 'rol_devuelto',
    'hora_devolucion', 'revisado'
  ]);
  const tz   = Session.getScriptTimeZone();
  const id   = 'dev_' + Date.now();
  const hora = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss");

  hoja.appendRow([
    id, hora.slice(0, 10), datos.pedido_id, datos.cliente_id,
    datos.frances_dev      || 0, datos.minon_dev       || 0,
    datos.sanguchero_dev   || 0, datos.negro_dev        || 0,
    datos.tort_fina_dev    || 0, datos.tort_gruesa_dev  || 0,
    datos.bollito_dev      || 0, datos.cuernito_tomate_dev || 0,
    datos.fact_crema_dev   || 0, datos.media_luna_dev   || 0,
    datos.sacra_vigilante_dev || 0,
    datos.monto_devolucion || 0, datos.motivo || '',
    datos.devuelto_por, datos.rol_devuelto, hora, 'no'
  ]);

  // Actualizar el pedido: restar monto y marcar que tiene devolución
  actualizarPedido({
    id: datos.pedido_id,
    monto_devolucion: datos.monto_devolucion || 0,
  });

  return { id };
}

function listarDevoluciones() {
  return hojaAObjetos('devoluciones');
}

function marcarDevolucionRevisada(id) {
  const hoja  = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('devoluciones');
  const vals  = hoja.getDataRange().getValues();
  const heads = vals[0];
  const idIdx = heads.indexOf('id');
  const revIdx = heads.indexOf('revisado');
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(id)) {
      hoja.getRange(i + 1, revIdx + 1).setValue('si');
      return { ok: true };
    }
  }
  return { ok: false };
}

// ─── Historial para informes ───────────────────────────────────────────────────

function listarHistorial(mes) {
  const todos = hojaAObjetos('historial');
  if (!mes) return todos;
  return todos.filter(r => String(r.fecha_cierre).slice(0, 7) === mes);
}

// ─── Personal (embolsadores y repartidores) ───────────────────────────────────

function listarEmbolsadores() {
  const hoja = obtenerOCrearHoja(SpreadsheetApp.getActiveSpreadsheet(), 'embolsadores', ['id','nombre']);
  return hojaAObjetos('embolsadores');
}

function guardarPersonal(datos, nombreHoja) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = obtenerOCrearHoja(ss, nombreHoja, ['id','nombre']);
  const vals = hoja.getDataRange().getValues();
  const heads= vals[0];
  const idIdx= heads.indexOf('id');

  if (datos.id) {
    for (let i = 1; i < vals.length; i++) {
      if (String(vals[i][idIdx]) === String(datos.id)) {
        const nomIdx = heads.indexOf('nombre');
        if (nomIdx >= 0) hoja.getRange(i + 1, nomIdx + 1).setValue(datos.nombre);
        return { actualizado: datos.id };
      }
    }
  }
  const id = nombreHoja.slice(0, 3) + '_' + Date.now();
  hoja.appendRow([id, datos.nombre]);
  return { id };
}

function eliminarPersonal(id, nombreHoja) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombreHoja);
  if (!hoja) return { ok: false };
  const vals  = hoja.getDataRange().getValues();
  const idIdx = vals[0].indexOf('id');
  for (let i = 1; i < vals.length; i++) {
    if (String(vals[i][idIdx]) === String(id)) {
      hoja.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false };
}

// ─── Migración: agregar columna grupo (ejecutar UNA vez) ──────────────────────

function migrarAgregarGrupo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  _migrarColumnaGrupo(ss.getSheetByName('pedidos'),   4); // después de cliente_id
  _migrarColumnaGrupo(ss.getSheetByName('historial'), 6); // después de cliente_id (col 5)
  SpreadsheetApp.flush();
  Logger.log('✅ Migración completada.');
}

function _migrarColumnaGrupo(hoja, posicion) {
  if (!hoja) return;
  const headers = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  if (headers.includes('grupo')) { Logger.log('⏭ ' + hoja.getName() + ': grupo ya existe.'); return; }
  hoja.insertColumnBefore(posicion);
  const cell = hoja.getRange(1, posicion);
  cell.setValue('grupo');
  cell.setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
  if (hoja.getLastRow() > 1) hoja.getRange(2, posicion, hoja.getLastRow() - 1, 1).setValue('IONA');
  Logger.log('✅ ' + hoja.getName() + ': columna grupo insertada.');
}

// ─── Test Drive (ejecutar una vez para autorizar acceso a Drive) ──────────────

function testDrive() {
  const carpeta = DriveApp.getFoldersByName('backupAppPan').hasNext()
    ? DriveApp.getFoldersByName('backupAppPan').next()
    : DriveApp.createFolder('backupAppPan');
  Logger.log('✅ Drive OK. Carpeta: ' + carpeta.getName() + ' — ID: ' + carpeta.getId());
}

// ─── Planillas ────────────────────────────────────────────────────────────────

function listarPlanillas() {
  return [
    { id: 'IONA',     nombre: 'Iona',     tipo: 'panaderia' },
    { id: 'SAN_JUAN', nombre: 'San Juan', tipo: 'panaderia' },
    { id: 'FACTURAS', nombre: 'Facturas', tipo: 'facturas'  },
    { id: 'PASCUAL',  nombre: 'Pascual',  tipo: 'panaderia' },
  ];
}
