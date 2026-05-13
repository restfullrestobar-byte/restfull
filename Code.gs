// ============================================================
//  RESTFUL RESTOBAR — Sistema Unificado v2.2
//  - Evaluaciones (intacto)
//  - Fidelización con fecha_nacimiento + whatsapp_optin
//  - Eventos editables desde Sheets + notificación a clientes
//  Google Apps Script (Code.gs)
// ============================================================

// ============ EVALUACIONES ============
var SHEET_NAME = 'Evaluaciones';
var EMAIL_TO   = 'bryanligabow@gmail.com,frealejandroayala2001@gmail.com';
var LOGO_URL   = 'https://drive.google.com/uc?export=view&id=16wwiJdF9G2-EdVCj9wVr7WR6JYsTG62N';

// ============ HOJAS ============
const SHEETS = {
  CLIENTES:   'Clientes',
  TRANSACC:   'Transacciones',
  CANJES:     'Canjes',
  PASSWORDS:  'Passwords_Diarias',
  CONFIG:     'Configuracion',
  LOG_FAIL:   'Intentos_Fallidos',
  RECOMPENSAS:'Recompensas',
  WEBHOOKS:   'Webhooks',
  IDEMPOTENCY:'Idempotency',
  EVENTOS:    'Eventos'
};

// Headers actualizados — orden EXACTO que coincide con tu hoja Clientes actual.
// (id, nombre, telefono, email, fecha_registro, puntos_actuales, puntos_totales_historicos,
//  nivel, acepto_terminos, fecha_aceptacion, ultima_acumulacion, C.I, fecha_nacimiento, whatsapp_optin)
const HEADERS = {
  [SHEETS.CLIENTES]:    ['id','nombre','telefono','email','fecha_registro','puntos_actuales','puntos_totales_historicos','nivel','acepto_terminos','fecha_aceptacion','ultima_acumulacion','C.I','fecha_nacimiento','whatsapp_optin'],
  [SHEETS.TRANSACC]:    ['id','cliente_id','telefono','fecha_hora','puntos_ganados','password_usada','ip_cliente','idempotency_key'],
  [SHEETS.CANJES]:      ['id','cliente_id','telefono','fecha','recompensa_id','recompensa_nombre','puntos_canjeados','codigo','estado','fecha_canjeado'],
  [SHEETS.PASSWORDS]:   ['fecha','password_6_digitos','fecha_envio_correo','enviado_a'],
  [SHEETS.CONFIG]:      ['parametro','valor','descripcion'],
  [SHEETS.LOG_FAIL]:    ['fecha_hora','telefono','password_intentada','ip'],
  [SHEETS.RECOMPENSAS]: ['id','nombre','descripcion','costo_pts','nivel_minimo','stock','activo','imagen_url'],
  [SHEETS.WEBHOOKS]:    ['evento','url','activo','descripcion'],
  [SHEETS.IDEMPOTENCY]: ['key','fecha','accion','resultado'],
  [SHEETS.EVENTOS]:     ['id','tipo','dia_semana','fecha','titulo','subtitulo','hora_inicio','hora_fin','icon','color','active','notificado']
};

const CONFIG_DEFAULTS = [
  ['restaurante_nombre',       'Restful Restobar',       'Nombre del restaurante'],
  ['restaurante_email_dueno',  'bryanligabow@gmail.com', 'Email del dueño para password diaria'],
  ['restaurante_telefono',     '+593 981 329 458',       'Teléfono del restaurante'],
  ['puntos_por_visita',        '50',                     'Puntos fijos por visita'],
  ['puntos_por_dolar',         '0',                      'Puntos por cada $1 (0 = visita fija)'],
  ['cooldown_horas',           '24',                     'Horas entre acumulaciones del mismo cliente'],
  ['sesion_minutos',           '60',                     'Duración de sesión del cliente en minutos'],
  ['max_intentos_password',    '5',                      'Máximo intentos fallidos por hora'],
  ['bloqueo_minutos',          '60',                     'Minutos de bloqueo tras superar intentos'],
  ['nivel_bronce_min',         '0',                      'Puntos mínimos nivel Bronce'],
  ['nivel_plata_min',          '500',                    'Puntos mínimos nivel Plata'],
  ['nivel_oro_min',            '1500',                   'Puntos mínimos nivel Oro'],
  ['admin_usuario',            'admin',                  'Usuario dashboard'],
  ['admin_password',           'cambiar123',             'Password dashboard (CAMBIAR)'],
  ['restaurante_lat',          '-3.679904',              'Latitud (geo-fence)'],
  ['restaurante_lng',          '-79.682335',             'Longitud (geo-fence)'],
  ['radio_metros',             '50',                     'Radio en metros'],
  ['leaderboard_limit',        '10',                     'Top N en ranking'],
  ['version_api',              '2.2',                    'Versión actual de la API'],
  ['evolution_url',            'https://contabilidad-mateai-evolution-api.dtuoap.easypanel.host', 'URL base Evolution API'],
  ['evolution_instance',       'mate-ai',                'Instancia Evolution'],
  ['evolution_apikey',         '429683C4C977415CAAFCCE10F7D57E11', 'API Key Evolution (privada)'],
  ['evolution_group_name',     'limpieza de exterior y barra', 'Nombre exacto del grupo WhatsApp'],
  ['evolution_group_jid',      '',                       'JID del grupo (auto)'],
  ['weekly_report_emails',     'bryanligabow@gmail.com,frealejandroayala2001@gmail.com', 'Destinatarios informe semanal'],
  ['eventos_admin_token',      'restful-2026',           'Token para editar/notificar eventos (CAMBIAR)']
];

