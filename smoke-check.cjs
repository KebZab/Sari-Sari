const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const html = fs.readFileSync('sari-sari-store.html', 'utf8');
if (fs.existsSync('index.html')) {
  assert.equal(fs.readFileSync('index.html', 'utf8'), html, 'index.html must match sari-sari-store.html');
}
const script = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/)[1];
new vm.Script(script);
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
vm.createContext(context);
vm.runInContext(script, context);
assert.match(app.innerHTML, /Demo accounts/);
assert.equal(JSON.parse(memory.get('sst_products')).length, 28);

inputs['login-phone'] = { value: '09201112222' };
inputs['login-password'] = { value: 'juan123' };
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Piattos/);
const product = JSON.parse(memory.get('sst_products')).find(p => p.name.startsWith('Piattos'));
for (const item of JSON.parse(memory.get('sst_products'))) {
  if (item.image) assert.ok(fs.existsSync(item.image), `Missing product image: ${item.image}`);
}
context.window.App.addToCart(product.id);
assert.equal(JSON.parse(memory.get('sst_cart_' + JSON.parse(memory.get('sst_session')).userId))[0].qty, 1);
context.window.App.goCheckout();
context.window.state.checkoutCoords = { lat: 10.5, lng: 123.9, manual: true };
context.window.App.placeOrder();
let orders = JSON.parse(memory.get('sst_orders'));
assert.equal(orders.length, 1);
assert.equal(orders[0].delivery.lat, 10.5);
assert.equal(orders[0].delivery.lng, 123.9);

context.window.App.logout();
inputs['login-phone'].value = '09171234567';
inputs['login-password'].value = 'admin123';
context.window.App.handleLogin({ preventDefault() {} });
assert.match(app.innerHTML, /Dashboard/);
context.window.App.confirmOrder(orders[0].id);
orders = JSON.parse(memory.get('sst_orders'));
assert.equal(orders[0].status, 'Confirmed');
assert.equal(JSON.parse(memory.get('sst_products')).find(p => p.id === product.id).stock, product.stock - 1);
console.log('Smoke check passed: startup, customer login/cart/checkout, admin login/order confirmation.');
