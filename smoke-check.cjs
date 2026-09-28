const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// 1. Verify entrypoint integrity
const indexHtml = fs.readFileSync('index.html', 'utf8');
const sariStoreHtml = fs.readFileSync('sari-sari-store.html', 'utf8');
assert.equal(indexHtml, sariStoreHtml, 'index.html and sari-sari-store.html must match');

// 2. Verify all modular files exist and are referenced in HTML
const modularScripts = [
  'js/config.js',
  'js/store-db.js',
  'js/state.js',
  'js/geolocation.js',
  'js/map-engine.js',
  'js/views/auth.views.js',
  'js/views/customer.views.js',
  'js/views/admin.views.js',
  'js/views/location.modal.js',
  'js/app.js'
];

for (const s of modularScripts) {
  assert.ok(fs.existsSync(s), `Missing module file: ${s}`);
  assert.ok(indexHtml.includes(s), `index.html must reference: ${s}`);
}

const cssFiles = [
  'css/app.css',
  'css/variables.css',
  'css/base.css',
  'css/customer.css',
  'css/admin.css',
  'css/maps-modals.css'
];

for (const c of cssFiles) {
  assert.ok(fs.existsSync(c), `Missing CSS file: ${c}`);
}

// 3. Execution context for automated simulation
const memory = new Map();
const inputs = {};
const app = { innerHTML: '' };
const toastWrap = { appendChild() {} };
const context = {
  console, Date, Math, JSON, Number, String, Object, Array, RegExp,
  setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  confirm() { return true; },
  localStorage: {
    getItem(k) { return memory.has(k) ? memory.get(k) : null; },
    setItem(k, v) { memory.set(k, v); },
    removeItem(k) { memory.delete(k); }
  },
  navigator: {
    geolocation: {
      getCurrentPosition(success, error, opts) {
        success({
          coords: {
            latitude: 14.5995,
            longitude: 120.9842,
            accuracy: 12
          }
        });
      }
    }
  },
  document: {
    getElementById(id) { return id === 'app' ? app : id === 'toast-wrap' ? toastWrap : inputs[id] || null; },
    createElement() { return { style: {}, remove() {}, textContent: '' }; }
  },
  window: { scrollTo() {} },
  React: { createElement() {} }
};
context.window.window = context.window;
vm.createContext(context);

// Load and execute all modular scripts in order
for (const scriptFile of modularScripts) {
  const code = fs.readFileSync(scriptFile, 'utf8');
  vm.runInContext(code, context);
}

// Assert initial startup
assert.match(app.innerHTML, /NelGlenn's/);
assert.equal(JSON.parse(memory.get('sst_products')).length, 28);

// Customer login
inputs['login-phone'] = { value: '09201112222' };
inputs['login-password'] = { value: 'juan123' };
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Piattos/);
for (const [view, label] of [
  ['customer-home', 'All products'],
  ['customer-orders', 'Your orders|No orders yet'],
  ['customer-profile', 'My profile']
]) {
  context.window.App.go(view);
  assert.equal(context.window.state.view, view);
  assert.match(app.innerHTML, new RegExp(label));
}
context.window.App.go('customer-home');
const product = JSON.parse(memory.get('sst_products')).find(p => p.name.startsWith('Piattos'));
for (const item of JSON.parse(memory.get('sst_products'))) {
  if (item.image) assert.ok(fs.existsSync(item.image), `Missing product image: ${item.image}`);
}

// Cart & Checkout
context.window.App.addToCart(product.id);
assert.equal(JSON.parse(memory.get('sst_cart_' + JSON.parse(memory.get('sst_session')).userId))[0].qty, 1);
context.window.App.goCheckout();

// Verify Buyer Detect GPS
context.window.state.checkoutCoords = null;
context.window.App.detectCustomerGps(false);
assert.ok(context.window.state.checkoutCoords, 'Buyer detect GPS must set checkoutCoords');
assert.equal(context.window.state.checkoutCoords.lat, 14.5995);
assert.equal(context.window.state.checkoutCoords.lng, 120.9842);
assert.equal(context.window.state.checkoutGpsStatus, 'locked');

context.window.App.placeOrder();
let orders = JSON.parse(memory.get('sst_orders'));
assert.equal(orders.length, 1);
assert.equal(orders[0].delivery.lat, 14.5995);
assert.equal(orders[0].delivery.lng, 120.9842);
context.window.App.go('customer-orders');
context.window.App.reorderOrder(orders[0].id);
assert.equal(context.window.state.cartOpen, true, 'Re-order must open the cart');
assert.match(app.innerHTML, /Your Cart/);

