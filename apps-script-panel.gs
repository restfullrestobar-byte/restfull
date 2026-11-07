// ============================================================
//  PANEL DEL MENÚ — el menú vive en la hoja "Menu"
//  Pegar AL FINAL de Code.gs. No toca ninguna función existente.
//
//  En routeAction_ agregar estas 2 líneas junto a los otros case:
//      case 'getMenu':     return getMenu_(params);
//      case 'guardarMenu': return guardarMenu_(params);
// ============================================================

var MENU_SHEET = 'Menu';
var MENU_COLS = ['seccion','seccion_nombre','subtitulo','categoria','nombre',
                 'descripcion','peso','precio','precio2','decimales',
                 'agotado','visible','orden'];

// ---------- instalación: traer los 99 platos (correr UNA vez) ----------
function seedMenuDesdeGitHub() {
  var url = 'https://raw.githubusercontent.com/restfullrestobar-byte/restfull/main/menu.json';
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) {
    Logger.log('❌ No se pudo bajar el menú: HTTP ' + res.getResponseCode());
    return;
  }
  var data = JSON.parse(res.getContentText());
  var filas = [];
  var orden = 0;
  data.secciones.forEach(function (s) {
    (s.items || []).forEach(function (i) {
      orden++;
      filas.push([s.id, s.nombre, s.subtitulo || '', i.categoria || '', i.nombre,
                  i.descripcion || '', i.peso || '', i.precio,
                  (i.precio2 == null ? '' : i.precio2),
                  i.decimales !== false, !!i.agotado, i.visible !== false, orden]);
    });
  });

  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(MENU_SHEET) || ss.insertSheet(MENU_SHEET);
  sh.clear();
  sh.getRange(1, 1, 1, MENU_COLS.length).setValues([MENU_COLS])
    .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#C5A55A');
  sh.setFrozenRows(1);
  sh.getRange(2, 1, filas.length, MENU_COLS.length).setValues(filas);
  Logger.log('✅ Hoja "Menu" creada con ' + filas.length + ' platos.');
}

// ---------- lectura (pública, sin contraseña: la usa el menú de los clientes) ----------
function getMenu_(p) {
  var sh = SpreadsheetApp.getActive().getSheetByName(MENU_SHEET);
  if (!sh || sh.getLastRow() < 2) return { ok: false, error: 'La hoja Menu está vacía.' };

  var data = sh.getDataRange().getValues();
  var H = data[0].map(function (h) { return String(h).trim(); });
  var idx = {}; MENU_COLS.forEach(function (c) { idx[c] = H.indexOf(c); });

  var secciones = [], porId = {};
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var sid = String(row[idx.seccion] || '').trim();
    var nom = String(row[idx.nombre] || '').trim();
    if (!sid || !nom) continue;

    if (!porId[sid]) {
      porId[sid] = { id: sid, nombre: String(row[idx.seccion_nombre] || sid),
                     subtitulo: String(row[idx.subtitulo] || ''), items: [] };
      secciones.push(porId[sid]);
    }
    var p2 = row[idx.precio2];
    porId[sid].items.push({
      nombre: nom,
      descripcion: String(row[idx.descripcion] || ''),
      peso: String(row[idx.peso] || ''),
      precio: Number(row[idx.precio]) || 0,
      precio2: (p2 === '' || p2 == null) ? null : Number(p2),
      decimales: row[idx.decimales] !== false && String(row[idx.decimales]).toUpperCase() !== 'FALSE',
      agotado: row[idx.agotado] === true || String(row[idx.agotado]).toUpperCase() === 'TRUE',
      visible: !(row[idx.visible] === false || String(row[idx.visible]).toUpperCase() === 'FALSE'),
      categoria: String(row[idx.categoria] || '')
    });
  }
  return { ok: true, actualizado: new Date().toISOString(), secciones: secciones };
}

