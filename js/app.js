/* ================= APP ACTIONS & CONTROLLER ================= */
var App = window.App = window.App || {};

      App.go = function (view) {
        destroyMap('checkout');
        destroyMap('customerTracking');
        destroyMap('adminDeliveries');
        state.view = view;
        state.cartOpen = false; state.notifOpen = false;
        if (view === 'customer-checkout') { state.addressEditing = false; }
        render(false);
      };
      App.viewOrder = function (id) {
        destroyMap('customerTracking');
        var user = currentUser();
        state.orderDetailId = id;
        state.view = user.role === 'admin' ? state.view : 'customer-order-detail';
        state.cartOpen = false; state.notifOpen = false;
        render(false);
      };
      App.setSearch = function (v) {
        state.search = v;
        var gridEl = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('customer-product-grid') : null;
        if (gridEl && state.view === 'customer-home') {
          var products = filteredProducts();
          var cart = getCart();
          var cartMap = {}; cart.forEach(function (c) { cartMap[c.productId] = c.qty; });
          if (products.length === 0) {
            gridEl.innerHTML = '<div class="empty-state"><div class="ic">\ud83d\udd0d</div><h3>No products found</h3><p>Try a different search term or category.</p>' +
              (state.search ? '<button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="App.clearSearch()">Clear search</button>' : '') +
              '</div>';
          } else {
            gridEl.innerHTML = products.map(function (p) {
              var st = stockStatus(p);
              var cat = categoryById(p.categoryId);
              var inCart = cartMap[p.productId || p.id] || cartMap[p.id] || 0;
              var disabled = (p.stock <= 0 || p.status === 'unavailable');
              var footer = renderProductCardFooter(p, inCart);
              return '' +
                '<div class="p-card' + (inCart > 0 ? ' in-cart' : '') + (disabled ? ' is-unavailable' : '') + '" id="pcard-' + p.id + '" data-product-id="' + p.id + '">' +
                  '<div class="p-img">' +
                    '<span class="p-badge ' + st.cls + '">' + st.label + '</span>' +
                    (inCart > 0 ? '<span class="p-incart-badge" id="pbadge-incart-' + p.id + '">' + inCart + ' in cart</span>' : '<span class="p-incart-badge" id="pbadge-incart-' + p.id + '" style="display:none;"></span>') +
                    productImgHtml(p) +
                  '</div>' +
                  '<div class="p-body">' +
                    '<div class="p-cat">' + esc(cat ? cat.name : '') + '</div>' +
                    '<div class="p-name">' + esc(p.name) + '</div>' +
                    '<div class="p-price-row">' +
                      '<span class="p-price">' + peso(p.price) + '</span>' +
                      (p.stock > 0 && p.stock <= 5 ? '<span class="p-low-stock">Few left</span>' : '') +
                    '</div>' +
                    '<div class="p-stockline">' + (p.stock > 0 ? p.stock + ' pcs available' : 'Currently unavailable') + '</div>' +
                    '<div class="p-foot" id="pfoot-' + p.id + '">' + footer + '</div>' +
                  '</div>' +
                '</div>';
            }).join('');
          }
          var titleEl = document.querySelector('.section-title');
          if (titleEl) {
            titleEl.innerHTML = (state.activeCategoryId ? esc(categoryById(state.activeCategoryId).name) : 'All products') + ' <span style="color:var(--ink-400);font-weight:600;font-size:14px;">(' + products.length + ')</span>';
          }
        } else {
          render(true);
        }
      };
      App.clearSearch = function () {
        state.search = '';
        var input = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('prod-search-input') : null;
        if (input) input.value = '';
        App.setSearch('');
      };
      App.setCategory = function (id) {
        state.activeCategoryId = id;
        render(true);
      };
      App.toggleCart = function (open) {
        state.cartOpen = open;
        state.notifOpen = false;
        render(true);
      };
      App.toggleNotif = function (open) {
        state.notifOpen = open;
        state.cartOpen = false;
        render(true);
      };
      App.readNotif = function (id) {
        var notifs = getNotifs();
        notifs.forEach(function (n) { if (n.id === id) n.read = true; });
        saveNotifs(notifs);
        render(true);
      };
      App.toggleSidebar = function (open) {
        state.sidebarOpen = open;
        render(true);
      };
      App.setAdminSection = function (sec) {
        destroyMap('adminDeliveries');
        state.adminSection = sec;
        state.sidebarOpen = false;
        state.orderFilter = 'All';
        render(false);
      };
      App.closeModal = function () {
        destroyMap('adminOrderModal');
        state.view = currentUser().role === 'admin' ? 'admin-' + state.adminSection : state.view;
        state.editingProductId = null;
        state.productFormCategory = null;
        state.productFormImage = undefined;
        render(true);
      };
      App.setOrderFilter = function (f) {
        state.orderFilter = f;
        render(true);
      };
      App.addInstructionTag = function (tag) {
        var el = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('chk-instructions') : null;
        if (el) {
          var cur = el.value.trim();
          if (cur.indexOf(tag) === -1) {
            el.value = cur ? (cur + ', ' + tag) : tag;
            state.checkoutInstructions = el.value;
          }
        }
      };

