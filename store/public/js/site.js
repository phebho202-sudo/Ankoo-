/* ANKOO storefront: progressive enhancement only. Every form also works without JavaScript. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = (function () { var i = $('input[name="_csrf"]'); return i ? i.value : ''; })();

  function post(url, data) {
    var body = new URLSearchParams(data);
    return fetch(url, {
      method: 'POST', credentials: 'same-origin', body: body,
      headers: { 'X-Requested-With': 'fetch', 'X-CSRF-Token': csrf, Accept: 'application/json' },
    }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong'); return j; }); });
  }

  // ---- Header ----
  var header = $('.site-header');
  function onScroll() { if (header) header.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();

  var menu = $('#mobile-menu');
  var openBtn = $('[data-menu-open]');
  function setMenu(open) {
    if (!menu) return;
    menu.hidden = !open; document.body.classList.toggle('menu-open', open);
    if (openBtn) openBtn.setAttribute('aria-expanded', String(open));
    if (open) { var c = $('[data-menu-close]', menu); if (c) c.focus(); } else if (openBtn) openBtn.focus();
  }
  if (openBtn) openBtn.addEventListener('click', function () { setMenu(true); });
  $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && !menu.hidden) setMenu(false); });

  var search = $('[data-search]');
  $$('[data-search-open]').forEach(function (b) {
    b.addEventListener('click', function () { search.hidden = false; header.classList.add('search-open'); $('input', search).focus(); });
  });
  $$('[data-search-close]').forEach(function (b) {
    b.addEventListener('click', function () { search.hidden = true; header.classList.remove('search-open'); });
  });

  $$('[data-autosubmit]').forEach(function (s) { s.addEventListener('change', function () { s.form.submit(); }); });

  // Filters open by default on wide screens.
  var fd = $('[data-filter-details]');
  if (fd && window.matchMedia('(min-width: 961px)').matches) fd.open = true;

  // ---- Product gallery dots (mobile swipe) ----
  $$('[data-gallery]').forEach(function (g) {
    var track = $('.gallery-track', g); var dots = $$('.gallery-dots span', g);
    if (!dots.length) return;
    track.addEventListener('scroll', function () {
      var i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach(function (d, j) { d.classList.toggle('on', i === j); });
    }, { passive: true });
  });

  // ---- Variant availability ----
  var buy = $('[data-buy]');
  if (buy) {
    var data = JSON.parse(($('[data-variants]', buy) || {}).textContent || '{"variants":[]}');
    var addBtn = $('[data-add]', buy); var msg = $('[data-buy-msg]', buy); var avail = $('[data-avail]');
    var sizeInputs = $$('input[name="size"][type="radio"]', buy);
    var colourInputs = $$('input[name="colour"][type="radio"]', buy);
    var val = function (name) { var c = $('input[name="' + name + '"]:checked', buy) || $('input[name="' + name + '"][type="hidden"]', buy); return c ? c.value : ''; };
    var find = function (s, c) { return data.variants.filter(function (v) { return v.size === s && v.colour === c; })[0]; };
    function refresh() {
      var colour = val('colour');
      sizeInputs.forEach(function (i) {
        var v = find(i.value, colour);
        i.disabled = !v || (!data.made && v.stock <= 0);
        if (i.disabled && i.checked) i.checked = false;
      });
      var size = val('size');
      var v = find(size, colour);
      var needsSize = sizeInputs.length && !size;
      if (!data.made && v && avail) {
        avail.className = 'avail avail-' + (v.stock <= 0 ? 'out' : v.stock <= 3 ? 'low' : 'in');
        avail.textContent = v.stock <= 0 ? 'Sold out' : v.stock <= 3 ? 'Only ' + v.stock + ' left' : 'In stock';
      }
      addBtn.disabled = !needsSize && (!v || (!data.made && v.stock <= 0));
      addBtn.textContent = (!needsSize && v && !data.made && v.stock <= 0) ? 'Sold out' : (needsSize ? 'Select a size' : 'Add to bag');
      if (needsSize) addBtn.disabled = false;
    }
    sizeInputs.concat(colourInputs).forEach(function (i) { i.addEventListener('change', refresh); });
    refresh();

    $$('[data-qty] [data-step]', buy).forEach(function (b) {
      b.addEventListener('click', function () {
        var input = $('input', b.parentNode); var n = (parseInt(input.value, 10) || 1) + Number(b.dataset.step);
        input.value = Math.max(1, Math.min(Number(input.max) || 20, n));
      });
    });

    buy.addEventListener('submit', function (e) {
      if (sizeInputs.length && !val('size')) { e.preventDefault(); msg.className = 'form-msg err'; msg.textContent = 'Please choose a size.'; return; }
      if (!window.fetch) return;
      e.preventDefault();
      addBtn.disabled = true;
      post(buy.action, new FormData(buy)).then(function (j) {
        msg.className = 'form-msg ok'; msg.innerHTML = '';
        msg.appendChild(document.createTextNode(j.message + ' '));
        var a = document.createElement('a'); a.href = '/cart'; a.textContent = 'View bag'; msg.appendChild(a);
        $$('[data-bag-count]').forEach(function (c) { c.textContent = j.count; c.hidden = !j.count; });
        track({ event: 'AddToCart', id: j.track.id, value: j.track.value, currency: 'NGN' });
      }).catch(function (err) { msg.className = 'form-msg err'; msg.textContent = err.message; })
        .then(function () { addBtn.disabled = false; refresh(); });
    });

    // Mobile sticky buy bar
    var bar = $('[data-mobile-buy]');
    if (bar && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        var show = !entries[0].isIntersecting && entries[0].boundingClientRect.top < 0;
        bar.classList.toggle('show', show); document.body.classList.toggle('buybar', show);
      }).observe(buy);
      $('[data-scroll-buy]', bar).addEventListener('click', function () { buy.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
    }
  }

  // ---- Checkout: live delivery options ----
  var co = $('[data-checkout]');
  if (co) {
    var country = $('select[name="country"]', co);
    var ng = $('[data-ng]', co); var intl = $('[data-intl]', co);
    var opts = $('[data-ship-opts]', co); var totals = $('[data-totals]', co);
    var timer;
    function toggleCountry() {
      var isNg = country.value === 'NG';
      ng.hidden = !isNg; intl.hidden = isNg;
      $('select', ng).required = isNg;
    }
    function quote() {
      clearTimeout(timer);
      timer = setTimeout(function () {
        var fd = new FormData(co); fd.delete('_csrf');
        post('/checkout/quote', fd).then(function (j) { opts.innerHTML = j.options; totals.innerHTML = j.totals; }).catch(function () {});
      }, 350);
    }
    country.addEventListener('change', function () { toggleCountry(); quote(); });
    $$('[data-quote]', co).forEach(function (i) { i.addEventListener(i.tagName === 'SELECT' ? 'change' : 'input', quote); });
    opts.addEventListener('change', quote);
  }

  // ---- Analytics (GA4 + Meta Pixel), loaded only after consent when required ----
  var cfgEl = $('#analytics-config');
  var cfg = cfgEl ? JSON.parse(cfgEl.textContent) : null;
  var loaded = false;
  function getCookie(n) { var m = document.cookie.match('(?:^|; )' + n + '=([^;]*)'); return m ? decodeURIComponent(m[1]) : ''; }
  function inject(src) { var s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); }
  function loadAnalytics() {
    if (loaded || !cfg) return; loaded = true;
    if (cfg.ga) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date()); window.gtag('config', cfg.ga);
      inject('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga));
    }
    if (cfg.px) {
      var f = window.fbq = function () { f.callMethod ? f.callMethod.apply(f, arguments) : f.queue.push(arguments); };
      if (!window._fbq) window._fbq = f; f.push = f; f.loaded = true; f.version = '2.0'; f.queue = [];
      inject('https://connect.facebook.net/en_US/fbevents.js');
      window.fbq('init', cfg.px); window.fbq('track', 'PageView');
    }
    var t = $('#track-data'); if (t) track(JSON.parse(t.textContent));
  }
  function track(e) {
    if (!loaded || !e) return;
    var ids = e.ids || (e.id ? [String(e.id)] : []);
    if (window.fbq) {
      var p = { value: e.value, currency: e.currency || 'NGN', content_ids: ids.map(String), content_type: 'product' };
      if (e.event === 'InitiateCheckout') p.num_items = e.num_items;
      window.fbq('track', e.event, p);
    }
    if (window.gtag) {
      var map = { ViewContent: 'view_item', AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', Purchase: 'purchase' };
      var g = { currency: e.currency || 'NGN', value: e.value, items: ids.map(function (i) { return { item_id: String(i), item_name: e.name }; }) };
      if (e.order) g.transaction_id = e.order;
      window.gtag('event', map[e.event] || e.event, g);
    }
  }
  if (cfg) {
    var consent = getCookie('consent');
    var banner = $('[data-consent]');
    if (!cfg.consent || consent === 'yes') loadAnalytics();
    else if (!consent && banner) {
      banner.hidden = false;
      var set = function (v) { document.cookie = 'consent=' + v + '; Path=/; Max-Age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); banner.hidden = true; if (v === 'yes') loadAnalytics(); };
      $('[data-consent-yes]', banner).addEventListener('click', function () { set('yes'); });
      $('[data-consent-no]', banner).addEventListener('click', function () { set('no'); });
    }
  }
})();
