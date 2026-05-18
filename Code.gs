// ============================================================
//  RESTFUL RESTOBAR — Sistema Unificado v2.2 (COMPLETO)
//  - Evaluaciones
//  - Fidelización con fecha_nacimiento + whatsapp_optin
//  - Eventos editables desde Sheets + notificación
//  Google Apps Script (Code.gs)
// ============================================================

var SHEET_NAME = 'Evaluaciones';
var EMAIL_TO   = 'bryanligabow@gmail.com,frealejandroayala2001@gmail.com';
var LOGO_URL   = 'https://drive.google.com/uc?export=view&id=16wwiJdF9G2-EdVCj9wVr7WR6JYsTG62N';

const SHEETS = {
  CLIENTES:'Clientes', TRANSACC:'Transacciones', CANJES:'Canjes',
  PASSWORDS:'Passwords_Diarias', CONFIG:'Configuracion', LOG_FAIL:'Intentos_Fallidos',
  RECOMPENSAS:'Recompensas', WEBHOOKS:'Webhooks', IDEMPOTENCY:'Idempotency', EVENTOS:'Eventos'
};

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
  ['restaurante_nombre','Restful Restobar','Nombre del restaurante'],
  ['restaurante_email_dueno','bryanligabow@gmail.com','Email del dueño para password diaria'],
  ['restaurante_telefono','+593 981 329 458','Teléfono del restaurante'],
  ['puntos_por_visita','50','Puntos fijos por visita'],
  ['puntos_por_dolar','0','Puntos por cada $1 (0 = visita fija)'],
  ['cooldown_horas','24','Horas entre acumulaciones'],
  ['sesion_minutos','60','Duración sesión cliente (min)'],
  ['max_intentos_password','5','Máximo intentos fallidos por hora'],
  ['bloqueo_minutos','60','Minutos de bloqueo tras superar intentos'],
  ['nivel_bronce_min','0','Puntos mínimos Bronce'],
  ['nivel_plata_min','500','Puntos mínimos Plata'],
  ['nivel_oro_min','1500','Puntos mínimos Oro'],
  ['admin_usuario','admin','Usuario dashboard'],
  ['admin_password','cambiar123','Password dashboard (CAMBIAR)'],
  ['restaurante_lat','-3.679904','Latitud (geo-fence)'],
  ['restaurante_lng','-79.682335','Longitud (geo-fence)'],
  ['radio_metros','50','Radio en metros'],
  ['leaderboard_limit','10','Top N ranking'],
  ['version_api','2.2','Versión actual de la API'],
  ['evolution_url','https://contabilidad-mateai-evolution-restfull.dtuoap.easypanel.host','URL Evolution API REWARDS (clientes / eventos / bienvenida)'],
  ['evolution_instance','RestFull-Rerwards','Instancia Evolution REWARDS'],
  ['evolution_apikey','429683C4C977415CAAFCCE10F7D57E11','API Key Evolution REWARDS (privada)'],
  ['evolution_group_name','limpieza de exterior y barra','Nombre del grupo WhatsApp del staff'],
  ['evolution_group_jid','','JID del grupo staff (auto)'],
  ['evolution_url_staff','https://contabilidad-mateai-evolution-api.dtuoap.easypanel.host','URL Evolution API STAFF (mate-ai, grupo password)'],
  ['evolution_instance_staff','mate-ai','Instancia Evolution STAFF (grupo password)'],
  ['evolution_apikey_staff','429683C4C977415CAAFCCE10F7D57E11','API Key Evolution STAFF (privada)'],
  ['weekly_report_emails','bryanligabow@gmail.com,frealejandroayala2001@gmail.com','Destinatarios informe semanal'],
  ['eventos_admin_token','restful-2026','Token para editar/notificar eventos (CAMBIAR)'],
  ['notify_test_phone','968429494','MODO PRUEBA: si está lleno, los eventos solo se notifican a este teléfono. Vaciar para enviar a todos los opt-in'],
  ['notify_channels','both','Canales de notificación de eventos: email | whatsapp | both']
];

const REWARDS_DEFAULTS = [
  ['REW001','Cóctel gratis','Cualquier cóctel de la casa',200,'Bronce',999,'SI',''],
  ['REW002','Entrada al evento','Entrada gratis al evento de la semana',500,'Bronce',999,'SI',''],
  ['REW003','50% en pedido personal','50% off en 1 plato + 1 bebida',1000,'Plata',999,'SI',''],
  ['REW004','Consumo $100','Canjea un consumo valorado en $100',2000,'Oro',999,'SI','']
];

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
  if (cfg.getLastRow() < 2) cfg.getRange(2, 1, CONFIG_DEFAULTS.length, 3).setValues(CONFIG_DEFAULTS);
  else {
    var existing = cfg.getRange(2, 1, cfg.getLastRow()-1, 1).getValues().map(function(r){return r[0];});
    CONFIG_DEFAULTS.forEach(function(d){ if (existing.indexOf(d[0]) === -1) cfg.appendRow(d); });
  }

  var rew = ss.getSheetByName(SHEETS.RECOMPENSAS);
  if (rew.getLastRow() < 2) rew.getRange(2, 1, REWARDS_DEFAULTS.length, REWARDS_DEFAULTS[0].length).setValues(REWARDS_DEFAULTS);

  var evt = ss.getSheetByName(SHEETS.EVENTOS);
  if (evt.getLastRow() < 2) {
    evt.getRange(2, 1, EVENTOS_DEFAULTS.length, EVENTOS_DEFAULTS[0].length).setValues(EVENTOS_DEFAULTS);
    evt.getRange(2, 2, EVENTOS_DEFAULTS.length, 1).setNumberFormat('@');
  }

  SpreadsheetApp.getUi().alert('✅ Setup v2.2 completo.');
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'dailyPasswordJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyPasswordJob').timeBased().atHour(6).everyDays(1).create();
  SpreadsheetApp.getUi().alert('✅ Trigger 6:00 AM instalado.');
}

function installMaintenanceTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    var fn = t.getHandlerFunction();
    if (fn === 'monthlyCleanupJob' || fn === 'weeklyBackupJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('monthlyCleanupJob').timeBased().onMonthDay(1).atHour(3).create();
  ScriptApp.newTrigger('weeklyBackupJob').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();
  SpreadsheetApp.getUi().alert('✅ Triggers de mantenimiento instalados.');
}

function installWeeklyReportTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'weeklyReportJob') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('weeklyReportJob').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  try { SpreadsheetApp.getUi().alert('✅ Informe semanal: lunes 8:00 AM.'); } catch(_){}
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
    case 'getEvents':       return getEvents_(params);
    case 'addEvent':        return withLock_(function(){ return addEvent_(params); });
    case 'updateEvent':     return withLock_(function(){ return updateEvent_(params); });
    case 'deleteEvent':     return withLock_(function(){ return deleteEvent_(params); });
    case 'notifyEvent':     return withLock_(function(){ params.viaApi = true; return notifyEvent_(params); });
    case 'accumulate':      return withLock_(function(){ return accumulate_(params, ip); });
    case 'redeemReward':    return withLock_(function(){ return redeemReward_(params, ip); });
    case 'markRedeemed':    return withLock_(function(){ return markRedeemed_(params); });
    default: return { ok:false, error:'Acción no válida: ' + params.action };
  }
}

