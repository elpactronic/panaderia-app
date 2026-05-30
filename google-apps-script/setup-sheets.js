/**
 * PASO 1: Ejecutar esta función UNA sola vez para crear todas las hojas.
 * En Google Sheets: Extensiones → Apps Script → pegar este código → ejecutar setupPanaderia()
 */
function setupPanaderia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  crearHoja(ss, 'clientes', [
    'id', 'nombre', 'grupo', 'repartidor_id', 'retira_local', 'activo'
  ]);

  crearHoja(ss, 'repartidores', [
    'id', 'nombre'
  ]);

  crearHoja(ss, 'precios', [
    'producto', 'tipo', 'precio_unitario'
  ]);

  crearHoja(ss, 'pedidos', [
    'id', 'fecha', 'cliente_id',
    'frances_kg', 'minon_kg', 'sanguchero_kg', 'negro_kg',
    'tort_fina', 'tort_gruesa', 'bollito', 'cuernito_tomate',
    'fact_crema', 'media_luna', 'sacra_vigilante',
    'monto_total', 'status',
    'hora_pedido', 'embolsador', 'hora_embolsado', 'notas'
  ]);

  crearHoja(ss, 'config', [
    'clave', 'valor'
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
  hojaConfig.getRange('A2:B3').setValues([
    ['hora_cierre_pedidos', '23:59'],
    ['version_app',         '1.0.0'],
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
      case 'listar_precios':      resultado = listarPrecios();             break;
      case 'listar_pedidos':      resultado = listarPedidos(datos.fecha);  break;
      case 'crear_pedido':        resultado = crearPedido(datos);          break;
      case 'actualizar_pedido':   resultado = actualizarPedido(datos);     break;
      case 'cancelar_pedido':     resultado = cancelarPedido(datos.id);    break;
      case 'guardar_cliente':     resultado = guardarCliente(datos);       break;
      case 'guardar_precio':      resultado = guardarPrecio(datos);        break;
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
  return filas
    .filter(f => f.some(c => c !== ''))
    .map(fila => Object.fromEntries(headers.map((h, i) => [h, fila[i]])));
}

function listarClientes() {
  return hojaAObjetos('clientes').filter(c => c.activo !== false && c.activo !== 'FALSE');
}

function listarRepartidores() {
  return hojaAObjetos('repartidores');
}

function listarPrecios() {
  return hojaAObjetos('precios');
}

function listarPedidos(fecha) {
  const todos = hojaAObjetos('pedidos');
  return fecha ? todos.filter(p => p.fecha === fecha) : todos;
}

// ─── Helpers de escritura ──────────────────────────────────────────────────────

function crearPedido(datos) {
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('pedidos');
  const id = 'ped_' + Date.now();
  const ahora = new Date().toISOString();

  const fila = [
    id,
    datos.fecha,
    datos.cliente_id,
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
    if (vals[i][idIdx] === datos.id) {
      Object.entries(datos).forEach(([key, val]) => {
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
  const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('clientes');
  if (datos.id) {
    // update
    const vals  = hoja.getDataRange().getValues();
    const heads = vals[0];
    const idIdx = heads.indexOf('id');
    for (let i = 1; i < vals.length; i++) {
      if (vals[i][idIdx] === datos.id) {
        Object.entries(datos).forEach(([key, val]) => {
          const col = heads.indexOf(key);
          if (col >= 0) hoja.getRange(i + 1, col + 1).setValue(val);
        });
        return { actualizado: datos.id };
      }
    }
  }
  // insert
  const id = 'cli_' + Date.now();
  hoja.appendRow([id, datos.nombre, datos.grupo, datos.repartidor_id, datos.retira_local || false, true]);
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
