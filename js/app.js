/* ================= APP ACTIONS & CONTROLLER ================= */
var App = window.App || {};

/* ================= APP ACTIONS (exposed as window.App) ================= */
      var App = {};

      App.go = function (view) {
        destroyMap('checkout');
        destroyMap('customerTracking');
        destroyMap('adminDeliveries');
        state.view = view;
        state.cartOpen = false; state.notifOpen = false;
        if (view === 'customer-checkout') { state.addressEditing = false; }
        render();
      };
      App.viewOrder = function (id) {
        destroyMap('customerTracking');
        var user = currentUser();
        state.orderDetailId = id;
        state.view = user.role === 'admin' ? state.view : 'customer-order-detail';
        state.cartOpen = false; state.notifOpen = false;
        render();
      };
      App.setSearch = function (v) { state.search = v; renderInPlace(); };
      App.setCategory = function (id) { state.activeCategoryId = id; render(); };
      App.toggleCart = function (open) { state.cartOpen = open; state.notifOpen = false; render(); };
      App.toggleNotif = function (open) {
        state.notifOpen = open; state.cartOpen = false; render();
      };
      App.readNotif = function (id) {
        var notifs = getNotifs();
        notifs.forEach(function (n) { if (n.id === id) n.read = true; });
        saveNotifs(notifs);
        render();
      };
      App.toggleSidebar = function (open) { state.sidebarOpen = open; render(); };
      App.setAdminSection = function (sec) {
        destroyMap('adminDeliveries');
        state.adminSection = sec; state.sidebarOpen = false; state.orderFilter = 'All'; render();
      };
      App.closeModal = function () { state.view = currentUser().role === 'admin' ? 'admin-' + state.adminSection : state.view; state.editingProductId = null; state.productFormCategory = null; state.productFormImage = undefined; render(); };
      App.setOrderFilter = function (f) { state.orderFilter = f; render(); };