const REWARDS_DEFAULTS = [
  ['REW001','Cóctel gratis',          'Cualquier cóctel de la casa',                      200, 'Bronce',999,'SI',''],
  ['REW002','Entrada al evento',      'Entrada gratis al evento de la semana',            500, 'Bronce',999,'SI',''],
  ['REW003','50% en pedido personal', '50% off en 1 plato + 1 bebida',                    1000,'Plata', 999,'SI',''],
  ['REW004','Consumo $100',           'Canjea un consumo valorado en $100',               2000,'Oro',   999,'SI','']
];

// Estructura nueva de Eventos:
//   id          → identificador único (EVxxx)
//   tipo        → "recurrente" | "unico"
//   dia_semana  → solo si tipo=recurrente. 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
//   fecha       → solo si tipo=unico. Formato YYYY-MM-DD
//   titulo      → título del evento
//   subtitulo   → descripción corta
//   hora_inicio → entero 0-23 (ej. 20 = 8 PM)
//   hora_fin    → entero 0-24 (ej. 24 = medianoche)
//   icon        → nombre corto (mic, beer, soccer, fire, star, glass…) que el frontend mapea
//   color       → color hex para tema de la tarjeta (#c73838)
//   active      → TRUE/FALSE
//   notificado  → TRUE si ya se envió correo a clientes opt-in (evita duplicados)
const EVENTOS_DEFAULTS = [
  ['EV001','recurrente',5,'','Viernes de Karaoke','Abre tus cuerdas vocales con un cóctel en mano',20,24,'mic','#c73838','TRUE','FALSE'],
  ['EV002','recurrente',4,'','Jueves de Alitas','Alitas en promoción 2x1 toda la noche',20,24,'fire','#c73838','TRUE','FALSE'],
  ['EV003','recurrente',6,'','DJ y Karaoke','Música en vivo con DJ y noche de karaoke',21,24,'mic','#c73838','TRUE','FALSE'],
  ['EV004','unico','','2026-05-17','Intercambio de Cromos','Únete a nuestro intercambio Panini · nachos + 4 Club $14.99',16,20,'soccer','#C5A55A','TRUE','FALSE']
];

const RESET_REWARD_ID = 'REW004';
const RESET_THRESHOLD = 2000;

// ============================================================
//  SETUP
// ============================================================
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.getRange(1, 1, 1, 7).setValues([['Fecha/Hora','Mesera','Atención','Comida','¿Volvería?','Mesa','Comentario']]);
  sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#8B0000').setFontColor('#ffffff');

  Object.keys(HEADERS).forEach(function(name){
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]])
        .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#C5A55A');
      sh.setFrozenRows(1);
    }
  });

  var cfg = ss.getSheetByName(SHEETS.CONFIG);
  if (cfg.getLastRow() < 2) {
    cfg.getRange(2, 1, CONFIG_DEFAULTS.length, 3).setValues(CONFIG_DEFAULTS);
  } else {
    var existing = cfg.getRange(2, 1, cfg.getLastRow()-1, 1).getValues().map(function(r){return r[0];});
    CONFIG_DEFAULTS.forEach(function(d){
      if (existing.indexOf(d[0]) === -1) cfg.appendRow(d);
    });
  }

  var rew = ss.getSheetByName(SHEETS.RECOMPENSAS);
  if (rew.getLastRow() < 2) {
    rew.getRange(2, 1, REWARDS_DEFAULTS.length, REWARDS_DEFAULTS[0].length).setValues(REWARDS_DEFAULTS);
  }

  var evt = ss.getSheetByName(SHEETS.EVENTOS);
  if (evt.getLastRow() < 2) {
    evt.getRange(2, 1, EVENTOS_DEFAULTS.length, EVENTOS_DEFAULTS[0].length).setValues(EVENTOS_DEFAULTS);
    evt.getRange(2, 2, EVENTOS_DEFAULTS.length, 1).setNumberFormat('@');
  }

  SpreadsheetApp.getUi().alert('✅ Setup v2.2 completo.\n\nCambios:\n• Columnas Clientes: fecha_nacimiento + whatsapp_optin\n• Hoja Eventos con CRUD y notificación por correo');
}