// ============================================================
//  EVALUACIONES
// ============================================================
function handleEvaluacion_(data) {
  // Anti-spam: rechazar envíos vacíos (bots, prefetch, llamadas sin contenido)
  var mesera = String(data.mesera || '').trim();
  var atencion = parseInt(data.atencion, 10) || 0;
  var comida = parseInt(data.comida, 10) || 0;
  if (!mesera && atencion === 0 && comida === 0) {
    return ContentService.createTextOutput(JSON.stringify({status:'rejected', reason:'empty'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Validación mínima: requiere mesera + al menos una calificación
  if (!mesera || (atencion === 0 && comida === 0)) {
    return ContentService.createTextOutput(JSON.stringify({status:'rejected', reason:'incomplete'}))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Calificaciones fuera de rango = bot
  if (atencion < 0 || atencion > 5 || comida < 0 || comida > 5) {
    return ContentService.createTextOutput(JSON.stringify({status:'rejected', reason:'invalid_rating'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setup(); sheet = ss.getSheetByName(SHEET_NAME); }
  sheet.appendRow([
    data.fecha || new Date().toLocaleString('es', {timeZone:'America/Guayaquil'}),
    mesera, atencion, comida,
    data.volveria || '', data.mesa || '', data.comentario || ''
  ]);
  sendPremiumEmail(data);
  return ContentService.createTextOutput(JSON.stringify({status:'ok'})).setMimeType(ContentService.MimeType.JSON);
}

function stars(n) {
  var num = parseInt(n) || 0, html = '';
  for (var i = 1; i <= 5; i++) html += '<td style="padding:0 1px;"><span style="font-size:18px;color:' + (i <= num ? '#C5A55A' : '#2a2a2a') + ';">&#9733;</span></td>';
  return '<table cellpadding="0" cellspacing="0" style="display:inline-table;"><tr>' + html + '<td style="padding-left:8px;font-family:Georgia,serif;font-size:14px;color:#C5A55A;font-weight:bold;">' + num + '/5</td></tr></table>';
}

function sendPremiumEmail(data) {
  var mesera = data.mesera || 'No especificada';
  var subject = 'Nueva Evaluación | ' + mesera + ' — Restful Restobar';
  var bg='#0a0a0a', card='#111111', accent='#8B0000', gold='#C5A55A', goldSoft='#D4B96E', textMain='#E8E0D4', textSoft='#888888', border='#1e1e1e';
  var volColor = (data.volveria === 'Sí') ? '#5CB85C' : ((data.volveria === 'No') ? '#D9534F' : '#888');
  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#e8e8e8;font-family:Georgia,serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:30px 10px;"><table width="580" cellpadding="0" cellspacing="0" style="background:'+card+';border-radius:8px;overflow:hidden;"><tr><td style="height:3px;background:linear-gradient(90deg,'+gold+','+goldSoft+','+gold+');">&nbsp;</td></tr><tr><td style="background:'+bg+';padding:36px 40px 28px;text-align:center;"><img src="'+LOGO_URL+'" width="100" height="100"/></td></tr><tr><td style="background:'+bg+';padding:22px 40px 28px;text-align:center;"><p style="margin:0;font-family:Georgia,serif;font-size:11px;color:'+gold+';letter-spacing:4px;text-transform:uppercase;">Nueva evaluación recibida</p></td></tr><tr><td style="padding:0 40px;"><table width="100%" cellpadding="0" cellspacing="0">' +
    row('Mesera','<b style="color:#fff;">'+mesera+'</b>',border) +
    row('Atención',stars(data.atencion),border) +
    row('Comida',stars(data.comida),border) +
    row('¿Volvería?','<b style="color:'+volColor+';">'+(data.volveria||'—')+'</b>',border) +
    row('Mesa','<span style="color:'+textMain+';">'+(data.mesa||'No especificada')+'</span>',border) +
    '</table></td></tr><tr><td style="padding:20px 40px 30px;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border-radius:6px;"><tr><td style="width:4px;background:'+gold+';"></td><td style="padding:20px 24px;"><p style="margin:0 0 8px;font-size:9px;color:'+gold+';text-transform:uppercase;letter-spacing:3px;font-family:Arial,sans-serif;">Comentario</p><p style="margin:0;font-family:Georgia,serif;font-size:14px;color:'+textMain+';font-style:italic;">'+(data.comentario||'Sin comentario')+'</p></td></tr></table></td></tr><tr><td style="padding:24px 40px;text-align:center;border-top:1px solid '+border+';"><p style="margin:0;font-family:Georgia,serif;font-size:13px;color:'+accent+';letter-spacing:3px;">RESTFUL</p></td></tr></table></td></tr></table></body></html>';
  MailApp.sendEmail({ to: EMAIL_TO, subject: subject, htmlBody: html });
}

function row(label, value, borderColor) {
  return '<tr><td style="padding:18px 0;border-bottom:1px solid '+borderColor+';font-family:Arial,sans-serif;font-size:12px;color:#777;width:35%;">'+label+'</td><td style="padding:18px 0;border-bottom:1px solid '+borderColor+';">'+value+'</td></tr>';
}

// ============================================================
//  CRON DIARIO — Password
// ============================================================
function dailyPasswordJob() {
  var today = todayISO();
  var cfg = readConfig();
  var shP = SpreadsheetApp.getActive().getSheetByName(SHEETS.PASSWORDS);
  var tz = Session.getScriptTimeZone();
  var data = shP.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var raw = data[i][0];
    var rowDate = (raw instanceof Date) ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd') : String(raw).substring(0, 10);
    if (rowDate === today) { console.log('Ya existe password: ' + data[i][1]); return; }
  }
  var pwd = generate6DigitPassword();
  var nextRow = shP.getLastRow() + 1;
  shP.getRange(nextRow, 1).setNumberFormat('@');
  shP.getRange(nextRow, 2).setNumberFormat('@');
  shP.appendRow([today, pwd, new Date(), cfg.restaurante_email_dueno]);
  sendOwnerEmail_(pwd, cfg);
  sendDailyPasswordWhatsApp_(pwd, cfg);
  fireWebhook_('daily_password', { fecha: today });
}

function generate6DigitPassword() {
  var n; do { n = Math.floor(Math.random() * 900000) + 100000; } while (isTrivial_(n));
  return String(n);
}
function isTrivial_(n) { var s = String(n); return /^(\d)\1{5}$/.test(s) || s === '123456' || s === '654321' || s === '000000'; }

function sendOwnerEmail_(pwd, cfg) {
  var to = cfg.restaurante_email_dueno;
  if (!to || to.indexOf('@') === -1) { console.log('⚠️ Email no configurado. PWD: ' + pwd); return; }
  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MMM/yyyy');
  var name = cfg.restaurante_nombre || 'Restaurante';
  var subject = '🔐 Contraseña del día ' + name + ' — ' + fecha;
  var bg='#0a0a0a', card='#111111', gold='#C5A55A', goldSoft='#D4B96E';
  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#e8e8e8;"><table width="100%"><tr><td align="center" style="padding:30px 10px;"><table width="580" style="background:'+card+';border-radius:8px;overflow:hidden;"><tr><td style="height:3px;background:linear-gradient(90deg,'+gold+','+goldSoft+','+gold+');">&nbsp;</td></tr><tr><td style="background:'+bg+';padding:36px 40px;text-align:center;"><img src="'+LOGO_URL+'" width="100"/><p style="margin:20px 0 0;font-family:Georgia,serif;font-size:11px;color:'+gold+';letter-spacing:4px;text-transform:uppercase;">Contraseña de fidelización</p><p style="font-family:Arial;font-size:12px;color:#777;">' + fecha + '</p></td></tr><tr><td style="padding:10px 40px 30px;background:'+bg+';"><table width="100%" style="background:linear-gradient(135deg,'+gold+','+goldSoft+');border-radius:12px;"><tr><td style="padding:32px;text-align:center;font-family:Courier New,monospace;font-size:42px;font-weight:700;color:#1a1a1a;letter-spacing:14px;">' + pwd + '</td></tr></table></td></tr></table></td></tr></table></body></html>';
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
}

// ============================================================
//  FIDELIZACIÓN
// ============================================================
function withLock_(fn) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(5000); return fn(); }
  catch (e) { return { ok:false, error:'Sistema ocupado: ' + e.message }; }
  finally { try { lock.releaseLock(); } catch(_){} }
}

function register_(p) {
  var v = validate_('register', p);
  if (!v.ok) return v;
  var nombre = String(p.nombre).trim();
  var telefono = normalizePhone_(p.telefono);
  var email = String(p.email).trim().toLowerCase();
  var fechaNac = p.fecha_nacimiento ? String(p.fecha_nacimiento) : '';
  var waOptin = (p.whatsapp_optin === true || String(p.whatsapp_optin).toUpperCase() === 'TRUE' || String(p.whatsapp_optin).toUpperCase() === 'SI');
  if (findClientByPhone_(telefono)) return { ok:false, error:'Ya estás registrado. Usa iniciar sesión.' };

  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTES);
  var id = 'C' + Date.now();
  var H = HEADERS[SHEETS.CLIENTES];
  var nextRow = sh.getLastRow() + 1;
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
  var cfg = readConfig();
  try { sendWelcomeEmail_(nombre, email, cfg); } catch (e) { console.log('welcome email err: ' + e); }
  try { sendWelcomeWhatsApp_(nombre, telefono, cfg); } catch (e) { console.log('welcome wa err: ' + e); }
  fireWebhook_('client_registered', { clientId:id, telefono:telefono, nombre:nombre });
  return { ok:true, cliente:{ id:id, nombre:nombre, telefono:telefono, email:email, fecha_nacimiento:fechaNac, whatsapp_optin: waOptin ? 'SI' : 'NO', puntos_actuales:0, puntos_totales_historicos:0, nivel:'Bronce' } };
}

function sendWelcomeEmail_(nombre, email, cfg) {
  if (!email || email.indexOf('@') === -1) return;
  var rest = cfg.restaurante_nombre || 'Restful Restobar';
  var firstName = nombre.split(' ')[0];
  var subject = '🎁 Bienvenido a ' + rest + ' Rewards, ' + firstName + '!';
  var bg='#0a0a0a', card='#111111', gold='#C5A55A', goldSoft='#D4B96E', textMain='#E8E0D4', border='#1e1e1e';

  var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#e8e8e8;font-family:Georgia,serif;">' +
    '<table width="100%"><tr><td align="center" style="padding:30px 10px;">' +
    '<table width="580" style="background:'+card+';border-radius:8px;overflow:hidden;">' +
    '<tr><td style="height:3px;background:linear-gradient(90deg,'+gold+','+goldSoft+','+gold+');">&nbsp;</td></tr>' +
    '<tr><td style="background:'+bg+';padding:36px 40px 20px;text-align:center;">' +
      '<img src="'+LOGO_URL+'" width="100"/>' +
      '<p style="margin:14px 0 6px;font-family:Georgia,serif;font-size:11px;color:'+gold+';letter-spacing:5px;text-transform:uppercase;">Bienvenido al programa</p>' +
      '<h1 style="margin:14px 0 6px;color:#fff;font-weight:400;font-size:28px;">¡Hola, '+firstName+'!</h1>' +
      '<p style="color:rgba(232,224,212,0.6);font-family:Arial,sans-serif;font-size:13px;line-height:1.6;">Tu registro en <b style="color:'+gold+';">'+rest+' Rewards</b> fue exitoso.<br>Empieza a acumular puntos en cada visita.</p>' +
    '</td></tr>' +
    '<tr><td style="padding:0 40px 24px;background:'+bg+';">' +
      '<table width="100%" style="background:linear-gradient(135deg,rgba(197,165,90,0.12),rgba(139,0,0,0.08));border:1px solid rgba(197,165,90,0.25);border-radius:14px;"><tr><td style="padding:24px 22px;">' +
        '<p style="margin:0 0 12px;font-family:Georgia,serif;font-size:15px;color:'+gold+';">🎁 Tus premios</p>' +
        '<table width="100%"><tr><td style="padding:10px 0;border-bottom:1px solid '+border+';color:'+textMain+';font-family:Georgia,serif;font-size:13px;">Cóctel gratis</td><td style="padding:10px 0;border-bottom:1px solid '+border+';text-align:right;color:'+gold+';font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">200 pts</td></tr>' +
        '<tr><td style="padding:10px 0;border-bottom:1px solid '+border+';color:'+textMain+';font-family:Georgia,serif;font-size:13px;">Entrada al evento</td><td style="padding:10px 0;border-bottom:1px solid '+border+';text-align:right;color:'+gold+';font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">500 pts</td></tr>' +
        '<tr><td style="padding:10px 0;border-bottom:1px solid '+border+';color:'+textMain+';font-family:Georgia,serif;font-size:13px;">50% en pedido personal</td><td style="padding:10px 0;border-bottom:1px solid '+border+';text-align:right;color:'+gold+';font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">1.000 pts</td></tr>' +
        '<tr><td style="padding:10px 0;color:'+gold+';font-family:Georgia,serif;font-size:13px;font-weight:bold;">Consumo de $100</td><td style="padding:10px 0;text-align:right;color:'+gold+';font-family:Arial,sans-serif;font-size:12px;font-weight:bold;">2.000 pts</td></tr></table>' +
      '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 40px;text-align:center;background:'+card+';border-top:1px solid '+border+';">' +
      '<p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#8B0000;letter-spacing:3px;">RESTFUL</p>' +
    '</td></tr></table></td></tr></table></body></html>';

  MailApp.sendEmail({ to: email, subject: subject, htmlBody: html });
}

// WhatsApp de bienvenida al registrarse en Rewards (instancia Rewards)
function sendWelcomeWhatsApp_(nombre, telefono, cfg) {
  try {
    cfg = cfg || readConfig();
    var url = String(cfg.evolution_url || '').replace(/\/$/, '');
    var instance = String(cfg.evolution_instance || '');
    var apikey = String(cfg.evolution_apikey || '');
    if (!url || !instance || !apikey || !telefono) return { ok:false, error:'Config Evolution Rewards o teléfono faltante' };

    var num = String(telefono).replace(/\D/g, '');
    if (num.indexOf('593') !== 0) num = '593' + num.replace(/^0+/, '');

    var rest = cfg.restaurante_nombre || 'Restful Restobar';
    var firstName = nombre ? nombre.split(' ')[0] : 'amigo';
    var msg = [
      '¡Bienvenido a *' + rest + ' Rewards*, ' + firstName + '! 🎁',
      '',
      'Tu registro fue exitoso. Ya puedes empezar a acumular puntos en cada visita.',
      '',
      '━━━━━━━━━━━━━━━━━',
      '🏆 *TUS PREMIOS*',
      '━━━━━━━━━━━━━━━━━',
      '🍹 Cóctel gratis — *200 pts*',
      '🎟 Entrada al evento — *500 pts*',
      '💸 50% en pedido personal — *1.000 pts*',
      '🥂 Consumo de $100 — *2.000 pts*',
      '',
      '━━━━━━━━━━━━━━━━━',
      '📋 *CÓMO ACUMULAR*',
      '━━━━━━━━━━━━━━━━━',
      '1️⃣ Visítanos y disfruta el menú',
      '2️⃣ Pídele al mesero la contraseña del día',
      '3️⃣ Acredítate los puntos desde el menú digital',
      '4️⃣ Canjea tus premios cuando quieras',
      '',
      '✨ Al llegar a *2.000 pts* obtienes un consumo gratis de $100 y empiezas un nuevo ciclo.',
      '',
      'Te esperamos! 🥂',
      '_Equipo ' + rest + '_'
    ].join('\n');

    var res = UrlFetchApp.fetch(url + '/message/sendText/' + encodeURIComponent(instance), {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': apikey },
      payload: JSON.stringify({ number: num, text: msg }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return { ok:true, status: code };
    console.log('Welcome WA status ' + code + ': ' + res.getContentText());
    return { ok:false, status: code, error: res.getContentText() };
  } catch (e) {
    console.log('sendWelcomeWhatsApp_ err: ' + e);
    return { ok:false, error: String(e) };
  }
}

// Prueba: mandar bienvenida a Brayan sin tener que re-registrar
function testWelcomeMessages() {
  var cfg = readConfig();
  Logger.log('--- Email ---');
  try { sendWelcomeEmail_('Brayan Carrión', 'bryanligabow@gmail.com', cfg); Logger.log('✅ Email enviado'); }
  catch (e) { Logger.log('❌ Email: ' + e.message); }
  Logger.log('--- WhatsApp ---');
  var r = sendWelcomeWhatsApp_('Brayan Carrión', '968429494', cfg);
  Logger.log(JSON.stringify(r, null, 2));
}

function login_(p) {
  var telefono = normalizePhone_(p.telefono);
  if (!telefono) return { ok:false, error:'Teléfono inválido' };
  var c = findClientByPhone_(telefono);
  if (!c) return { ok:false, error:'No encontramos ese teléfono. Regístrate primero.' };
  return { ok:true, cliente: clientRowToObj_(c) };
}

function getClient_(p) {
  var c = findClientByPhone_(normalizePhone_(p.telefono));
  if (!c) return { ok:false, error:'Cliente no encontrado' };
  return { ok:true, cliente: clientRowToObj_(c) };
}

function accumulate_(p, ip) {
  var v = validate_('accumulate', p); if (!v.ok) return v;
  var telefono = normalizePhone_(p.telefono);
  var pwd = String(p.password).trim();
  var monto = parseFloat(p.monto || 0);
  var idemKey = p.idempotency_key || '';
  var cfg = readConfig();
  if (idemKey) { var prev = checkIdempotency_(idemKey); if (prev) return prev; }
  if (isPhoneBlocked_(telefono, cfg)) return { ok:false, error:'Demasiados intentos. Intenta más tarde.' };
  var c = findClientByPhone_(telefono);
  if (!c) return { ok:false, error:'Debes registrarte primero' };
  var H = HEADERS[SHEETS.CLIENTES];
  var lastIdx = H.indexOf('ultima_acumulacion');
  var last = c.row[lastIdx];
  if (last) {
    var diffH = (Date.now() - new Date(last).getTime()) / 36e5;
    var cd = parseFloat(cfg.cooldown_horas || '24');
    if (diffH < cd) return { ok:false, error:'Ya acumulaste puntos recientemente', cooldown_minutos_restantes: Math.ceil((cd-diffH)*60) };
  }
  var pwdHoy = getTodayPassword_();
  if (!pwdHoy) return { ok:false, error:'Password no disponible' };
  if (pwd !== pwdHoy) { logFailed_(telefono, pwd, ip); return { ok:false, error:'Contraseña incorrecta' }; }
  var pxd = parseFloat(cfg.puntos_por_dolar || '0');
  var pts = (pxd > 0 && monto > 0) ? Math.round(monto * pxd) : parseInt(cfg.puntos_por_visita || '50', 10);
  if (pts <= 0) return { ok:false, error:'Puntos inválidos' };
  if (pts > 5000) return { ok:false, error:'Puntos sospechosos' };
  var ss = SpreadsheetApp.getActive();
  var cliSh = ss.getSheetByName(SHEETS.CLIENTES);
  var rowIdx = c.rowIndex;
  var curr = Number(cliSh.getRange(rowIdx, H.indexOf('puntos_actuales')+1).getValue()) || 0;
  var total = Number(cliSh.getRange(rowIdx, H.indexOf('puntos_totales_historicos')+1).getValue()) || 0;
  var oldLevel = String(cliSh.getRange(rowIdx, H.indexOf('nivel')+1).getValue() || 'Bronce');
  var newCurr = curr + pts, newTotal = total + pts;
  var topeAlcanzado = false;
  if (newCurr > RESET_THRESHOLD) { newCurr = RESET_THRESHOLD; topeAlcanzado = true; }
  var newLevel = computeLevel_(newTotal, cfg);
  cliSh.getRange(rowIdx, H.indexOf('puntos_actuales')+1).setValue(newCurr);
  cliSh.getRange(rowIdx, H.indexOf('puntos_totales_historicos')+1).setValue(newTotal);
  cliSh.getRange(rowIdx, H.indexOf('nivel')+1).setValue(newLevel);
  cliSh.getRange(rowIdx, H.indexOf('ultima_acumulacion')+1).setValue(new Date());
  ss.getSheetByName(SHEETS.TRANSACC).appendRow(['T'+Date.now(), c.row[0], telefono, new Date(), pts, pwd, ip, idemKey]);
  var result = { ok:true, puntos_ganados: pts, puntos_actuales: newCurr, puntos_totales_historicos: newTotal, nivel: newLevel, nivel_subio: newLevel !== oldLevel, listo_para_canjear_max: newCurr >= RESET_THRESHOLD, tope_alcanzado: topeAlcanzado, reset_threshold: RESET_THRESHOLD, cooldown_horas: parseFloat(cfg.cooldown_horas || '24') };
  if (idemKey) saveIdempotency_(idemKey, 'accumulate', result);
  if (newLevel !== oldLevel) fireWebhook_('level_up', { clientId: c.row[0], oldLevel: oldLevel, newLevel: newLevel });
  fireWebhook_('points_accumulated', { clientId: c.row[0], pts: pts, total: newTotal });
  return result;
}

function getDashboard_(p) {
  var c = findClientByPhone_(normalizePhone_(p.telefono));
  if (!c) return { ok:false, error:'Cliente no encontrado' };
  var cfg = readConfig();
  var cliente = clientRowToObj_(c);
  var puntos = Number(cliente.puntos_totales_historicos) || 0;
  var plata = parseInt(cfg.nivel_plata_min || '500', 10);
  var oro = parseInt(cfg.nivel_oro_min || '1500', 10);
  var nextLevel = null, toNext = 0;
  if (puntos < plata) { nextLevel = 'Plata'; toNext = plata - puntos; }
  else if (puntos < oro) { nextLevel = 'Oro'; toNext = oro - puntos; }
  return { ok:true, cliente: cliente, nextLevel: nextLevel, puntos_para_siguiente: toNext };
}

function getRewards_(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.RECOMPENSAS);
  if (!sh) return { ok:true, rewards: [] };
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.RECOMPENSAS];
  var nivelCliente = null, puntosCliente = null;
  if (p.telefono) {
    var c = findClientByPhone_(normalizePhone_(p.telefono));
    if (c) {
      nivelCliente = String(c.row[HEADERS[SHEETS.CLIENTES].indexOf('nivel')] || 'Bronce');
      puntosCliente = Number(c.row[HEADERS[SHEETS.CLIENTES].indexOf('puntos_actuales')]) || 0;
    }
  }
  var rewards = [];
  for (var i = 1; i < data.length; i++) {
    var r = {};
    H.forEach(function(k, j){ r[k] = data[i][j]; });
    if (String(r.activo).toUpperCase() !== 'SI') continue;
    if (Number(r.stock) <= 0) continue;
    rewards.push(r);
  }
  rewards.sort(function(a,b){ return Number(a.costo_pts) - Number(b.costo_pts); });
  return { ok:true, rewards: rewards, cliente_puntos: puntosCliente, cliente_nivel: nivelCliente };
}

function redeemReward_(p, ip) {
  var v = validate_('redeem', p); if (!v.ok) return v;
  var telefono = normalizePhone_(p.telefono);
  var rewardId = String(p.recompensa_id).trim();
  var idemKey = p.idempotency_key || '';
  if (idemKey) { var prev = checkIdempotency_(idemKey); if (prev) return prev; }
  var c = findClientByPhone_(telefono);
  if (!c) return { ok:false, error:'Cliente no encontrado' };
  var ss = SpreadsheetApp.getActive();
  var rewSh = ss.getSheetByName(SHEETS.RECOMPENSAS);
  var rewData = rewSh.getDataRange().getValues();
  var Hr = HEADERS[SHEETS.RECOMPENSAS];
  var rewardRow = -1, reward = null;
  for (var i = 1; i < rewData.length; i++) {
    if (String(rewData[i][Hr.indexOf('id')]) === rewardId) { rewardRow = i + 1; reward = {}; Hr.forEach(function(k,j){ reward[k] = rewData[i][j]; }); break; }
  }
  if (!reward) return { ok:false, error:'Recompensa no encontrada' };
  if (String(reward.activo).toUpperCase() !== 'SI') return { ok:false, error:'No disponible' };
  if (Number(reward.stock) <= 0) return { ok:false, error:'Sin stock' };
  var Hc = HEADERS[SHEETS.CLIENTES];
  var cliSh = ss.getSheetByName(SHEETS.CLIENTES);
  var puntos = Number(cliSh.getRange(c.rowIndex, Hc.indexOf('puntos_actuales')+1).getValue()) || 0;
  var costo = Number(reward.costo_pts);
  if (puntos < costo) return { ok:false, error:'Puntos insuficientes (tienes '+puntos+', necesitas '+costo+')' };
  var puntosRestantes, fueReset = false;
  if (rewardId === RESET_REWARD_ID) { puntosRestantes = 0; fueReset = true; }
  else puntosRestantes = puntos - costo;
  cliSh.getRange(c.rowIndex, Hc.indexOf('puntos_actuales')+1).setValue(puntosRestantes);
  rewSh.getRange(rewardRow, Hr.indexOf('stock')+1).setValue(Number(reward.stock) - 1);
  var codigo = generateRedeemCode_();
  var canjeId = 'K' + Date.now();
  ss.getSheetByName(SHEETS.CANJES).appendRow([canjeId, c.row[0], telefono, new Date(), rewardId, reward.nombre, costo, codigo, 'pendiente', '']);
  var result = { ok:true, canje_id: canjeId, codigo: codigo, recompensa: reward.nombre, puntos_canjeados: costo, puntos_restantes: puntosRestantes, fue_reset: fueReset };
  if (idemKey) saveIdempotency_(idemKey, 'redeem', result);
  return result;
}

function markRedeemed_(p) {
  var codigo = String(p.codigo || '').trim().toUpperCase();
  if (!codigo) return { ok:false, error:'Falta código' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CANJES);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.CANJES];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H.indexOf('codigo')]).toUpperCase() === codigo) {
      if (String(data[i][H.indexOf('estado')]) === 'canjeado') return { ok:false, error:'Ya canjeado' };
      sh.getRange(i+1, H.indexOf('estado')+1).setValue('canjeado');
      sh.getRange(i+1, H.indexOf('fecha_canjeado')+1).setValue(new Date());
      return { ok:true, recompensa: data[i][H.indexOf('recompensa_nombre')] };
    }
  }
  return { ok:false, error:'Código no encontrado' };
}

