// Menu data — prices in OMR, copied from the cafe's Instagram menu story.
// Row: [name, price]  or  [name, hotPrice, icedPrice]  (use null where not offered)
const MENU = {
  coffee: [
    { title: 'Espresso Bar', dual: true, items: [
      ['Espresso', '1', null], ['Americano', '1.2', '1.3'], ['Macchiato', '1.2', null],
      ['Cortado', '1.4', null], ['Flat White', '1.5', null], ['Cappuccino', '1.6', null],
      ['Latte', '1.7', '1.8'], ['Spanish Latte', '1.9', '1.9'], ['Mocha', '1.9', '1.9'],
      ['Hot Chocolate', '1.3', null]
    ]},
    { title: 'Brewed Coffee', items: [['Genius Brew', '2.2'], ['Cold Brew', '1.8'], ['V60', '2']] },
    { title: 'Coffee Mocktails', items: [['Berry Cloud Signature', '2.2'], ['Espresso Bomb', '1.2'], ['Creamy Espresso', '1.7'], ['Espresso Martini', '1.4']] }
  ],
  matcha: [
    { title: 'Matcha Bar', dual: true, items: [
      ['Classic Matcha', '1.5', '1.8'], ['Flavoured Matcha', '1.6', '1.8'],
      ['Cloud Matcha', null, '2.3'], ['Genius Signature Matcha', null, '2.5']
    ]}
  ],
  cold: [
    { title: 'Signature', items: [['Midnight in Genius', '2.2'], ['Orbit Energy', '2.5'], ['Hibiscus', '1.8']] },
    { title: 'Mojito Bar', items: [['Classic Mojito', '1.3'], ['Flavoured Mojito', '1.4']] },
    { title: 'Smoothies', items: [['Golden Açaí', '2'], ['Strawberry Banana', '1.8']] },
    { title: 'Fresh Juices', items: [['Orange', '1.4'], ['Watermelon', '1.4'], ['Mango', '1.4']] },
    { title: 'Iced Teas', items: [['Peach Iced Tea', '1.5'], ['Passion Fruit Iced Tea', '1.5']] },
    { title: 'Milkshakes', items: [['Vanilla Shake', '2'], ['Chocolate Shake', '2']] },
    { title: 'Healthy Drinks', items: [['Energy Booster', '2'], ['Vitamins Load', '2']] }
  ],
  tea: [
    { title: 'World Teas', items: [['Karak', '0.6'], ['Tea', '0.8']] },
    { title: 'Hot Herbal Drinks', items: [['Apple Cinnamon Tea', '1'], ['Spring Blossom', '1']] }
  ],
  sweet: [
    { title: 'Sweets', items: [['NYC Cheesecake', '2'], ['Tiramisu', '1.8'], ['Cookie', '1'], ['Croissant', '1']] },
    { title: 'Sandwiches', items: [['Chicken Sandwich', '2'], ['Halloumi Grilled Sandwich', '2'], ['Turkey & Cheese Sandwich', '2']] }
  ]
};

const price = v => v == null ? '—' : v;

function groupHTML(g) {
  const head = g.dual ? '<div class="cols"><span>Hot</span><span>Iced</span></div>' : '';
  const rows = g.items.map(it => g.dual
    ? `<li><span class="n">${it[0]}</span><span class="dots"></span><span class="p2"><b${it[1]==null?' class="na"':''}>${price(it[1])}</b><b${it[2]==null?' class="na"':''}>${price(it[2])}</b></span></li>`
    : `<li><span class="n">${it[0]}</span><span class="dots"></span><span class="p1"><b>${it[1]}</b></span></li>`
  ).join('');
  return `<div class="group"><div class="ghead"><h3>${g.title}</h3>${head}</div><ul>${rows}</ul></div>`;
}

Object.entries(MENU).forEach(([k, groups]) => {
  const el = document.getElementById(k + '-list') || document.getElementById(k);
  if (el) el.innerHTML = groups.map(groupHTML).join('');
});