// ============================================================
//  ROUTER
// ============================================================
function doPost(e) {
  try {
    var params;
    if (e.postData && e.postData.contents) {
      try { params = JSON.parse(e.postData.contents); } catch(_) { params = e.parameter || {}; }
    } else params = e.parameter || {};
    var ip = (e.parameter && e.parameter.ip) || params.ip || '';
    if (params.action) return jsonOut_(routeAction_(params, ip));
    return handleEvaluacion_(params);
  } catch (err) {
    console.log('doPost error: ' + err);
    return jsonOut_({ ok:false, error: String(err && err.message || err) });
  }
}

function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (params.action) return jsonOut_(routeAction_(params, params.ip || ''));
    return ContentService.createTextOutput('Restful Restobar — API v2.2 activa')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return jsonOut_({ ok:false, error: String(err && err.message || err) });
  }
}

function routeAction_(params, ip) {
  switch (params.action) {
    case 'getConfig':       return getPublicConfig_();
    case 'register':        return register_(params);
    case 'login':           return login_(params);
    case 'getClient':       return getClient_(params);
    case 'getDashboard':    return getDashboard_(params);
    case 'getRewards':      return getRewards_(params);
    case 'getLeaderboard':  return getLeaderboard_(params);
    case 'getHistory':      return getHistory_(params);

    // EVENTOS
    case 'getEvents':       return getEvents_(params);
    case 'addEvent':        return withLock_(function(){ return addEvent_(params); });
    case 'updateEvent':     return withLock_(function(){ return updateEvent_(params); });
    case 'deleteEvent':     return withLock_(function(){ return deleteEvent_(params); });
    case 'notifyEvent':     return withLock_(function(){ return notifyEvent_(params); });

    case 'accumulate':      return withLock_(function(){ return accumulate_(params, ip); });
    case 'redeemReward':    return withLock_(function(){ return redeemReward_(params, ip); });
    case 'markRedeemed':    return withLock_(function(){ return markRedeemed_(params); });
    default: return { ok:false, error:'Acción no válida: ' + params.action };
  }
}

// ============================================================
//  REGISTRO con fecha_nacimiento + whatsapp_optin
// ============================================================
function register_(p) {
  var v = validate_('register', p);
  if (!v.ok) return v;

  var nombre   = String(p.nombre).trim();
  var telefono = normalizePhone_(p.telefono);
  var email    = String(p.email).trim().toLowerCase();
  var fechaNac = p.fecha_nacimiento ? String(p.fecha_nacimiento) : '';
  var waOptin  = (p.whatsapp_optin === true || String(p.whatsapp_optin).toUpperCase() === 'TRUE' || String(p.whatsapp_optin).toUpperCase() === 'SI');

  var existing = findClientByPhone_(telefono);
  if (existing) return { ok:false, error:'Ya estás registrado. Usa iniciar sesión.' };

  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTES);
  var id = 'C' + Date.now();
  var H = HEADERS[SHEETS.CLIENTES];

  // Construir fila en el orden EXACTO de los headers
  var nextRow = sh.getLastRow() + 1;
  // Forzar columna teléfono y fecha_nacimiento como texto plano
  sh.getRange(nextRow, H.indexOf('telefono')+1).setNumberFormat('@');
  sh.getRange(nextRow, H.indexOf('fecha_nacimiento')+1).setNumberFormat('@');
  if (H.indexOf('C.I') !== -1) sh.getRange(nextRow, H.indexOf('C.I')+1).setNumberFormat('@');

  var rowData = H.map(function(k){
    switch (k) {
      case 'id': return id;
      case 'nombre': return nombre;
      case 'telefono': return telefono;
      case 'email': return email;
      case 'fecha_registro': return new Date();
      case 'puntos_actuales': return 0;
      case 'puntos_totales_historicos': return 0;
      case 'nivel': return 'Bronce';
      case 'acepto_terminos': return 'SI';
      case 'fecha_aceptacion': return new Date();
      case 'ultima_acumulacion': return '';
      case 'C.I': return '';
      case 'fecha_nacimiento': return fechaNac;
      case 'whatsapp_optin': return waOptin ? 'SI' : 'NO';
      default: return '';
    }
  });
  sh.appendRow(rowData);

  try { sendWelcomeEmail_(nombre, email, readConfig()); } catch (e) { console.log('welcome email error: ' + e); }
  fireWebhook_('client_registered', { clientId:id, telefono:telefono, nombre:nombre });

  return { ok:true, cliente:{
    id:id, nombre:nombre, telefono:telefono, email:email,
    fecha_nacimiento:fechaNac, whatsapp_optin: waOptin ? 'SI' : 'NO',
    puntos_actuales:0, puntos_totales_historicos:0, nivel:'Bronce'
  } };
}

