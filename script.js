// sticky nav
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 60);
onScroll(); addEventListener('scroll', onScroll, {passive:true});

// mobile menu
const burger = document.getElementById('burger');
const links = document.getElementById('links');
const setMenu = open => {
  links.classList.toggle('open', open);
  nav.classList.toggle('menu-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
};
burger.addEventListener('click', () => setMenu(!links.classList.contains('open')));
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));

// menu tabs
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab,.panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById(t.dataset.tab).classList.add('active');
  t.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});
}));

// reveal on scroll
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), {threshold: .15});
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.transitionDelay = (i % 4) * 90 + 'ms';
  io.observe(el);
});

// open / closed (Muscat time, UTC+4)
(function () {
  const el = document.getElementById('openNow');
  const m = new Date(Date.now() + new Date().getTimezoneOffset() * 6e4 + 4 * 36e5);
  const d = m.getDay(), h = m.getHours() + m.getMinutes() / 60;
  const closeAt = (d >= 4 && d <= 6) ? 24 : 23; // Thu-Sat 12am, Sun-Wed 11pm
  const open = h >= 7 && h < closeAt;
  el.textContent = open ? '● Open now' : '○ Closed right now — opens 7 am';
  el.classList.toggle('open', open);
})();

document.getElementById('yr').textContent = new Date().getFullYear();

// ===== Order list builder =====
(function () {
  const WA = '96894247491', KEY = 'genius-cart-v1';
  const $ = id => document.getElementById(id);
  const sheet = $('sheet'), back = $('sheetBack'), bar = $('cartbar');
  if (!sheet) return;
  let cart = [], lastFocus = null;
  try { cart = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { cart = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {} };

  const baisa = s => Math.round(parseFloat(s) * 1000);
  const fmt = b => { const v = b / 1000; return (b % 100 === 0 ? v.toFixed(1) : v.toFixed(3).replace(/0+$/, '')) + ' OMR'; };
  const keyOf = (n, v) => n + '|' + v;
  const total = () => cart.reduce((s, i) => s + i.p * i.q, 0);
  const count = () => cart.reduce((s, i) => s + i.q, 0);
  const label = i => i.n + (i.v ? ' (' + i.v + ')' : '');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  function message() {
    const lines = ['Hi Genius! 👋 I\'d like to order:', ''];
    cart.forEach(i => lines.push('• ' + i.q + '× ' + label(i) + ' — ' + fmt(i.p * i.q)));
    lines.push('', 'Total: ' + fmt(total()));
    const name = $('oName').value.trim(), note = $('oNote').value.trim();
    if (name) lines.push('Name: ' + name);
    lines.push('Pickup: ' + $('oWhen').value);
    if (note) lines.push('Notes: ' + note);
    return lines.join('\n');
  }

  function render(bump) {
    const n = count(), has = n > 0;
    // price pills: show quantity badge
    document.querySelectorAll('.pbtn').forEach(b => {
      const it = cart.find(i => i.k === keyOf(b.dataset.n, b.dataset.v));
      if (it) b.setAttribute('data-q', it.q); else b.removeAttribute('data-q');
    });
    // floating bar
    bar.classList.toggle('show', has && !sheet.classList.contains('open'));
    $('cbCount').textContent = n; $('cbTotal').textContent = fmt(total());
    if (bump) { bar.classList.remove('bump'); void bar.offsetWidth; bar.classList.add('bump'); }
    const lbl = $('orderBtnLabel'); if (lbl) lbl.textContent = has ? 'View my order (' + n + ')' : 'Start my order';
    // sheet
    $('cartEmpty').hidden = has;
    $('cartTotalRow').hidden = !has; $('cartForm').hidden = !has; $('clearCart').hidden = !has;
    $('cartList').innerHTML = cart.map((i, idx) =>
      '<li><div class="ci-name">' + esc(label(i)) + '<small>' + fmt(i.p) + ' each</small></div>' +
      '<div class="ci-qty"><button type="button" data-d="-1" data-i="' + idx + '" aria-label="Remove one ' + esc(label(i)) + '">−</button><span>' + i.q + '</span><button type="button" data-d="1" data-i="' + idx + '" aria-label="Add one ' + esc(label(i)) + '">+</button></div>' +
      '<b class="ci-sum">' + fmt(i.p * i.q) + '</b></li>').join('');
    $('cartTotal').textContent = fmt(total());
    const a = $('sendWA');
    a.href = 'https://wa.me/' + WA + (has ? '?text=' + encodeURIComponent(message()) : '');
    $('sendLabel').textContent = has ? 'Send order on WhatsApp' : 'Message us on WhatsApp';
    save();
  }

  function add(n, v, p) {
    const k = keyOf(n, v), it = cart.find(i => i.k === k);
    if (it) it.q++; else cart.push({ k, n, v, p: baisa(p), q: 1 });
    render(true);
  }

  function open() {
    lastFocus = document.activeElement;
    sheet.classList.add('open'); back.classList.add('open'); sheet.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; render();
    setTimeout(() => $('sheetClose').focus(), 50);
  }
  function close() {
    sheet.classList.remove('open'); back.classList.remove('open'); sheet.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = ''; render();
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', e => {
    const p = e.target.closest('.pbtn'); if (p) { add(p.dataset.n, p.dataset.v, p.dataset.p); return; }
    if (e.target.closest('[data-open-cart]')) { open(); return; }
    const q = e.target.closest('.ci-qty button');
    if (q) {
      const i = cart[+q.dataset.i]; if (!i) return;
      i.q += +q.dataset.d; if (i.q <= 0) cart.splice(+q.dataset.i, 1);
      render();
    }
  });
  $('sheetClose').addEventListener('click', close);
  back.addEventListener('click', close);
  $('clearCart').addEventListener('click', () => { cart = []; render(); });
  ['oName', 'oWhen', 'oNote'].forEach(id => $(id).addEventListener('input', () => render()));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('open')) close(); });
  render();
})();