// ---------- escritura (con contraseña + fecha de corte) ----------
function guardarMenu_(p) {
  var a = panelAuth_(p);
  if (!a.ok) return a;

  var menu;
  try { menu = (typeof p.menu === 'string') ? JSON.parse(p.menu) : p.menu; }
  catch (e) { return { ok: false, error: 'Menú mal formado: ' + e.message }; }
  if (!menu || !menu.secciones || !menu.secciones.length)
    return { ok: false, error: 'El menú llegó vacío. No se guardó nada.' };

  var filas = [], orden = 0;
  menu.secciones.forEach(function (s) {
    (s.items || []).forEach(function (i) {
      orden++;
      filas.push([s.id, s.nombre, s.subtitulo || '', i.categoria || '', i.nombre,
                  i.descripcion || '', i.peso || '', Number(i.precio) || 0,
                  (i.precio2 == null || i.precio2 === '') ? '' : Number(i.precio2),
                  i.decimales !== false, !!i.agotado, i.visible !== false, orden]);
    });
  });

  // Red de seguridad: que un bug no deje la carta vacía
  if (filas.length < 20)
    return { ok: false, error: 'Solo llegaron ' + filas.length + ' platos. Por seguridad no se guardó — recargá y probá de nuevo.' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(8000); } catch (e) { return { ok: false, error: 'El menú está siendo guardado por otra persona. Probá en unos segundos.' }; }
  try {
    var ss = SpreadsheetApp.getActive();
    var sh = ss.getSheetByName(MENU_SHEET) || ss.insertSheet(MENU_SHEET);

    // Respaldo de la versión anterior antes de pisarla
    try {
      var prev = ss.getSheetByName('Menu_Backup');
      if (prev) ss.deleteSheet(prev);
      if (sh.getLastRow() > 1) sh.copyTo(ss).setName('Menu_Backup');
    } catch (e) {}

    sh.clear();
    sh.getRange(1, 1, 1, MENU_COLS.length).setValues([MENU_COLS])
      .setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#C5A55A');
    sh.setFrozenRows(1);
    sh.getRange(2, 1, filas.length, MENU_COLS.length).setValues(filas);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  return { ok: true, platos: filas.length };
}

// ---------- contraseña y fecha de corte ----------
function panelCfg_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('panel_cfg');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var sh = SpreadsheetApp.getActive().getSheetByName('Configuracion');
  var out = { password: '', hasta: '' };
  if (sh) {
    var d = sh.getDataRange().getValues();
    for (var i = 1; i < d.length; i++) {
      var k = String(d[i][0] || '').trim();
      if (k === 'menu_password')     out.password = String(d[i][1] || '').trim();
      if (k === 'menu_pagado_hasta') out.hasta    = panelFechaISO_(d[i][1]);
    }
  }
  try { cache.put('panel_cfg', JSON.stringify(out), 30); } catch (e) {}
  return out;
}

function panelFechaISO_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim().substring(0, 10);
}

function panelIgual_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return d === 0;
}

function panelAuth_(p) {
  var c = CacheService.getScriptCache();
  if (Number(c.get('panel_fails') || 0) >= 8)
    return { ok: false, error: 'Demasiados intentos fallidos. Esperá 15 minutos.' };

  var cfg = panelCfg_();
  if (!cfg.password)
    return { ok: false, error: 'Falta configurar menu_password en la hoja Configuracion.' };

  if (!panelIgual_(p.password, cfg.password)) {
    c.put('panel_fails', String(Number(c.get('panel_fails') || 0) + 1), 900);
    return { ok: false, error: 'Contraseña incorrecta.' };
  }
  c.remove('panel_fails');

  if (!cfg.hasta)
    return { ok: false, error: 'Falta configurar menu_pagado_hasta en la hoja Configuracion.' };

  var hoy = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  if (hoy > cfg.hasta)
    return { ok: false, vencido: true,
             error: 'La suscripción venció el ' + cfg.hasta + '. Escribile a Bryan para reactivar la edición.' };

  return { ok: true, hasta: cfg.hasta };
}

// ---------- prueba ----------
function probarPanel() {
  var cfg = panelCfg_();
  Logger.log('menu_password: ' + (cfg.password ? 'configurada' : '❌ FALTA'));
  Logger.log('menu_pagado_hasta: ' + (cfg.hasta || '❌ FALTA'));
  var r = getMenu_({});
  if (r.ok) {
    var n = 0; r.secciones.forEach(function (s) { n += s.items.length; });
    Logger.log('✅ Hoja Menu OK — ' + n + ' platos en ' + r.secciones.length + ' secciones.');
  } else {
    Logger.log('❌ ' + r.error);
  }
}