// ============================================================
//  EVENTOS — CRUD + NOTIFICACIÓN
// ============================================================
// Lectura pública. Filtros opcionales:
//   ?action=getEvents              → eventos del mes en curso (expande recurrentes)
//   ?action=getEvents&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//   ?action=getEvents&fecha=YYYY-MM-DD
function getEvents_(p) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.EVENTOS);
  if (!sh) return { ok:true, events: [] };
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var tz = Session.getScriptTimeZone();

  // Rango por defecto: mes actual completo
  var today = new Date();
  var defDesde = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth(), 1), tz, 'yyyy-MM-dd');
  var defHasta = Utilities.formatDate(new Date(today.getFullYear(), today.getMonth()+2, 0), tz, 'yyyy-MM-dd');

  var fecha = p.fecha ? String(p.fecha) : null;
  var desde = p.desde ? String(p.desde) : (fecha || defDesde);
  var hasta = p.hasta ? String(p.hasta) : (fecha || defHasta);

  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    H.forEach(function(k, j){ row[k] = data[i][j]; });
    if (!row.id) continue;
    if (!truthy_(row.active)) continue;

    var tipo = String(row.tipo || '').toLowerCase();

    if (tipo === 'unico') {
      var fechaStr = (row.fecha instanceof Date)
        ? Utilities.formatDate(row.fecha, tz, 'yyyy-MM-dd')
        : String(row.fecha || '').substring(0, 10);
      if (!fechaStr) continue;
      if (fechaStr < desde || fechaStr > hasta) continue;
      out.push(buildEventInstance_(row, fechaStr));
    } else if (tipo === 'recurrente') {
      var dia = parseInt(row.dia_semana, 10);
      if (isNaN(dia) || dia < 0 || dia > 6) continue;
      var d0 = new Date(desde + 'T00:00:00');
      var d1 = new Date(hasta + 'T00:00:00');
      var cursor = new Date(d0);
      // Avanzar hasta el primer día de la semana correcto
      while (cursor.getDay() !== dia && cursor <= d1) cursor.setDate(cursor.getDate() + 1);
      while (cursor <= d1) {
        var fStr = Utilities.formatDate(cursor, tz, 'yyyy-MM-dd');
        out.push(buildEventInstance_(row, fStr));
        cursor.setDate(cursor.getDate() + 7);
      }
    }
  }

  out.sort(function(a, b){
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return (Number(a.hora_inicio) || 0) - (Number(b.hora_inicio) || 0);
  });

  return { ok:true, events: out };
}

function buildEventInstance_(row, fechaISO) {
  return {
    id: row.id,
    tipo: row.tipo,
    dia_semana: row.dia_semana,
    fecha: fechaISO,
    titulo: row.titulo,
    subtitulo: row.subtitulo,
    hora_inicio: Number(row.hora_inicio) || 0,
    hora_fin: Number(row.hora_fin) || 0,
    icon: row.icon,
    color: row.color || '#c73838',
    active: true,
    notificado: truthy_(row.notificado)
  };
}

function truthy_(v) {
  if (v === true) return true;
  var s = String(v || '').toUpperCase().trim();
  return s === 'TRUE' || s === 'SI' || s === 'YES' || s === '1';
}