/* ---- Auth ---- */
      App.handleLogin = function (e) {
        e.preventDefault();
        var phone = document.getElementById('login-phone').value.trim();
        var password = document.getElementById('login-password').value;
        var user = getUsers().filter(function (u) { return u.phone === phone; })[0];
        if (!user || user.password !== password) {
          state.loginError = 'Incorrect phone number or password.';
          render();
          return false;
        }
        state.loginError = '';
        setSession(user.id);
        state.view = user.role === 'admin' ? 'admin-dashboard' : 'customer-home';
        state.adminSection = 'dashboard';
        render();
        toast('Welcome back, ' + user.fullName.split(' ')[0] + '!');
        return false;
      };
      App.handleRegister = function (e) {
        e.preventDefault();
        var vals = {
          fullName: document.getElementById('reg-fullname').value.trim(),
          phone: document.getElementById('reg-phone').value.trim(),
          barangay: document.getElementById('reg-barangay').value.trim(),
          houseStreet: document.getElementById('reg-housestreet').value.trim(),
          landmark: document.getElementById('reg-landmark').value.trim(),
          password: document.getElementById('reg-password').value,
          confirm: document.getElementById('reg-confirm').value
        };
        var err = {};
        if (!vals.fullName) err.fullName = 'Full name is required.';
        if (!vals.phone || !/^[0-9+ ]{7,15}$/.test(vals.phone)) err.phone = 'Enter a valid phone number.';
        else if (getUsers().some(function (u) { return u.phone === vals.phone; })) err.phone = 'This phone number is already registered.';
        if (!vals.barangay) err.barangay = 'Barangay is required.';
        if (!vals.houseStreet) err.houseStreet = 'House number / street is required.';
        if (!vals.password || vals.password.length < 6) err.password = 'Password must be at least 6 characters.';
        if (vals.confirm !== vals.password) err.confirm = 'Passwords do not match.';
        if (Object.keys(err).length) {
          state.registerError = err;
          render();
          return false;
        }
        var users = getUsers();
        var newUser = {
          id: uid('user'), role: 'customer', fullName: vals.fullName, phone: vals.phone,
          password: vals.password, barangay: vals.barangay, houseStreet: vals.houseStreet,
          landmark: vals.landmark, createdAt: new Date().toISOString()
        };
        users.push(newUser);
        saveUsers(users);
        state.registerError = {};
        setSession(newUser.id);
        state.view = 'customer-home';
        render();
        toast('Account created. Welcome, ' + newUser.fullName.split(' ')[0] + '!');
        return false;
      };
      App.logout = function () {
        stopRiderDeviceGps();
        destroyMap('checkout');
        destroyMap('customerTracking');
        destroyMap('adminDeliveries');
        clearSession();
        state.view = 'auth-login';
        state.adminSection = 'dashboard';
        render();
      };

      /* ---- Profile ---- */
      App.saveProfile = function (e) {
        e.preventDefault();
        var user = currentUser();
        var users = getUsers();
        var u = users.filter(function (x) { return x.id === user.id; })[0];
        u.fullName = document.getElementById('pf-fullname').value.trim();
        u.phone = document.getElementById('pf-phone').value.trim();
        u.barangay = document.getElementById('pf-barangay').value.trim();
        u.houseStreet = document.getElementById('pf-housestreet').value.trim();
        u.landmark = document.getElementById('pf-landmark').value.trim();
        var newPw = document.getElementById('pf-password').value;
        if (newPw) u.password = newPw;
        saveUsers(users);
        toast('Profile updated.');
        render();
        return false;
      };

      /* ---- Cart ---- */
      App.addToCart = function (productId) {
        var p = productById(productId);
        if (!p || p.stock <= 0 || p.status === 'unavailable') { toast('This product is not available.'); return; }
        var cart = getCart();
        var existing = cart.filter(function (c) { return c.productId === productId; })[0];
        if (existing) {
          if (existing.qty < p.stock) existing.qty++;
        } else {
          cart.push({ productId: productId, qty: 1 });
        }
        saveCart(cart);
        toast(p.name + ' added to cart.');
        render();
      };
      App.cartInc = function (productId) {
        var p = productById(productId);
        var cart = getCart();
        var item = cart.filter(function (c) { return c.productId === productId; })[0];
        if (!item) { cart.push({ productId: productId, qty: 1 }); }
        else if (item.qty < p.stock) { item.qty++; }
        else { toast('Only ' + p.stock + ' pcs available.'); }
        saveCart(cart);
        render();
      };
      App.cartDec = function (productId) {
        var cart = getCart();
        var item = cart.filter(function (c) { return c.productId === productId; })[0];
        if (!item) return;
        item.qty--;
        if (item.qty <= 0) cart = cart.filter(function (c) { return c.productId !== productId; });
        saveCart(cart);
        render();
      };
      App.cartRemove = function (productId) {
        var cart = getCart().filter(function (c) { return c.productId !== productId; });
        saveCart(cart);
        render();
      };
      App.goCheckout = function () {
        var cart = getCart();
        if (cart.length === 0) { toast('Your cart is empty.'); return; }
        for (var i = 0; i < cart.length; i++) {
          var p = productById(cart[i].productId);
          if (!p || p.stock <= 0 || p.status === 'unavailable' || cart[i].qty > p.stock) {
            toast('Some items in your cart are no longer available in that quantity.');
            var fixed = cart.filter(function (c) {
              var pr = productById(c.productId);
              return pr && pr.status !== 'unavailable' && pr.stock > 0;
            }).map(function (c) {
              var pr = productById(c.productId);
              return { productId: c.productId, qty: Math.min(c.qty, pr.stock) };
            });
            saveCart(fixed);
            render();
            return;
          }
        }
        state.cartOpen = false;
        state.addressEditing = false;
        state.checkoutInstructions = '';
        App.go('customer-checkout');
      };
      App.editCheckoutAddress = function () { state.addressEditing = true; render(); };
      App.saveCheckoutAddress = function () {
        var user = currentUser();
        var users = getUsers();
        var u = users.filter(function (x) { return x.id === user.id; })[0];
        u.barangay = document.getElementById('chk-barangay').value.trim();
        u.houseStreet = document.getElementById('chk-housestreet').value.trim();
        u.landmark = document.getElementById('chk-landmark').value.trim();
        u.phone = document.getElementById('chk-phone').value.trim();
        saveUsers(users);
        state.addressEditing = false;
        toast('Address updated.');
        render();
      };

      /* ---- Place order ---- */
      App.placeOrder = function () {
        var user = currentUser();
        var cart = getCart();
        if (cart.length === 0) { toast('Your cart is empty.'); return; }
        if (!user.barangay || !user.houseStreet || !user.phone) {
          toast('Please complete your delivery address before checking out.');
          state.addressEditing = true; render(); return;
        }
        if (!state.checkoutCoords || !Number.isFinite(state.checkoutCoords.lat) || !Number.isFinite(state.checkoutCoords.lng)) {
          toast('Set your real drop-off location using GPS or by tapping the map before placing the order.');
          return;
        }
        var instructionsEl = document.getElementById('chk-instructions');
        var instructions = instructionsEl ? instructionsEl.value.trim() : '';

        var products = getProducts();
        var items = [];
        var total = 0;
        for (var i = 0; i < cart.length; i++) {
          var p = products.filter(function (x) { return x.id === cart[i].productId; })[0];
          if (!p || p.status === 'unavailable' || p.stock <= 0 || cart[i].qty > p.stock) {
            toast('One or more items are no longer available in the requested quantity. Please review your cart.');
            render();
            return;
          }
          items.push({ productId: p.id, name: p.name, price: p.price, qty: cart[i].qty });
          total += p.price * cart[i].qty;
        }
        var now = new Date().toISOString();
        var coords = state.checkoutCoords;
        var order = {
          id: uid('order'),
          orderNumber: nextOrderNumber(),
          customerId: user.id,
          items: items,
          total: total,
          delivery: {
            fullName: user.fullName,
            phone: user.phone,
            barangay: user.barangay,
            houseStreet: user.houseStreet,
            landmark: user.landmark,
            lat: coords.lat,
            lng: coords.lng,
            gpsAccuracy: coords.accuracy || null,
            gpsTime: coords.timestamp || now
          },
          instructions: instructions,
          paymentMethod: 'COD',
          status: 'Pending',
          stockDeducted: false,
          statusHistory: [{ status: 'Pending', timestamp: now }],
          createdAt: now
        };
        var orders = getOrders();
        orders.push(order);
        saveOrders(orders);
        saveCart([]);
        state.checkoutCoords = null;
        state.checkoutGpsStatus = 'idle';
        var admin = getUsers().filter(function (u) { return u.role === 'admin'; })[0];
        if (admin) addNotif(admin.id, 'New order ' + order.orderNumber + ' from ' + user.fullName + ' \u2014 ' + peso(total) + '.', 'newOrder', order.id);
        state.checkoutInstructions = '';
        state.orderDetailId = order.id;
        App.go('customer-order-detail');
        toast('Order placed! We will confirm it shortly.');
      };

      /* ---- Cancel (customer) ---- */
      App.cancelOrder = function (orderId) {
        if (!confirm('Cancel this order? This cannot be undone.')) return;
        var orders = getOrders();
        var o = orders.filter(function (x) { return x.id === orderId; })[0];
        if (!o) return;
        if (o.status !== 'Pending' && o.status !== 'Confirmed') {
          toast('This order can no longer be cancelled.');
          return;
        }
        if (o.stockDeducted) {
          restockOrder(o);
        }
        o.status = 'Cancelled';
        o.statusHistory.push({ status: 'Cancelled', timestamp: new Date().toISOString() });
        saveOrders(orders);
        addNotif(o.customerId, 'Your order ' + o.orderNumber + ' was cancelled.', 'cancel', o.id);
        toast('Order cancelled.');
        render();
      };

      function restockOrder(order) {
        var products = getProducts();
        order.items.forEach(function (it) {
          var p = products.filter(function (x) { return x.id === it.productId; })[0];
          if (p) p.stock += it.qty;
        });
        saveProducts(products);
      }

      /* ---- Admin order actions ---- */
      App.openOrderModal = function (orderId) {
        state.orderDetailId = orderId;
        state.view = 'admin-order-modal';
        render();
      };
      App.confirmOrder = function (orderId) {
        var orders = getOrders();
        var o = orders.filter(function (x) { return x.id === orderId; })[0];
        if (!o || o.status !== 'Pending') return;
        var products = getProducts();
        for (var i = 0; i < o.items.length; i++) {
          var p = products.filter(function (x) { return x.id === o.items[i].productId; })[0];
          if (!p || p.stock < o.items[i].qty) {
            toast('Cannot confirm: insufficient stock for ' + (p ? p.name : 'a product') + '. Please adjust inventory first.');
            return;
          }
        }
        o.items.forEach(function (it) {
          var p = products.filter(function (x) { return x.id === it.productId; })[0];
          p.stock -= it.qty;
        });
        saveProducts(products);
        o.status = 'Confirmed';
        o.stockDeducted = true;
        o.statusHistory.push({ status: 'Confirmed', timestamp: new Date().toISOString() });
        saveOrders(orders);
        addNotif(o.customerId, 'Good news! Your order ' + o.orderNumber + ' has been confirmed.', 'status', o.id);
        toast('Order confirmed.');
        App.closeModal();
      };
      App.rejectOrder = function (orderId) {
        if (!confirm('Reject/cancel this order?')) return;
        var orders = getOrders();
        var o = orders.filter(function (x) { return x.id === orderId; })[0];
        if (!o) return;
        if (o.stockDeducted) restockOrder(o);
        o.status = 'Cancelled';
        o.statusHistory.push({ status: 'Cancelled', timestamp: new Date().toISOString() });
        saveOrders(orders);
        addNotif(o.customerId, 'Sorry, your order ' + o.orderNumber + ' was rejected/cancelled by the store.', 'cancel', o.id);
        toast('Order rejected.');
        App.closeModal();
      };
      App.advanceStatus = function (orderId, newStatus) {
        var orders = getOrders();
        var o = orders.filter(function (x) { return x.id === orderId; })[0];
        if (!o) return;
        o.status = newStatus;
        if (newStatus === 'Delivered' && activeRiderWatchingOrderId === orderId) stopRiderDeviceGps();
        o.statusHistory.push({ status: newStatus, timestamp: new Date().toISOString() });
        saveOrders(orders);
        var msgs = {
          'Preparing': 'Your order ' + o.orderNumber + ' is now being prepared.',
          'Out for Delivery': 'Your order ' + o.orderNumber + ' is out for delivery!',
          'Delivered': 'Your order ' + o.orderNumber + ' has been delivered. Enjoy!'
        };
        if (msgs[newStatus]) addNotif(o.customerId, msgs[newStatus], 'status', o.id);
        toast('Order marked as ' + newStatus + '.');
        if (state.view === 'admin-order-modal') App.closeModal(); else render();
      };

      /* ---- Admin: products ---- */
      App.openProductModal = function (productId) {
        state.editingProductId = productId;
        state.productFormCategory = null;
        state.productFormImage = undefined;
        state.view = 'admin-product-modal';
        render();
      };
      App.handleProductImage = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          var img = new Image();
          img.onload = function () {
            var maxW = 300;
            var scale = Math.min(1, maxW / img.width);
            var canvas = document.createElement('canvas');
            canvas.width = img.width * scale; canvas.height = img.height * scale;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            var dataUrl;
            try { dataUrl = canvas.toDataURL('image/jpeg', 0.8); }
            catch (err) { dataUrl = ev.target.result; }
            state.productFormImage = dataUrl;
            var prev = document.getElementById('prod-img-prev');
            if (prev) prev.innerHTML = '<img src="' + dataUrl + '">';
          };
          img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
      };
      App.saveProduct = function (e) {
        e.preventDefault();
        var name = document.getElementById('pd-name').value.trim();
        var categoryId = document.getElementById('pd-category').value;
        var description = document.getElementById('pd-desc').value.trim();
        var price = parseFloat(document.getElementById('pd-price').value);
        var stock = parseInt(document.getElementById('pd-stock').value, 10);
        var status = document.getElementById('pd-status').value;
        if (!name || isNaN(price) || price < 0 || isNaN(stock) || stock < 0) {
          toast('Please fill in valid product details.');
          return false;
        }
        var products = getProducts();
        var cat = categoryById(categoryId);
        if (state.editingProductId) {
          var p = products.filter(function (x) { return x.id === state.editingProductId; })[0];
          p.name = name; p.categoryId = categoryId; p.description = description; p.price = price; p.stock = stock; p.status = status;
          if (state.productFormImage !== undefined) p.image = state.productFormImage;
          if (!p.emoji && cat) p.emoji = cat.emoji;
          toast('Product updated.');
        } else {
          products.push({
            id: uid('prod'), name: name, categoryId: categoryId, description: description,
            price: price, stock: stock, status: status, image: state.productFormImage || null,
            emoji: cat ? cat.emoji : ICON.box, createdAt: new Date().toISOString()
          });
          toast('Product added.');
        }
        saveProducts(products);
        App.closeModal();
        return false;
      };
      App.deleteProduct = function (productId) {
        if (!confirm('Remove this product from the store? Customers will no longer see it.')) return;
        var products = getProducts().filter(function (p) { return p.id !== productId; });
        saveProducts(products);
        toast('Product removed.');
        render();
      };
      App.adjustStock = function (productId, delta) {
        var products = getProducts();
        var p = products.filter(function (x) { return x.id === productId; })[0];
        if (!p) return;
        p.stock = Math.max(0, p.stock + delta);
        saveProducts(products);
        render();
      };

window.App = App;

/* ================= RENDER ROOT ================= */
/* ================= RENDER ROOT ================= */
      function render() {
        var app = document.getElementById('app');
        var user = currentUser();
        if (!user) {
          if (state.view !== 'auth-login' && state.view !== 'auth-register') state.view = 'auth-login';
          app.innerHTML = state.view === 'auth-register' ? renderRegister() : renderLogin();
        } else if (user.role === 'admin') {
          app.innerHTML = renderAdminShell(user);
        } else {
          app.innerHTML = renderCustomerShell(user);
        }
        window.scrollTo(0, 0);
        scheduleMapInitialization();
      }

/* ================= INIT BOOTLOADER ================= */
/* ================= INIT ================= */
      seedIfNeeded();
      ensureDemoCustomersExist();
      updateProductImagesIfNeeded();
      if (getSession() && !currentUser()) clearSession();
      render();
      initCloudRealtimeListeners();

