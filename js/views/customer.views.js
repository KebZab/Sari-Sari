/* ================= CUSTOMER VIEWS & SHELL ================= */
/* ================= CUSTOMER SHELL ================= */
      function renderCustomerShell(user) {
        var view = state.view;
        if (['auth-login', 'auth-register', ''].indexOf(view) >= 0) view = 'customer-home';
        var body;
        if (view === 'customer-orders') body = renderCustomerOrders(user);
        else if (view === 'customer-order-detail') body = renderCustomerOrderDetail(user);
        else if (view === 'customer-checkout') body = renderCheckout(user);
        else if (view === 'customer-profile') body = renderCustomerProfile(user);
        else body = renderCustomerHome(user);

        var showTop = (view === 'customer-home');
        var cc = cartCount();
        var html = '<div class="mobile-frame' + (cc > 0 && view === 'customer-home' ? ' has-floating-cart' : '') + '">';
        if (showTop) html += renderCustomerTopbar(user);
        html += '<div class="screen">' + body + '</div>';
        if (view === 'customer-home' && cc > 0 && !state.cartOpen) {
          html += renderFloatingCartBar();
        }
        html += renderCustomerBottomNav(view, user);
        if (state.cartOpen) html += renderCartDrawer(user);
        if (state.notifOpen) html += renderNotifDrawer(user);
        html += '</div>';
        return html;
      }

      function renderFloatingCartBar() {
        var cc = cartCount();
        if (cc <= 0) return '';
        var total = cartTotal();
        return '' +
          '<div class="floating-cart-bar" id="floating-cart-bar" onclick="App.toggleCart(true)" role="button" aria-label="View shopping cart">' +
            '<div class="fc-left">' +
              '<div class="fc-icon-pill">' + ICON.cart + '<span class="fc-badge">' + cc + '</span></div>' +
              '<div class="fc-meta">' +
                '<span class="fc-label">' + cc + (cc === 1 ? ' item' : ' items') + ' in cart</span>' +
                '<span class="fc-price">' + peso(total) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="fc-action">' +
              '<span>View Cart</span>' +
              '<span class="fc-arr">&rarr;</span>' +
            '</div>' +
          '</div>';
      }

      function renderCustomerTopbar(user) {
        var uc = unreadCount(user.id);
        var addrText = user.barangay ? user.barangay : (state.checkoutCoords ? 'GPS Location Pinned' : 'Set delivery location');
        if (user.landmark && user.barangay) addrText += ' (' + user.landmark + ')';
        return '' +
          '<div class="topbar">' +
            '<div class="topbar-row">' +
              '<div class="brand">' +
                '<div class="mark">' + ICON.store + '</div>' +
                '<div class="brand-text">' +
                  '<div class="name" style="display:flex;align-items:center;gap:6px;">Aling Nena\'s Store <span class="cloud-badge" style="font-size:10px;padding:2px 7px;"><span class="cloud-dot"></span> Live</span></div>' +
                  '<div class="tag">Fresh &amp; ready for pickup or delivery</div>' +
                '</div>' +
              '</div>' +
              '<div class="topbar-actions">' +
                '<button class="icon-btn" onclick="App.toggleNotif(true)" aria-label="Notifications">' + ICON.bell + (uc > 0 ? '<span class="dot">' + uc + '</span>' : '') + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="delivery-bar" onclick="App.openLocationModal()">' +
              '<span class="del-ic">📍</span>' +
              '<span class="del-text">Deliver to: <strong>' + esc(addrText) + '</strong></span>' +
              '<span class="del-pill">Change &rsaquo;</span>' +
            '</div>' +
            '<div class="search-wrap">' +
              '<span class="si">' + ICON.search + '</span>' +
              '<input id="prod-search-input" type="text" placeholder="Search products (e.g. sardinas, gatas, tubig)" value="' + esc(state.search) + '" oninput="App.setSearch(this.value)">' +
              (state.search ? '<button class="search-clear-btn" type="button" aria-label="Clear search" onclick="App.clearSearch()">&times;</button>' : '') +
            '</div>' +
            '<div class="cat-scroll" id="cat-scroll-bar">' +
              '<button class="chip' + (state.activeCategoryId === null ? ' active' : '') + '" onclick="App.setCategory(null)"><span class="chip-emoji">✨</span> All items</button>' +
              getCategories().map(function (c) {
                return '<button class="chip' + (state.activeCategoryId === c.id ? ' active' : '') + '" onclick="App.setCategory(\'' + c.id + '\')"><span class="chip-emoji">' + c.emoji + '</span> ' + esc(c.name) + '</button>';
              }).join('') +
            '</div>' +
          '</div>';
      }

      function renderActiveOrderBanner(user) {
        var orders = getOrders().filter(function (o) { return o.customerId === user.id && o.status !== 'Delivered' && o.status !== 'Cancelled'; });
        if (orders.length === 0) return '';
        orders.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        var o = orders[0];
        var idx = STATUS_FLOW.indexOf(o.status);
        var segs = STATUS_FLOW.map(function (s, i) { return '<div class="seg' + (i <= idx ? ' done' : '') + '"></div>'; }).join('');
        return '' +
          '<div class="active-order-card">' +
          '<div class="row1"><div><div style="font-weight:800;font-size:15px;">' + ICON.truck + ' Your order is on the way</div><div class="ord-no">' + esc(o.orderNumber) + '</div></div><div class="status-pill">' + esc(o.status) + '</div></div>' +
          '<div class="progress-track">' + segs + '</div>' +
          '<button class="cta" onclick="App.viewOrder(\'' + o.id + '\')">View order status &rarr;</button>' +
          '</div>';
      }

      function filteredProducts() {
        var products = getProducts();
        var q = state.search.trim().toLowerCase();
        return products.filter(function (p) {
          if (state.activeCategoryId && p.categoryId !== state.activeCategoryId) return false;
          if (q && p.name.toLowerCase().indexOf(q) === -1 && (p.description || '').toLowerCase().indexOf(q) === -1) return false;
          return true;
        });
      }

      function productImgHtml(p, size) {
        if (p && p.image) {
          return '<img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline\';"><span style="display:none;">' + (p.emoji || ICON.box) + '</span>';
        }
        return '<span>' + (p ? p.emoji || ICON.box : ICON.box) + '</span>';
      }

      function renderProductCardFooter(p, inCart) {
        var disabled = (p.stock <= 0 || p.status === 'unavailable');
        var maxed = inCart >= p.stock;
        if (disabled) {
          return '<button class="add-btn is-disabled" disabled>Out of Stock</button>';
        } else if (inCart > 0) {
          return '<div class="qty-stepper">' +
            '<button class="qty-btn dec" type="button" aria-label="Decrease quantity" onclick="event.stopPropagation();App.cartDec(\'' + p.id + '\')">' + ICON.minus + '</button>' +
            '<span class="qty-num">' + inCart + '</span>' +
            '<button class="qty-btn inc" type="button" aria-label="Increase quantity" ' + (maxed ? 'disabled style="opacity:0.35;" ' : '') + 'onclick="event.stopPropagation();App.cartInc(\'' + p.id + '\')">' + ICON.plus + '</button>' +
          '</div>';
        } else {
          return '<button class="add-btn" type="button" onclick="event.stopPropagation();App.addToCart(\'' + p.id + '\')">' +
            '<span class="btn-ic">' + ICON.plus + '</span> Add' +
          '</button>';
        }
      }

      function renderCustomerHome(user) {
        var products = filteredProducts();
        var cart = getCart();
        var cartMap = {}; cart.forEach(function (c) { cartMap[c.productId] = c.qty; });
        var grid;
        if (products.length === 0) {
          grid = '<div class="empty-state"><div class="ic">\ud83d\udd0d</div><h3>No products found</h3><p>Try a different search term or category.</p>' +
            (state.search ? '<button class="btn btn-outline btn-sm" style="margin-top:12px;" onclick="App.clearSearch()">Clear search</button>' : '') +
            '</div>';
        } else {
          grid = '<div class="product-grid" id="customer-product-grid">' + products.map(function (p) {
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
          }).join('') + '</div>';
        }
        return renderActiveOrderBanner(user) +
          '<div class="section-title">' + (state.activeCategoryId ? esc(categoryById(state.activeCategoryId).name) : 'All products') + ' <span style="color:var(--ink-400);font-weight:600;font-size:14px;">(' + products.length + ')</span></div>' +
          grid;
      }

      function renderCustomerBottomNav(view, user) {
        var cc = cartCount();
        function item(key, icon, label, badge) {
          return '<button class="' + (view === key ? 'active' : '') + '" onclick="App.go(\'' + key + '\')"><span class="ic">' + icon + '</span>' + label + (badge ? '<span class="nav-badge">' + badge + '</span>' : '') + '</button>';
        }
        return '<div class="bottom-nav">' +
          item('customer-home', ICON.home, 'Home') +
          '<button class="' + (state.cartOpen ? 'active' : '') + '" onclick="App.toggleCart(true)"><span class="ic">' + ICON.cart + '</span>Cart' + (cc > 0 ? '<span class="nav-badge">' + cc + '</span>' : '') + '</button>' +
          item('customer-orders', ICON.orders, 'Orders') +
          item('customer-profile', ICON.profile, 'Profile') +
          '</div>';
      }

      /* ---------- Cart Drawer ---------- */
      function renderCartDrawer(user) {
        var cart = getCart();
        var body;
        if (cart.length === 0) {
          body = '<div class="empty-state"><div class="ic">' + ICON.cart + '</div><h3>Your cart is empty</h3><p>Browse products and add items to order.</p><button class="btn btn-primary" style="margin-top:14px;" onclick="App.toggleCart(false)">Browse Products</button></div>';
        } else {
          body = cart.map(function (c) {
            var p = productById(c.productId);
            if (!p) return '';
            var maxed = c.qty >= p.stock;
            var lineTotal = p.price * c.qty;
            return '' +
              '<div class="cart-item" id="cart-item-' + p.id + '">' +
              '<div class="thumb">' + productImgHtml(p) + '</div>' +
              '<div class="info">' +
              '<div class="nm">' + esc(p.name) + '</div>' +
              '<div class="pr-wrap"><span class="pr">' + peso(p.price) + ' each</span> <span class="line-total">' + peso(lineTotal) + '</span></div>' +
              '<div class="rowend">' +
              '<div class="qty-stepper" style="max-width:116px;"><button type="button" aria-label="Decrease" onclick="App.cartDec(\'' + p.id + '\')">' + ICON.minus + '</button><span class="qty-num">' + c.qty + '</span><button type="button" aria-label="Increase" ' + (maxed ? 'disabled style="opacity:.35;"' : '') + ' onclick="App.cartInc(\'' + p.id + '\')">' + ICON.plus + '</button></div>' +
              '<button class="link-danger" type="button" onclick="App.cartRemove(\'' + p.id + '\')">Remove</button>' +
              '</div>' +
              '</div>' +
              '</div>';
          }).join('');
        }
        var total = cartTotal();
        var count = cartCount();
        return '' +
          '<div class="overlay-bg bottom-sheet" onclick="if(event.target===this) App.toggleCart(false)">' +
          '<div class="drawer-bottom">' +
          '<div class="sheet-handle"></div>' +
          '<div class="drawer-head"><h3>' + ICON.cart + ' Your Cart <span class="head-count">(' + count + ')</span></h3><button class="close-x" onclick="App.toggleCart(false)">&times;</button></div>' +
          '<div class="drawer-body">' + body + '</div>' +
          (cart.length > 0 ? (
            '<div class="cart-summary">' +
            '<div class="summary-row"><span>Items Subtotal</span><span class="val">' + peso(total) + '</span></div>' +
            '<div class="summary-row"><span style="display:flex;align-items:center;gap:4px;">Delivery Fee <span class="badge-free">Free</span></span><span class="val">₱0.00</span></div>' +
            '<div class="summary-row total"><span>Total to Pay</span><span class="val">' + peso(total) + '</span></div>' +
            '<button class="btn btn-primary btn-block btn-lg" onclick="App.goCheckout()">Proceed to Checkout (' + peso(total) + ') &rarr;</button>' +
            '</div>'
          ) : '') +
          '</div>' +
          '</div>';
      }

      /* ---------- Notifications Drawer ---------- */
      function renderNotifDrawer(user) {
        var items = getNotifs().filter(function (n) { return n.userId === user.id; });
        var body;
        if (items.length === 0) {
          body = '<div class="empty-state"><div class="ic">' + ICON.bell + '</div><h3>No notifications yet</h3><p>You\'ll see order updates here.</p></div>';
        } else {
          body = items.map(function (n) {
            return '<div class="notif-item' + (n.read ? '' : ' unread') + '" onclick="App.readNotif(\'' + n.id + '\')">' +
              '<div class="notif-ic">' + notifIcon(n.type) + '</div>' +
              '<div><div class="notif-text">' + esc(n.message) + '</div><div class="notif-time">' + fmtDateTime(n.createdAt) + '</div></div>' +
              '</div>';
          }).join('');
        }
        var isCustomer = currentUser() && currentUser().role === 'customer';
        if (isCustomer) {
          return '' +
            '<div class="overlay-bg bottom-sheet" onclick="if(event.target===this) App.toggleNotif(false)">' +
            '<div class="drawer-bottom">' +
            '<div class="sheet-handle"></div>' +
            '<div class="drawer-head"><h3>' + ICON.bell + ' Notifications</h3><button class="close-x" onclick="App.toggleNotif(false)">&times;</button></div>' +
            '<div class="drawer-body">' + body + '</div>' +
            '</div>' +
            '</div>';
        }
        return '' +
          '<div class="overlay-bg" onclick="if(event.target===this) App.toggleNotif(false)">' +
          '<div class="drawer">' +
          '<div class="drawer-head"><h3>' + ICON.bell + ' Notifications</h3><button class="close-x" onclick="App.toggleNotif(false)">&times;</button></div>' +
          '<div class="drawer-body">' + body + '</div>' +
          '</div>' +
          '</div>';
      }
      function notifIcon(type) {
        var map = { order: ICON.orders, status: ICON.truck, cancel: ICON.close, newOrder: ICON.bell, info: ICON.bell };
        return map[type] || ICON.bell;
      }

      /* ---------- Checkout ---------- */
      function renderCheckout(user) {
        var cart = getCart();
        if (cart.length === 0) {
          return '<div class="empty-state"><div class="ic">' + ICON.cart + '</div><h3>Your cart is empty</h3><p>Add products before checking out.</p><button class="btn btn-primary" style="margin-top:14px;" onclick="App.go(\'customer-home\')">Browse products</button></div>';
        }
        var total = cartTotal();
        var addrEditing = state.addressEditing;
        var addressBlock;
        if (addrEditing) {
          addressBlock = '' +
            '<div class="field"><label>Barangay</label><input id="chk-barangay" type="text" value="' + esc(user.barangay) + '"></div>' +
            '<div class="field"><label>House number / street</label><input id="chk-housestreet" type="text" value="' + esc(user.houseStreet) + '"></div>' +
            '<div class="field"><label>Nearby landmark</label><input id="chk-landmark" type="text" value="' + esc(user.landmark) + '"></div>' +
            '<div class="field"><label>Phone number</label><input id="chk-phone" type="tel" value="' + esc(user.phone) + '"></div>' +
            '<button class="btn btn-outline btn-sm" onclick="App.saveCheckoutAddress()">Save address</button>';
        } else {
          addressBlock = '' +
            '<div class="info-row"><span class="k">Name</span><span class="v">' + esc(user.fullName) + '</span></div>' +
            '<div class="info-row"><span class="k">Phone</span><span class="v">' + esc(user.phone) + '</span></div>' +
            '<div class="info-row"><span class="k">Barangay</span><span class="v">' + esc(user.barangay) + '</span></div>' +
            '<div class="info-row"><span class="k">House / street</span><span class="v">' + esc(user.houseStreet) + '</span></div>' +
            '<div class="info-row"><span class="k">Landmark</span><span class="v">' + esc(user.landmark) + '</span></div>' +
            '<button class="btn btn-outline btn-sm" style="margin-top:10px;" onclick="App.editCheckoutAddress()">' + ICON.edit + ' Edit address</button>';
        }
        var itemsHtml = cart.map(function (c) {
          var p = productById(c.productId);
          if (!p) return '';
          return '<div class="info-row"><span class="k">' + esc(p.name) + ' &times; ' + c.qty + '</span><span class="v">' + peso(p.price * c.qty) + '</span></div>';
        }).join('');
        var gpsBlock = '' +
          '<div class="section-title" style="margin-top:14px;">' + ICON.pin + ' Pinpoint location (Real-time GPS)</div>' +
          '<div class="card" style="padding:14px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;position:relative;z-index:20;">' +
          '<div>' +
          '<div style="font-weight:700;font-size:13.5px;">Exact Drop-off Pin</div>' +
          '<div style="font-size:11.5px;color:var(--ink-500);">Tap "Detect My GPS" or drag the pin to your gate</div>' +
          '</div>' +
          '<button type="button" class="gps-btn" id="btn-detect-gps" onclick="App.detectCustomerGps(true)">' +
          '<span class="gps-radar-dot"></span>' +
          '<span id="gps-btn-text">' + (state.checkoutGpsStatus === 'locked' ? 'GPS Locked ✓' : 'Detect My GPS') + '</span>' +
          '</button>' +
          '</div>' +
          '<div id="checkout-map" class="map-box checkout-map-view"></div>' +
          '<div class="gps-status-row" id="checkout-gps-status" style="cursor:pointer;" onclick="App.detectCustomerGps(true)">' +
          (state.checkoutCoords ?
            (state.checkoutCoords.manual ?
              '<span class="gps-badge-pill manual">📍 Pin Set on Map</span><span>' + state.checkoutCoords.lat.toFixed(5) + ', ' + state.checkoutCoords.lng.toFixed(5) + '</span>' :
              '<span class="gps-badge-pill locked"><span class="cloud-dot"></span> GPS Locked</span><span>' + (state.checkoutCoords.accuracy ? '~' + state.checkoutCoords.accuracy + 'm accuracy' : 'High accuracy') + '</span>'
            ) :
            '<span class="gps-badge-pill searching">📍 Detect GPS or tap the map</span><span>No drop-off location selected</span>'
          ) +
          '</div>' +
          '</div>';

        return '' +
          '<div class="section-title" style="margin-top:6px;">' + ICON.pin + ' Delivery address</div>' +
          '<div class="card">' + addressBlock + '</div>' +
          gpsBlock +
          '<div class="section-title">' + ICON.package + ' Order items</div>' +
          '<div class="card">' + itemsHtml + '</div>' +
          '<div class="section-title">Delivery instructions (optional)</div>' +
          '<div class="card">' +
          '<div class="quick-tags" style="margin-bottom:8px;display:flex;flex-wrap:wrap;gap:6px;">' +
          '<button type="button" class="chip" style="font-size:11px;padding:4px 9px;" onclick="App.addInstructionTag(\'Call when outside\')">+ Call when outside</button>' +
          '<button type="button" class="chip" style="font-size:11px;padding:4px 9px;" onclick="App.addInstructionTag(\'Leave at doorstep\')">+ Leave at doorstep</button>' +
          '<button type="button" class="chip" style="font-size:11px;padding:4px 9px;" onclick="App.addInstructionTag(\'Ring doorbell\')">+ Ring doorbell</button>' +
          '</div>' +
          '<textarea id="chk-instructions" placeholder="e.g. Please call upon arrival, leave with the guard, etc.">' + esc(state.checkoutInstructions) + '</textarea>' +
          '</div>' +
          '<div class="section-title">' + ICON.money + ' Payment method</div>' +
          '<div class="card" style="padding:10px 14px;">' +
          '<div class="info-row" style="padding:6px 0;"><span class="k" style="display:flex;align-items:center;gap:6px;">💵 Cash on Delivery (COD)</span><span class="v" style="color:var(--green-700);">Active</span></div>' +
          '<div style="font-size:11.5px;color:var(--ink-500);margin-top:2px;">Pay directly in cash to the rider upon delivery. GCash transfer upon arrival also supported.</div>' +
          '</div>' +
          '<div class="card" style="background:linear-gradient(135deg, var(--green-50), var(--surface));">' +
          '<div class="summary-row total"><span>Total to pay</span><span>' + peso(total) + '</span></div>' +
          '<button class="btn btn-primary btn-block" onclick="App.placeOrder()">' + ICON.check + ' Place order</button>' +
          '</div>';
      }

      /* ---------- Orders list / detail ---------- */
      function renderCustomerOrders(user) {
        var orders = getOrders().filter(function (o) { return o.customerId === user.id; });
        orders.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (orders.length === 0) {
          return '<div class="empty-state"><div class="ic">' + ICON.orders + '</div><h3>No orders yet</h3><p>Your placed orders will show up here.</p></div>';
        }
        return '<div class="section-title">Your orders</div>' + orders.map(function (o) {
          return '' +
            '<div class="order-card" onclick="App.viewOrder(\'' + o.id + '\')">' +
            '<div class="top"><div><div class="ordno">' + esc(o.orderNumber) + '</div><div class="meta">' + fmtDateTime(o.createdAt) + ' &middot; ' + o.items.length + ' item(s)</div></div><span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span></div>' +
            '<div class="info-row" style="padding:2px 0;"><span class="k">Total</span><span class="v">' + peso(o.total) + '</span></div>' +
            '</div>';
        }).join('');
      }
      function statusClass(status) {
        return 'st-' + status.toLowerCase().replace(/ /g, '');
      }

      function renderCustomerOrderDetail(user) {
        var o = getOrders().filter(function (x) { return x.id === state.orderDetailId; })[0];
        if (!o || o.customerId !== user.id) {
          return '<div class="empty-state"><h3>Order not found</h3><button class="btn btn-primary" onclick="App.go(\'customer-orders\')">Back to orders</button></div>';
        }
        var canCancel = (o.status === 'Pending' || o.status === 'Confirmed');
        var timeline;
        if (o.status === 'Cancelled') {
          timeline = '<div class="tl-step done current"><div class="tl-dot">' + ICON.close + '</div><div><div class="tl-label">Cancelled</div><div class="tl-time">' + fmtDateTime(lastHistTime(o, 'Cancelled')) + '</div></div></div>';
        } else {
          var idx = STATUS_FLOW.indexOf(o.status);
          timeline = STATUS_FLOW.map(function (s, i) {
            var done = i <= idx;
            var cur = i === idx;
            var t = lastHistTime(o, s);
            return '<div class="tl-step' + (done ? ' done' : '') + (cur ? ' current' : '') + '"><div class="line"></div><div class="tl-dot">' + (done ? ICON.check : (i + 1)) + '</div><div><div class="tl-label">' + s + '</div><div class="tl-time">' + (t ? fmtDateTime(t) : 'Waiting') + '</div></div></div>';
          }).join('');
        }
        var itemsHtml = o.items.map(function (it) {
          return '<div class="info-row"><span class="k">' + esc(it.name) + ' &times; ' + it.qty + '</span><span class="v">' + peso(it.price * it.qty) + '</span></div>';
        }).join('');
        var trackingHtml = '';
        if (o.status !== 'Cancelled') {
          trackingHtml = '' +
            '<div class="section-title">🛵 Live Delivery Tracking &amp; Navigation</div>' +
            '<div id="customer-tracking-react-root"></div>';
        }

        return '' +
          '<button class="btn btn-ghost btn-sm" style="padding-left:0;margin-bottom:10px;" onclick="App.go(\'customer-orders\')">&larr; Back to orders</button>' +
          '<div class="card"><div class="top" style="display:flex;justify-content:space-between;align-items:center;"><div><div class="ordno" style="font-size:17px;">' + esc(o.orderNumber) + '</div><div class="meta">Placed ' + fmtDateTime(o.createdAt) + '</div></div><span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span></div></div>' +
          '<div class="section-title">Order status</div>' +
          '<div class="card"><div class="timeline">' + timeline + '</div></div>' +
          trackingHtml +
          '<div class="section-title">Items</div>' +
          '<div class="card">' + itemsHtml + '<div class="divider"></div><div class="summary-row total"><span>Total</span><span>' + peso(o.total) + '</span></div></div>' +
          '<div class="section-title">Delivery details</div>' +
          '<div class="card">' +
          '<div class="info-row"><span class="k">Name</span><span class="v">' + esc(o.delivery.fullName) + '</span></div>' +
          '<div class="info-row"><span class="k">Phone</span><span class="v">' + esc(o.delivery.phone) + '</span></div>' +
          '<div class="info-row"><span class="k">Address</span><span class="v">' + esc(o.delivery.houseStreet + ', ' + o.delivery.barangay) + '</span></div>' +
          '<div class="info-row"><span class="k">GPS Location</span><span class="v" style="font-family:monospace;font-size:11.5px;">' + (getOrderCoords(o) ? getOrderCoords(o).lat.toFixed(5) + ', ' + getOrderCoords(o).lng.toFixed(5) : 'No location saved') + '</span></div>' +
          '<div class="info-row"><span class="k">Landmark</span><span class="v">' + esc(o.delivery.landmark || '\u2014') + '</span></div>' +
          '<div class="info-row"><span class="k">Instructions</span><span class="v">' + esc(o.instructions || '\u2014') + '</span></div>' +
          '<div class="info-row"><span class="k">Payment</span><span class="v">Cash on Delivery</span></div>' +
          '</div>' +
          (canCancel ? '<button class="btn btn-danger btn-block" onclick="App.cancelOrder(\'' + o.id + '\')">Cancel order</button>' : '');
      }
      function lastHistTime(order, status) {
        var h = (order.statusHistory || []).filter(function (x) { return x.status === status; });
        return h.length ? h[h.length - 1].timestamp : null;
      }

      /* ---------- Profile ---------- */
      function renderCustomerProfile(user) {
        var isGoogle = (user.authProvider === 'google' || user.googleUid || user.email);
        var googleBadge = isGoogle ?
          '<div class="profile-google-badge">' +
          GOOGLE_ICON_SVG +
          '<div>' +
          '<div style="font-weight:700;font-size:13px;color:var(--ink-900);">Connected with Google</div>' +
          '<div style="font-size:12px;color:var(--ink-500);">' + esc(user.email || 'Google User') + '</div>' +
          '</div>' +
          '</div>' : '';

        return '' +
          '<div class="section-title" style="margin-top:6px;">' + ICON.profile + ' My profile</div>' +
          googleBadge +
          '<div class="card">' +
          '<form onsubmit="return App.saveProfile(event)">' +
          '<div class="field"><label>Full name</label><input id="pf-fullname" type="text" value="' + esc(user.fullName) + '" required></div>' +
          '<div class="field"><label>Phone number (Required for delivery updates)</label><input id="pf-phone" type="tel" value="' + esc(user.phone || '') + '" placeholder="09XXXXXXXXX" required></div>' +
          '<div class="field"><label>Barangay</label><input id="pf-barangay" type="text" value="' + esc(user.barangay || '') + '" required></div>' +
          '<div class="field"><label>House number / street</label><input id="pf-housestreet" type="text" value="' + esc(user.houseStreet || '') + '" required></div>' +
          '<div class="field"><label>Nearby landmark</label><input id="pf-landmark" type="text" value="' + esc(user.landmark || '') + '"></div>' +
          '<div class="field"><label>' + (isGoogle ? 'Optional account password' : 'New password (leave blank to keep current)') + '</label><input id="pf-password" type="password" placeholder="********"></div>' +
          '<button type="submit" class="btn btn-primary btn-block">Save changes</button>' +
          '</form>' +
          '</div>' +
          '<button class="btn btn-outline btn-block" style="margin-top:4px;" onclick="App.logout()">' + ICON.logout + ' Log out</button>';
      }
