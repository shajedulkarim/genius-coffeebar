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