// Admin login & Order confirmation
context.window.App.logout();
assert.match(app.innerHTML, /Sign in with Google/);
inputs['login-phone'].value = '09171234567';
inputs['login-password'].value = 'admin123';
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Dashboard/);
for (const section of ['dashboard', 'orders', 'deliveries', 'products', 'inventory', 'customers', 'notifications']) {
  context.window.App.setAdminSection(section);
  assert.equal(context.window.state.adminSection, section);
  assert.equal(context.window.state.view, 'admin-' + section);
  const heading = section === 'dashboard' ? 'Overview' : section[0].toUpperCase() + section.slice(1);
  assert.match(app.innerHTML, new RegExp('<h1>' + heading + '</h1>'));
}
assert.match(app.innerHTML, /admin-mobile-nav/);
assert.match(app.innerHTML, /aria-label="More sections"/);
assert.match(app.innerHTML, /onclick="App.toggleNotif\(true\)" aria-label="Notifications"/);
context.window.App.toggleNotif(true);
assert.equal(context.window.state.notifOpen, true);
assert.match(app.innerHTML, /drawer-head"><h3>.*Notifications/);
context.window.App.setAdminSection('orders');
assert.equal(context.window.state.notifOpen, false);
context.window.App.showDeliveryRoute(orders[0].id);
assert.equal(context.window.state.adminSection, 'deliveries');
assert.equal(context.window.state.selectedDeliveryOrderId, orders[0].id);
context.window.App.confirmOrder(orders[0].id);
orders = JSON.parse(memory.get('sst_orders'));
assert.equal(orders[0].status, 'Confirmed');
assert.equal(JSON.parse(memory.get('sst_products')).find(p => p.id === product.id).stock, product.stock - 1);

// Google Sign-In flow
context.window.App.logout();
assert.match(app.innerHTML, /btn-google/);
context.window.App.demoGoogleLogin();
assert.match(app.innerHTML, /Piattos/);
const currentSession = JSON.parse(memory.get('sst_session'));
const googleUser = JSON.parse(memory.get('sst_users')).find(u => u.id === currentSession.userId);
assert.ok(googleUser);
assert.equal(googleUser.authProvider, 'google');
assert.equal(googleUser.email, 'kevin.demo@gmail.com');
context.window.App.go('customer-profile');
assert.match(app.innerHTML, /Connected with Google/);

// One customer's local order must not rewrite another customer's cloud order.
const cloudWrites = [];
context.firestoreDb = {
  collection(name) {
    return { doc(id) { return { set(item) { cloudWrites.push({ name, id, item }); return Promise.resolve(); } }; } };
  }
};
const existingOrders = JSON.parse(memory.get('sst_orders'));
const anotherOrder = { ...existingOrders[0], id: 'order_second_customer', customerId: googleUser.id, orderNumber: 'ORD-SECOND' };
context.saveOrders(existingOrders.concat(anotherOrder));
assert.deepEqual(cloudWrites.map(w => w.id), ['order_second_customer']);
const thirdOrder = { ...anotherOrder, id: 'order_third_customer', orderNumber: 'ORD-THIRD' };
context.applyCloudSnapshot('sst_orders', 'orders', {
  forEach(fn) { [existingOrders[0], thirdOrder].forEach(item => fn({ data() { return item; } })); }
});
assert.deepEqual(JSON.parse(memory.get('sst_orders')).map(o => o.id).sort(),
  [existingOrders[0].id, anotherOrder.id, thirdOrder.id].sort());

// Leaflet anchors and marker CSS must place the visible pin at the coordinates.
context.L = { divIcon(options) { return options; } };
for (const icon of [context.createStoreIcon(), context.createCustomerIcon('Juan', 'ORD-1', true), context.createRiderIcon('ORD-1')]) {
  assert.equal(icon.iconAnchor[0], icon.iconSize[0] / 2);
  assert.equal(icon.iconAnchor[1], icon.iconSize[1]);
}
const longNameIcon = context.createCustomerIcon('Kevin Managuit', 'ORD-0001', true);
assert.match(longNameIcon.html, /Kevin #0001/);
assert.doesNotMatch(longNameIcon.html, />Kevin Managuit \(/);
const mapCss = fs.readFileSync('css/maps-modals.css', 'utf8');
assert.doesNotMatch(mapCss, /translate\(-50%,\s*-(?:50|100)%\)/);

console.log('Smoke check passed: auth, customer/admin navigation, checkout, delivery routing, and multi-user order sync.');
