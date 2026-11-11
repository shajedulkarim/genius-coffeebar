// Live content from the admin portal (Supabase). Falls back to the built-in menu.js
// if the backend is not configured or unreachable, so the site never breaks.
(function () {
  const cfg = window.GENIUS_CFG || {};
  const CK = 'genius-cms-v2';
  const on = !!(cfg.url && cfg.key);
  const TABS = ['coffee', 'matcha', 'cold', 'tea', 'sweet'];
  const price = n => (n == null ? null : String(Number(n)));
  const imgs = [...document.querySelectorAll('img[src^="img/"]')].map(el => {
    el.dataset.orig = el.getAttribute('src');
    return { el, slot: el.dataset.orig.replace(/^img\//, '').replace(/\.\w+$/, '') };
  });
  window.GeniusSettings = {};

  const H = h => { const x = ((h % 24) + 24) % 24; return (x % 12 || 12) + (x < 12 ? ' am' : ' pm'); };

  function applySettings(s) {
    window.GeniusSettings = s || {};
    // announcement banner
    const a = s.announcement, bar = document.getElementById('announce');
    if (bar) {
      const show = !!(a && a.on && a.text && a.text.trim());
      bar.hidden = !show; bar.textContent = show ? a.text.trim() : '';
      document.body.classList.toggle('has-announce', show);
    }
    // rating
    const r = s.rating, el = document.querySelector('.rating');
    if (el && r && r.score) {
      el.querySelector('b').textContent = r.score;
      el.querySelector('span:last-child').textContent = '· ' + r.count + ' Google reviews';
      el.setAttribute('aria-label', 'Rated ' + r.score + ' out of 5 on Google, ' + r.count + ' reviews');
      if (r.url) el.href = r.url;
    }
    // hours text
    const h = s.hours;
    if (h) {
      const dd = document.querySelectorAll('.card dl dd');
      if (dd[0]) dd[0].textContent = H(h.open) + ' – ' + H(h.close_sun_wed);
      if (dd[1]) dd[1].textContent = H(h.open) + ' – ' + H(h.close_thu_sat);
    }
    // photos
    const map = s.images || {};
    imgs.forEach(({ el, slot }) => {
      const u = map[slot];
      if (u && el.getAttribute('src') !== u) el.src = u;
      else if (!u && el.getAttribute('src') !== el.dataset.orig) el.src = el.dataset.orig;
    });
    document.dispatchEvent(new Event('settings:applied'));
  }

  function buildMenu(groups, items) {
    const M = {};
    TABS.forEach(t => M[t] = []);
    groups.slice().sort((a, b) => a.sort - b.sort).forEach(g => {
      if (!M[g.tab]) return;
      const its = items.filter(i => i.group_id === g.id && !i.hidden && (i.hot != null || (g.dual && i.iced != null))).sort((a, b) => a.sort - b.sort)
        .map(i => g.dual ? [i.name, price(i.hot), price(i.iced), i.sold_out] : [i.name, price(i.hot), null, i.sold_out]);
      if (its.length) M[g.tab].push({ title: g.title, dual: g.dual, items: its });
    });
    return M;
  }

  function apply(data) {
    if (data.menu && TABS.some(t => data.menu[t].length)) renderMenu(data.menu);
    applySettings(data.settings || {});
  }

  if (on) {
    try { const c = JSON.parse(localStorage.getItem(CK)); if (c) apply(c); } catch (e) {}
    const H1 = { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key };
    const get = t => fetch(cfg.url + '/rest/v1/' + t, { headers: H1 }).then(r => { if (!r.ok) throw new Error(t); return r.json(); });
    Promise.all([get('menu_groups?select=*'), get('menu_items?select=*'), get('settings?select=*')]).then(([g, i, st]) => {
      const settings = {}; st.forEach(x => settings[x.key] = x.value);
      const data = { menu: buildMenu(g, i), settings };
      const prev = localStorage.getItem(CK), next = JSON.stringify(data);
      if (prev !== next) { apply(data); try { localStorage.setItem(CK, next); } catch (e) {} }
    }).catch(() => {});
  }

  // Save a copy of each order for the admin portal. Never blocks or breaks the WhatsApp flow.
  let last = '';
  window.GeniusCMS = {
    logOrder(o) {
      if (!on) return;
      const sig = JSON.stringify(o.items) + o.name + o.pickup + o.note;
      if (sig === last) return; last = sig;
      try {
        fetch(cfg.url + '/rest/v1/orders', {
          method: 'POST', keepalive: true,
          headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ name: o.name || null, pickup: o.pickup, note: o.note || null, items: o.items, total: o.total })
        }).catch(() => {});
      } catch (e) {}
    }
  };
})();