/* ---- Auth ---- */
      App.handleLogin = function (e) {
        e.preventDefault();
        var phone = document.getElementById('login-phone').value.trim();
        var password = document.getElementById('login-password').value;
        var user = getUsers().filter(function (u) { return u.phone === phone; })[0];
        if (!user || !verifyPassword(password, user.password)) {
          state.loginError = 'Incorrect phone number or password.';
          render();
          return false;
        }
        if (typeof hashPassword === 'function' && (!user.password || !user.password.startsWith('hash_'))) {
          user.password = hashPassword(password);
          saveUsers(getUsers());
        }
        state.loginError = '';
        setSession(user.id);
        state.view = user.role === 'admin' ? 'admin-dashboard' : 'customer-home';
        state.adminSection = 'dashboard';
        render(false);
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
          password: typeof hashPassword === 'function' ? hashPassword(vals.password) : vals.password,
          barangay: vals.barangay, houseStreet: vals.houseStreet,
          landmark: vals.landmark, createdAt: new Date().toISOString()
        };
        users.push(newUser);
        saveUsers(users);
        state.registerError = {};
        setSession(newUser.id);
        state.view = 'customer-home';
        render(false);
        toast('Account created. Welcome, ' + newUser.fullName.split(' ')[0] + '!');
        return false;
      };

      /* ---- Google Authentication ---- */
      App.handleGoogleSignIn = function () {
        if (typeof firebase !== 'undefined' && firebase.auth) {
          try {
            var auth = firebase.auth();
            var provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('profile');
            provider.addScope('email');
            provider.setCustomParameters({ prompt: 'select_account' });

            var isMobile = false;
            try {
              isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                         (window.innerWidth && window.innerWidth <= 768);
            } catch (e) { }

            toast('Connecting to Google...');

            if (isMobile) {
              auth.signInWithRedirect(provider).catch(function (err) {
                console.warn("[Google Auth] Mobile redirect error:", err);
                App.showGoogleAuthNoticeModal(err);
              });
              return;
            }

            auth.signInWithPopup(provider).then(function (result) {
              if (result && result.user) {
                App.processGoogleUser(result.user);
              }
            }).catch(function (error) {
              console.warn("[Google Auth] Desktop popup error:", error);
              if (error.code === 'auth/popup-blocked' || error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                toast('Opening Google Sign-In redirect...');
                try {
                  auth.signInWithRedirect(provider);
                  return;
                } catch (redErr) {
                  console.warn("[Google Auth] Fallback redirect error:", redErr);
                }
              }
              App.showGoogleAuthNoticeModal(error);
            });
            return;
          } catch (err) {
            console.warn("[Google Auth] Exception:", err);
            App.showGoogleAuthNoticeModal(err);
            return;
          }
        }

        App.showGoogleAuthNoticeModal({ code: 'auth/offline', message: 'Firebase Auth is initializing or offline.' });
      };

      App.processGoogleUser = function (gUser) {
        if (!gUser) return;
        var email = (gUser.email || '').toLowerCase().trim();
        var displayName = (gUser.displayName || '').trim();
        var photoURL = gUser.photoURL || '';
        var uidVal = gUser.uid || '';
        var phone = (gUser.phoneNumber || '').trim();

        var users = getUsers();
        var matchedUser = users.filter(function (u) {
          if (uidVal && u.googleUid === uidVal) return true;
          if (email && u.email && u.email.toLowerCase() === email) return true;
          if (phone && u.phone && u.phone === phone) return true;
          return false;
        })[0];

        if (matchedUser) {
          if (uidVal && !matchedUser.googleUid) matchedUser.googleUid = uidVal;
          if (photoURL && !matchedUser.photoURL) matchedUser.photoURL = photoURL;
          if (email && !matchedUser.email) matchedUser.email = email;
          if (displayName && (!matchedUser.fullName || matchedUser.fullName === 'Google User' || matchedUser.fullName === 'Google Customer')) {
            matchedUser.fullName = displayName;
          }
          saveUsers(users);
          setSession(matchedUser.id);
          state.view = matchedUser.role === 'admin' ? 'admin-dashboard' : 'customer-home';
          state.adminSection = 'dashboard';
          render(false);
          toast('Welcome back, ' + (matchedUser.fullName ? matchedUser.fullName.split(' ')[0] : 'there') + '!');
        } else {
          var newCustomer = {
            id: (typeof uid === 'function' ? uid('user') : 'user_' + Date.now().toString(36)),
            role: 'customer',
            fullName: displayName || (email ? email.split('@')[0] : 'Google Customer'),
            email: email,
            phone: phone || '',
            password: '',
            googleUid: uidVal,
            photoURL: photoURL,
            authProvider: 'google',
            barangay: state.detectedBarangay || 'Barangay San Isidro',
            houseStreet: state.detectedStreet || '123 Rizal Ave.',
            landmark: state.userPlaceName ? 'Near ' + state.userPlaceName : '',
            createdAt: new Date().toISOString()
          };
          users.push(newCustomer);
          saveUsers(users);
          setSession(newCustomer.id);
          state.view = 'customer-home';
          state.adminSection = 'dashboard';
          render(false);
          toast('Signed in with Google! Welcome, ' + (newCustomer.fullName ? newCustomer.fullName.split(' ')[0] : '') + '!');
        }
      };

      App.showGoogleAuthNoticeModal = function (err) {
        state.showGoogleNoticeModal = true;
        state.googleAuthError = err || null;
        render(true);
      };

      App.closeGoogleAuthModal = function () {
        state.showGoogleNoticeModal = false;
        state.googleAuthError = null;
        render(true);
      };

      App.demoGoogleLogin = function () {
        App.closeGoogleAuthModal();
        App.processGoogleUser({
          uid: 'google_demo_account',
          displayName: 'Kevin Zabala (Google)',
          email: 'kevin.demo@gmail.com',
          photoURL: '',
          phoneNumber: '09208889999'
        });
      };

      App.logout = function () {
        stopRiderDeviceGps();
        destroyMap('checkout');
        destroyMap('customerTracking');
        destroyMap('adminDeliveries');
        destroyMap('adminOrderModal');
        clearSession();
        if (typeof firebase !== 'undefined' && firebase.auth) {
          try { firebase.auth().signOut().catch(function () {}); } catch (e) {}
        }
        state.view = 'auth-login';
        state.adminSection = 'dashboard';
        render(false);
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
        render(true);
        return false;
      };

      /* ---- In-place Cart UI Sync (No reload, No scroll reset) ---- */
      App.syncCartUI = function (productId) {
        var cart = getCart();
        var cc = cartCount();
        var ct = cartTotal();

        // 1. Update bottom nav cart badge
        if (typeof document !== 'undefined' && document.querySelectorAll) {
          var navBtns = document.querySelectorAll('.bottom-nav button');
          for (var i = 0; i < navBtns.length; i++) {
            if (navBtns[i].textContent.indexOf('Cart') !== -1 || navBtns[i].innerHTML.indexOf(ICON.cart) !== -1) {
              var badge = navBtns[i].querySelector('.nav-badge');
              if (cc > 0) {
                if (badge) {
                  badge.textContent = cc;
                } else {
                  var sp = document.createElement('span');
                  sp.className = 'nav-badge';
                  sp.textContent = cc;
                  navBtns[i].appendChild(sp);
                }
              } else if (badge) {
                badge.remove();
              }
            }
          }
        }

        // 2. If on customer-home, update or toggle floating cart bar
        if (state.view === 'customer-home' && typeof document !== 'undefined' && document.querySelector) {
          var floatBar = document.getElementById('floating-cart-bar');
          var mobileFrame = document.querySelector('.mobile-frame');

          if (cc > 0 && !state.cartOpen) {
            if (floatBar) {
              var fcBadge = floatBar.querySelector('.fc-badge');
              var fcLabel = floatBar.querySelector('.fc-label');
              var fcPrice = floatBar.querySelector('.fc-price');
              if (fcBadge) fcBadge.textContent = cc;
              if (fcLabel) fcLabel.textContent = cc + (cc === 1 ? ' item' : ' items') + ' in cart';
              if (fcPrice) fcPrice.textContent = peso(ct);
            } else if (mobileFrame) {
              var bottomNav = document.querySelector('.bottom-nav');
              var div = document.createElement('div');
              div.innerHTML = renderFloatingCartBar();
              if (div.firstElementChild) {
                if (bottomNav) {
                  mobileFrame.insertBefore(div.firstElementChild, bottomNav);
                } else {
                  mobileFrame.appendChild(div.firstElementChild);
                }
              }
            }
            if (mobileFrame) mobileFrame.classList.add('has-floating-cart');
          } else {
            if (floatBar) floatBar.remove();
            if (mobileFrame) mobileFrame.classList.remove('has-floating-cart');
          }
        }

        // 3. Update the specific product card if in DOM
        if (productId && typeof document !== 'undefined' && document.getElementById) {
          var card = document.getElementById('pcard-' + productId);
          if (card) {
            var p = productById(productId);
            if (p) {
              var inCartItem = cart.filter(function (x) { return x.productId === productId; })[0];
              var inCart = inCartItem ? inCartItem.qty : 0;
              var foot = document.getElementById('pfoot-' + productId);
              if (foot) {
                foot.innerHTML = renderProductCardFooter(p, inCart);
              }
              var inCartBadge = document.getElementById('pbadge-incart-' + productId);
              if (inCartBadge) {
                if (inCart > 0) {
                  inCartBadge.textContent = inCart + ' in cart';
                  inCartBadge.style.display = '';
                  card.classList.add('in-cart');
                } else {
                  inCartBadge.textContent = '';
                  inCartBadge.style.display = 'none';
                  card.classList.remove('in-cart');
                }
              }
              card.classList.add('p-bump');
              setTimeout(function () { card.classList.remove('p-bump'); }, 300);
              return;
            }
          }
        }

        // 4. Fallback if product card is not in DOM (e.g., inside cart drawer)
        render(true);
      };

      /* ---- Cart Operations ---- */
      App.addToCart = function (productId) {
        var p = productById(productId);
        if (!p || p.stock <= 0 || p.status === 'unavailable') {
          toast('This product is not available.');
          return;
        }
        var cart = getCart();
        var existing = cart.filter(function (c) { return c.productId === productId; })[0];
        if (existing) {
          if (existing.qty < p.stock) {
            existing.qty++;
          } else {
            toast('Only ' + p.stock + ' pcs available.');
            return;
          }
        } else {
          cart.push({ productId: productId, qty: 1 });
        }
        saveCart(cart);
        toast(p.name + ' added to cart.');
        App.syncCartUI(productId);
      };

      App.cartInc = function (productId) {
        var p = productById(productId);
        var cart = getCart();
        var item = cart.filter(function (c) { return c.productId === productId; })[0];
        if (!item) {
          cart.push({ productId: productId, qty: 1 });
        } else if (item.qty < p.stock) {
          item.qty++;
        } else {
          toast('Only ' + p.stock + ' pcs available.');
          return;
        }
        saveCart(cart);
        App.syncCartUI(productId);
      };

      App.cartDec = function (productId) {
        var cart = getCart();
        var item = cart.filter(function (c) { return c.productId === productId; })[0];
        if (!item) return;
        item.qty--;
        if (item.qty <= 0) cart = cart.filter(function (c) { return c.productId !== productId; });
        saveCart(cart);
        App.syncCartUI(productId);
      };

      App.cartRemove = function (productId) {
        var cart = getCart().filter(function (c) { return c.productId !== productId; });
        saveCart(cart);
        App.syncCartUI(productId);
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
            render(true);
            return;
          }
        }
        state.cartOpen = false;
        var user = currentUser();
        state.addressEditing = (!user || !user.barangay || !user.houseStreet || !user.phone);
        state.checkoutInstructions = '';
        if (!state.checkoutCoords) {
          if (state.userCoords && Number.isFinite(state.userCoords.lat) && Number.isFinite(state.userCoords.lng)) {
            state.checkoutCoords = state.userCoords;
            state.checkoutGpsStatus = 'locked';
          } else if (user && Number.isFinite(user.lat) && Number.isFinite(user.lng)) {
            state.checkoutCoords = {
              lat: user.lat,
              lng: user.lng,
              accuracy: null,
              manual: false,
              timestamp: new Date().toISOString()
            };
            state.checkoutGpsStatus = 'locked';
          }
        }
        App.go('customer-checkout');
      };
      App.editCheckoutAddress = function () { state.addressEditing = true; render(true); };
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
        render(true);
      };

      /* ---- Place order ---- */
      App.placeOrder = function () {
        var user = currentUser();
        var cart = getCart();
        if (cart.length === 0) { toast('Your cart is empty.'); return; }
        if (!user.barangay || !user.houseStreet || !user.phone) {
          toast('Please complete your delivery address before checking out.');
          state.addressEditing = true; render(true); return;
        }
        if (!state.checkoutCoords || !Number.isFinite(state.checkoutCoords.lat) || !Number.isFinite(state.checkoutCoords.lng)) {
          if (state.userCoords && Number.isFinite(state.userCoords.lat) && Number.isFinite(state.userCoords.lng)) {
            state.checkoutCoords = state.userCoords;
            state.checkoutGpsStatus = 'locked';
          } else if (user && Number.isFinite(user.lat) && Number.isFinite(user.lng)) {
            state.checkoutCoords = {
              lat: user.lat,
              lng: user.lng,
              accuracy: null,
              manual: false,
              timestamp: new Date().toISOString()
            };
            state.checkoutGpsStatus = 'locked';
          }
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
            render(true);
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
        render(true);
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
        destroyMap('adminOrderModal');
        state.orderDetailId = orderId;
        state.view = 'admin-order-modal';
        render(true);
      };
      App.togglePhoneGpsStreaming = function (orderId) {
        if (typeof activeStreamingOrderId !== 'undefined' && activeStreamingOrderId === orderId) {
          stopRiderDeviceGps();
          activeStreamingOrderId = null;
          toast('Stopped courier GPS streaming.');
        } else {
          var started = startRiderDeviceGps(orderId);
          if (started) {
            activeStreamingOrderId = orderId;
            toast('Streaming phone GPS to customer in real-time!');
          }
        }
        render(true);
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
        if (state.view === 'admin-order-modal') App.closeModal(); else render(true);
      };

      /* ---- Admin: products ---- */
      App.openProductModal = function (productId) {
        state.editingProductId = productId;
        state.productFormCategory = null;
        state.productFormImage = undefined;
        state.view = 'admin-product-modal';
        render(true);
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
        render(true);
      };
      App.adjustStock = function (productId, delta) {
        var products = getProducts();
        var p = products.filter(function (x) { return x.id === productId; })[0];
        if (!p) return;
        p.stock = Math.max(0, p.stock + delta);
        saveProducts(products);
        render(true);
      };

      App.reorderOrder = function (orderId) {
        var o = getOrders().filter(function (x) { return x.id === orderId; })[0];
        if (!o || !o.items || !o.items.length) {
          toast('Order details not found.');
          return;
        }
        var prods = getProducts();
        var addedCount = 0;
        o.items.forEach(function (it) {
          var p = prods.filter(function (x) { return x.id === it.productId; })[0];
          if (p && p.stock > 0) {
            var qtyToAdd = Math.min(it.qty, p.stock);
            App.addToCart(p.id, qtyToAdd);
            addedCount++;
          }
        });
        if (addedCount > 0) {
          toast('Re-ordered ' + addedCount + ' item(s) into your cart!');
          App.go('customer-cart');
        } else {
          toast('Selected items are currently out of stock.');
        }
      };

      App.printReceipt = function (orderId) {
        var o = getOrders().filter(function (x) { return x.id === orderId; })[0];
        if (!o) {
          toast('Order not found.');
          return;
        }
        var printWin = window.open('', '_blank', 'width=650,height=750');
        if (!printWin) {
          toast('Please allow popups to generate receipt.');
          return;
        }
        var itemsHtml = (o.items || []).map(function (it) {
          return '<tr>' +
            '<td style="padding:8px;border-bottom:1px solid #eee;font-weight:600;">' + esc(it.name) + '</td>' +
            '<td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">' + it.qty + '</td>' +
            '<td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">' + peso(it.price * it.qty) + '</td>' +
            '</tr>';
        }).join('');

        var docHtml = '<!DOCTYPE html><html><head><title>Receipt - ' + esc(o.orderNumber) + '</title>' +
          '<meta charset="UTF-8">' +
          '<style>' +
          'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;margin:24px;color:#1e293b;max-width:550px;margin:auto;}' +
          '.hdr{text-align:center;border-bottom:2px dashed #cbd5e1;padding-bottom:16px;margin-bottom:20px;}' +
          '.hdr h2{margin:0;font-size:22px;color:#0f172a;}' +
          '.hdr p{margin:4px 0;font-size:13px;color:#64748b;}' +
          '.info-box{background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;margin-bottom:20px;font-size:13px;line-height:1.6;}' +
          'table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13.5px;}' +
          'th{text-align:left;border-bottom:2px solid #0f172a;padding:8px;font-size:12px;text-transform:uppercase;color:#475569;}' +
          '.tot{font-size:18px;font-weight:800;text-align:right;margin-top:16px;padding-top:12px;border-top:2px solid #0f172a;}' +
          '@media print{.noprint{display:none;}}' +
          '</style>' +
          '</head><body>' +
          '<div class="hdr">' +
          '<h2>NelGlenn\'s Sari-Sari Store</h2>' +
          '<p>Official Digital Order Receipt</p>' +
          '<p>Order No: <strong>' + esc(o.orderNumber) + '</strong> &middot; ' + fmtDateTime(o.createdAt) + '</p>' +
          '</div>' +
          '<div class="info-box">' +
          '<div><strong>Customer Name:</strong> ' + esc(o.delivery.fullName) + '</div>' +
          '<div><strong>Phone Number:</strong> ' + esc(o.delivery.phone) + '</div>' +
          '<div><strong>Delivery Address:</strong> ' + esc((o.delivery.houseStreet || '') + ', ' + (o.delivery.barangay || '')) + '</div>' +
          '<div><strong>Status:</strong> ' + esc(o.status) + ' &middot; <strong>Payment Method:</strong> Cash on Delivery</div>' +
          '</div>' +
          '<table><thead><tr><th>Item Name</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Total</th></tr></thead><tbody>' + itemsHtml + '</tbody></table>' +
          '<div class="tot">Grand Total: ' + peso(o.total) + '</div>' +
          '<div style="text-align:center;margin-top:28px;font-size:12px;color:#94a3b8;">Thank you for ordering at NelGlenn\'s Sari-Sari Store!</div>' +
          '<div class="noprint" style="text-align:center;margin-top:24px;">' +
          '<button onclick="window.print()" style="padding:10px 24px;font-size:14px;font-weight:700;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;">🖨️ Print Receipt</button>' +
          '</div>' +
          '</body></html>';

        printWin.document.write(docHtml);
        printWin.document.close();
      };

      App.restockAllLowItems = function () {
        var products = getProducts();
        var count = 0;
        products.forEach(function (p) {
          if (p.stock <= LOW_STOCK_THRESHOLD) {
            p.stock += 20;
            count++;
          }
        });
        if (count > 0) {
          saveProducts(products);
          toast('Restocked ' + count + ' low-stock item(s) by +20!');
          render(true);
        } else {
          toast('All items have sufficient stock.');
        }
      };

window.App = App;

/* ================= RENDER ROOT WITH SCROLL PRESERVATION ================= */
      var _lastView = null;
      var _lastAdminSection = null;

      function render(preserveScroll) {
        var app = document.getElementById('app');
        if (!app) return;

        var currentView = state.view;
        var currentAdminSec = state.adminSection;

        var shouldPreserve = (typeof preserveScroll === 'boolean')
          ? preserveScroll
          : (_lastView !== null && _lastView === currentView && _lastAdminSection === currentAdminSec);

        var scrollY = 0;
        var scrollX = 0;
        var catScrollLeft = 0;
        var drawerScrollTop = 0;

        if (shouldPreserve && typeof window !== 'undefined') {
          scrollY = window.pageYOffset || (document.documentElement ? document.documentElement.scrollTop : 0) || (document.body ? document.body.scrollTop : 0) || 0;
          scrollX = window.pageXOffset || (document.documentElement ? document.documentElement.scrollLeft : 0) || (document.body ? document.body.scrollLeft : 0) || 0;
          if (typeof document !== 'undefined' && document.querySelector) {
            var catEl = document.querySelector('.cat-scroll');
            if (catEl) catScrollLeft = catEl.scrollLeft;
            var drEl = document.querySelector('.drawer-body');
            if (drEl) drawerScrollTop = drEl.scrollTop;
          }
        }

        _lastView = currentView;
        _lastAdminSection = currentAdminSec;

        var rootEl = (typeof document !== 'undefined') ? document.documentElement : null;
        var origBehavior = (rootEl && rootEl.style) ? rootEl.style.scrollBehavior : '';
        if (rootEl && rootEl.style) rootEl.style.scrollBehavior = 'auto';

        var user = currentUser();
        if (!user) {
          if (state.view !== 'auth-login' && state.view !== 'auth-register') state.view = 'auth-login';
          app.innerHTML = state.view === 'auth-register' ? renderRegister() : renderLogin();
        } else if (user.role === 'admin') {
          app.innerHTML = renderAdminShell(user);
        } else {
          app.innerHTML = renderCustomerShell(user);
        }

        if (shouldPreserve && typeof window !== 'undefined' && (scrollY > 0 || scrollX > 0 || catScrollLeft > 0 || drawerScrollTop > 0)) {
          if (typeof window.scrollTo === 'function') {
            window.scrollTo(scrollX, scrollY);
          }
          if (catScrollLeft > 0 && typeof document !== 'undefined' && document.querySelector) {
            var newCat = document.querySelector('.cat-scroll');
            if (newCat) newCat.scrollLeft = catScrollLeft;
          }
          if (drawerScrollTop > 0 && typeof document !== 'undefined' && document.querySelector) {
            var newDr = document.querySelector('.drawer-body');
            if (newDr) newDr.scrollTop = drawerScrollTop;
          }
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () {
              if (typeof window.scrollTo === 'function') {
                window.scrollTo(scrollX, scrollY);
              }
              if (rootEl && rootEl.style) rootEl.style.scrollBehavior = origBehavior;
            });
          } else if (rootEl && rootEl.style) {
            rootEl.style.scrollBehavior = origBehavior;
          }
        } else {
          if (!shouldPreserve && typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
            window.scrollTo(0, 0);
          }
          if (rootEl && rootEl.style) rootEl.style.scrollBehavior = origBehavior;
        }

        scheduleMapInitialization();
      }

      App.render = window.render = render;

/* ================= INIT BOOTLOADER ================= */
      seedIfNeeded();
      ensureDemoCustomersExist();
      updateProductImagesIfNeeded();
      if (getSession() && !currentUser()) clearSession();
      render(false);
      initCloudRealtimeListeners();

      if (typeof firebase !== 'undefined' && firebase.auth) {
        try {
          var auth = firebase.auth();
          auth.getRedirectResult().then(function (result) {
            if (result && result.user) {
              App.processGoogleUser(result.user);
            }
          }).catch(function (err) {
            console.warn("[Google Auth] Redirect result check:", err);
            if (err && err.code && err.code !== 'auth/null-user') {
              App.showGoogleAuthNoticeModal(err);
            }
          });

          auth.onAuthStateChanged(function (gUser) {
            if (gUser && (!currentUser() || currentUser().authProvider === 'google')) {
              App.processGoogleUser(gUser);
            }
          });
        } catch (e) { }
      }
