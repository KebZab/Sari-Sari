/* ================= FIREBASE CLOUD & STORAGE INSTANCES ================= */
var fbApp = null;
      var firestoreDb = null;
      var fbRtdb = null;
      var fbAuth = null;
      var isCloudOnline = false;

      try {
        if (typeof firebase !== 'undefined') {
          fbApp = firebase.initializeApp(firebaseConfig);
          firestoreDb = firebase.firestore();
          try {
            if (firebase.database) {
              fbRtdb = firebase.database();
              console.log("[Firebase] Realtime Database initialized");
            }
          } catch (rtdbErr) {
            console.warn("[Firebase] Realtime Database deferred:", rtdbErr.message);
          }
          try {
            if (firebase.auth) {
              fbAuth = firebase.auth();
              console.log("[Firebase] Auth initialized");
            }
          } catch (authErr) {
            console.warn("[Firebase] Auth deferred:", authErr.message);
          }
          isCloudOnline = true;
          console.log("[Firebase] Cloud connected: sarisaristore-ffa71");
        }
      } catch (e) {
        console.warn("[Firebase] Offline or deferred initialization:", e);
      }

/* ================= STORAGE HELPERS ================= */
      function dbGet(key, fallback) {
        try {
          var raw = localStorage.getItem(key);
          if (raw === null || raw === undefined) return fallback;
          return JSON.parse(raw);
        } catch (e) { return fallback; }
      }
      function dbSet(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); return true; }
        catch (e) { toast('Storage error: could not save. Your browser storage may be full.'); return false; }
      }
      function uid(prefix) {
        return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      }
      function esc(str) {
        if (str === undefined || str === null) return '';
        return String(str).replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }
      function peso(n) {
        n = Number(n) || 0;
        return '\u20b1' + n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      function fmtDateTime(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ', ' +
          d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
      }
      function fmtDateShort(iso) {
        var d = new Date(iso);
        return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
      }
      function isSameDay(iso, ref) {
        var a = new Date(iso), b = ref || new Date();
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
      }
      function toast(msg) {
        var wrap = document.getElementById('toast-wrap');
        var el = document.createElement('div');
        el.className = 'toast'; el.textContent = msg;
        wrap.appendChild(el);
        setTimeout(function () { el.style.transition = 'opacity .3s ease, transform .3s ease'; el.style.opacity = '0'; el.style.transform = 'translateY(-8px)'; setTimeout(function () { el.remove(); }, 320); }, 2600);
      }

/* ================= STORE LOCATION & GPS UTILS ================= */
function getStoreLocation() {
        var saved = dbGet('sst_store_location', null);
        if (saved && saved.isActualGps && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
          return saved;
        }
        return DEFAULT_STORE_LOCATION;
      }

      var STORE_LOCATION = getStoreLocation();

      function updateStoreLocationObject(newLoc) {
        if (!newLoc) return;
        STORE_LOCATION.lat = newLoc.lat;
        STORE_LOCATION.lng = newLoc.lng;
        STORE_LOCATION.name = newLoc.name || STORE_LOCATION.name;
        STORE_LOCATION.address = newLoc.address || STORE_LOCATION.address;
        STORE_LOCATION.isActualGps = !!newLoc.isActualGps;
        STORE_LOCATION.accuracy = newLoc.accuracy || null;
      }

      function setStoreLocation(coords, name, address) {
        var cur = getStoreLocation();
        var updated = {
          lat: coords.lat,
          lng: coords.lng,
          accuracy: coords.accuracy || null,
          name: name || cur.name || "NelGlenn's Store",
          address: address || coords.address || "Actual Store Coordinates",
          isActualGps: true,
          updatedAt: new Date().toISOString()
        };
        dbSet('sst_store_location', updated);
        updateStoreLocationObject(updated);
        if (firestoreDb) {
          try { firestoreDb.collection('settings').doc('store_location').set(updated, { merge: true }).catch(function () { }); } catch (e) { }
        }
        if (fbRtdb) {
          try { fbRtdb.ref('settings/store_location').set(updated).catch(function () { }); } catch (e) { }
        }
        return updated;
      }

/* ================= SEED DATA ================= */
      var PRODUCT_IMAGE_MAP = {
        'Piattos Cheese 40g': 'images/piattos.jpg',
        'Nova Multigrain Chips': 'images/nova.jpg',
        'Chippy BBQ 110g': 'images/chippy.png',
        'SkyFlakes Crackers': 'images/skyflakes.png',
        'Fita Biscuit Pack': 'images/fita.jpg',
        'Rebisco Crackers Sandwich': 'images/rebisco.jpg',
        'Lucky Me Pancit Canton': 'images/pancit_canton.jpg',
        'Payless Instant Mami': 'images/payless.jpg',
        '555 Sardines Tomato Sauce': 'images/sardines.png',
        'Argentina Corned Beef': 'images/corned_beef.jpg',
        'Century Tuna Flakes': 'images/tuna.jpg',
        'Sinandomeng Rice 1kg': 'images/sinandomeng.png',
        'Dinorado Rice 1kg': 'images/dinorado.jpg',
        'Kopiko Black 3-in-1': 'images/kopiko.jpg',
        'Nescafe 3-in-1 Original': 'images/nescafe.jpg',
        'Zesto Juice Drink 250ml': 'images/zesto.jpg',
        'Coke Mismo 295ml': 'images/coke.jpg',
        'Sprite 1L': 'images/sprite.jpg',
        'Wilkins Water 500ml': 'images/wilkins.jpg',
        'Summit Distilled Water 1L': 'images/summit.png',
        'Safeguard Bar Soap': 'images/safeguard.jpg',
        'Head & Shoulders Sachet': 'images/head_shoulders.jpg',
        'Tide Powder Sachet': 'images/tide.jpg',
        'Joy Dishwashing Liquid 250ml': 'images/joy.png',
        'Yellow Pad Paper': 'images/yellow_pad.jpg',
        'Panda Ballpen Black': 'images/panda_pen.jpg',
        'Candles Pack of 4': 'images/candles.jpg',
        'Load Card Reminder Slip': 'images/load_card.jpg'
      };

      function seedIfNeeded() {
        if (dbGet(K.SEEDED, false)) return;
        var categories = CATEGORY_LIST.map(function (c) { return { id: uid('cat'), name: c.name, emoji: c.emoji }; });
        dbSet(K.CATEGORIES, categories);
        function cid(name) { return categories.filter(function (c) { return c.name === name; })[0].id; }

        var products = [
          ['Piattos Cheese 40g', 'Snacks', 25, 30, 'Ridged potato crisps with cheese flavor. Good with softdrinks.'],
          ['Nova Multigrain Chips', 'Snacks', 15, 6, 'Crunchy multigrain snack, sold per pack.'],
          ['Chippy BBQ 110g', 'Snacks', 15, 0, 'Corn snack with barbecue flavor.'],
          ['SkyFlakes Crackers', 'Biscuits', 10, 50, 'Classic soda crackers, good for merienda.'],
          ['Fita Biscuit Pack', 'Biscuits', 35, 20, 'Crunchy biscuit good with coffee.'],
          ['Rebisco Crackers Sandwich', 'Biscuits', 9, 7, 'Cheese-filled sandwich crackers.'],
          ['Lucky Me Pancit Canton', 'Instant Noodles', 15, 60, 'Chili mansi flavored instant noodles.'],
          ['Payless Instant Mami', 'Instant Noodles', 8, 40, 'Budget-friendly instant noodle soup.'],
          ['555 Sardines Tomato Sauce', 'Canned Goods', 22, 25, 'Sardines in tomato sauce, 155g can.'],
          ['Argentina Corned Beef', 'Canned Goods', 35, 10, 'Classic corned beef, good with rice.'],
          ['Century Tuna Flakes', 'Canned Goods', 38, 4, 'Tuna flakes in oil, 155g can.'],
          ['Sinandomeng Rice 1kg', 'Rice', 58, 40, 'Well-milled rice, everyday staple.'],
          ['Dinorado Rice 1kg', 'Rice', 65, 15, 'Premium fragrant rice variety.'],
          ['Kopiko Black 3-in-1', 'Coffee', 65, 20, 'Strong black coffee mix, box of sachets.'],
          ['Nescafe 3-in-1 Original', 'Coffee', 68, 5, 'Creamy instant coffee mix.'],
          ['Zesto Juice Drink 250ml', 'Drinks', 12, 30, 'Fruit-flavored juice drink in tetra pack.'],
          ['Coke Mismo 295ml', 'Soft Drinks', 20, 24, 'Ice-cold cola in a personal size bottle.'],
          ['Sprite 1L', 'Soft Drinks', 55, 0, 'Lemon-lime soda, family size.'],
          ['Wilkins Water 500ml', 'Water', 15, 50, 'Purified drinking water.'],
          ['Summit Distilled Water 1L', 'Water', 20, 18, 'Distilled water, 1 liter bottle.'],
          ['Safeguard Bar Soap', 'Personal Care', 35, 20, 'Antibacterial bath soap.'],
          ['Head & Shoulders Sachet', 'Personal Care', 8, 60, 'Anti-dandruff shampoo sachet.'],
          ['Tide Powder Sachet', 'Household Items', 8, 45, 'Laundry detergent powder, single-use sachet.'],
          ['Joy Dishwashing Liquid 250ml', 'Household Items', 45, 3, 'Grease-cutting dishwashing liquid.'],
          ['Yellow Pad Paper', 'School Supplies', 15, 30, 'Ruled writing pad, letter size.'],
          ['Panda Ballpen Black', 'School Supplies', 7, 25, 'Smooth-writing ballpoint pen.'],
          ['Candles Pack of 4', 'Other Products', 10, 25, 'Standard white candles for blackouts.'],
          ['Load Card Reminder Slip', 'Other Products', 5, 50, 'Ask the store owner for prepaid load.']
        ];
        var catEmoji = {}; CATEGORY_LIST.forEach(function (c) { catEmoji[c.name] = c.emoji; });
        var prodObjs = products.map(function (p) {
          return {
            id: uid('prod'), name: p[0], categoryId: cid(p[1]), price: p[2], stock: p[3],
            description: p[4], emoji: catEmoji[p[1]], image: PRODUCT_IMAGE_MAP[p[0]] || null,
            status: 'available', createdAt: new Date().toISOString()
          };
        });
        dbSet(K.PRODUCTS, prodObjs);

        var adminUser = {
          id: uid('user'), role: 'admin', fullName: 'NelGlenn (Owner)', phone: '09171234567',
          password: hashPassword('admin123'), barangay: '', houseStreet: '', landmark: '', createdAt: new Date().toISOString()
        };
        var demoCustomer = {
          id: uid('user'), role: 'customer', fullName: 'Juan Dela Cruz', phone: '09201112222',
          password: hashPassword('juan123'), barangay: 'Barangay San Isidro', houseStreet: '123 Mabini St.',
          landmark: 'Near the covered court', lat: 14.60152, lng: 120.98731, createdAt: new Date().toISOString()
        };
        var demoCustomer2 = {
          id: uid('user'), role: 'customer', fullName: 'Maria Santos', phone: '09183334444',
          password: hashPassword('maria123'), barangay: 'Barangay San Isidro', houseStreet: '45 Taft Ave.',
          landmark: 'Near 7-Eleven store', lat: 14.59715, lng: 120.98188, createdAt: new Date().toISOString()
        };
        var adminUser2 = {
          id: uid('user'), role: 'admin', fullName: 'Zabal (Admin)', phone: 'zabal@sarisari.com',
          password: hashPassword('123456'), barangay: '', houseStreet: '', landmark: '', createdAt: new Date().toISOString()
        };
        dbSet(K.USERS, [adminUser, adminUser2, demoCustomer, demoCustomer2]);
        dbSet(K.ORDERS, []);
        dbSet(K.NOTIFS, []);
        dbSet(K.COUNTER, 0);
        dbSet(K.SEEDED, true);
      }

      function hashPassword(pwd) {
        if (!pwd) return '';
        if (typeof pwd === 'string' && (pwd.indexOf('hash_') === 0 || pwd.indexOf('sha256_') === 0)) return pwd;
        var str = 'salt_sarisari_v1_' + pwd;
        var h = 0x811c9dc5;
        for (var i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
        }
        return 'hash_' + (h >>> 0).toString(16);
      }

      function verifyPassword(inputPassword, storedPassword) {
        if (!storedPassword) return false;
        if (storedPassword === inputPassword) return true;
        return hashPassword(inputPassword) === storedPassword;
      }

      function migrateLegacyStoreData() {
        var users = getUsers();
        var usersChanged = false;
        users.forEach(function (u) {
          if (u.fullName && u.fullName.indexOf('Aling Nena') !== -1) {
            u.fullName = u.fullName.replace(/Aling Nena/g, 'NelGlenn');
            usersChanged = true;
          }
          if (u.password && typeof u.password === 'string' && !u.password.startsWith('hash_')) {
            u.password = hashPassword(u.password);
            usersChanged = true;
          }
        });
        if (usersChanged) {
          saveUsers(users);
        }

        var loc = dbGet('sst_store_location', null);
        if (loc && loc.name && loc.name.indexOf('Aling Nena') !== -1) {
          loc.name = loc.name.replace(/Aling Nena/g, 'NelGlenn');
          dbSet('sst_store_location', loc);
          updateStoreLocationObject(loc);
        }

        var sess = dbGet(K.SESSION, null);
        if (sess && sess.fullName && sess.fullName.indexOf('Aling Nena') !== -1) {
          sess.fullName = sess.fullName.replace(/Aling Nena/g, 'NelGlenn');
          dbSet(K.SESSION, sess);
        }

        try {
          if (typeof localStorage !== 'undefined' && localStorage.getItem('sst_seeded_v1')) {
            localStorage.removeItem('sst_seeded_v1');
            localStorage.setItem('sst_seeded_v2', 'true');
          }
        } catch (e) { }
      }

      function ensureDemoCustomersExist() {
        migrateLegacyStoreData();
        var users = getUsers();
        var updated = false;
        if (!users.some(function (u) { return u.phone === '09183334444'; })) {
          users.push({
            id: uid('user'), role: 'customer', fullName: 'Maria Santos', phone: '09183334444',
            password: hashPassword('maria123'), barangay: 'Barangay San Isidro', houseStreet: '45 Taft Ave.',
            landmark: 'Near 7-Eleven store', lat: 14.59715, lng: 120.98188, createdAt: new Date().toISOString()
          });
          updated = true;
        }
        if (!users.some(function (u) { return u.phone === 'zabal@sarisari.com'; })) {
          users.push({
            id: uid('user'), role: 'admin', fullName: 'Zabal (Admin)', phone: 'zabal@sarisari.com',
            password: hashPassword('123456'), barangay: '', houseStreet: '', landmark: '', createdAt: new Date().toISOString()
          });
          updated = true;
        }
        if (updated) {
          saveUsers(users);
        }
      }

      function updateProductImagesIfNeeded() {
        var prods = getProducts();
        var updated = false;
        prods.forEach(function (p) {
          if (PRODUCT_IMAGE_MAP[p.name] && (!p.image || p.image !== PRODUCT_IMAGE_MAP[p.name])) {
            p.image = PRODUCT_IMAGE_MAP[p.name];
            updated = true;
          }
        });
        if (updated) {
          saveProducts(prods);
        }
      }

/* ================= DATA ACCESS ================= */
      function getUsers() { return dbGet(K.USERS, []); }
      function saveUsers(u) { dbSet(K.USERS, u); syncToCloud('users', u); }
      function getProducts() { return dbGet(K.PRODUCTS, []); }
      function saveProducts(p) { dbSet(K.PRODUCTS, p); syncToCloud('products', p); }
      function getCategories() { return dbGet(K.CATEGORIES, []); }
      function saveCategories(c) { dbSet(K.CATEGORIES, c); syncToCloud('categories', c); }
      function getOrders() { return dbGet(K.ORDERS, []); }
      function saveOrders(o) { dbSet(K.ORDERS, o); syncToCloud('orders', o); }
      function getNotifs() { return dbGet(K.NOTIFS, []); }
      function saveNotifs(n) { dbSet(K.NOTIFS, n); syncToCloud('notifs', n); }

      var _cloudSyncDebounceTimers = {};

      function syncDocToCloud(coll, item) {
        if (!firestoreDb || !item || !item.id) return;
        try {
          firestoreDb.collection(coll).doc(item.id).set(JSON.parse(JSON.stringify(item)), { merge: true }).catch(function (e) {
            console.warn("[Firebase] syncDoc error (" + coll + "/" + item.id + "):", e);
          });
        } catch (e) { }
      }

      function syncToCloud(coll, items) {
        if (!firestoreDb || !items) return;
        if (_cloudSyncDebounceTimers[coll]) clearTimeout(_cloudSyncDebounceTimers[coll]);
        _cloudSyncDebounceTimers[coll] = setTimeout(function () {
          try {
            var batch = firestoreDb.batch();
            items.forEach(function (item) {
              if (item && item.id) {
                var docRef = firestoreDb.collection(coll).doc(item.id);
                batch.set(docRef, JSON.parse(JSON.stringify(item)), { merge: true });
              }
            });
            batch.commit().catch(function (e) { console.warn("[Firebase] sync error (" + coll + "): ", e); });
          } catch (e) { console.warn("[Firebase] sync exception:", e); }
        }, 200);
      }

      function triggerRealtimeRender() {
        if (typeof window !== 'undefined' && window.App && typeof window.App.render === 'function') {
          window.App.render(true);
        } else if (typeof window !== 'undefined' && typeof window.render === 'function') {
          window.render(true);
        } else if (typeof render === 'function') {
          try { render(true); } catch (e) { }
        }
      }

      function initCloudRealtimeListeners() {
        if (!firestoreDb) return;

        firestoreDb.collection('products').onSnapshot(function (snap) {
          if (snap && !snap.empty) {
            var cloudProds = [];
            snap.forEach(function (doc) { cloudProds.push(doc.data()); });
            var localRaw = JSON.stringify(getProducts());
            var cloudRaw = JSON.stringify(cloudProds);
            if (cloudRaw !== localRaw) {
              dbSet(K.PRODUCTS, cloudProds);
              triggerRealtimeRender();
            }
          } else {
            var localProds = getProducts();
            if (localProds.length > 0) syncToCloud('products', localProds);
          }
        }, function (err) { console.warn("[Firebase] products sync:", err); });

        firestoreDb.collection('orders').onSnapshot(function (snap) {
          if (snap && !snap.empty) {
            var cloudOrders = [];
            snap.forEach(function (doc) { cloudOrders.push(doc.data()); });
            var localRaw = JSON.stringify(getOrders());
            var cloudRaw = JSON.stringify(cloudOrders);
            if (cloudRaw !== localRaw) {
              dbSet(K.ORDERS, cloudOrders);
              triggerRealtimeRender();
            }
          } else {
            var localOrders = getOrders();
            if (localOrders.length > 0) syncToCloud('orders', localOrders);
          }
        }, function (err) { console.warn("[Firebase] orders sync:", err); });

        firestoreDb.collection('categories').onSnapshot(function (snap) {
          if (snap && !snap.empty) {
            var cloudCats = [];
            snap.forEach(function (doc) { cloudCats.push(doc.data()); });
            var localRaw = JSON.stringify(getCategories());
            var cloudRaw = JSON.stringify(cloudCats);
            if (cloudRaw !== localRaw) {
              dbSet(K.CATEGORIES, cloudCats);
              triggerRealtimeRender();
            }
          } else {
            var localCats = getCategories();
            if (localCats.length > 0) syncToCloud('categories', localCats);
          }
        }, function (err) { console.warn("[Firebase] categories sync:", err); });

        firestoreDb.collection('users').onSnapshot(function (snap) {
          if (snap && !snap.empty) {
            var cloudUsers = [];
            snap.forEach(function (doc) { cloudUsers.push(doc.data()); });
            var localRaw = JSON.stringify(getUsers());
            var cloudRaw = JSON.stringify(cloudUsers);
            if (cloudRaw !== localRaw) {
              dbSet(K.USERS, cloudUsers);
              triggerRealtimeRender();
            }
          } else {
            var localUsers = getUsers();
            if (localUsers.length > 0) syncToCloud('users', localUsers);
          }
        }, function (err) { console.warn("[Firebase] users sync:", err); });

        firestoreDb.collection('notifs').onSnapshot(function (snap) {
          if (snap && !snap.empty) {
            var cloudNotifs = [];
            snap.forEach(function (doc) { cloudNotifs.push(doc.data()); });
            var localRaw = JSON.stringify(getNotifs());
            var cloudRaw = JSON.stringify(cloudNotifs);
            if (cloudRaw !== localRaw) {
              dbSet(K.NOTIFS, cloudNotifs);
              triggerRealtimeRender();
            }
          } else {
            var localNotifs = getNotifs();
            if (localNotifs.length > 0) syncToCloud('notifs', localNotifs);
          }
        }, function (err) { console.warn("[Firebase] notifs sync:", err); });

        firestoreDb.collection('settings').doc('store_location').onSnapshot(function (doc) {
          if (doc.exists) {
            var d = doc.data();
            if (d && typeof d.lat === 'number' && typeof d.lng === 'number') {
              var curLoc = JSON.stringify(STORE_LOCATION);
              if (JSON.stringify(d) !== curLoc) {
                updateStoreLocationObject(d);
                dbSet('sst_store_location', d);
                triggerRealtimeRender();
              }
            }
          }
        }, function (err) { });

        if (fbRtdb) {
          try {
            fbRtdb.ref('settings/store_location').on('value', function (snap) {
              var d = snap.val();
              if (d && typeof d.lat === 'number' && typeof d.lng === 'number') {
                updateStoreLocationObject(d);
                dbSet('sst_store_location', d);
                triggerRealtimeRender();
              }
            });
          } catch (e) { }
        }
      }

      function getSession() { return dbGet(K.SESSION, null); }
      function setSession(userId) { dbSet(K.SESSION, { userId: userId }); }
      function clearSession() { localStorage.removeItem(K.SESSION); }
      function currentUser() {
        var s = getSession(); if (!s) return null;
        return getUsers().filter(function (u) { return u.id === s.userId; })[0] || null;
      }

      function categoryById(id) { return getCategories().filter(function (c) { return c.id === id; })[0]; }
      function productById(id) { return getProducts().filter(function (p) { return p.id === id; })[0]; }

      function stockStatus(p) {
        if (p.status === 'unavailable') return { label: 'Unavailable', cls: 'badge-out' };
        if (p.stock <= 0) return { label: 'Out of Stock', cls: 'badge-out' };
        if (p.stock <= LOW_STOCK_THRESHOLD) return { label: 'Low Stock', cls: 'badge-low' };
        return { label: 'In Stock', cls: 'badge-in' };
      }
      function nextOrderNumber() {
        var n = dbGet(K.COUNTER, 0) + 1;
        dbSet(K.COUNTER, n);
        var d = new Date();
        var ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
        return 'ORD-' + ymd + '-' + String(n).padStart(4, '0');
      }

      function addNotif(targetUserId, message, type, orderId) {
        var notifs = getNotifs();
        notifs.unshift({ id: uid('notif'), userId: targetUserId, message: message, type: type || 'info', orderId: orderId || null, read: false, createdAt: new Date().toISOString() });
        saveNotifs(notifs);
      }
      function unreadCount(userId) {
        return getNotifs().filter(function (n) { return n.userId === userId && !n.read; }).length;
      }

      /* ================= CART (per user, localStorage) ================= */
      function cartKey(userId) { return 'sst_cart_' + userId; }
      function getCart() {
        var u = currentUser(); if (!u) return [];
        return dbGet(cartKey(u.id), []);
      }
      function saveCart(items) {
        var u = currentUser(); if (!u) return;
        dbSet(cartKey(u.id), items);
      }
      function cartCount() {
        return getCart().reduce(function (s, i) { return s + i.qty; }, 0);
      }
      function cartTotal() {
        var items = getCart(); var total = 0;
        items.forEach(function (i) {
          var p = productById(i.productId);
          if (p) total += p.price * i.qty;
        });
        return total;
      }