function addEvent_(p) {
  var auth = checkAdminToken_(p);
  if (!auth.ok) return auth;
  var v = validateEvent_(p);
  if (!v.ok) return v;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var H = HEADERS[SHEETS.EVENTOS];
  var id = p.id || ('EV' + Date.now());
  var tipo = String(p.tipo || 'unico').toLowerCase();

  var row = H.map(function(k){
    switch (k) {
      case 'id':           return id;
      case 'tipo':         return tipo;
      case 'dia_semana':   return (tipo === 'recurrente') ? (parseInt(p.dia_semana, 10) || 0) : '';
      case 'fecha':        return (tipo === 'unico') ? String(p.fecha || '') : '';
      case 'titulo':       return String(p.titulo || '');
      case 'subtitulo':    return String(p.subtitulo || '');
      case 'hora_inicio':  return parseInt(p.hora_inicio, 10) || 0;
      case 'hora_fin':     return parseInt(p.hora_fin, 10) || 0;
      case 'icon':         return String(p.icon || 'star');
      case 'color':        return String(p.color || '#c73838');
      case 'active':       return truthy_(p.active === undefined ? 'TRUE' : p.active) ? 'TRUE' : 'FALSE';
      case 'notificado':   return 'FALSE';
      default: return '';
    }
  });
  var nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, H.indexOf('fecha') + 1).setNumberFormat('@');
  sh.appendRow(row);

  if (truthy_(p.notify)) {
    try { notifyEvent_({ token: p.token, id: id }); } catch (e) { console.log('notify error: ' + e); }
  }

  return { ok:true, id: id };
}

function updateEvent_(p) {
  var auth = checkAdminToken_(p);
  if (!auth.ok) return auth;
  if (!p.id) return { ok:false, error:'Falta id' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var idxId = H.indexOf('id');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(p.id)) {
      H.forEach(function(k, j){
        if (k === 'id') return;
        if (Object.prototype.hasOwnProperty.call(p, k)) {
          var val = p[k];
          if (k === 'active' || k === 'notificado') val = truthy_(val) ? 'TRUE' : 'FALSE';
          if (k === 'fecha') { sh.getRange(i+1, j+1).setNumberFormat('@'); val = String(val); }
          if (k === 'hora_inicio' || k === 'hora_fin' || k === 'dia_semana') val = parseInt(val, 10) || 0;
          sh.getRange(i+1, j+1).setValue(val);
        }
      });
      return { ok:true, id: p.id };
    }
  }
  return { ok:false, error:'Evento no encontrado: ' + p.id };
}

function deleteEvent_(p) {
  var auth = checkAdminToken_(p);
  if (!auth.ok) return auth;
  if (!p.id) return { ok:false, error:'Falta id' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var idxId = H.indexOf('id');
  var idxActive = H.indexOf('active');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(p.id)) {
      if (p.hard === true || String(p.hard).toLowerCase() === 'true') {
        sh.deleteRow(i + 1);
        return { ok:true, deleted: 'hard', id: p.id };
      }
      sh.getRange(i+1, idxActive + 1).setValue('FALSE');
      return { ok:true, deleted: 'soft', id: p.id };
    }
  }
  return { ok:false, error:'Evento no encontrado: ' + p.id };
}

function validateEvent_(p) {
  if (!p.titulo || !String(p.titulo).trim()) return { ok:false, error:'titulo requerido' };
  var tipo = String(p.tipo || 'unico').toLowerCase();
  if (tipo === 'unico') {
    if (!p.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha))) return { ok:false, error:'fecha inválida para evento único (YYYY-MM-DD)' };
  } else if (tipo === 'recurrente') {
    var d = parseInt(p.dia_semana, 10);
    if (isNaN(d) || d < 0 || d > 6) return { ok:false, error:'dia_semana debe ser 0-6 (0=Dom, 6=Sáb)' };
  } else {
    return { ok:false, error:'tipo debe ser "unico" o "recurrente"' };
  }
  return { ok:true };
}

function checkAdminToken_(p) {
  var cfg = readConfig();
  var expected = String(cfg.eventos_admin_token || '').trim();
  var got = String(p.token || '').trim();
  if (!expected) return { ok:false, error:'Token admin no configurado' };
  if (got !== expected) return { ok:false, error:'Token inválido' };
  return { ok:true };
}

