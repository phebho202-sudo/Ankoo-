/* ANKOO admin: media picker, client-side image resizing, product variants and uploads. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var csrf = ($('meta[name="csrf"]') || {}).content || '';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var menuBtn = $('[data-a-menu]'); var nav = $('[data-a-nav]');
  if (menuBtn) menuBtn.addEventListener('click', function () { nav.classList.toggle('open'); });
  $$('form[data-confirm]').forEach(function (f) { f.addEventListener('submit', function (e) { if (!confirm(f.dataset.confirm)) e.preventDefault(); }); });
  $$('[data-print]').forEach(function (b) { b.addEventListener('click', function () { window.print(); }); });

  // ---- Image resizing in the browser: keeps uploads small for mobile visitors ----
  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(); var url = URL.createObjectURL(file);
      img.onload = function () { resolve(img); }; img.onerror = function () { reject(new Error('Could not read ' + file.name)); };
      img.src = url;
    });
  }
  function toBlob(img, max) {
    var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    var w = Math.round(img.naturalWidth * scale); var h = Math.round(img.naturalHeight * scale);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise(function (resolve) {
      c.toBlob(function (b) {
        if (b && b.type === 'image/webp') return resolve({ blob: b, w: w, h: h });
        c.toBlob(function (j) { resolve({ blob: j, w: w, h: h }); }, 'image/jpeg', 0.86);
      }, 'image/webp', 0.84);
    });
  }
  function b64(blob) {
    return new Promise(function (resolve) { var r = new FileReader(); r.onload = function () { resolve(String(r.result).split(',')[1]); }; r.readAsDataURL(blob); });
  }
  function uploadImage(file) {
    var raw = /svg|gif/.test(file.type);
    var work = raw
      ? b64(file).then(function (d) { return { data: d }; })
      : loadImage(file).then(function (img) {
        return Promise.all([toBlob(img, 2400), toBlob(img, 900)]).then(function (r) {
          return Promise.all([b64(r[0].blob), b64(r[1].blob)]).then(function (d) { return { data: d[0], sm: d[1], width: r[0].w, height: r[0].h }; });
        });
      });
    return work.then(function (payload) {
      payload.alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
      return fetch('/admin/media/upload', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf, Accept: 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload failed'); return j; }); });
    });
  }
  function uploadVideo(file, onProgress) {
    return new Promise(function (resolve, reject) {
      var x = new XMLHttpRequest();
      x.open('POST', '/admin/media/video?name=' + encodeURIComponent(file.name));
      x.setRequestHeader('X-CSRF-Token', csrf); x.setRequestHeader('Accept', 'application/json');
      x.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      x.upload.onprogress = function (e) { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      x.onload = function () { var j = {}; try { j = JSON.parse(x.responseText); } catch (e) { /* */ } if (x.status >= 200 && x.status < 300) resolve(j); else reject(new Error(j.error || 'Upload failed')); };
      x.onerror = function () { reject(new Error('Network error during upload')); };
      x.send(file);
    });
  }
  function uploadMany(files, status) {
    var list = Array.prototype.slice.call(files); var done = 0; var results = [];
    return list.reduce(function (p, f) {
      return p.then(function () {
        if (status) status.textContent = 'Uploading ' + (done + 1) + ' of ' + list.length + '…';
        return uploadImage(f).then(function (j) { results.push(j); done++; });
      });
    }, Promise.resolve()).then(function () { if (status) status.textContent = 'Uploaded ' + done + ' image(s).'; return results; })
      .catch(function (e) { if (status) status.textContent = e.message; alert(e.message); return results; });
  }

  // ---- Media picker dialog ----
  var picker = $('[data-picker]'); var grid = picker && $('[data-picker-grid]', picker);
  var pickCb = null; var pickMulti = false; var pickKind = 'image';
  function renderGrid(items) {
    grid.innerHTML = items.length ? items.map(function (m) {
      return '<button type="button" data-id="' + m.id + '" data-thumb="' + esc(m.thumb || m.url) + '" data-kind="' + m.kind + '">' +
        (m.kind === 'video' ? '<span class="m-video">▶ #' + m.id + '</span>' : '<img src="' + esc(m.thumb) + '" alt="' + esc(m.alt || '') + '" loading="lazy">') + '</button>';
    }).join('') : '<p class="a-empty">Nothing uploaded yet.</p>';
  }
  function loadGrid() { return fetch('/admin/media.json?kind=' + pickKind, { credentials: 'same-origin', headers: { Accept: 'application/json' } }).then(function (r) { return r.json(); }).then(renderGrid); }
  function openPicker(kind, multi, cb) {
    pickKind = kind; pickMulti = multi; pickCb = cb;
    var up = $('[data-picker-upload]', picker);
    up.accept = kind === 'video' ? 'video/mp4,video/quicktime,video/webm' : 'image/*';
    up.multiple = kind !== 'video';
    grid.innerHTML = '<p class="a-empty">Loading…</p>';
    picker.showModal(); loadGrid();
  }
  if (picker) {
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-id]'); if (!b) return;
      pickCb([{ id: b.dataset.id, thumb: b.dataset.thumb, kind: b.dataset.kind }]);
      if (!pickMulti) picker.close(); else b.classList.add('picked');
    });
    $('[data-picker-upload]', picker).addEventListener('change', function (e) {
      var status = $('[data-picker-status]', picker); var files = e.target.files;
      var p = pickKind === 'video'
        ? uploadVideo(files[0], function (pc) { status.textContent = 'Uploading video… ' + pc + '%'; }).then(function (j) { status.textContent = 'Uploaded.'; return [j]; })
        : uploadMany(files, status);
      p.then(function (res) {
        e.target.value = '';
        if (res.length) { pickCb(res.map(function (j) { return { id: j.id, thumb: j.thumb || j.url, kind: j.kind }; })); if (!pickMulti) picker.close(); else loadGrid(); }
      }).catch(function (err) { status.textContent = err.message; });
    });
  }

  // Single media fields
  $$('[data-media-field]').forEach(function (f) {
    var input = $('input[type="hidden"]', f); var prev = $('[data-preview]', f); var clear = $('[data-clear]', f); var pick = $('[data-pick]', f);
    pick.addEventListener('click', function () {
      openPicker(f.dataset.kind || 'image', false, function (items) {
        var m = items[0]; input.value = m.id;
        prev.innerHTML = m.kind === 'video' ? '<span class="m-video">▶ Video #' + esc(m.id) + '</span>' : '<img src="' + esc(m.thumb) + '" alt="">';
        clear.hidden = false; pick.textContent = 'Change';
      });
    });
    clear.addEventListener('click', function () { input.value = ''; prev.innerHTML = ''; clear.hidden = true; pick.textContent = 'Choose'; });
  });

  // Product images (ordered list)
  var imgs = $('[data-images]');
  if (imgs) {
    var addFig = function (m) {
      if ($('figure[data-id="' + m.id + '"]', imgs)) return;
      var fig = document.createElement('figure'); fig.dataset.id = m.id;
      fig.innerHTML = '<img src="' + esc(m.thumb) + '" alt=""><input type="hidden" name="images[]" value="' + esc(m.id) + '"><div><button type="button" data-left aria-label="Move left">←</button><button type="button" data-right aria-label="Move right">→</button><button type="button" data-remove aria-label="Remove">✕</button></div>';
      imgs.appendChild(fig);
    };
    $('[data-add-images]').addEventListener('click', function () { openPicker('image', true, function (items) { items.forEach(addFig); }); });
    imgs.addEventListener('click', function (e) {
      var fig = e.target.closest('figure'); if (!fig) return;
      if (e.target.closest('[data-remove]')) fig.remove();
      if (e.target.closest('[data-left]') && fig.previousElementSibling) imgs.insertBefore(fig, fig.previousElementSibling);
      if (e.target.closest('[data-right]') && fig.nextElementSibling) imgs.insertBefore(fig.nextElementSibling, fig);
    });
  }

  // Product variants table
  var gen = $('[data-gen-variants]');
  if (gen) {
    var tbody = $('[data-variants]');
    gen.addEventListener('click', function () {
      var split = function (s) { return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean).filter(function (x, i, a) { return a.indexOf(x) === i; }); };
      var sizes = split($('[data-opt-sizes]').value); var colours = split($('[data-opt-colours]').value);
      if (!sizes.length) sizes = ['']; if (!colours.length) colours = [''];
      var existing = {};
      $$('tr', tbody).forEach(function (tr) {
        var g = function (n) { return $('[name="' + n + '[]"]', tr).value; };
        existing[g('v_size') + '|' + g('v_colour')] = { stock: g('v_stock'), sku: g('v_sku'), active: g('v_active') };
      });
      var rows = [];
      colours.forEach(function (c) {
        sizes.forEach(function (s) {
          var e = existing[s + '|' + c] || { stock: 0, sku: '', active: '1' };
          rows.push('<tr><td><input type="hidden" name="v_size[]" value="' + esc(s) + '">' + (esc(s) || '—') + '</td><td><input type="hidden" name="v_colour[]" value="' + esc(c) + '">' + (esc(c) || '—') +
            '</td><td><input type="number" name="v_stock[]" value="' + esc(e.stock) + '" min="0" max="100000"></td><td><input name="v_sku[]" value="' + esc(e.sku) + '" maxlength="60"></td>' +
            '<td><select name="v_active[]"><option value="1"' + (e.active !== '0' ? ' selected' : '') + '>Yes</option><option value="0"' + (e.active === '0' ? ' selected' : '') + '>No</option></select></td></tr>');
        });
      });
      tbody.innerHTML = rows.join('');
    });
  }

  // Media library page uploads
  var lib = $('[data-library-upload]'); var vid = $('[data-video-upload]'); var st = $('[data-upload-status]');
  if (lib) lib.addEventListener('change', function () { uploadMany(lib.files, st).then(function () { location.reload(); }); });
  if (vid) vid.addEventListener('change', function () {
    uploadVideo(vid.files[0], function (p) { st.textContent = 'Uploading video… ' + p + '%'; })
      .then(function () { location.reload(); }).catch(function (e) { st.textContent = e.message; alert(e.message); });
  });
})();
