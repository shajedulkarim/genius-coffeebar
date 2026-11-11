(function () {
  'use strict';
  const $app = document.getElementById('app'), $boot = document.getElementById('boot'), $toast = document.getElementById('toast');
  const cfg = window.GENIUS_CFG || {};
  const TABS = [['coffee', 'Coffee'], ['matcha', 'Matcha'], ['cold', 'Cold & Fresh'], ['tea', 'Tea'], ['sweet', 'Sweets & Bites']];
  const SLOTS = [
    ['storefront-sign', 'Storefront sign'], ['interior', 'Inside the cafe'],
    ['coffee-cold-foam', 'Coffee: cold foam'], ['coffee-latte-art', 'Coffee: latte art'], ['coffee-cake', 'Coffee: black coffee & cake'],
    ['matcha', 'Matcha'], ['strawberry-matcha', 'Strawberry matcha'],
    ['red-smoothie', 'Red smoothie'], ['date-smoothie', 'Date smoothie'], ['orange-juice', 'Orange juice'], ['drinks-trio', 'Drinks trio'],
    ['tea-table', 'Tea'], ['tiramisu', 'Tiramisu'],
    ['chocolate-cake', 'Chocolate cake'], ['pistachio-cheesecake', 'Pistachio cheesecake'], ['lotus-cheesecake', 'Lotus cheesecake'], ['chocolate-cheesecake', 'Chocolate cheesecake']
  ];
  const STATUS_NEXT = { new: ['preparing', 'Start preparing'], preparing: ['ready', 'Mark ready'], ready: ['done', 'Done · picked up'] };
  const ICON = {
    orders: '<svg viewBox="0 0 24 24"><path d="M6 3h12l2 4H4zM4 7v13h16V7M9 12h6"/></svg>',
    menu: '<svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    photos: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-8 8"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.5-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 00-2 1.2l-2.3-.9-2 3.5 2 1.5A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.5 2 3.5 2.3-.9a7 7 0 002 1.2l.4 2.5h4l.4-2.5a7 7 0 002-1.2l2.3.9 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hr = x => { x = ((x % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' am' : ' pm'); };
  const omr = n => { const v = Number(n); return (Number.isInteger(v * 10) ? v.toFixed(1) : String(parseFloat(v.toFixed(3)))) + ' OMR'; };
  let toastT;
  const toast = (msg, bad) => { $toast.textContent = msg; $toast.classList.toggle('bad', !!bad); $toast.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => $toast.classList.remove('show'), bad ? 4000 : 1600); };
  const show = () => { $boot.hidden = true; $app.hidden = false; };

  // ---------- not configured ----------
  if (!cfg.url || !cfg.key || !window.supabase) {
    show();
    $app.innerHTML = '<div class="login"><div class="brand"><span class="logo"></span><b>Genius Admin</b></div><div class="card setup"><h3>Not connected yet</h3>' +
      (window.supabase ? '' : '<p class="err">Could not load the Supabase library. Check the internet connection and reload.</p>') +
      '<p>The admin portal needs its database. Follow <code>admin/SETUP.md</code> (about 10 minutes), then put the project URL and anon key into <code>config.js</code>.</p></div></div>';
    return;
  }

  const db = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  const S = { user: null, tab: 'orders', menuTab: 'coffee', groups: [], items: [], settings: {}, orders: [], ordersFilter: 'active', busy: {}, maxSeen: 0, polling: null, recovery: false };

  // ---------- data ----------
  async function loadMenu() {
    const [g, i, s] = await Promise.all([db.from('menu_groups').select('*').order('sort'), db.from('menu_items').select('*').order('sort'), db.from('settings').select('*')]);
    if (g.error || i.error || s.error) throw (g.error || i.error || s.error);
    S.groups = g.data; S.items = i.data; S.settings = {}; s.data.forEach(x => S.settings[x.key] = x.value);
  }
  async function loadOrders(quiet) {
    const r = await db.from('orders').select('*').order('created_at', { ascending: false }).limit(150);
    if (r.error) { if (!quiet) toast('Could not load orders', true); return; }
    const fresh = r.data.filter(o => o.id > S.maxSeen && o.status === 'new');
    if (S.maxSeen && fresh.length) { notify(fresh.length); }
    S.maxSeen = Math.max(S.maxSeen, ...r.data.map(o => o.id), 0);
    S.orders = r.data;
    if (S.tab === 'orders') renderPage(); else renderNav();
  }
  function notify(n) {
    toast('🔔 ' + n + ' new order' + (n > 1 ? 's' : ''));
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
      o.connect(g); g.connect(a.destination); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(.2, a.currentTime);
      g.gain.exponentialRampToValueAtTime(.001, a.currentTime + .6); o.start(); o.stop(a.currentTime + .6);
    } catch (e) {}
  }
  const newCount = () => S.orders.filter(o => o.status === 'new').length;

  async function saveSetting(key, value) {
    const r = await db.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
    if (r.error) { toast('Could not save: ' + r.error.message, true); return false; }
    S.settings[key] = value; return true;
  }

  // ---------- auth ----------
  async function start() {
    db.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') { S.recovery = true; }
      if (ev === 'SIGNED_OUT') { S.user = null; stopPoll(); renderLogin(); }
    });
    const { data } = await db.auth.getSession();
    if (data.session) await enter(data.session.user); else { show(); renderLogin(); }
  }
  async function enter(user) {
    const ok = await db.rpc('is_admin');
    if (ok.error || ok.data !== true) {
      await db.auth.signOut(); show();
      renderLogin(ok.error ? 'Database is not set up yet (run supabase/schema.sql).' : 'This account is not an admin. Ask the owner to add the email to the admins list.');
      return;
    }
    S.user = user;
    try { await loadMenu(); await loadOrders(true); } catch (e) { show(); renderLogin('Could not load data: ' + (e.message || e)); return; }
    S.tab = S.recovery ? 'settings' : 'orders';
    show(); renderShell(); startPoll();
  }
  function renderLogin(msg) {
    $app.innerHTML = '<form class="login" id="loginForm" autocomplete="on"><div class="brand"><span class="logo"></span><b>Genius Admin</b><span>Sign in to manage the cafe</span></div>' +
      '<div class="card"><label class="f"><span>Email</span><input type="email" name="email" autocomplete="username" required inputmode="email"></label>' +
      '<label class="f"><span>Password</span><input type="password" name="password" autocomplete="current-password" required></label>' +
      (msg ? '<p class="err">' + esc(msg) + '</p>' : '<p class="err" id="lerr" hidden></p>') +
      '<button class="btn block" type="submit">Sign in</button>' +
      '<p style="text-align:center;margin-top:12px"><button type="button" class="btn ghost sm" id="forgot">Forgot password</button></p></div></form>';
    const f = document.getElementById('loginForm');
    f.addEventListener('submit', async e => {
      e.preventDefault(); const b = f.querySelector('.btn'); b.disabled = true;
      const r = await db.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      if (r.error) { b.disabled = false; renderLogin(r.error.message === 'Invalid login credentials' ? 'Wrong email or password.' : r.error.message); return; }
      await enter(r.data.user);
    });
    document.getElementById('forgot').addEventListener('click', async () => {
      const em = f.email.value.trim(); if (!em) { toast('Type your email first', true); return; }
      const r = await db.auth.resetPasswordForEmail(em, { redirectTo: location.href.split('#')[0] });
      toast(r.error ? r.error.message : 'Reset link sent. Check your email.', !!r.error);
    });
  }
  function startPoll() { stopPoll(); S.polling = setInterval(() => { if (!document.hidden) loadOrders(true); }, 20000); document.addEventListener('visibilitychange', onVis); }
  function stopPoll() { clearInterval(S.polling); document.removeEventListener('visibilitychange', onVis); }
  function onVis() { if (!document.hidden && S.user) loadOrders(true); }

  // ---------- shell ----------
  function renderShell() {
    $app.innerHTML = '<header class="top"><span class="logo"></span><h1>Genius Admin</h1><a href="../" target="_blank" rel="noopener">View site ↗</a></header><div class="page" id="page"></div><nav class="nav" id="nav"></nav>';
    renderNav(); renderPage();
  }
  function renderNav() {
    const n = document.getElementById('nav'); if (!n) return;
    const nc = newCount();
    n.innerHTML = [['orders', 'Orders'], ['menu', 'Menu'], ['photos', 'Photos'], ['settings', 'Settings']].map(([k, l]) =>
      '<button data-go="' + k + '" class="' + (S.tab === k ? 'on' : '') + '" aria-label="' + l + '">' + ICON[k] + l + (k === 'orders' && nc ? '<span class="badge">' + nc + '</span>' : '') + '</button>').join('');
    document.title = (nc ? '(' + nc + ') ' : '') + 'Genius Admin';
  }
  function renderPage() {
    const p = document.getElementById('page'); if (!p) return;
    const y = window.scrollY;
    p.innerHTML = ({ orders: pageOrders, menu: pageMenu, photos: pagePhotos, settings: pageSettings })[S.tab]();
    renderNav(); window.scrollTo(0, y);
  }

  // ---------- ORDERS ----------
  const muscat = (d, o) => new Date(d).toLocaleString('en-GB', Object.assign({ timeZone: 'Asia/Muscat' }, o));
  const ago = d => { const m = Math.round((Date.now() - new Date(d)) / 6e4); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.floor(m / 60) + ' h ago' : muscat(d, { day: 'numeric', month: 'short' }); };
  function pageOrders() {
    const today = muscat(Date.now(), { day: '2-digit', month: '2-digit', year: 'numeric' });
    const td = S.orders.filter(o => muscat(o.created_at, { day: '2-digit', month: '2-digit', year: 'numeric' }) === today && o.status !== 'cancelled');
    const sum = td.reduce((s, o) => s + Number(o.total), 0);
    const act = S.orders.filter(o => ['new', 'preparing', 'ready'].includes(o.status));
    const list = S.ordersFilter === 'active' ? act : S.ordersFilter === 'done' ? S.orders.filter(o => o.status === 'done') : S.orders;
    return '<h2 class="h2">Orders</h2><div class="stats"><div class="stat"><b>' + td.length + '</b><span>Orders today</span></div><div class="stat"><b>' + omr(sum) + '</b><span>Today\'s total</span></div></div>' +
      '<div class="chips">' + [['active', 'Active', act.length], ['done', 'Done'], ['all', 'All']].map(([k, l, c]) => '<button class="chip ' + (S.ordersFilter === k ? 'on' : '') + '" data-ofilter="' + k + '">' + l + (c ? '<i>' + c + '</i>' : '') + '</button>').join('') + '<button class="chip" data-refresh>↻ Refresh</button></div>' +
      (list.length ? list.map(orderCard).join('') : '<div class="empty">' + (S.ordersFilter === 'active' ? 'No active orders.<br>New orders from the website appear here.' : 'Nothing here.') + '</div>') +
      '<p class="sub" style="text-align:center">Orders also arrive on WhatsApp. Here you can track their status.</p>';
  }
  function orderCard(o) {
    const nx = STATUS_NEXT[o.status];
    return '<article class="card ord s-' + o.status + '" data-oid="' + o.id + '"><div class="ord-h"><div><b>' + esc(o.name || 'Guest') + '</b><div class="sub">' + muscat(o.created_at, { hour: '2-digit', minute: '2-digit' }) + ' · ' + ago(o.created_at) + ' · ' + esc(o.pickup || '') + '</div></div><span class="tag ' + o.status + '">' + o.status + '</span></div>' +
      '<ul>' + (o.items || []).map(i => '<li><span>' + i.q + '× ' + esc(i.n) + (i.v ? ' <small class="sub">(' + esc(i.v) + ')</small>' : '') + '</span><span>' + omr(i.p * i.q) + '</span></li>').join('') + '</ul>' +
      '<div class="tot"><span>Total</span><span>' + omr(o.total) + '</span></div>' + (o.note ? '<div class="note">📝 ' + esc(o.note) + '</div>' : '') +
      ((nx || o.status === 'new' || o.status === 'preparing' || o.status === 'ready') ? '<div class="acts">' + (nx ? '<button class="btn grow" data-ostatus="' + nx[0] + '">' + nx[1] + '</button>' : '') +
        (['new', 'preparing', 'ready'].includes(o.status) ? '<button class="btn danger" data-ostatus="cancelled">Cancel</button>' : '') + '</div>' : '') + '</article>';
  }
  async function setOrder(id, status) {
    const o = S.orders.find(x => x.id === id); if (!o) return;
    const old = o.status; o.status = status; renderPage();
    const r = await db.from('orders').update({ status }).eq('id', id);
    if (r.error) { o.status = old; renderPage(); toast('Could not update: ' + r.error.message, true); }
  }

  // ---------- MENU ----------
  const gOf = tab => S.groups.filter(g => g.tab === tab).sort((a, b) => a.sort - b.sort);
  const iOf = gid => S.items.filter(i => i.group_id === gid).sort((a, b) => a.sort - b.sort);
  const pv = v => v == null ? '' : String(Number(v));
  function pageMenu() {
    const gs = gOf(S.menuTab);
    const chips = '<div class="chips">' + TABS.map(([k, l]) => '<button class="chip ' + (S.menuTab === k ? 'on' : '') + '" data-mtab="' + k + '">' + l + '<i>' + S.groups.filter(g => g.tab === k).length + '</i></button>').join('') + '</div>';
    if (!S.groups.length) {
      return '<h2 class="h2">Menu</h2><div class="card"><h3>Menu is empty</h3><p class="sub" style="margin-bottom:14px">One tap copies the current website menu into the database. After that you can edit everything here.</p><button class="btn block" data-import>Import current menu</button></div>';
    }
    return '<h2 class="h2">Menu</h2>' + chips + (gs.length ? gs.map(groupCard).join('') : '<div class="empty">No sections in this tab yet.</div>') +
      '<button class="btn block" data-addgroup>＋ Add section</button><p class="sub" style="text-align:center;margin-top:14px">Changes save automatically and show on the website within seconds.</p>';
  }
  function groupCard(g) {
    const its = iOf(g.id), gs = gOf(g.tab), idx = gs.indexOf(g);
    return '<section class="card grp" data-gid="' + g.id + '"><div class="grp-h"><input type="text" value="' + esc(g.title) + '" data-gtitle aria-label="Section name" maxlength="60">' +
      '<button class="iconb" data-gmove="-1" aria-label="Move section up"' + (idx === 0 ? ' disabled' : '') + '>' + ICON.up + '</button><button class="iconb" data-gmove="1" aria-label="Move section down"' + (idx === gs.length - 1 ? ' disabled' : '') + '>' + ICON.down + '</button></div>' +
      '<div class="grp-o"><label class="sw"><input type="checkbox" data-gdual' + (g.dual ? ' checked' : '') + '><s></s>Hot &amp; Iced prices</label><button class="iconb del" data-gdel aria-label="Delete section">' + ICON.trash + '</button></div>' +
      its.map((it, n) => itemRow(g, it, n, its.length)).join('') +
      '<div class="addrow"><button class="btn sm" data-additem>＋ Add item</button></div></section>';
  }
  function itemRow(g, it, n, len) {
    return '<div class="it ' + (it.hidden ? 'hid' : '') + '" data-iid="' + it.id + '"><div class="it-1"><input type="text" value="' + esc(it.name) + '" data-iname aria-label="Item name" maxlength="80">' +
      '<button class="iconb" data-imove="-1" aria-label="Move up"' + (n === 0 ? ' disabled' : '') + '>' + ICON.up + '</button><button class="iconb" data-imove="1" aria-label="Move down"' + (n === len - 1 ? ' disabled' : '') + '>' + ICON.down + '</button></div>' +
      '<div class="it-2"><label class="pr"><span>' + (g.dual ? 'Hot OMR' : 'Price OMR') + '</span><input type="text" inputmode="decimal" value="' + pv(it.hot) + '" data-iprice="hot" placeholder="' + (g.dual ? '—' : '0.0') + '"></label>' +
      (g.dual ? '<label class="pr"><span>Iced OMR</span><input type="text" inputmode="decimal" value="' + pv(it.iced) + '" data-iprice="iced" placeholder="—"></label>' : '') +
      '<span class="sp"></span><div class="it-tools"><label class="sw warn"><input type="checkbox" data-isold' + (it.sold_out ? ' checked' : '') + '><s></s>Sold out</label><label class="sw"><input type="checkbox" data-ihide' + (it.hidden ? ' checked' : '') + '><s></s>Hide</label><button class="iconb del" data-idel aria-label="Delete item">' + ICON.trash + '</button></div></div></div>';
  }
  async function mut(p, okMsg) {
    const r = await p;
    if (r.error) { toast('Could not save: ' + r.error.message, true); await loadMenu().catch(() => {}); renderPage(); return false; }
    if (okMsg) toast(okMsg); return true;
  }
  async function swapSort(list, idx, dir, table) {
    const a = list[idx], b = list[idx + dir]; if (!a || !b) return;
    // normalise to 0..n so equal sorts never block a move
    const order = list.slice(); order[idx] = b; order[idx + dir] = a;
    const ups = [];
    order.forEach((x, i) => { if (x.sort !== i) { x.sort = i; ups.push(db.from(table).update({ sort: i }).eq('id', x.id)); } });
    renderPage();
    const rs = await Promise.all(ups); const bad = rs.find(r => r.error);
    if (bad) { toast('Could not reorder: ' + bad.error.message, true); await loadMenu().catch(() => {}); renderPage(); }
  }
  function parsePrice(s, allowBlank) {
    s = String(s).trim().replace(',', '.').replace(/\s*omr$/i, '');
    if (s === '' || s === '-' || s === '—') return allowBlank ? null : undefined;
    const v = Number(s); if (!isFinite(v) || v < 0 || v > 999) return undefined;
    return Math.round(v * 1000) / 1000;
  }
  async function importDefault() {
    if (typeof MENU === 'undefined') { toast('Default menu not found', true); return; }
    const btn = $app.querySelector('[data-import]'); if (btn) btn.disabled = true;
    let gi = 0;
    for (const [tab, groups] of Object.entries(MENU)) {
      for (const g of groups) {
        const gr = await db.from('menu_groups').insert({ tab, title: g.title, dual: !!g.dual, sort: gi++ }).select().single();
        if (gr.error) { toast('Import failed: ' + gr.error.message, true); await loadMenu().catch(() => {}); renderPage(); return; }
        const rows = g.items.map((it, n) => ({ group_id: gr.data.id, name: it[0], hot: it[1] == null ? null : Number(it[1]), iced: g.dual && it[2] != null ? Number(it[2]) : null, sort: n }));
        const ir = await db.from('menu_items').insert(rows);
        if (ir.error) { toast('Import failed: ' + ir.error.message, true); await loadMenu().catch(() => {}); renderPage(); return; }
      }
    }
    await loadMenu(); renderPage(); toast('Menu imported ✓');
  }

  // ---------- PHOTOS ----------
  function pagePhotos() {
    const imgs = S.settings.images || {};
    return '<h2 class="h2">Photos</h2><p class="sub" style="margin-bottom:14px">Tap Replace to change a photo on the website. Pick a photo from your phone; it is resized automatically.</p><div class="pgrid">' +
      SLOTS.map(([k, l]) => {
        const custom = imgs[k];
        return '<div class="ph' + (S.busy['p' + k] ? ' busy' : '') + '" data-slot="' + k + '"><img src="' + esc(custom || '../img/' + k + '.webp') + '" alt="" loading="lazy"><div><b>' + esc(l) + '</b>' + (custom ? '<small>Custom photo</small>' : '') +
          '<label class="btn sm ghost" style="cursor:pointer">' + (S.busy['p' + k] ? 'Uploading…' : 'Replace') + '<input type="file" accept="image/*" data-pfile hidden></label>' +
          (custom ? '<button class="btn sm danger" data-preset>Use original</button>' : '') + '</div></div>';
      }).join('') + '</div>';
  }
  function resizeToJpeg(file, max) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.round(im.naturalWidth * sc), h = Math.round(im.naturalHeight * sc);
        const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url); c.toBlob(b => b ? res(b) : rej(new Error('Could not process the photo')), 'image/jpeg', .86);
      };
      im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that photo')); };
      im.src = url;
    });
  }
  async function uploadPhoto(slot, file) {
    S.busy['p' + slot] = true; renderPage();
    try {
      const blob = await resizeToJpeg(file, 1600), path = slot + '-' + Date.now() + '.jpg';
      const up = await db.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
      if (up.error) throw up.error;
      const url = db.storage.from('photos').getPublicUrl(path).data.publicUrl;
      const old = (S.settings.images || {})[slot];
      const ok = await saveSetting('images', Object.assign({}, S.settings.images || {}, { [slot]: url }));
      if (ok) { toast('Photo updated ✓'); removeOld(old); } else { await db.storage.from('photos').remove([path]); }
    } catch (e) { toast(e.message || 'Upload failed', true); }
    S.busy['p' + slot] = false; renderPage();
  }
  function removeOld(url) { try { const m = /\/photos\/([^?]+)/.exec(url || ''); if (m) db.storage.from('photos').remove([decodeURIComponent(m[1])]); } catch (e) {} }
  async function resetPhoto(slot) {
    const imgs = Object.assign({}, S.settings.images || {}), old = imgs[slot]; delete imgs[slot];
    if (await saveSetting('images', imgs)) { toast('Original photo restored'); removeOld(old); }
    renderPage();
  }

  // ---------- SETTINGS ----------
  function pageSettings() {
    const a = S.settings.announcement || { on: false, text: '' };
    const h = Object.assign({ open: 7, close_sun_wed: 23, close_thu_sat: 24, temp_closed: false }, S.settings.hours);
    const r = Object.assign({ score: '5.0', count: 36, url: '' }, S.settings.rating);
    const opts = (from, to, sel) => { let o = ''; for (let x = from; x <= to; x++) o += '<option value="' + x + '"' + (x === sel ? ' selected' : '') + '>' + (x === 24 ? '12 am (midnight)' : hr(x)) + '</option>'; return o; };
    return '<h2 class="h2">Settings</h2>' +
      '<form class="card" data-form="announcement"><h3>Announcement banner</h3><p class="sub" style="margin-bottom:10px">A bar across the top of the website, for example “Closed for Eid — back Friday”.</p>' +
      '<label class="sw"><input type="checkbox" name="on"' + (a.on ? ' checked' : '') + '><s></s>Show banner</label><label class="f"><span>Message</span><input type="text" name="text" maxlength="140" value="' + esc(a.text) + '" placeholder="Short message"></label><button class="btn block" type="submit">Save banner</button></form>' +
      '<form class="card" data-form="hours"><h3>Opening hours</h3><label class="sw warn" style="margin-bottom:10px"><input type="checkbox" name="temp_closed"' + (h.temp_closed ? ' checked' : '') + '><s></s>Temporarily closed (shows “Closed” on the site)</label>' +
      '<label class="f"><span>Opens</span><select name="open">' + opts(4, 12, h.open) + '</select></label><label class="f"><span>Closes Sun – Wed</span><select name="close_sun_wed">' + opts(18, 24, h.close_sun_wed) + '</select></label><label class="f"><span>Closes Thu – Sat</span><select name="close_thu_sat">' + opts(18, 24, h.close_thu_sat) + '</select></label><button class="btn block" type="submit">Save hours</button></form>' +
      '<form class="card" data-form="rating"><h3>Google rating</h3><div class="row"><label class="f grow"><span>Stars (e.g. 4.9)</span><input type="text" name="score" inputmode="decimal" value="' + esc(r.score) + '" maxlength="4"></label><label class="f grow"><span>Number of reviews</span><input type="number" name="count" min="0" max="99999" value="' + esc(r.count) + '"></label></div>' +
      '<label class="f"><span>Link to your Google reviews</span><input type="text" name="url" value="' + esc(r.url) + '" placeholder="https://…"></label><button class="btn block" type="submit">Save rating</button></form>' +
      '<form class="card" data-form="password"><h3>Account</h3><p class="sub" style="margin-bottom:10px">Signed in as <b>' + esc(S.user && S.user.email) + '</b></p><label class="f"><span>New password (min 8 characters)</span><input type="password" name="pw" autocomplete="new-password" minlength="8"></label><button class="btn block" type="submit">Change password</button></form>' +
      '<button class="btn danger block" data-signout>Sign out</button>';
  }
  async function submitForm(f) {
    const n = f.dataset.form, d = new FormData(f), btn = f.querySelector('[type=submit]'); btn.disabled = true;
    try {
      if (n === 'announcement') { if (await saveSetting('announcement', { on: d.has('on'), text: String(d.get('text') || '').trim() })) toast('Banner saved ✓'); }
      else if (n === 'hours') {
        const v = { open: +d.get('open'), close_sun_wed: +d.get('close_sun_wed'), close_thu_sat: +d.get('close_thu_sat'), temp_closed: d.has('temp_closed') };
        if (await saveSetting('hours', v)) toast('Hours saved ✓');
      } else if (n === 'rating') {
        const score = String(d.get('score')).trim().replace(',', '.'), count = parseInt(d.get('count'), 10), u = String(d.get('url') || '').trim();
        if (!(Number(score) >= 1 && Number(score) <= 5)) { toast('Stars must be between 1 and 5', true); }
        else if (!(count >= 0)) { toast('Enter the number of reviews', true); }
        else if (u && !/^https:\/\//i.test(u)) { toast('The link must start with https://', true); }
        else if (await saveSetting('rating', { score, count, url: u })) toast('Rating saved ✓');
      } else if (n === 'password') {
        const pw = String(d.get('pw') || ''); if (pw.length < 8) { toast('Use at least 8 characters', true); }
        else { const r = await db.auth.updateUser({ password: pw }); toast(r.error ? r.error.message : 'Password changed ✓', !!r.error); if (!r.error) f.reset(); }
      }
    } finally { btn.disabled = false; }
  }

  // ---------- events ----------
  const $ = (el, sel) => el.closest(sel);
  document.addEventListener('click', async e => {
    const t = e.target, b = t.closest('button'); if (!b || !S.user) return;
    if (b.dataset.go) { S.tab = b.dataset.go; renderPage(); window.scrollTo(0, 0); return; }
    if (b.dataset.ofilter) { S.ordersFilter = b.dataset.ofilter; renderPage(); return; }
    if ('refresh' in b.dataset) { await loadOrders(); toast('Updated'); return; }
    if (b.dataset.ostatus) { const c = $(b, '[data-oid]'); if (b.dataset.ostatus === 'cancelled' && !confirm('Cancel this order?')) return; setOrder(+c.dataset.oid, b.dataset.ostatus); return; }
    if (b.dataset.mtab) { S.menuTab = b.dataset.mtab; renderPage(); return; }
    if ('import' in b.dataset) { importDefault(); return; }
    if ('signout' in b.dataset) { await db.auth.signOut(); return; }
    if ('addgroup' in b.dataset) {
      const gs = gOf(S.menuTab), r = await db.from('menu_groups').insert({ tab: S.menuTab, title: 'New section', dual: false, sort: gs.length ? Math.max(...gs.map(g => g.sort)) + 1 : 0 }).select().single();
      if (r.error) { toast('Could not add: ' + r.error.message, true); return; }
      S.groups.push(r.data); renderPage(); toast('Section added'); return;
    }
    const gc = $(b, '[data-gid]'), g = gc && S.groups.find(x => x.id === gc.dataset.gid);
    if (g && b.dataset.gmove) { const list = gOf(g.tab); swapSort(list, list.indexOf(g), +b.dataset.gmove, 'menu_groups'); return; }
    if (g && 'gdel' in b.dataset) {
      if (!confirm('Delete the section “' + g.title + '” and all its items? This cannot be undone.')) return;
      if (await mut(db.from('menu_groups').delete().eq('id', g.id), 'Section deleted')) { S.groups = S.groups.filter(x => x.id !== g.id); S.items = S.items.filter(i => i.group_id !== g.id); renderPage(); }
      return;
    }
    if (g && 'additem' in b.dataset) {
      const its = iOf(g.id), r = await db.from('menu_items').insert({ group_id: g.id, name: 'New item', hot: 0, iced: null, sort: its.length ? Math.max(...its.map(i => i.sort)) + 1 : 0 }).select().single();
      if (r.error) { toast('Could not add: ' + r.error.message, true); return; }
      S.items.push(r.data); renderPage(); toast('Item added — set its name and price');
      const inp = document.querySelector('[data-iid="' + r.data.id + '"] [data-iname]'); if (inp) { inp.focus(); inp.select(); }
      return;
    }
    const ic = $(b, '[data-iid]'), it = ic && S.items.find(x => x.id === ic.dataset.iid);
    if (it && b.dataset.imove) { const list = iOf(it.group_id); swapSort(list, list.indexOf(it), +b.dataset.imove, 'menu_items'); return; }
    if (it && 'idel' in b.dataset) {
      if (!confirm('Delete “' + it.name + '”?')) return;
      if (await mut(db.from('menu_items').delete().eq('id', it.id), 'Item deleted')) { S.items = S.items.filter(x => x.id !== it.id); renderPage(); }
      return;
    }
    if (b.dataset.preset !== undefined) { const c = $(b, '[data-slot]'); if (c && confirm('Go back to the original photo?')) resetPhoto(c.dataset.slot); }
  });

  document.addEventListener('change', async e => {
    const t = e.target; if (!S.user) return;
    const gc = $(t, '[data-gid]'), g = gc && S.groups.find(x => x.id === gc.dataset.gid);
    const ic = $(t, '[data-iid]'), it = ic && S.items.find(x => x.id === ic.dataset.iid);
    if (t.matches('[data-pfile]')) { const c = $(t, '[data-slot]'), f = t.files[0]; if (c && f) uploadPhoto(c.dataset.slot, f); t.value = ''; return; }
    if (g && t.matches('[data-gtitle]')) {
      const v = t.value.trim(); if (!v) { t.value = g.title; toast('Name cannot be empty', true); return; }
      if (v === g.title) return; g.title = v; await mut(db.from('menu_groups').update({ title: v }).eq('id', g.id), 'Saved ✓'); return;
    }
    if (g && !it && t.matches('[data-gdual]')) {
      g.dual = t.checked; renderPage();
      await mut(db.from('menu_groups').update({ dual: g.dual }).eq('id', g.id), g.dual ? 'Hot & Iced prices on' : 'Single price'); return;
    }
    if (it && t.matches('[data-iname]')) {
      const v = t.value.trim(); if (!v) { t.value = it.name; toast('Name cannot be empty', true); return; }
      if (v === it.name) return; it.name = v; await mut(db.from('menu_items').update({ name: v }).eq('id', it.id), 'Saved ✓'); return;
    }
    if (it && t.matches('[data-iprice]')) {
      const f = t.dataset.iprice, grp = S.groups.find(x => x.id === it.group_id);
      const v = parsePrice(t.value, f === 'iced' || (grp && grp.dual));
      if (v === undefined) { t.value = pv(it[f]); toast('Enter a price like 1.5', true); return; }
      it[f] = v; t.value = pv(v); await mut(db.from('menu_items').update({ [f]: v }).eq('id', it.id), 'Saved ✓'); return;
    }
    if (it && t.matches('[data-isold]')) { it.sold_out = t.checked; await mut(db.from('menu_items').update({ sold_out: it.sold_out }).eq('id', it.id), it.sold_out ? 'Marked sold out' : 'Back on the menu'); return; }
    if (it && t.matches('[data-ihide]')) { it.hidden = t.checked; ic.classList.toggle('hid', it.hidden); await mut(db.from('menu_items').update({ hidden: it.hidden }).eq('id', it.id), it.hidden ? 'Hidden from website' : 'Visible again'); return; }
  });

  document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (f) { e.preventDefault(); submitForm(f); } });

  start().catch(err => { show(); $app.innerHTML = '<div class="login"><div class="card"><h3>Something went wrong</h3><p class="err">' + esc(err.message || err) + '</p></div></div>'; });
})();
