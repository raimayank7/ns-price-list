/* price-list.niveshsahayak.in: printable price lists from the saved items and services (NSStore 'item').
   Item price fields: mrp (MRP), prate (purchase price), wrate (wholesale), rate (retail = the selling rate the
   document makers already use). Prices are edited here and saved back to the items, so every bill uses them.
   The printed list is always English (owner rule); screens use NS.t('prl.*'). Settings in localStorage ns-prl. */
(function () {
  'use strict';
  var NS = window.NS, $ = NS.$, $$ = NS.$$, esc = NS.esc, t = function (k, v) { return NS.t(k, v); };
  var KEY = 'ns-prl', COLS = ['code', 'hsn', 'unit', 'mrp', 'prate', 'wrate', 'rate', 'gst'], PRICES = ['mrp', 'prate', 'wrate', 'rate'];
  var EN = { title: 'Price list', item: 'Item', code: 'Code', hsn: 'HSN/SAC', unit: 'Unit', mrp: 'MRP', prate: 'Purchase price', wrate: 'Wholesale', rate: 'Retail', gst: 'GST %',
    incl: 'Prices include GST.', plus: 'GST extra as applicable.', from: 'Prices valid from', made: 'Made free at price-list.niveshsahayak.in', inr: 'All prices in ₹.' };
  var DEF = { title: '', biz: '', from: '', gstNote: 'incl', sort: 'name', group: false, cols: { code: true, hsn: false, unit: true, mrp: true, prate: false, wrate: false, rate: true, gst: false }, skip: {} };

  var root, items = [], bizs = [], docs = [], S, dirty = {};
  function load() { var s = {}; try { s = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {} S = Object.assign({}, DEF, s); S.cols = Object.assign({}, DEF.cols, s.cols); S.skip = s.skip || {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/,/g, '')); return isFinite(n) ? n : null; }
  function money(v) { var n = num(v); return n == null ? '' : NS.money(n, false); }
  function biz() { return bizs.filter(function (b) { return b.id === S.biz; })[0] || bizs[0] || null; }

  /* margin of the retail price over the purchase price, in % of purchase */
  function margin(it) { var p = num(it.prate), r = num(it.rate); return p && r != null ? Math.round((r - p) / p * 1000) / 10 : null; }
  function issues(it) {
    var out = [], m = num(it.mrp), r = num(it.rate), w = num(it.wrate), p = num(it.prate);
    if (r == null) out.push(t('prl.e.norate'));
    if (m != null && r != null && r > m) out.push(t('prl.e.overmrp'));
    if (m != null && w != null && w > m) out.push(t('prl.e.wovermrp'));
    if (p != null && r != null && r < p) out.push(t('prl.e.loss'));
    return out;
  }

  /* the newest purchase bill line with the same item name gives its cost (rate after discount, without GST) */
  function lastCost(it) {
    var name = String(it.desc || '').trim().toLowerCase(), best = null;
    if (!name) return null;
    docs.forEach(function (d) {
      if (d.type !== 'pbill' || d.kind === 'return' || !d.items) return;
      d.items.forEach(function (l) {
        if (String(l.desc || '').trim().toLowerCase() !== name || num(l.rate) == null) return;
        if (!best || String(d.date) > String(best.date)) best = { date: d.date, cost: Math.round((num(l.rate) - num(l.rate) * (num(l.disc) || 0) / 100) * 100) / 100 };
      });
    });
    return best;
  }

  function chosen() {
    var list = items.filter(function (it) { return !S.skip[it.id]; });
    var by = S.sort === 'code' ? function (it) { return String(it.code || it.hsn || '~') + ' ' + it.desc; } : S.sort === 'rate' ? null : function (it) { return String(it.desc); };
    if (by) list.sort(function (a, b) { return by(a).localeCompare(by(b)); });
    else list.sort(function (a, b) { return (num(a.rate) || 0) - (num(b.rate) || 0); });
    if (S.group) list.sort(function (a, b) { return (a.kind === 'service') - (b.kind === 'service'); });
    return list;
  }
  function cols() { return COLS.filter(function (c) { return S.cols[c]; }); }

  /* the printed sheet: English labels, plain 0-9 digits */
  function sheet() {
    var b = biz(), cs = cols(), list = chosen(), title = S.title || EN.title, last = null;
    var head = '<div class="prl-head">' + (b ? '<div><b class="prl-biz">' + esc(b.name || '') + '</b><br>' + esc([b.addr, b.city, b.pin].filter(Boolean).join(', ')) +
      (b.phone ? '<br>' + esc(b.phone) : '') + (b.gstin ? '<br>GSTIN ' + esc(b.gstin) : '') + '</div>' : '<div></div>') +
      '<div class="prl-ttl"><p class="dt">' + esc(title) + '</p>' + (S.from ? '<span>' + esc(EN.from) + ' ' + esc(NS.fmtDate(S.from)) + '</span>' : '') + '</div></div>';
    var rows = list.map(function (it, i) {
      var g = S.group ? (it.kind === 'service' ? 'Services' : 'Goods') : null, sub = '';
      if (g && g !== last) { sub = '<tr class="prl-grp"><td colspan="' + (cs.length + 2) + '">' + g + '</td></tr>'; last = g; }
      return sub + '<tr><td class="n">' + (i + 1) + '</td><td>' + esc(it.desc || '') + '</td>' + cs.map(function (c) {
        if (PRICES.indexOf(c) >= 0) return '<td class="r">' + money(it[c]) + '</td>';
        if (c === 'gst') return '<td class="r">' + (it.gst !== '' && it.gst != null ? esc(it.gst) + '%' : '') + '</td>';
        return '<td>' + esc(it[c] || '') + '</td>';
      }).join('') + '</tr>';
    }).join('');
    var note = S.gstNote === 'incl' ? EN.incl : S.gstNote === 'plus' ? EN.plus : '';
    return head + '<table class="prl-tbl"><thead><tr><th class="n">#</th><th>' + EN.item + '</th>' + cs.map(function (c) { return '<th' + (PRICES.indexOf(c) >= 0 || c === 'gst' ? ' class="r"' : '') + '>' + EN[c] + '</th>'; }).join('') +
      '</tr></thead><tbody>' + (rows || '<tr><td colspan="' + (cs.length + 2) + '">-</td></tr>') + '</tbody></table>' +
      '<p class="prl-foot">' + esc([EN.inr, note].filter(Boolean).join(' ')) + '<span>' + EN.made + '</span></p>';
  }

  function drawSheet() { var s = $('[data-prl-sheet]', root); if (s) s.innerHTML = sheet(); var w = $('[data-prl-warn]', root); if (w) w.hidden = !S.cols.prate; }

  function drawItems() {
    var box = $('[data-prl-items]', root), q = ($('#prl-q', root) || {}).value || '';
    if (!items.length) { box.innerHTML = '<p class="soft">' + esc(t('prl.none')) + '</p>'; return; }
    var ql = q.toLowerCase(), shown = items.filter(function (it) { return !ql || (String(it.desc) + ' ' + (it.code || '') + ' ' + (it.hsn || '')).toLowerCase().indexOf(ql) >= 0; });
    var bad = items.filter(function (it) { return issues(it).length; }).length;
    box.innerHTML = '<p>' + esc(t('prl.sum', { n: items.length, on: items.length - Object.keys(S.skip).filter(function (k) { return S.skip[k] && items.some(function (it) { return it.id === k; }); }).length, bad: bad })) + '</p>' +
      '<div class="gt-scroll"><table class="gt-tbl gt-list prl-edit"><thead><tr><th>' + esc(t('prl.in')) + '</th><th>' + esc(t('hs.i.name')) + '</th>' +
      PRICES.map(function (c) { return '<th>' + esc(t('prl.c.' + c)) + '</th>'; }).join('') + '<th>' + esc(t('prl.margin')) + '</th><th>' + esc(t('gi.m.res')) + '</th></tr></thead><tbody>' +
      shown.map(function (it) {
        var iss = issues(it), m = margin(it);
        return '<tr' + (iss.length ? ' class="bad"' : '') + '><td><input type="checkbox" data-pick="' + esc(it.id) + '"' + (S.skip[it.id] ? '' : ' checked') + ' aria-label="' + esc(t('prl.in')) + ' ' + esc(it.desc) + '"></td>' +
          '<td>' + esc(it.desc) + (it.unit ? ' <span class="soft">/ ' + esc(it.unit) + '</span>' : '') + '</td>' +
          PRICES.map(function (c) { return '<td><input class="hs-cell prl-n" inputmode="decimal" data-id="' + esc(it.id) + '" data-f="' + c + '" value="' + esc(it[c] == null ? '' : it[c]) + '" aria-label="' + esc(t('prl.c.' + c)) + ' ' + esc(it.desc) + '"></td>'; }).join('') +
          '<td class="mono">' + (m == null ? '' : m + '%') + '</td><td>' + (iss.length ? esc(iss.join(' ')) : '✓') + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<div class="row"><button type="button" class="btn primary" data-prl-save' + (Object.keys(dirty).length ? '' : ' disabled') + '>' + esc(t('prl.save')) + '</button>' +
      '<button type="button" class="btn" data-prl-cost>' + esc(t('prl.cost')) + '</button>' +
      '<button type="button" class="link" data-prl-all="1">' + esc(t('prl.all')) + '</button> · <button type="button" class="link" data-prl-all="0">' + esc(t('prl.nonesel')) + '</button></div>';
  }

  function render() {
    load();
    var ck = function (c) { return '<label class="chk"><input type="checkbox" data-col="' + c + '"' + (S.cols[c] ? ' checked' : '') + '> ' + esc(t('prl.c.' + c)) + '</label>'; };
    var bopts = bizs.map(function (b) { return '<option value="' + esc(b.id) + '"' + (b.id === (biz() || {}).id ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('');
    root.innerHTML =
      '<div class="gt-grid">' +
      '<section class="gt-card gt-noprint" aria-labelledby="prl-h1"><h2 id="prl-h1">' + esc(t('prl.h.set')) + '</h2>' +
        (bizs.length ? '<label class="gt-lbl" for="prl-biz">' + esc(t('prl.biz')) + '</label><select id="prl-biz">' + bopts + '</select>' : '<p class="soft">' + esc(t('prl.nobiz')) + '</p>') +
        '<label class="gt-lbl" for="prl-title">' + esc(t('prl.ttl')) + '</label><input id="prl-title" value="' + esc(S.title) + '" placeholder="Price list" maxlength="80">' +
        '<label class="gt-lbl" for="prl-from">' + esc(t('prl.from')) + '</label><input id="prl-from" type="date" value="' + esc(S.from) + '">' +
        '<p class="gt-lbl">' + esc(t('prl.cols')) + '</p><div class="prl-cols">' + COLS.map(ck).join('') + '</div>' +
        '<p class="note" data-prl-warn hidden>' + esc(t('prl.w.prate')) + '</p>' +
        '<label class="gt-lbl" for="prl-gst">' + esc(t('prl.gst')) + '</label><select id="prl-gst">' + ['incl', 'plus', 'none'].map(function (v) { return '<option value="' + v + '"' + (S.gstNote === v ? ' selected' : '') + '>' + esc(t('prl.g.' + v)) + '</option>'; }).join('') + '</select>' +
        '<label class="gt-lbl" for="prl-sort">' + esc(t('prl.sort')) + '</label><select id="prl-sort">' + ['name', 'code', 'rate'].map(function (v) { return '<option value="' + v + '"' + (S.sort === v ? ' selected' : '') + '>' + esc(t('prl.s.' + v)) + '</option>'; }).join('') + '</select>' +
        '<label class="chk"><input type="checkbox" id="prl-group"' + (S.group ? ' checked' : '') + '> ' + esc(t('prl.group')) + '</label>' +
        '<div class="row gt-acts"><button type="button" class="btn primary" data-prl-print>' + esc(t('prl.print')) + '</button><button type="button" class="btn" data-prl-wa>' + esc(t('prl.wa')) + '</button><button type="button" class="btn" data-prl-csv>' + esc(t('prl.csv')) + '</button></div>' +
      '</section>' +
      '<section class="gt-card prl-paper" aria-label="' + esc(t('prl.preview')) + '"><div data-prl-sheet></div></section>' +
      '</div>' +
      '<section class="gt-card gt-noprint" aria-labelledby="prl-h2"><h2 id="prl-h2">' + esc(t('prl.h.items')) + '</h2><p class="soft">' + esc(t('prl.help')) + '</p>' +
        '<label class="gt-lbl" for="prl-q">' + esc(t('prl.q')) + '</label><input id="prl-q" type="search">' +
        '<div data-prl-items><div class="shim" style="height:80px"></div></div></section>' +
      '<section class="gt-card gt-noprint" aria-labelledby="prl-h3"><h2 id="prl-h3">' + esc(t('prl.h.add')) + '</h2>' +
        '<div class="fg2"><div><label class="gt-lbl" for="prl-a-desc">' + esc(t('hs.i.name')) + '</label><input id="prl-a-desc" maxlength="120"></div><div><label class="gt-lbl" for="prl-a-unit">' + esc(t('prl.c.unit')) + '</label><input id="prl-a-unit" maxlength="12" placeholder="pcs"></div></div>' +
        '<div class="fg2">' + ['mrp', 'wrate', 'rate'].map(function (c) { return '<div><label class="gt-lbl" for="prl-a-' + c + '">' + esc(t('prl.c.' + c)) + '</label><input id="prl-a-' + c + '" inputmode="decimal"></div>'; }).join('') +
        '<div><label class="gt-lbl" for="prl-a-gst">' + esc(t('prl.c.gst')) + '</label><input id="prl-a-gst" inputmode="decimal"></div></div>' +
        '<div class="row"><button type="button" class="btn" data-prl-add>' + esc(t('prl.add')) + '</button></div></section>';
    wire();
    drawSheet(); drawItems();
  }

  function setPrice(id, f, v) {
    var it = items.filter(function (x) { return x.id === id; })[0]; if (!it) return;
    it[f] = v.trim(); dirty[id] = 1;
    var b = $('[data-prl-save]', root); if (b) b.disabled = false;
    drawSheet();
  }

  function wire() {
    var on = function (sel, ev, fn) { var el = $(sel, root); if (el) el.addEventListener(ev, fn); };
    on('#prl-biz', 'change', function (e) { S.biz = e.target.value; save(); drawSheet(); });
    on('#prl-title', 'input', function (e) { S.title = e.target.value; save(); drawSheet(); });
    on('#prl-from', 'change', function (e) { S.from = e.target.value; save(); drawSheet(); });
    on('#prl-gst', 'change', function (e) { S.gstNote = e.target.value; save(); drawSheet(); });
    on('#prl-sort', 'change', function (e) { S.sort = e.target.value; save(); drawSheet(); });
    on('#prl-group', 'change', function (e) { S.group = e.target.checked; save(); drawSheet(); });
    on('#prl-q', 'input', drawItems);
    root.addEventListener('change', function (e) {
      var c = e.target.getAttribute('data-col'), p = e.target.getAttribute('data-pick');
      if (c) { S.cols[c] = e.target.checked; save(); drawSheet(); }
      if (p) { if (e.target.checked) delete S.skip[p]; else S.skip[p] = 1; save(); drawSheet(); }
    });
    root.addEventListener('input', function (e) { if (e.target.classList.contains('prl-n')) setPrice(e.target.getAttribute('data-id'), e.target.getAttribute('data-f'), e.target.value); });
    root.addEventListener('focusout', function (e) { if (e.target.classList.contains('prl-n')) drawItemsKeepFocus(); });
    root.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-prl-print')) { drawSheet(); window.print(); }
      else if (b.hasAttribute('data-prl-save')) saveAll();
      else if (b.hasAttribute('data-prl-cost')) fillCost();
      else if (b.hasAttribute('data-prl-csv')) csv();
      else if (b.hasAttribute('data-prl-wa')) wa();
      else if (b.hasAttribute('data-prl-add')) add();
      else if (b.hasAttribute('data-prl-all')) { var all = b.getAttribute('data-prl-all') === '1'; S.skip = {}; if (!all) items.forEach(function (it) { S.skip[it.id] = 1; }); save(); drawSheet(); drawItems(); }
    };
  }
  /* redraw issue and margin columns after a price is typed, without losing the field being typed in */
  function drawItemsKeepFocus() { setTimeout(function () { var a = document.activeElement, id = a && a.getAttribute && a.getAttribute('data-id'), f = a && a.getAttribute && a.getAttribute('data-f'); drawItems(); if (id) { var n = $('.prl-n[data-id="' + id + '"][data-f="' + f + '"]', root); if (n) n.focus(); } }, 0); }

  function saveAll() {
    var ids = Object.keys(dirty); if (!ids.length) return;
    Promise.all(ids.map(function (id) { return NSStore.put('item', items.filter(function (x) { return x.id === id; })[0]); })).then(function () {
      dirty = {}; NS.toast(t('prl.saved', { n: ids.length })); drawItems();
    }, function (e) { NS.toast(t('nosave', { e: e.message }), 'bad'); });
  }

  function fillCost() {
    var n = 0;
    items.forEach(function (it) { if (num(it.prate) != null) return; var c = lastCost(it); if (c) { it.prate = String(c.cost); dirty[it.id] = 1; n++; } });
    NS.toast(n ? t('prl.costed', { n: n }) : t('prl.nocost'));
    drawSheet(); drawItems();
  }

  function csv() {
    var cs = cols(), q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [[EN.item].concat(cs.map(function (c) { return EN[c]; })).map(q).join(',')].concat(chosen().map(function (it) { return [it.desc].concat(cs.map(function (c) { return it[c]; })).map(q).join(','); }));
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }));
    a.download = 'price-list-' + NS.today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
  }

  /* a short text list for WhatsApp: name, retail (or wholesale) price and MRP; never the purchase price */
  function wa() {
    var b = biz(), price = S.cols.rate ? 'rate' : S.cols.wrate ? 'wrate' : 'rate';
    var lines = chosen().map(function (it) {
      var p = money(it[price]), m = S.cols.mrp && num(it.mrp) != null && it.mrp !== it[price] ? ' (MRP ₹' + money(it.mrp) + ')' : '';
      return '• ' + it.desc + (p ? ': ₹' + p + (it.unit ? '/' + it.unit : '') : '') + m;
    });
    var msg = (S.title || EN.title) + (b && b.name ? ' - ' + b.name : '') + (S.from ? '\n' + EN.from + ' ' + NS.fmtDate(S.from) : '') + '\n\n' + lines.join('\n') +
      (S.gstNote === 'incl' ? '\n\n' + EN.incl : S.gstNote === 'plus' ? '\n\n' + EN.plus : '');
    window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  }

  function add() {
    var v = function (id) { return ($('#prl-a-' + id, root).value || '').trim(); };
    if (!v('desc')) { NS.toast(t('prl.e.name'), 'bad'); return; }
    var it = { desc: v('desc'), unit: v('unit'), mrp: v('mrp'), wrate: v('wrate'), rate: v('rate'), gst: v('gst'), kind: 'goods' };
    if (items.some(function (x) { return String(x.desc).toLowerCase() === it.desc.toLowerCase(); })) { NS.toast(t('prl.e.dup'), 'bad'); return; }
    NSStore.put('item', it).then(function () { NS.toast(t('prl.added', { n: it.desc })); items.push(it); render(); }, function (e) { NS.toast(t('nosave', { e: e.message }), 'bad'); });
  }

  function loadAll() {
    return NSStore.ready().then(function () { return Promise.all([NSStore.list('item'), NSStore.list('biz'), NSStore.list('doc')]); }).then(function (r) {
      items = r[0].filter(function (it) { return it.desc; }); bizs = r[1]; docs = r[2]; dirty = {};
      render();
    }).catch(function () { items = []; render(); });
  }

  function start() { root = $('#price-list-tool'); if (root) loadAll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  document.addEventListener('ns-lang', function () { if (root) render(); });
  NS.priceListSheet = sheet;
})();
