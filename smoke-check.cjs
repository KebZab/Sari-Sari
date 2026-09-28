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
  navigator: {},
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
assert.match(app.innerHTML, /Aling Nena's/);
assert.equal(JSON.parse(memory.get('sst_products')).length, 28);

// Customer login
inputs['login-phone'] = { value: '09201112222' };
inputs['login-password'] = { value: 'juan123' };
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Piattos/);
const product = JSON.parse(memory.get('sst_products')).find(p => p.name.startsWith('Piattos'));
for (const item of JSON.parse(memory.get('sst_products'))) {
  if (item.image) assert.ok(fs.existsSync(item.image), `Missing product image: ${item.image}`);
}

// Cart & Checkout
context.window.App.addToCart(product.id);
assert.equal(JSON.parse(memory.get('sst_cart_' + JSON.parse(memory.get('sst_session')).userId))[0].qty, 1);
context.window.App.goCheckout();
context.window.state.checkoutCoords = { lat: 10.5, lng: 123.9, manual: true };
context.window.App.placeOrder();
let orders = JSON.parse(memory.get('sst_orders'));
assert.equal(orders.length, 1);
assert.equal(orders[0].delivery.lat, 10.5);
assert.equal(orders[0].delivery.lng, 123.9);

// Admin login & Order confirmation
context.window.App.logout();
assert.match(app.innerHTML, /Sign in with Google/);
inputs['login-phone'].value = '09171234567';
inputs['login-password'].value = 'admin123';
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Dashboard/);
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

console.log('Smoke check passed: startup, phone auth, cart/checkout, admin dispatch, and Google Sign-In.');