function getLeaderboard_(p) {
  var cfg = readConfig();
  var limit = parseInt(p.limit || cfg.leaderboard_limit || '10', 10);
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTES);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.CLIENTES];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var nombre = String(data[i][H.indexOf('nombre')] || '');
    var pts = Number(data[i][H.indexOf('puntos_totales_historicos')]) || 0;
    if (nombre && pts > 0) rows.push({ nombre: nombre.split(' ')[0]+' '+(nombre.split(' ')[1]||'').charAt(0)+'.', puntos: pts, nivel: data[i][H.indexOf('nivel')] || 'Bronce' });
  }
  rows.sort(function(a,b){ return b.puntos - a.puntos; });
  return { ok:true, leaderboard: rows.slice(0, limit) };
}

function getHistory_(p) {
  var telefono = normalizePhone_(p.telefono);
  if (!telefono) return { ok:false, error:'Teléfono inválido' };
  var ss = SpreadsheetApp.getActive();
  var trData = ss.getSheetByName(SHEETS.TRANSACC).getDataRange().getValues();
  var Ht = HEADERS[SHEETS.TRANSACC];
  var items = [];
  for (var i = 1; i < trData.length; i++) {
    if (String(trData[i][Ht.indexOf('telefono')]) === telefono) items.push({ tipo:'acumulacion', fecha: trData[i][Ht.indexOf('fecha_hora')], puntos: Number(trData[i][Ht.indexOf('puntos_ganados')]) });
  }
  items.sort(function(a,b){ return new Date(b.fecha).getTime() - new Date(a.fecha).getTime(); });
  return { ok:true, historial: items.slice(0, parseInt(p.limit||'20', 10)) };
}