// Notifica un evento por CORREO a todos los clientes con whatsapp_optin = SI/TRUE
// Marca el evento como notificado=TRUE para evitar duplicados (a menos que p.force=true)
function notifyEvent_(p) {
  var auth = checkAdminToken_(p);
  if (!auth.ok) return auth;
  if (!p.id) return { ok:false, error:'Falta id del evento' };

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var idxId = H.indexOf('id');
  var idxNot = H.indexOf('notificado');
  var eventRow = -1, event = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idxId]) === String(p.id)) {
      eventRow = i + 1;
      event = {};
      H.forEach(function(k, j){ event[k] = data[i][j]; });
      break;
    }
  }
  if (!event) return { ok:false, error:'Evento no encontrado: ' + p.id };
  if (!truthy_(event.active)) return { ok:false, error:'El evento está inactivo' };
  if (truthy_(event.notificado) && !truthy_(p.force)) {
    return { ok:false, error:'Evento ya notificado. Usa force=true para reenviar.' };
  }

  var tz = Session.getScriptTimeZone();
  if (event.fecha instanceof Date) event.fecha = Utilities.formatDate(event.fecha, tz, 'yyyy-MM-dd');

  // Recolectar destinatarios con opt-in
  var cliSh = ss.getSheetByName(SHEETS.CLIENTES);
  var cliData = cliSh.getDataRange().getValues();
  var Hc = HEADERS[SHEETS.CLIENTES];
  var idxEmail = Hc.indexOf('email');
  var idxNom   = Hc.indexOf('nombre');
  var idxOpt   = Hc.indexOf('whatsapp_optin');
  var dest = [];
  for (var k = 1; k < cliData.length; k++) {
    if (truthy_(cliData[k][idxOpt])) {
      var em = String(cliData[k][idxEmail] || '').trim();
      if (em && em.indexOf('@') !== -1) {
        dest.push({ email: em, nombre: String(cliData[k][idxNom] || '') });
      }
    }
  }

  if (!dest.length) return { ok:false, error:'No hay clientes con opt-in' };

  var cfg = readConfig();
  var sent = 0, failed = 0;
  dest.forEach(function(d){
    try { sendEventEmail_(d.email, d.nombre, event, cfg); sent++; }
    catch (e) { failed++; console.log('event email error: ' + e); }
  });

  // Marcar notificado=TRUE
  sh.getRange(eventRow, idxNot + 1).setValue('TRUE');

  return { ok:true, evento: event.titulo, enviados: sent, fallidos: failed, total: dest.length };
}

// Mapa simple icon-key -> emoji para el correo
var EVENT_ICON_MAP_ = {
  mic:'🎤', music:'🎵', dj:'🎧', soccer:'⚽', ball:'⚽',
  fire:'🔥', beer:'🍺', glass:'🍸', cocktail:'🍸', wine:'🍷',
  star:'⭐', gift:'🎁', party:'🎉', heart:'❤️', trophy:'🏆',
  food:'🍽️', burger:'🍔', wings:'🍗', steak:'🥩'
};

function iconToEmoji_(icon) {
  var k = String(icon || '').toLowerCase().trim();
  return EVENT_ICON_MAP_[k] || '🎉';
}

function sendEventEmail_(to, nombre, ev, cfg) {
  cfg = cfg || readConfig();
  var rest = cfg.restaurante_nombre || 'Restful Restobar';
  var emoji = iconToEmoji_(ev.icon);
  var subject = emoji + ' ' + ev.titulo + ' — ' + rest;
  var bg='#0a0a0a', card='#111111', accent='#8B0000', gold='#C5A55A', goldSoft='#D4B96E', textMain='#E8E0D4', border='#1e1e1e';
  var color = String(ev.color || '#c73838');

  var DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var fechaHum = '';
  if (String(ev.tipo).toLowerCase() === 'recurrente') {
    var d = parseInt(ev.dia_semana, 10);
    if (!isNaN(d)) fechaHum = 'Todos los ' + DAYS[d] + 's';
  } else if (ev.fecha) {
    var p = String(ev.fecha).split('-');
    var dt = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    fechaHum = DAYS[dt.getDay()] + ' ' + dt.getDate() + ' de ' + MONTHS[dt.getMonth()] + ', ' + dt.getFullYear();
  }
  var horaHum = '';
  if (ev.hora_inicio || ev.hora_fin) {
    horaHum = String(ev.hora_inicio || 0).padStart(2,'0') + ':00 — ' + String(ev.hora_fin || 0).padStart(2,'0') + ':00';
  }

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
  '<body style="margin:0;padding:0;background-color:#e8e8e8;font-family:Georgia,serif;">' +
  '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8e8e8;"><tr><td align="center" style="padding:30px 10px;">' +
  '<table width="580" cellpadding="0" cellspacing="0" style="background-color:'+card+';border-radius:8px;overflow:hidden;">' +
  '<tr><td style="height:4px;background:'+color+';font-size:0;line-height:0;">&nbsp;</td></tr>' +
  '<tr><td style="background-color:'+bg+';padding:36px 40px 12px;text-align:center;">' +
  '<img src="'+LOGO_URL+'" width="80" height="80" alt="Restful" style="display:block;margin:0 auto 16px;" />' +
  '<p style="margin:0;font-family:Georgia,serif;font-size:11px;color:'+color+';letter-spacing:5px;text-transform:uppercase;">Evento en ' + rest + '</p>' +
  '<h1 style="margin:14px 0 6px;font-family:Georgia,serif;font-size:30px;color:#fff;font-weight:400;letter-spacing:1px;line-height:1.15;">' + emoji + ' ' + ev.titulo + '</h1>' +
  (fechaHum ? '<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:14px;color:'+goldSoft+';">' + fechaHum + (horaHum ? ' · ' + horaHum : '') + '</p>' : '') +
  '</td></tr>' +
  (ev.subtitulo ? '<tr><td style="padding:14px 40px 24px;background-color:'+bg+';text-align:center;"><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:'+textMain+';line-height:1.7;">' + ev.subtitulo + '</p></td></tr>' : '') +
  '<tr><td style="padding:0 40px 28px;background-color:'+bg+';text-align:center;">' +
  '<p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#888;line-height:1.7;">Te esperamos, ' + (nombre ? nombre.split(' ')[0] + '. ' : '') + 'Reserva al ' + (cfg.restaurante_telefono||'') + '.</p>' +
  '</td></tr>' +
  '<tr><td style="padding:18px 40px;text-align:center;background-color:'+card+';border-top:1px solid '+border+';">' +
  '<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:13px;color:'+accent+';letter-spacing:3px;">RESTFUL</p>' +
  '<p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#444;letter-spacing:2px;">RECIBES ESTO PORQUE ACTIVASTE NOTIFICACIONES DE EVENTOS</p>' +
  '</td></tr>' +
  '<tr><td style="height:3px;background:'+color+';font-size:0;line-height:0;">&nbsp;</td></tr>' +
  '</table></td></tr></table></body></html>';

  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
}

