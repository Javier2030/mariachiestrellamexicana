/* Mariachi Estrella Mexicana — interacción del sitio.
   Sin dependencias. Todo degrada a HTML funcional si el JS falla. */
(function () {
  'use strict';

  var WA = '573021084267';

  /* --- Menú móvil --- */
  var burger = document.getElementById('burger');
  var nav = document.getElementById('nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', String(open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') { nav.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* --- Animación de entrada ---
     El estado oculto lo pone el JS, no el CSS: si este script no corre, el contenido
     simplemente se ve sin animación en lugar de quedar invisible. */
  var animables = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.remove('pre');
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -40px' });

    animables.forEach(function (el) {
      // Lo que ya está en pantalla no se oculta: evita el parpadeo del primer bloque.
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.9) { el.classList.add('in'); return; }
      el.classList.add('pre');
      io.observe(el);
    });

    // Red de seguridad: pase lo que pase con el observer, a los 3 s todo es visible.
    // Una animación no vale el riesgo de que un cliente no vea los precios.
    setTimeout(function () {
      animables.forEach(function (el) { el.classList.remove('pre'); el.classList.add('in'); });
    }, 3000);
  }

  /* --- Fecha mínima = hoy (zona horaria de Bogotá) --- */
  var dateInput = document.getElementById('q-date');
  if (dateInput) {
    var bogota = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    dateInput.min = bogota;
    if (!dateInput.value) dateInput.value = bogota;
  }

  /* --- Validación + envío a WhatsApp --- */
  var form = document.getElementById('quote-form');
  if (form) {
    var phoneField = document.getElementById('q-phone');

    // Formato visual del celular colombiano: 302 108 4267
    if (phoneField) {
      phoneField.addEventListener('input', function () {
        var d = this.value.replace(/\D/g, '').slice(0, 10);
        this.value = d.replace(/^(\d{3})(\d{0,3})(\d{0,4}).*/, function (_, a, b, c) {
          return a + (b ? ' ' + b : '') + (c ? ' ' + c : '');
        });
      });
    }

    var isValid = function (el) {
      var v = el.value.trim();
      if (!v) return false;
      if (el.id === 'q-phone') return /^3\d{9}$/.test(v.replace(/\D/g, ''));
      return true;
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;

      form.querySelectorAll('[required]').forEach(function (el) {
        var field = el.closest('.field');
        if (isValid(el)) { field.classList.remove('invalid'); }
        else { field.classList.add('invalid'); ok = false; }
      });

      if (!ok) {
        var first = form.querySelector('.field.invalid input, .field.invalid select');
        if (first) first.focus();
        return;
      }

      var g = function (id) { return (document.getElementById(id).value || '').trim(); };
      var fecha = g('q-date');
      var fechaTxt = fecha;
      try {
        var p = fecha.split('-');
        fechaTxt = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es-CO', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
      } catch (_) { /* se queda el ISO */ }

      var msg =
        '¡Hola Mariachi Estrella Mexicana! Quiero cotizar una serenata.\n\n' +
        '• Nombre: ' + g('q-name') + '\n' +
        '• Celular: ' + g('q-phone') + '\n' +
        '• Fecha: ' + fechaTxt + '\n' +
        '• Hora: ' + g('q-time') + '\n' +
        '• Localidad: ' + g('q-zone');

      // Adjunta el gclid para poder atribuir la conversión a la campaña.
      var gclid = sessionStorage.getItem('mem_gclid');
      if (gclid) msg += '\n\nRef: ' + gclid;

      track('generate_lead', { method: 'formulario', zona: g('q-zone') });

      window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      form.reset();
      if (dateInput) dateInput.value = dateInput.min;
    });
  }

  /* --- Visor de la galería --- */
  var botones = [].slice.call(document.querySelectorAll('.gal-btn'));
  if (botones.length) {
    var visor = document.createElement('div');
    visor.className = 'viewer';
    visor.setAttribute('role', 'dialog');
    visor.setAttribute('aria-modal', 'true');
    visor.setAttribute('aria-label', 'Visor de fotos');
    visor.innerHTML =
      '<button class="viewer-close" type="button" aria-label="Cerrar">✕</button>' +
      '<button class="viewer-nav prev" type="button" aria-label="Foto anterior">‹</button>' +
      '<button class="viewer-nav next" type="button" aria-label="Foto siguiente">›</button>' +
      '<figure style="margin:0;display:grid;place-items:center">' +
      '<img alt=""><figcaption></figcaption></figure>';
    document.body.appendChild(visor);

    var vImg = visor.querySelector('img');
    var vCap = visor.querySelector('figcaption');
    var idx = 0, previo = null;

    function mostrar(i) {
      idx = (i + botones.length) % botones.length;
      var b = botones[idx];
      vImg.src = b.getAttribute('data-full');
      vImg.alt = b.getAttribute('data-alt');
      vCap.textContent = b.getAttribute('data-alt');
    }
    function abrir(i) {
      previo = document.activeElement;
      mostrar(i);
      visor.classList.add('open');
      document.body.style.overflow = 'hidden';
      visor.querySelector('.viewer-close').focus();
    }
    function cerrar() {
      visor.classList.remove('open');
      document.body.style.overflow = '';
      if (previo) previo.focus();
    }

    botones.forEach(function (b, i) { b.addEventListener('click', function () { abrir(i); }); });
    visor.querySelector('.viewer-close').addEventListener('click', cerrar);
    visor.querySelector('.prev').addEventListener('click', function () { mostrar(idx - 1); });
    visor.querySelector('.next').addEventListener('click', function () { mostrar(idx + 1); });
    visor.addEventListener('click', function (e) { if (e.target === visor) cerrar(); });

    document.addEventListener('keydown', function (e) {
      if (!visor.classList.contains('open')) return;
      if (e.key === 'Escape') cerrar();
      else if (e.key === 'ArrowLeft') mostrar(idx - 1);
      else if (e.key === 'ArrowRight') mostrar(idx + 1);
    });

    // Deslizar en móvil
    var x0 = null;
    visor.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    visor.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 45) mostrar(idx + (dx < 0 ? 1 : -1));
      x0 = null;
    }, { passive: true });
  }

  /* --- Seguimiento de conversiones --- */
  function track(event, params) {
    if (typeof window.gtag === 'function') window.gtag('event', event, params || {});
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: event }, params || {}));
  }
  window.memTrack = track;

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-cta]');
    if (!a) return;
    var id = a.getAttribute('data-cta');
    var isCall = a.href && a.href.indexOf('tel:') === 0;
    var isWa = a.href && a.href.indexOf('wa.me') > -1;
    track(isCall ? 'llamada_click' : isWa ? 'whatsapp_click' : 'cta_click', { cta_id: id });
  });
})();