function getPublicConfig_() {
  var cfg = readConfig();
  return { ok:true, nombre: cfg.restaurante_nombre, telefono: cfg.restaurante_telefono, puntos_por_visita: parseInt(cfg.puntos_por_visita||'50',10), sesion_minutos: parseInt(cfg.sesion_minutos||'60',10), cooldown_horas: parseFloat(cfg.cooldown_horas||'24'), nivel_bronce_min: parseInt(cfg.nivel_bronce_min||'0',10), nivel_plata_min: parseInt(cfg.nivel_plata_min||'500',10), nivel_oro_min: parseInt(cfg.nivel_oro_min||'1500',10), restaurante_lat: parseFloat(cfg.restaurante_lat||'0'), restaurante_lng: parseFloat(cfg.restaurante_lng||'0'), radio_metros: parseInt(cfg.radio_metros||'50',10), version_api: cfg.version_api||'2.2' };
}

// ============================================================
//  EVENTOS — CRUD + NOTIFICACIÓN
// ============================================================
function truthy_(v) { if (v === true) return true; var s = String(v||'').toUpperCase().trim(); return s === 'TRUE' || s === 'SI' || s === 'YES' || s === '1'; }

function getEvents_(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  if (!sh) return { ok:true, events: [] };
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var tz = Session.getScriptTimeZone();
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
      var fechaStr = (row.fecha instanceof Date) ? Utilities.formatDate(row.fecha, tz, 'yyyy-MM-dd') : String(row.fecha || '').substring(0, 10);
      if (!fechaStr) continue;
      if (fechaStr < desde || fechaStr > hasta) continue;
      out.push(buildEventInstance_(row, fechaStr));
    } else if (tipo === 'recurrente') {
      var dia = parseInt(row.dia_semana, 10);
      if (isNaN(dia) || dia < 0 || dia > 6) continue;
      var d0 = new Date(desde + 'T00:00:00');
      var d1 = new Date(hasta + 'T00:00:00');
      var cursor = new Date(d0);
      while (cursor.getDay() !== dia && cursor <= d1) cursor.setDate(cursor.getDate() + 1);
      while (cursor <= d1) {
        out.push(buildEventInstance_(row, Utilities.formatDate(cursor, tz, 'yyyy-MM-dd')));
        cursor.setDate(cursor.getDate() + 7);
      }
    }
  }
  out.sort(function(a, b){ if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1; return (Number(a.hora_inicio)||0) - (Number(b.hora_inicio)||0); });
  return { ok:true, events: out };
}

