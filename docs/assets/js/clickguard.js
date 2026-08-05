/* ClickGuard — telemetría de clics pagados.
 *
 * Qué hace: cuando alguien llega con un `gclid` (clic de Google Ads), mide señales
 * de comportamiento y las envía a nuestro propio endpoint. El endpoint decide si el
 * clic fue humano o fraudulento; el script de Google Ads consume esa lista y excluye
 * las IP responsables.
 *
 * Qué NO hace: no usa fingerprinting persistente, no lee cookies de terceros y no
 * identifica personas. Solo mide si hubo un ser humano al otro lado de ESTE clic.
 *
 * Todo es opcional: si el endpoint no responde, la página funciona igual.
 */
(function () {
  'use strict';

  var ENDPOINT = '/api/cg';          // Cloudflare Worker (ver worker/clickguard-worker.js)
  var params = new URLSearchParams(location.search);
  var gclid = params.get('gclid') || params.get('wbraid') || params.get('gbraid');

  // Persistimos el gclid para toda la sesión: el usuario puede navegar antes de convertir.
  if (gclid) sessionStorage.setItem('mem_gclid', gclid);
  else gclid = sessionStorage.getItem('mem_gclid');

  if (!gclid) return;               // Tráfico orgánico: no se mide nada.

  var t0 = Date.now();
  var sig = {
    gclid: gclid,
    kw: params.get('kw') || params.get('utm_term') || '',
    cid: params.get('cid') || '',           // {campaignid}
    gid: params.get('gid') || '',           // {adgroupid}
    net: params.get('net') || '',           // {network}: g | s | d
    dev: params.get('dev') || '',           // {device}: m | t | c
    mt: params.get('mt') || '',             // {matchtype}
    ref: document.referrer.slice(0, 300),
    lang: navigator.language || '',
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone) || '',
    scr: screen.width + 'x' + screen.height + '@' + (window.devicePixelRatio || 1),
    vp: innerWidth + 'x' + innerHeight,
    hw: navigator.hardwareConcurrency || 0,
    mem: navigator.deviceMemory || 0,
    touch: navigator.maxTouchPoints || 0,
    wd: !!navigator.webdriver,              // automatización declarada
    plugins: (navigator.plugins && navigator.plugins.length) || 0,
    // Señales de comportamiento, se llenan mientras la sesión transcurre:
    moves: 0, scrolls: 0, keys: 0, clicks: 0, maxScroll: 0,
    dwell: 0, visible: 0, converted: false
  };

  // Un headless mal disfrazado suele fallar aquí: sin plugins, sin táctil y con UA de escritorio.
  sig.hl = (sig.plugins === 0 && sig.touch === 0 && sig.dev === 'c') ? 1 : 0;

  var visibleSince = document.visibilityState === 'visible' ? Date.now() : 0;

  function on(target, ev, fn, opts) { target.addEventListener(ev, fn, opts || { passive: true }); }

  on(document, 'mousemove', function () { sig.moves++; });
  on(document, 'touchstart', function () { sig.moves++; });
  on(document, 'keydown', function () { sig.keys++; });
  on(document, 'click', function () { sig.clicks++; });
  on(window, 'scroll', function () {
    sig.scrolls++;
    var h = document.documentElement.scrollHeight - innerHeight;
    if (h > 0) sig.maxScroll = Math.max(sig.maxScroll, Math.round(scrollY / h * 100));
  });

  on(document, 'visibilitychange', function () {
    if (document.visibilityState === 'visible') { visibleSince = Date.now(); }
    else if (visibleSince) { sig.visible += Date.now() - visibleSince; visibleSince = 0; }
  });

  // Una conversión real invalida cualquier sospecha: nunca excluir a quien compra.
  ['whatsapp_click', 'llamada_click', 'generate_lead'].forEach(function (ev) {
    on(window, 'mem:' + ev, function () { sig.converted = true; });
  });
  on(document, 'click', function (e) {
    var a = e.target.closest && e.target.closest('[data-cta]');
    if (a) sig.converted = true;
  });

  var sent = false;
  function flush(reason) {
    if (sent) return;
    sig.dwell = Date.now() - t0;
    sig.visible += visibleSince ? Date.now() - visibleSince : 0;
    sig.reason = reason;

    var body = JSON.stringify(sig);
    var ok = false;
    if (navigator.sendBeacon) {
      ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    }
    if (!ok) {
      fetch(ENDPOINT, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'application/json' } })
        .catch(function () { /* silencio: nunca romper la página por telemetría */ });
    }
    sent = true;
  }

  // Reporte temprano (a los 12 s) para clics que se van sin evento de salida,
  // y reporte final al abandonar la página.
  var early = setTimeout(function () { flush('timer'); sent = false; }, 12000);
  on(window, 'pagehide', function () { clearTimeout(early); flush('pagehide'); });
  on(document, 'visibilitychange', function () {
    if (document.visibilityState === 'hidden') { clearTimeout(early); flush('hidden'); }
  });
})();
