// ============================================================
//  PANEL DEL MENÚ — proxy a GitHub
//  Pegar este bloque AL FINAL de Code.gs (no toca nada existente)
//  y agregar 2 líneas al router (ver PANEL.md)
// ============================================================

var GH_REPO   = 'restfullrestobar-byte/restfull';
var GH_FILE   = 'menu.json';
var GH_BRANCH = 'main';

// ---------- helpers de configuración ----------
function panelProp_(k) {
  return String(PropertiesService.getScriptProperties().getProperty(k) || '');
}

// Guardar el token de GitHub (correr UNA vez desde el editor y luego borrar el valor)
function guardarTokenGitHub() {
  var TOKEN = 'PEGA_ACA_TU_TOKEN';          // <-- pegar, ejecutar, y volver a dejarlo vacío
  if (TOKEN.indexOf('PEGA_ACA') === 0) {
    Logger.log('Pegá el token en la variable TOKEN y volvé a ejecutar.');
    return;
  }
  PropertiesService.getScriptProperties().setProperty('gh_token', TOKEN);
  Logger.log('✅ Token guardado. Ahora borrá el valor de la variable y guardá el archivo.');
}

// Lee password y fecha de corte de la hoja Configuracion (cache corto para no leerla a cada rato)
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
      if (k === 'menu_password')      out.password = String(d[i][1] || '').trim();
      if (k === 'menu_pagado_hasta')  out.hasta    = fechaISO_(d[i][1]);
    }
  }
  try { cache.put('panel_cfg', JSON.stringify(out), 30); } catch (e) {}
  return out;
}

function fechaISO_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return String(v).trim().substring(0, 10);
}

function panelHoy_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// Comparación de strings en tiempo constante (evita filtrar la clave por timing)
function igualSeguro_(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  var dif = 0;
  for (var i = 0; i < a.length; i++) dif |= (a.charCodeAt(i) ^ b.charCodeAt(i));
  return dif === 0;
}

// ---------- anti fuerza bruta ----------
function panelBloqueado_() {
  return Number(CacheService.getScriptCache().get('panel_fails') || 0) >= 8;
}
function panelFallo_() {
  var c = CacheService.getScriptCache();
  var n = Number(c.get('panel_fails') || 0) + 1;
  c.put('panel_fails', String(n), 900);   // 15 min
}
function panelOk_() { CacheService.getScriptCache().remove('panel_fails'); }

// ---------- autenticación ----------
function panelAuth_(p) {
  if (panelBloqueado_())
    return { ok: false, error: 'Demasiados intentos fallidos. Esperá 15 minutos.' };

  var cfg = panelCfg_();
  if (!cfg.password)
    return { ok: false, error: 'Falta configurar menu_password en la hoja Configuracion.' };

  if (!igualSeguro_(p.password, cfg.password)) {
    panelFallo_();
    return { ok: false, error: 'Contraseña incorrecta.' };
  }
  panelOk_();

  var hoy = panelHoy_();
  if (!cfg.hasta)
    return { ok: false, error: 'Falta configurar menu_pagado_hasta en la hoja Configuracion.' };

  if (hoy > cfg.hasta) {
    return { ok: false, vencido: true,
             error: 'La suscripción venció el ' + cfg.hasta + '. Escribile a Bryan para reactivar la edición.' };
  }
  return { ok: true, hasta: cfg.hasta };
}

// ---------- GitHub ----------
function ghLeerMenu_() {
  var tok = panelProp_('gh_token');
  if (!tok) return { ok: false, error: 'Falta el token de GitHub (correr guardarTokenGitHub).' };
  var url = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?ref=' + GH_BRANCH;
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'restful-panel' },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200)
    return { ok: false, error: 'GitHub ' + res.getResponseCode() + ': ' + res.getContentText().substring(0, 180) };
  var j = JSON.parse(res.getContentText());
  var txt = Utilities.newBlob(Utilities.base64Decode(j.content)).getDataAsString('UTF-8');
  return { ok: true, menu: JSON.parse(txt), sha: j.sha };
}

function ghEscribirMenu_(menuObj, sha) {
  var tok = panelProp_('gh_token');
  if (!tok) return { ok: false, error: 'Falta el token de GitHub.' };
  var texto = JSON.stringify(menuObj, null, 1);
  var url = 'https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE;
  var res = UrlFetchApp.fetch(url, {
    method: 'put',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + tok, 'Accept': 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'restful-panel' },
    payload: JSON.stringify({
      message: 'Actualizar menu desde el panel',
      content: Utilities.base64Encode(texto, Utilities.Charset.UTF_8),
      sha: sha, branch: GH_BRANCH
    }),
    muteHttpExceptions: true
  });
  var code = res.getResponseCode();
  if (code === 409) return { ok: false, conflicto: true, error: 'El menú cambió mientras editabas. Recargá y volvé a intentar.' };
  if (code < 200 || code >= 300)
    return { ok: false, error: 'GitHub ' + code + ': ' + res.getContentText().substring(0, 180) };
  return { ok: true, sha: JSON.parse(res.getContentText()).content.sha };
}

// ---------- acciones públicas ----------
function menuEstado_(p) {
  var a = panelAuth_(p);
  if (!a.ok) return a;
  var r = ghLeerMenu_();
  if (!r.ok) return r;
  return { ok: true, hasta: a.hasta, menu: r.menu, sha: r.sha };
}

function publicarMenu_(p) {
  var a = panelAuth_(p);
  if (!a.ok) return a;

  var menu;
  try { menu = (typeof p.menu === 'string') ? JSON.parse(p.menu) : p.menu; }
  catch (e) { return { ok: false, error: 'Menú mal formado: ' + e.message }; }

  if (!menu || !menu.secciones || !menu.secciones.length)
    return { ok: false, error: 'El menú llegó vacío. No se publicó nada.' };

  // Red de seguridad: no dejar que un bug borre la carta entera
  var total = 0;
  menu.secciones.forEach(function (s) { total += (s.items || []).length; });
  if (total < 20)
    return { ok: false, error: 'Solo llegaron ' + total + ' platos. Por seguridad no se publicó — recargá y probá de nuevo.' };

  menu.actualizado = new Date().toISOString().replace(/\.\d+Z$/, 'Z');

  var w = ghEscribirMenu_(menu, p.sha);
  if (!w.ok) return w;
  return { ok: true, sha: w.sha, platos: total };
}

// ---------- prueba desde el editor ----------
function probarPanel() {
  var cfg = panelCfg_();
  Logger.log('password configurada: ' + (cfg.password ? 'sí' : 'NO'));
  Logger.log('pagado_hasta: ' + (cfg.hasta || 'NO CONFIGURADO') + ' | hoy: ' + panelHoy_());
  Logger.log('token GitHub: ' + (panelProp_('gh_token') ? 'guardado' : 'NO GUARDADO'));
  var r = ghLeerMenu_();
  if (r.ok) {
    var n = 0; r.menu.secciones.forEach(function (s) { n += s.items.length; });
    Logger.log('✅ GitHub OK — ' + n + ' platos leídos.');
  } else {
    Logger.log('❌ ' + r.error);
  }
}