function buildEventInstance_(row, fechaISO) {
  return { id: row.id, tipo: row.tipo, dia_semana: row.dia_semana, fecha: fechaISO, titulo: row.titulo, subtitulo: row.subtitulo, hora_inicio: Number(row.hora_inicio)||0, hora_fin: Number(row.hora_fin)||0, icon: row.icon, color: row.color||'#c73838', active: true, notificado: truthy_(row.notificado) };
}

function addEvent_(p) {
  var auth = checkAdminToken_(p); if (!auth.ok) return auth;
  var v = validateEvent_(p); if (!v.ok) return v;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var H = HEADERS[SHEETS.EVENTOS];
  var id = p.id || ('EV' + Date.now());
  var tipo = String(p.tipo || 'unico').toLowerCase();
  var row = H.map(function(k){
    switch (k) {
      case 'id': return id;
      case 'tipo': return tipo;
      case 'dia_semana': return (tipo === 'recurrente') ? (parseInt(p.dia_semana, 10) || 0) : '';
      case 'fecha': return (tipo === 'unico') ? String(p.fecha || '') : '';
      case 'titulo': return String(p.titulo || '');
      case 'subtitulo': return String(p.subtitulo || '');
      case 'hora_inicio': return parseInt(p.hora_inicio, 10) || 0;
      case 'hora_fin': return parseInt(p.hora_fin, 10) || 0;
      case 'icon': return String(p.icon || 'star');
      case 'color': return String(p.color || '#c73838');
      case 'active': return truthy_(p.active === undefined ? 'TRUE' : p.active) ? 'TRUE' : 'FALSE';
      case 'notificado': return 'FALSE';
      default: return '';
    }
  });
  var nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, H.indexOf('fecha') + 1).setNumberFormat('@');
  sh.appendRow(row);
  // Por defecto: notificar automáticamente al crear (sin necesidad de mandar notify=true)
  var shouldNotify = (p.notify === undefined) ? true : truthy_(p.notify);
  if (shouldNotify) {
    try { notifyEvent_({ id: id }); } catch (e) { console.log('notify err: ' + e); }
  }
  return { ok:true, id: id };
}

// =================== AUTO-NOTIFICACIÓN AL EDITAR EL SHEET ===================
// Función pública para escanear toda la hoja Eventos y notificar
// los que tengan active=TRUE y notificado=FALSE. Marca notificado=TRUE.
function notifyPendingEvents() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  if (!sh || sh.getLastRow() < 2) { Logger.log('Sin eventos.'); return; }
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var pending = [];
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][H.indexOf('id')] || '').trim();
    var active = truthy_(data[i][H.indexOf('active')]);
    var notificado = truthy_(data[i][H.indexOf('notificado')]);
    if (id && active && !notificado) pending.push(id);
  }
  if (!pending.length) { Logger.log('No hay eventos pendientes.'); return; }
  Logger.log('Eventos pendientes: ' + pending.join(', '));
  pending.forEach(function(id){
    try {
      var r = notifyEvent_({ id: id });
      Logger.log(id + ' -> ' + JSON.stringify(r));
    } catch (e) {
      Logger.log(id + ' err: ' + e);
    }
  });
}

// Trigger onEdit instalable: cada vez que se edite la hoja Eventos,
// dispara notificación de los pendientes.
function onEditEventos(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== SHEETS.EVENTOS) return;
    if (e.range.getRow() === 1) return; // ignorar header
    // Esperar un poquito para evitar disparos durante edición rápida
    Utilities.sleep(800);
    notifyPendingEvents();
  } catch (err) {
    console.log('onEditEventos err: ' + err);
  }
}

// Instala el trigger onEdit (correr UNA vez desde el editor)
function installEventEditTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'onEditEventos') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditEventos')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  SpreadsheetApp.getUi().alert('✅ Trigger onEdit instalado. Editar la hoja Eventos disparará notificaciones automáticas.');
}

function updateEvent_(p) {
  var auth = checkAdminToken_(p); if (!auth.ok) return auth;
  if (!p.id) return { ok:false, error:'Falta id' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H.indexOf('id')]) === String(p.id)) {
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
  var auth = checkAdminToken_(p); if (!auth.ok) return auth;
  if (!p.id) return { ok:false, error:'Falta id' };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H.indexOf('id')]) === String(p.id)) {
      if (truthy_(p.hard)) { sh.deleteRow(i + 1); return { ok:true, deleted:'hard', id: p.id }; }
      sh.getRange(i+1, H.indexOf('active') + 1).setValue('FALSE');
      return { ok:true, deleted:'soft', id: p.id };
    }
  }
  return { ok:false, error:'Evento no encontrado' };
}

function validateEvent_(p) {
  if (!p.titulo || !String(p.titulo).trim()) return { ok:false, error:'titulo requerido' };
  var tipo = String(p.tipo || 'unico').toLowerCase();
  if (tipo === 'unico') {
    if (!p.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(p.fecha))) return { ok:false, error:'fecha inválida (YYYY-MM-DD)' };
  } else if (tipo === 'recurrente') {
    var d = parseInt(p.dia_semana, 10);
    if (isNaN(d) || d < 0 || d > 6) return { ok:false, error:'dia_semana debe ser 0-6' };
  } else return { ok:false, error:'tipo debe ser "unico" o "recurrente"' };
  return { ok:true };
}

function checkAdminToken_(p) {
  var cfg = readConfig();
  var expected = String(cfg.eventos_admin_token || '').trim();
  if (!expected) return { ok:false, error:'Token admin no configurado' };
  if (String(p.token || '').trim() !== expected) return { ok:false, error:'Token inválido' };
  return { ok:true };
}

var EVENT_ICON_MAP_ = { mic:'🎤', music:'🎵', dj:'🎧', soccer:'⚽', ball:'⚽', fire:'🔥', beer:'🍺', glass:'🍸', cocktail:'🍸', wine:'🍷', star:'⭐', gift:'🎁', party:'🎉', heart:'❤️', trophy:'🏆', food:'🍽️', burger:'🍔', wings:'🍗', steak:'🥩' };
function iconToEmoji_(icon) { return EVENT_ICON_MAP_[String(icon||'').toLowerCase().trim()] || '🎉'; }

function notifyEvent_(p) {
  // p.token NO es obligatorio si se llama desde código (auto-trigger). Solo se valida si viene de API externa.
  if (p.viaApi && !checkAdminToken_(p).ok) return checkAdminToken_(p);
  if (!p.id) return { ok:false, error:'Falta id del evento' };

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  var eventRow = -1, event = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][H.indexOf('id')]) === String(p.id)) {
      eventRow = i + 1; event = {}; H.forEach(function(k, j){ event[k] = data[i][j]; }); break;
    }
  }
  if (!event) return { ok:false, error:'Evento no encontrado' };
  if (!truthy_(event.active)) return { ok:false, error:'Evento inactivo' };
  if (truthy_(event.notificado) && !truthy_(p.force)) return { ok:false, error:'Ya notificado. Usa force=true.' };

  var tz = Session.getScriptTimeZone();
  if (event.fecha instanceof Date) event.fecha = Utilities.formatDate(event.fecha, tz, 'yyyy-MM-dd');

  var cfg = readConfig();
  var testPhone = normalizePhone_(cfg.notify_test_phone || '');
  var channels = String(cfg.notify_channels || 'both').toLowerCase();
  var sendEmail = (channels === 'email' || channels === 'both');
  var sendWa    = (channels === 'whatsapp' || channels === 'both');

  // Recolectar destinatarios
  var cliSh = ss.getSheetByName(SHEETS.CLIENTES);
  var cliData = cliSh.getDataRange().getValues();
  var Hc = HEADERS[SHEETS.CLIENTES];
  var dest = [];
  for (var k = 1; k < cliData.length; k++) {
    var telCli = normalizePhone_(cliData[k][Hc.indexOf('telefono')]);
    var optin = truthy_(cliData[k][Hc.indexOf('whatsapp_optin')]);

    // MODO PRUEBA: solo este teléfono
    if (testPhone) {
      if (telCli !== testPhone) continue;
    } else {
      if (!optin) continue;
    }

    var em = String(cliData[k][Hc.indexOf('email')] || '').trim();
    var nom = String(cliData[k][Hc.indexOf('nombre')] || '');
    dest.push({ telefono: telCli, email: em, nombre: nom });
  }
  if (!dest.length) return { ok:false, error: testPhone ? 'No se encontró el teléfono de prueba ('+testPhone+') en Clientes' : 'No hay clientes con opt-in' };

  var emailSent = 0, emailFail = 0, waSent = 0, waFail = 0;
  dest.forEach(function(d){
    if (sendEmail && d.email && d.email.indexOf('@') !== -1) {
      try { sendEventEmail_(d.email, d.nombre, event, cfg); emailSent++; } catch (e) { emailFail++; console.log('email err: ' + e); }
    }
    if (sendWa && d.telefono) {
      var r = sendEventWhatsApp_(d.telefono, d.nombre, event, cfg);
      if (r && r.ok) waSent++; else waFail++;
    }
  });

  sh.getRange(eventRow, H.indexOf('notificado') + 1).setValue('TRUE');
  return {
    ok: true,
    evento: event.titulo,
    modo_prueba: !!testPhone,
    test_phone: testPhone || null,
    total_destinatarios: dest.length,
    email: { enviados: emailSent, fallidos: emailFail },
    whatsapp: { enviados: waSent, fallidos: waFail }
  };
}