function seedEvents() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.EVENTOS);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.EVENTOS);
    sh.getRange(1, 1, 1, HEADERS[SHEETS.EVENTOS].length).setValues([HEADERS[SHEETS.EVENTOS]])
      .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#C5A55A');
    sh.setFrozenRows(1);
  }
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, EVENTOS_DEFAULTS.length, EVENTOS_DEFAULTS[0].length).setValues(EVENTOS_DEFAULTS);
    sh.getRange(2, 2, EVENTOS_DEFAULTS.length, 1).setNumberFormat('@');
    Logger.log('✅ ' + EVENTOS_DEFAULTS.length + ' eventos insertados.');
  } else {
    Logger.log('La hoja Eventos ya tiene datos.');
  }
}

function testGetEvents() {
  Logger.log(JSON.stringify(getEvents_({}), null, 2));
}

// Disparar notificación manual de un evento (desde editor o trigger manual)
// 1) edita la variable EVT_ID con el id que quieres notificar
// 2) corre la función
function testNotifyEvent() {
  var cfg = readConfig();
  var EVT_ID = 'E004'; // <-- cambia aquí el ID del evento
  var r = notifyEvent_({ token: cfg.eventos_admin_token, id: EVT_ID });
  Logger.log(JSON.stringify(r, null, 2));
}

// ============================================================
//  EVALUACIONES (intacto)
// ============================================================
function handleEvaluacion_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setup(); sheet = ss.getSheetByName(SHEET_NAME); }
  sheet.appendRow([
    data.fecha || new Date().toLocaleString('es', {timeZone:'America/Guayaquil'}),
    data.mesera || '', data.atencion || 0, data.comida || 0,
    data.volveria || '', data.mesa || '', data.comentario || ''
  ]);
  sendPremiumEmail(data);
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function stars(n) {
  var num = parseInt(n) || 0;
  var html = '';
  for (var i = 1; i <= 5; i++) {
    html += '<td style="padding:0 1px;"><span style="font-size:18px;color:' + (i <= num ? '#C5A55A' : '#2a2a2a') + ';">&#9733;</span></td>';
  }
  return '<table cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>' + html +
    '<td style="padding-left:8px;font-family:Georgia,serif;font-size:14px;color:#C5A55A;font-weight:bold;">' + num + '/5</td></tr></table>';
}