// Manda mensaje WhatsApp del evento a un teléfono individual usando Evolution API (instancia Rewards)
function sendEventWhatsApp_(telefono, nombre, ev, cfg) {
  try {
    cfg = cfg || readConfig();
    var url = String(cfg.evolution_url || '').replace(/\/$/, '');
    var instance = String(cfg.evolution_instance || '');
    var apikey = String(cfg.evolution_apikey || '');
    if (!url || !instance || !apikey) return { ok:false, error:'Evolution no configurada' };

    // Normalizar teléfono y agregar código país Ecuador (593) si no lo tiene
    var num = String(telefono).replace(/\D/g, '');
    if (num.indexOf('593') !== 0) num = '593' + num.replace(/^0+/, '');

    var msg = buildEventWhatsAppMessage_(nombre, ev, cfg);
    var res = UrlFetchApp.fetch(url + '/message/sendText/' + encodeURIComponent(instance), {
      method: 'post',
      contentType: 'application/json',
      headers: { 'apikey': apikey },
      payload: JSON.stringify({ number: num, text: msg }),
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) return { ok:true, status: code };
    console.log('Evolution sendText status ' + code + ': ' + res.getContentText());
    return { ok:false, status: code, error: res.getContentText() };
  } catch (e) {
    console.log('sendEventWhatsApp_ err: ' + e);
    return { ok:false, error: String(e) };
  }
}

function buildEventWhatsAppMessage_(nombre, ev, cfg) {
  var rest = cfg.restaurante_nombre || 'Restful Restobar';
  var emoji = iconToEmoji_(ev.icon);
  var DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var fechaHum = '';
  if (String(ev.tipo).toLowerCase() === 'recurrente') {
    var d = parseInt(ev.dia_semana, 10);
    if (!isNaN(d)) fechaHum = 'Todos los ' + DAYS[d] + 's';
  } else if (ev.fecha) {
    var p = String(ev.fecha).split('-');
    var dt = new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
    fechaHum = DAYS[dt.getDay()] + ' ' + dt.getDate() + ' de ' + MONTHS[dt.getMonth()];
  }
  var horaHum = (ev.hora_inicio || ev.hora_fin) ? (String(ev.hora_inicio||0)+'h — '+String(ev.hora_fin||0)+'h') : '';
  var firstName = nombre ? nombre.split(' ')[0] : 'amigo';

  var lines = [
    '¡Hola *' + firstName + '*! ' + emoji,
    '',
    'Tenemos un nuevo evento en *' + rest + '*:',
    '',
    '*' + ev.titulo + '*'
  ];
  if (ev.subtitulo) lines.push('_' + ev.subtitulo + '_');
  lines.push('');
  if (fechaHum) lines.push('📅 ' + fechaHum);
  if (horaHum)  lines.push('🕐 ' + horaHum);
  lines.push('');
  lines.push('Reserva al ' + (cfg.restaurante_telefono || '') + '.');
  lines.push('Te esperamos! 🥂');
  return lines.join('\n');
}

function sendEventEmail_(to, nombre, ev, cfg) {
  cfg = cfg || readConfig();
  var rest = cfg.restaurante_nombre || 'Restful Restobar';
  var emoji = iconToEmoji_(ev.icon);
  var subject = emoji + ' ' + ev.titulo + ' — ' + rest;
  var bg='#0a0a0a', card='#111111', gold='#C5A55A', textMain='#E8E0D4';
  var color = String(ev.color || '#c73838');
  var DAYS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  var MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var fechaHum = '';
  if (String(ev.tipo).toLowerCase() === 'recurrente') {
    var d = parseInt(ev.dia_semana, 10);
    if (!isNaN(d)) fechaHum = 'Todos los ' + DAYS[d] + 's';
  } else if (ev.fecha) {
    var pp = String(ev.fecha).split('-');
    var dt = new Date(parseInt(pp[0]), parseInt(pp[1])-1, parseInt(pp[2]));
    fechaHum = DAYS[dt.getDay()] + ' ' + dt.getDate() + ' de ' + MONTHS[dt.getMonth()] + ', ' + dt.getFullYear();
  }
  var horaHum = (ev.hora_inicio || ev.hora_fin) ? (String(ev.hora_inicio||0)+':00 — '+String(ev.hora_fin||0)+':00') : '';
  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#e8e8e8;font-family:Georgia,serif;"><table width="100%"><tr><td align="center" style="padding:30px 10px;"><table width="580" style="background:'+card+';border-radius:8px;overflow:hidden;"><tr><td style="height:4px;background:'+color+';">&nbsp;</td></tr><tr><td style="background:'+bg+';padding:36px 40px 12px;text-align:center;"><img src="'+LOGO_URL+'" width="80"/><p style="margin:14px 0 0;font-size:11px;color:'+color+';letter-spacing:5px;text-transform:uppercase;">Evento en '+rest+'</p><h1 style="margin:14px 0 6px;color:#fff;font-weight:400;font-size:30px;">'+emoji+' '+ev.titulo+'</h1>'+(fechaHum?'<p style="margin:6px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#D4B96E;">'+fechaHum+(horaHum?' · '+horaHum:'')+'</p>':'')+'</td></tr>'+(ev.subtitulo?'<tr><td style="padding:14px 40px 24px;background:'+bg+';text-align:center;"><p style="margin:0;font-family:Arial,sans-serif;color:'+textMain+';">'+ev.subtitulo+'</p></td></tr>':'')+'<tr><td style="padding:18px 40px;text-align:center;background:'+card+';border-top:1px solid #1e1e1e;"><p style="margin:0;font-family:Georgia,serif;font-size:13px;color:#8B0000;letter-spacing:3px;">RESTFUL</p></td></tr></table></td></tr></table></body></html>';
  MailApp.sendEmail({ to: to, subject: subject, htmlBody: html });
}

// ============================================================
//  VALIDACIÓN + HELPERS
// ============================================================
function validate_(action, p) {
  switch (action) {
    case 'register':
      if (!String(p.nombre || '').trim()) return { ok:false, error:'Falta nombre' };
      if (!normalizePhone_(p.telefono)) return { ok:false, error:'Teléfono inválido' };
      if (!p.email || String(p.email).indexOf('@')===-1) return { ok:false, error:'Email inválido' };
      if (!p.acepto_terminos) return { ok:false, error:'Debes aceptar los términos' };
      return { ok:true };
    case 'accumulate':
      if (!normalizePhone_(p.telefono)) return { ok:false, error:'Teléfono inválido' };
      if (!/^\d{6}$/.test(String(p.password || '').trim())) return { ok:false, error:'Contraseña 6 dígitos' };
      return { ok:true };
    case 'redeem':
      if (!normalizePhone_(p.telefono)) return { ok:false, error:'Teléfono inválido' };
      if (!p.recompensa_id) return { ok:false, error:'Falta recompensa_id' };
      return { ok:true };
  }
  return { ok:true };
}

function jsonOut_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function readConfig() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('cfg_v2');
  if (cached) { try { return JSON.parse(cached); } catch(_){} }
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  var cfg = {};
  for (var i = 1; i < data.length; i++) { if (data[i][0]) cfg[String(data[i][0]).trim()] = data[i][1]; }
  try { cache.put('cfg_v2', JSON.stringify(cfg), 300); } catch(_){}
  return cfg;
}

function clearConfigCache() { try { CacheService.getScriptCache().remove('cfg_v2'); } catch(_){} }

function normalizePhone_(raw) {
  if (!raw) return '';
  var s = String(raw).replace(/\D/g, '');
  if (s.length > 10 && s.indexOf('593') === 0) s = s.substring(3);
  s = s.replace(/^0+/, '');
  if (s.length < 7) return '';
  return s;
}

function phoneMatches_(stored, target) { var a = normalizePhone_(stored), b = normalizePhone_(target); return a && b && a === b; }

function findClientByPhone_(tel) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTES);
  var data = sh.getDataRange().getValues();
  var idx = HEADERS[SHEETS.CLIENTES].indexOf('telefono');
  var target = normalizePhone_(tel);
  if (!target) return null;
  for (var i = 1; i < data.length; i++) { if (phoneMatches_(data[i][idx], target)) return { row:data[i], rowIndex:i+1 }; }
  return null;
}

function clientRowToObj_(c) {
  var h = HEADERS[SHEETS.CLIENTES], o = {};
  h.forEach(function(k, i){ o[k] = c.row[i]; });
  return o;
}

function getTodayPassword_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.PASSWORDS);
  var today = todayISO();
  var tz = Session.getScriptTimeZone();
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var raw = data[i][0];
    var rowDate = (raw instanceof Date) ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd') : String(raw).substring(0, 10);
    if (rowDate === today) {
      var pwd = String(data[i][1]);
      while (pwd.length < 6) pwd = '0' + pwd;
      return pwd;
    }
  }
  var newPwd = generate6DigitPassword();
  var nextRow = sh.getLastRow() + 1;
  sh.getRange(nextRow, 1).setNumberFormat('@');
  sh.getRange(nextRow, 2).setNumberFormat('@');
  sh.appendRow([today, newPwd, new Date(), '(generated-on-demand)']);
  return newPwd;
}

function todayISO() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }
function logFailed_(telefono, pwd, ip) { SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG_FAIL).appendRow([new Date(), telefono, pwd, ip]); }

function isPhoneBlocked_(telefono, cfg) {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG_FAIL);
  var maxIntentos = parseInt(cfg.max_intentos_password || '5', 10);
  var bloqueoMin = parseInt(cfg.bloqueo_minutos || '60', 10);
  var data = sh.getDataRange().getValues();
  var cutoff = Date.now() - bloqueoMin * 60 * 1000;
  var cnt = 0;
  for (var i = 1; i < data.length; i++) { if (String(data[i][1]) === telefono && new Date(data[i][0]).getTime() > cutoff) cnt++; }
  return cnt >= maxIntentos;
}

function computeLevel_(totalPts, cfg) {
  var oro = parseInt(cfg.nivel_oro_min || '1500', 10);
  var plata = parseInt(cfg.nivel_plata_min || '500', 10);
  if (totalPts >= oro) return 'Oro';
  if (totalPts >= plata) return 'Plata';
  return 'Bronce';
}

function generateRedeemCode_() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
  for (var i = 0; i < 6; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function checkIdempotency_(key) {
  if (!key) return null;
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.IDEMPOTENCY);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { if (String(data[i][0]) === key) { try { return JSON.parse(String(data[i][3])); } catch(_) { return null; } } }
  return null;
}

function saveIdempotency_(key, action, result) {
  if (!key) return;
  SpreadsheetApp.getActive().getSheetByName(SHEETS.IDEMPOTENCY).appendRow([key, new Date(), action, JSON.stringify(result)]);
}

function fireWebhook_(event, payload) {
  try {
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.WEBHOOKS);
    if (!sh || sh.getLastRow() < 2) return;
    var data = sh.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === event && String(data[i][2]).toUpperCase() === 'SI') {
        UrlFetchApp.fetch(String(data[i][1]), { method:'post', contentType:'application/json', payload: JSON.stringify({ event:event, data:payload, timestamp:new Date().toISOString() }), muteHttpExceptions:true });
      }
    }
  } catch (e) { console.log('webhook err: ' + e); }
}

function monthlyCleanupJob() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.LOG_FAIL);
  var data = sh.getDataRange().getValues();
  if (data.length <= 1) return;
  var cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  var keep = [data[0]];
  for (var i = 1; i < data.length; i++) { if (new Date(data[i][0]).getTime() > cutoff) keep.push(data[i]); }
  sh.clearContents();
  sh.getRange(1, 1, keep.length, keep[0].length).setValues(keep);
}

function weeklyBackupJob() {
  try {
    var ss = SpreadsheetApp.getActive();
    var name = ss.getName() + ' — Backup ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    DriveApp.getFileById(ss.getId()).makeCopy(name);
  } catch (e) { console.log('backup err: ' + e); }
}

// ============================================================
//  INFORME SEMANAL — al grupo del staff (lunes 8:00 AM)
// ============================================================
function weeklyReportJob() {
  try {
    var cfg = readConfig();
    var tz = Session.getScriptTimeZone();
    var now = new Date();
    var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // ----- Clientes nuevos en la última semana -----
    var shC = SpreadsheetApp.getActive().getSheetByName(SHEETS.CLIENTES);
    var dataC = shC.getDataRange().getValues();
    var Hc = HEADERS[SHEETS.CLIENTES];
    var iFecha = Hc.indexOf('fecha_registro');
    var iNombre = Hc.indexOf('nombre');
    var iTel = Hc.indexOf('telefono');
    var iPts = Hc.indexOf('puntos_actuales');
    var iOptin = Hc.indexOf('whatsapp_optin');

    var nuevos = [];
    var totalClientes = 0;
    var totalOptin = 0;
    var totalPuntosActivos = 0;
    for (var i = 1; i < dataC.length; i++) {
      var nombre = String(dataC[i][iNombre] || '').trim();
      if (!nombre) continue;
      totalClientes++;
      if (truthy_(dataC[i][iOptin])) totalOptin++;
      totalPuntosActivos += Number(dataC[i][iPts] || 0);
      var fr = dataC[i][iFecha];
      var frDate = (fr instanceof Date) ? fr : new Date(fr);
      if (!isNaN(frDate.getTime()) && frDate.getTime() >= weekAgo.getTime()) {
        nuevos.push({
          nombre: nombre,
          telefono: String(dataC[i][iTel] || ''),
          fecha: Utilities.formatDate(frDate, tz, 'dd/MM HH:mm')
        });
      }
    }

    // ----- Canjes en la última semana -----
    var canjesCount = 0;
    var canjesDetalle = {};
    try {
      var shCanj = SpreadsheetApp.getActive().getSheetByName(SHEETS.CANJES);
      if (shCanj && shCanj.getLastRow() > 1) {
        var dC = shCanj.getDataRange().getValues();
        var Hcan = HEADERS[SHEETS.CANJES];
        var jFecha = Hcan.indexOf('fecha');
        var jNombre = Hcan.indexOf('recompensa_nombre');
        for (var j = 1; j < dC.length; j++) {
          var fc = dC[j][jFecha];
          var fcDate = (fc instanceof Date) ? fc : new Date(fc);
          if (!isNaN(fcDate.getTime()) && fcDate.getTime() >= weekAgo.getTime()) {
            canjesCount++;
            var rn = String(dC[j][jNombre] || 'Premio');
            canjesDetalle[rn] = (canjesDetalle[rn] || 0) + 1;
          }
        }
      }
    } catch (_) {}

    // ----- Acumulaciones (visitas) en la última semana -----
    var visitas = 0;
    var puntosEntregados = 0;
    try {
      var shT = SpreadsheetApp.getActive().getSheetByName(SHEETS.TRANSACC);
      if (shT && shT.getLastRow() > 1) {
        var dT = shT.getDataRange().getValues();
        var Ht = HEADERS[SHEETS.TRANSACC];
        var tFecha = Ht.indexOf('fecha_hora');
        var tPts = Ht.indexOf('puntos_ganados');
        for (var k = 1; k < dT.length; k++) {
          var ft = dT[k][tFecha];
          var ftDate = (ft instanceof Date) ? ft : new Date(ft);
          if (!isNaN(ftDate.getTime()) && ftDate.getTime() >= weekAgo.getTime()) {
            visitas++;
            puntosEntregados += Number(dT[k][tPts] || 0);
          }
        }
      }
    } catch (_) {}

    // ----- Construir mensaje -----
    var rest = cfg.restaurante_nombre || 'Restful Restobar';
    var rango = Utilities.formatDate(weekAgo, tz, 'dd/MM') + ' – ' + Utilities.formatDate(now, tz, 'dd/MM/yyyy');
    var lineas = [];
    lineas.push('📊 *Informe Semanal — ' + rest + '*');
    lineas.push('🗓 Semana: ' + rango);
    lineas.push('');
    lineas.push('🆕 *Nuevos registros:* ' + nuevos.length);
    if (nuevos.length) {
      var muestraN = nuevos.slice(0, 10);
      muestraN.forEach(function(n){ lineas.push('  • ' + n.nombre + ' (' + n.telefono + ') – ' + n.fecha); });
      if (nuevos.length > 10) lineas.push('  …y ' + (nuevos.length - 10) + ' más');
    }
    lineas.push('');
    lineas.push('👥 *Total clientes:* ' + totalClientes);
    lineas.push('📣 *Opt-in WhatsApp:* ' + totalOptin);
    lineas.push('');
    lineas.push('🛎 *Visitas registradas:* ' + visitas);
    lineas.push('⭐ *Puntos entregados:* ' + puntosEntregados);
    lineas.push('💎 *Puntos activos totales:* ' + totalPuntosActivos);
    lineas.push('');
    lineas.push('🎁 *Canjes:* ' + canjesCount);
    Object.keys(canjesDetalle).forEach(function(k){ lineas.push('  • ' + k + ': ' + canjesDetalle[k]); });
    lineas.push('');
    lineas.push('_Generado automáticamente._');

    var msg = lineas.join('\n');

    // ----- Enviar al grupo del staff -----
    var r = sendStaffWhatsApp_(msg, cfg);
    console.log('weeklyReport WA: ' + JSON.stringify(r));

    // ----- También por correo a weekly_report_emails -----
    var emails = String(cfg.weekly_report_emails || '').split(',').map(function(s){return s.trim();}).filter(function(s){return s.indexOf('@') !== -1;});
    if (emails.length) {
      try {
        MailApp.sendEmail({
          to: emails.join(','),
          subject: '📊 Informe semanal — ' + rest + ' (' + rango + ')',
          body: msg
        });
      } catch (e) { console.log('weeklyReport email err: ' + e); }
    }

    return { ok: true, nuevos: nuevos.length, visitas: visitas, canjes: canjesCount, wa: r };
  } catch (err) {
    console.log('weeklyReportJob ERROR: ' + err);
    return { ok: false, error: String(err) };
  }
}