function sendPremiumEmail(data) {
  var mesera = data.mesera || 'No especificada';
  var subject = 'Nueva Evaluación | ' + mesera + ' — Restful Restobar';
  var bg='#0a0a0a', card='#111111', accent='#8B0000', gold='#C5A55A', goldSoft='#D4B96E', textMain='#E8E0D4', textSoft='#888888', border='#1e1e1e';
  var volColor = (data.volveria === 'Sí') ? '#5CB85C' : ((data.volveria === 'No') ? '#D9534F' : '#888');
  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#e8e8e8;font-family:Georgia,serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#e8e8e8;"><tr><td align="center" style="padding:30px 10px;"><table width="580" cellpadding="0" cellspacing="0" style="background-color:'+card+';border-radius:8px;overflow:hidden;"><tr><td style="height:3px;background:linear-gradient(90deg,'+gold+','+goldSoft+','+gold+');font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="background-color:'+bg+';padding:36px 40px 28px;text-align:center;"><img src="'+LOGO_URL+'" width="100" height="100" alt="Restful" style="display:block;margin:0 auto 0;" /></td></tr><tr><td style="padding:0 40px;background-color:'+bg+';"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-bottom:1px solid #222;">&nbsp;</td></tr></table></td></tr><tr><td style="background-color:'+bg+';padding:22px 40px 28px;text-align:center;"><p style="margin:0;font-family:Georgia,serif;font-size:11px;color:'+gold+';letter-spacing:4px;text-transform:uppercase;">Nueva evaluación recibida</p></td></tr><tr><td style="padding:0 40px;"><table width="100%" cellpadding="0" cellspacing="0">' +
    row('Mesera','<span style="font-family:Georgia,serif;font-size:15px;color:#fff;font-weight:bold;">'+mesera+'</span>',border) +
    row('Atención',stars(data.atencion),border) +
    row('Comida',stars(data.comida),border) +
    row('¿Volvería?','<span style="font-family:Georgia,serif;font-size:14px;color:'+volColor+';font-weight:bold;">'+(data.volveria||'—')+'</span>',border) +
    row('Mesa','<span style="font-family:Georgia,serif;font-size:14px;color:'+textMain+';">'+(data.mesa||'No especificada')+'</span>',border) +
    '<tr><td style="padding:18px 0;font-family:Arial,sans-serif;font-size:12px;color:'+textSoft+';vertical-align:middle;">Fecha / Hora</td><td style="padding:18px 0;font-family:Arial,sans-serif;font-size:12px;color:#666;">'+(data.fecha||new Date().toLocaleString('es',{timeZone:'America/Guayaquil'}))+'</td></tr></table></td></tr><tr><td style="padding:20px 40px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0d0d0d;border-radius:6px;overflow:hidden;"><tr><td style="width:4px;background-color:'+gold+';"></td><td style="padding:20px 24px;"><p style="margin:0 0 8px;font-family:Arial,sans-serif;font-size:9px;color:'+gold+';text-transform:uppercase;letter-spacing:3px;font-weight:bold;">Comentario del cliente</p><p style="margin:0;font-family:Georgia,serif;font-size:14px;color:'+textMain+';font-style:italic;line-height:1.6;">'+(data.comentario||'Sin comentario')+'</p></td></tr></table></td></tr><tr><td style="padding:24px 40px;text-align:center;border-top:1px solid '+border+';"><p style="margin:0 0 4px;font-family:Georgia,serif;font-size:13px;color:'+accent+';letter-spacing:3px;">RESTFUL</p><p style="margin:0;font-family:Arial,sans-serif;font-size:9px;color:#444;letter-spacing:2px;">SISTEMA AUTOMÁTICO DE EVALUACIONES</p></td></tr><tr><td style="height:3px;background:linear-gradient(90deg,'+gold+','+goldSoft+','+gold+');font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr></table></body></html>';
  MailApp.sendEmail({ to: EMAIL_TO, subject: subject, htmlBody: html });
}

function row(label, value, borderColor) {
  return '<tr><td style="padding:18px 0;border-bottom:1px solid '+borderColor+';font-family:Arial,sans-serif;font-size:12px;color:#777;vertical-align:middle;width:35%;">'+label+'</td><td style="padding:18px 0;border-bottom:1px solid '+borderColor+';vertical-align:middle;">'+value+'</td></tr>';
}

// ============================================================
//  ⬇️ PEGA DEBAJO DE ESTA LÍNEA el resto de tu Code.gs original
//  empezando por:  function sendWelcomeEmail_(...) {  hasta el final
//  (cron password, accumulate_, dashboard, helpers, informe semanal, evolution API, etc.)
//
//  Lo que YA cambié arriba y NO debes duplicar:
//   - SHEETS, HEADERS, CONFIG_DEFAULTS, REWARDS_DEFAULTS, EVENTOS_DEFAULTS
//   - setup(), doPost(), doGet(), routeAction_(), register_(), handleEvaluacion_(),
//     stars(), sendPremiumEmail(), row()
//   - Funciones nuevas de Eventos: getEvents_, addEvent_, updateEvent_, deleteEvent_,
//     validateEvent_, checkAdminToken_, notifyEvent_, sendEventEmail_, seedEvents, testNotifyEvent
// ============================================================