// Prueba manual del informe semanal sin esperar al lunes
function testWeeklyReport() {
  var r = weeklyReportJob();
  Logger.log(JSON.stringify(r, null, 2));
}

// ============================================================
//  LIMPIEZA DE TRIGGERS DUPLICADOS
// ============================================================
function cleanupDuplicateTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var seen = {};
  var removed = 0;
  triggers.forEach(function(t){
    var fn = t.getHandlerFunction();
    if (seen[fn]) { ScriptApp.deleteTrigger(t); removed++; }
    else seen[fn] = true;
  });
  try { SpreadsheetApp.getUi().alert('✅ Triggers limpiados. Eliminados duplicados: ' + removed); } catch(_) {}
  console.log('Triggers únicos restantes: ' + Object.keys(seen).join(', '));
  return { ok: true, removed: removed, kept: Object.keys(seen) };
}

// Instala TODOS los triggers automáticos en un solo paso
function installAllTriggers() {
  // limpiar primero todo
  ScriptApp.getProjectTriggers().forEach(function(t){
    var fn = t.getHandlerFunction();
    if (['dailyPasswordJob','weeklyBackupJob','monthlyCleanupJob','weeklyReportJob','onEditEventos'].indexOf(fn) !== -1) {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('dailyPasswordJob').timeBased().atHour(6).everyDays(1).create();
  ScriptApp.newTrigger('weeklyBackupJob').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(2).create();
  ScriptApp.newTrigger('monthlyCleanupJob').timeBased().onMonthDay(1).atHour(3).create();
  ScriptApp.newTrigger('weeklyReportJob').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  // onEditEventos requiere ScriptApp.newTrigger().forSpreadsheet().onEdit()
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('onEditEventos').forSpreadsheet(ss).onEdit().create();
  try {
    SpreadsheetApp.getUi().alert(
      '✅ Todos los triggers instalados:\n' +
      '• dailyPasswordJob → 6:00 AM diario\n' +
      '• weeklyBackupJob → lunes 2:00 AM\n' +
      '• monthlyCleanupJob → día 1 de cada mes 3:00 AM\n' +
      '• weeklyReportJob → lunes 8:00 AM\n' +
      '• onEditEventos → al editar el sheet'
    );
  } catch(_) {}
}

// ============================================================
//  EVOLUTION (WhatsApp) — versión mínima
// ============================================================
// Envía un texto al grupo de WhatsApp del staff (configurado en evolution_group_jid)
function sendStaffWhatsApp_(text, cfg) {
  try {
    cfg = cfg || readConfig();
    var url = String(cfg.evolution_url_staff || cfg.evolution_url || '').replace(/\/$/, '');
    var instance = String(cfg.evolution_instance_staff || cfg.evolution_instance || '');
    var apikey = String(cfg.evolution_apikey_staff || cfg.evolution_apikey || '');
    var jid = String(cfg.evolution_group_jid || '');
    if (!url || !instance || !apikey || !jid) {
      console.log('⚠️ Staff WA no configurado completamente. URL='+url+' inst='+instance+' jid='+jid);
      return { ok:false, error:'staff config incompleta' };
    }
    var res = UrlFetchApp.fetch(url + '/message/sendText/' + encodeURIComponent(instance), {
      method:'post', contentType:'application/json', headers:{'apikey':apikey},
      payload: JSON.stringify({ number: jid, text: text }),
      muteHttpExceptions:true
    });
    var code = res.getResponseCode();
    var body = res.getContentText();
    if (code >= 200 && code < 300) {
      console.log('Staff WA OK ' + code);
      return { ok:true, status: code };
    }
    console.log('Staff WA status ' + code + ': ' + body);
    return { ok:false, status: code, error: body };
  } catch (e) { console.log('staff wa err: ' + e); return { ok:false, error: String(e) }; }
}

function sendDailyPasswordWhatsApp_(pwd, cfg) {
  cfg = cfg || readConfig();
  var fecha = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var rest = cfg.restaurante_nombre || 'Restful Restobar';
  var msg = '🔐 *Contraseña del día — ' + rest + '*\n📅 ' + fecha + '\n\nLa contraseña de HOY es:\n\n*' + pwd + '*\n\n_Comparte solo con el equipo. Expira a las 23:59._';
  return sendStaffWhatsApp_(msg, cfg);
}

// Prueba que SOLO valida la conexión al grupo del staff (NO manda password fake)
function testStaffPasswordWhatsApp() {
  var cfg = readConfig();
  var msg = '🧪 *PRUEBA — ' + (cfg.restaurante_nombre || 'Restful Restobar') + '*\n\nSi recibes esto, el envío al grupo del staff está funcionando correctamente.\n\n_Este mensaje es solo de prueba — NO es un password._';
  var r = sendStaffWhatsApp_(msg, cfg);
  Logger.log(JSON.stringify(r, null, 2));
}

// Reenvía al grupo el password REAL del día (lee del sheet o lo genera si no existe)
function resendTodayPassword() {
  var cfg = readConfig();
  var today = todayISO();
  var shP = SpreadsheetApp.getActive().getSheetByName(SHEETS.PASSWORDS);
  var tz = Session.getScriptTimeZone();
  var data = shP.getDataRange().getValues();
  var pwd = null;
  for (var i = data.length - 1; i >= 1; i--) {
    var raw = data[i][0];
    var rowDate = (raw instanceof Date) ? Utilities.formatDate(raw, tz, 'yyyy-MM-dd') : String(raw).substring(0, 10);
    if (rowDate === today) { pwd = String(data[i][1]); break; }
  }
  if (!pwd) {
    pwd = generate6DigitPassword();
    var nextRow = shP.getLastRow() + 1;
    shP.getRange(nextRow, 1).setNumberFormat('@');
    shP.getRange(nextRow, 2).setNumberFormat('@');
    shP.appendRow([today, pwd, new Date(), cfg.restaurante_email_dueno]);
    sendOwnerEmail_(pwd, cfg);
  }
  var r = sendDailyPasswordWhatsApp_(pwd, cfg);
  Logger.log('Password REAL de hoy: ' + pwd);
  Logger.log(JSON.stringify(r, null, 2));
  return { pwd: pwd, wa: r };
}

// ============================================================
//  TESTS
// ============================================================
function testGetEvents() { Logger.log(JSON.stringify(getEvents_({}), null, 2)); }

// Prueba: dispara la notificación del primer evento activo encontrado
function testNotifyFirst() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  for (var i = 1; i < data.length; i++) {
    if (truthy_(data[i][H.indexOf('active')])) {
      var id = String(data[i][H.indexOf('id')]);
      Logger.log('Notificando evento: ' + id);
      Logger.log(JSON.stringify(notifyEvent_({ id: id, force: true }), null, 2));
      return;
    }
  }
  Logger.log('No hay eventos activos.');
}

// Prueba directa: manda un WhatsApp al teléfono de prueba sin pasar por evento del sheet
function testWhatsAppDirect() {
  var cfg = readConfig();
  var phone = String(cfg.notify_test_phone || '').trim();
  if (!phone) { Logger.log('Configura notify_test_phone primero'); return; }
  var fakeEvent = {
    titulo: 'Prueba de notificación',
    subtitulo: 'Si recibes esto, WhatsApp está funcionando 🎉',
    icon: 'party', color: '#C5A55A',
    tipo: 'unico', fecha: todayISO(), hora_inicio: 20, hora_fin: 22
  };
  var r = sendEventWhatsApp_(phone, 'Brayan', fakeEvent, cfg);
  Logger.log(JSON.stringify(r, null, 2));
}

// Lista todos los eventos pendientes de notificar (active=TRUE, notificado=FALSE)
function listPendingNotifications() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  var data = sh.getDataRange().getValues();
  var H = HEADERS[SHEETS.EVENTOS];
  Logger.log('=== EVENTOS PENDIENTES ===');
  for (var i = 1; i < data.length; i++) {
    var id = data[i][H.indexOf('id')];
    var active = data[i][H.indexOf('active')];
    var notif = data[i][H.indexOf('notificado')];
    if (truthy_(active) && !truthy_(notif)) {
      Logger.log('- ' + id + ' | ' + data[i][H.indexOf('titulo')]);
    }
  }
}
function seedEvents() {
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.EVENTOS);
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, EVENTOS_DEFAULTS.length, EVENTOS_DEFAULTS[0].length).setValues(EVENTOS_DEFAULTS);
    sh.getRange(2, 2, EVENTOS_DEFAULTS.length, 1).setNumberFormat('@');
  }
}
