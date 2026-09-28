/* ================= ADMIN VIEWS & SHELL ================= */
/* ================= ADMIN SHELL ================= */
      function renderAdminShell(user) {
        var section = state.adminSection;
        var content;
        if (section === 'orders') content = renderAdminOrders();
        else if (section === 'deliveries') content = renderAdminDeliveries();
        else if (section === 'products') content = renderAdminProducts();
        else if (section === 'inventory') content = renderAdminInventory();
        else if (section === 'customers') content = renderAdminCustomers();
        else if (section === 'notifications') content = renderAdminNotifications(user);
        else content = renderAdminDashboard();

        var titleMap = { dashboard: 'Dashboard', orders: 'Orders', deliveries: 'Deliveries', products: 'Products', inventory: 'Inventory', customers: 'Customers', notifications: 'Notifications' };
        var uc = unreadCount(user.id);

        var html = '<div class="admin-shell">';
        if (state.sidebarOpen) html += '<div class="sidebar-backdrop" onclick="App.toggleSidebar(false)"></div>';
        html += renderAdminSidebar(section);
        html += '<div class="admin-main">';
        html += '<div class="admin-topbar"><div style="display:flex;align-items:center;gap:12px;"><button class="hamburger" onclick="App.toggleSidebar(true)">' + ICON.menu + '</button><h2 style="font-size:18px;font-weight:800;">' + titleMap[section] + '</h2><span class="cloud-badge"><span class="cloud-dot"></span> Firebase Live</span></div><button class="icon-btn" style="background:var(--surface-2);color:var(--ink-700);border:1px solid var(--border);" onclick="App.go(\'admin-notif-drawer\')">' + ICON.bell + (uc > 0 ? '<span class="dot" style="background:var(--red-500);color:#fff;">' + uc + '</span>' : '') + '</button></div>';
        html += '<div class="admin-content">' + content + '</div>';
        html += '</div></div>';
        if (state.notifOpen) html += renderNotifDrawer(user);
        if (state.view === 'admin-product-modal') html += renderProductModal();
        if (state.view === 'admin-order-modal') html += renderAdminOrderModal();
        return html;
      }

      function renderAdminSidebar(section) {
        function item(key, icon, label) {
          return '<button class="' + (section === key ? 'active' : '') + '" onclick="App.setAdminSection(\'' + key + '\')"><span class="ic">' + icon + '</span>' + label + '</button>';
        }
        return '' +
          '<div class="admin-sidebar' + (state.sidebarOpen ? ' open' : '') + '">' +
          '<div class="admin-brand"><div class="mark">' + ICON.store + '</div><span>NelGlenn\'s Admin</span></div>' +
          '<div class="admin-nav">' +
          item('dashboard', ICON.dash, 'Dashboard') +
          item('orders', ICON.orders, 'Orders') +
          item('deliveries', ICON.delivery, 'Deliveries') +
          item('products', ICON.products, 'Products') +
          item('inventory', ICON.inventory, 'Inventory') +
          item('customers', ICON.customers, 'Customers') +
          item('notifications', ICON.bell, 'Notifications') +
          '<div class="grp-label">Account</div>' +
          '<button onclick="App.logout()"><span class="ic">' + ICON.logout + '</span>Log out</button>' +
          '</div>' +
          '</div>';
      }

      function renderAdminDashboard() {
        var orders = getOrders();
        var products = getProducts();
        var today = new Date();
        var todays = orders.filter(function (o) { return isSameDay(o.createdAt, today); });
        var pending = orders.filter(function (o) { return o.status === 'Pending'; });
        var preparing = orders.filter(function (o) { return o.status === 'Preparing'; });
        var outfd = orders.filter(function (o) { return o.status === 'Out for Delivery'; });
        var completed = orders.filter(function (o) { return o.status === 'Delivered'; });
        var totalSales = completed.reduce(function (s, o) { return s + o.total; }, 0);
        var lowStock = products.filter(function (p) { return p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD; });
        var outStock = products.filter(function (p) { return p.stock <= 0; });

        var totalLowItems = lowStock.length + outStock.length;
        var lowStockAlert = '';
        if (totalLowItems > 0) {
          lowStockAlert = '' +
            '<div style="background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);border-left:5px solid var(--amber-500);padding:12px 16px;border-radius:10px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
              '<div>' +
                '<strong style="color:var(--amber-700);font-size:14px;display:flex;align-items:center;gap:6px;">⚠️ Low Stock Alert</strong>' +
                '<div style="font-size:12.5px;color:var(--ink-700);margin-top:2px;">' + totalLowItems + ' product(s) are low or out of stock!</div>' +
              '</div>' +
              '<button class="btn btn-warning btn-sm" style="font-weight:700;" onclick="App.restockAllLowItems()">' + ICON.plus + ' Restock All (+20)</button>' +
            '</div>';
        }

        var productSalesMap = {};
        orders.forEach(function (o) {
          if (o.status !== 'Cancelled') {
            (o.items || []).forEach(function (it) {
              if (!productSalesMap[it.productId]) {
                productSalesMap[it.productId] = { name: it.name, qty: 0, revenue: 0 };
              }
              productSalesMap[it.productId].qty += it.qty;
              productSalesMap[it.productId].revenue += (it.price * it.qty);
            });
          }
        });

        var topProducts = Object.values(productSalesMap).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);
        var maxQty = topProducts.length > 0 ? topProducts[0].qty : 1;

        var analyticsHtml = '' +
          '<div class="card" style="margin-top:16px;margin-bottom:20px;padding:16px;">' +
            '<div style="font-weight:800;font-size:15px;margin-bottom:14px;display:flex;align-items:center;gap:6px;">📈 Top-Selling Products Leaderboard</div>' +
            (topProducts.length === 0 ? '<div style="font-size:13px;color:var(--ink-500);">No sales data recorded yet.</div>' :
              topProducts.map(function (tp, idx) {
                var pct = Math.round((tp.qty / maxQty) * 100);
                return '' +
                  '<div style="margin-bottom:12px;">' +
                    '<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-bottom:4px;">' +
                      '<span>#' + (idx + 1) + ' ' + esc(tp.name) + '</span>' +
                      '<span style="color:var(--ink-600);">' + tp.qty + ' sold &middot; <strong style="color:var(--emerald-600);">' + peso(tp.revenue) + '</strong></span>' +
                    '</div>' +
                    '<div style="background:var(--surface-2);height:8px;border-radius:4px;overflow:hidden;">' +
                      '<div style="background:var(--emerald-500);height:100%;width:' + pct + '%;"></div>' +
                    '</div>' +
                  '</div>';
              }).join('')) +
          '</div>';

        var stats = [
          [ICON.orders, "Today's Orders", todays.length, ''],
          [ICON.clock, 'Pending Orders', pending.length, pending.length > 0 ? 'warn' : ''],
          [ICON.fire, 'Being Prepared', preparing.length, ''],
          [ICON.truck, 'Out for Delivery', outfd.length, ''],
          [ICON.check, 'Completed Orders', completed.length, ''],
          [ICON.money, 'Total Sales', peso(totalSales), ''],
          [ICON.box, 'Total Products', products.length, ''],
          [ICON.warning, 'Low-Stock Products', lowStock.length, lowStock.length > 0 ? 'warn' : ''],
          [ICON.close, 'Out-of-Stock Products', outStock.length, outStock.length > 0 ? 'danger' : '']
        ];
        var statHtml = stats.map(function (s) {
          return '<div class="stat-card ' + s[3] + '"><span class="stat-icon">' + s[0] + '</span><div class="num">' + s[2] + '</div><div class="lbl">' + s[1] + '</div></div>';
        }).join('');

        var recent = orders.slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 6);
        var recentHtml = recent.length === 0 ? '<div class="empty-state"><div class="ic">' + ICON.orders + '</div><h3>No orders yet</h3><p>Orders will appear here once customers start ordering.</p></div>' : recent.map(function (o) {
          return '<div class="trow" onclick="App.openOrderModal(\'' + o.id + '\')" style="cursor:pointer;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div><div style="font-weight:700;font-size:14px;">' + esc(o.orderNumber) + '</div><div style="font-size:12px;color:var(--ink-500);margin-top:2px;">' + esc(o.delivery.fullName) + ' &middot; ' + fmtDateTime(o.createdAt) + '</div></div>' +
            '<span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span>' +
            '</div>' +
            '</div>';
        }).join('');

        return lowStockAlert + '<div class="stat-grid">' + statHtml + '</div>' + analyticsHtml +
          '<div class="section-title">Recent orders</div>' +
          '<div class="table-list">' + recentHtml + '</div>';
      }

      function renderAdminOrders() {
        var filters = ['All', 'Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
        var orders = getOrders().slice().sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
        if (state.orderFilter !== 'All') orders = orders.filter(function (o) { return o.status === state.orderFilter; });
        var chips = filters.map(function (f) {
          return '<button class="chip' + (state.orderFilter === f ? ' active' : '') + '" onclick="App.setOrderFilter(\'' + f + '\')">' + f + '</button>';
        }).join('');
        var list = orders.length === 0 ? '<div class="empty-state"><h3>No orders in this filter</h3></div>' : orders.map(function (o) {
          return '' +
            '<div class="trow" onclick="App.openOrderModal(\'' + o.id + '\')" style="cursor:pointer;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
            '<div><div style="font-weight:700;font-size:14.5px;">' + esc(o.orderNumber) + '</div>' +
            '<div style="font-size:12.5px;color:var(--ink-500);margin-top:3px;">' + esc(o.delivery.fullName) + ' &middot; ' + esc(o.delivery.phone) + '</div>' +
            '<div style="font-size:12px;color:var(--ink-500);margin-top:2px;">' + fmtDateTime(o.createdAt) + ' &middot; ' + o.items.length + ' item(s) &middot; ' + peso(o.total) + '</div></div>' +
            '<span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span>' +
            '</div>' +
            '</div>';
        }).join('');
        return '<div class="filter-row">' + chips + '</div><div class="table-list">' + list + '</div>';
      }

      function renderAdminDeliveries() {
        var orders = getOrders().filter(function (o) { return o.status === 'Preparing' || o.status === 'Out for Delivery'; });
        orders.sort(function (a, b) { return new Date(a.createdAt) - new Date(b.createdAt); });

        var mapHeader = '<div id="admin-radar-react-root"></div>';

        if (orders.length === 0) {
          return mapHeader + '<div class="empty-state"><div class="ic">' + ICON.truck + '</div><h3>No active deliveries</h3><p>Orders being prepared or out for delivery appear here.</p></div>';
        }

        var store = (typeof getStoreLocation === 'function') ? getStoreLocation() : STORE_LOCATION;

        var listHtml = orders.map(function (o) {
          var c = getOrderCoords(o);
          var dist = c && hasStoreGps(store) ? calcDistanceKm(store.lat, store.lng, c.lat, c.lng) : null;
          var distStr = dist !== null ? (dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + ' km') : (c ? 'Pinned' : 'No GPS');
          var initials = (o.delivery.fullName || 'Customer').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
          var isStreaming = (typeof activeStreamingOrderId !== 'undefined' && activeStreamingOrderId === o.id);

          return '' +
            '<div class="admin-delivery-ticket">' +
              '<div class="ticket-header">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                  '<div class="admin-avatar" style="width:36px;height:36px;font-size:13px;">' + initials + '</div>' +
                  '<div>' +
                    '<div style="font-weight:800;font-size:15px;color:var(--ink-900);">' + esc(o.orderNumber) + ' &middot; ' + esc(o.delivery.fullName) + '</div>' +
                    '<div style="font-size:12px;color:var(--ink-500);">' + fmtDateTime(o.createdAt) + ' &middot; ' + o.items.length + ' item(s) &middot; <strong>' + peso(o.total) + '</strong></div>' +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:6px;">' +
                  '<span class="badge-dist">📍 ' + distStr + '</span>' +
                  '<span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span>' +
                '</div>' +
              '</div>' +
              '<div class="ticket-body">' +
                '<div class="info-row" style="padding:4px 0;"><span class="k">' + ICON.pin + ' Drop-off Address</span><span class="v">' + esc(o.delivery.houseStreet + ', ' + o.delivery.barangay) + '</span></div>' +
                (o.delivery.landmark ? ('<div class="info-row" style="padding:4px 0;"><span class="k">🏛️ Landmark</span><span class="v">' + esc(o.delivery.landmark) + '</span></div>') : '') +
                (o.instructions ? ('<div class="info-row" style="padding:4px 0;"><span class="k">📝 Rider Note</span><span class="v" style="color:var(--gold-600);">' + esc(o.instructions) + '</span></div>') : '') +
              '</div>' +
              '<div class="ticket-actions">' +
                (o.status === 'Preparing' ? '<button class="btn btn-primary btn-sm" onclick="App.advanceStatus(\'' + o.id + '\',\'Out for Delivery\')">' + ICON.truck + ' Dispatch for delivery</button>' : '') +
                (o.status === 'Out for Delivery' ? '<button class="btn btn-primary btn-sm" onclick="App.advanceStatus(\'' + o.id + '\',\'Delivered\')">' + ICON.check + ' Mark Delivered</button>' : '') +
                (o.status === 'Out for Delivery' ? '<button type="button" class="btn ' + (isStreaming ? 'btn-danger' : 'btn-outline') + ' btn-sm" onclick="App.togglePhoneGpsStreaming(\'' + o.id + '\')">' + (isStreaming ? '⏹️ Stop Phone GPS' : '📱 Stream Phone GPS') + '</button>' : '') +
                '<a href="tel:' + esc(o.delivery.phone) + '" class="btn btn-outline btn-sm">' + ICON.phone + ' Call</a>' +
                '<button class="btn btn-outline btn-sm" onclick="App.openOrderModal(\'' + o.id + '\')">🗺️ View Map &amp; Details</button>' +
              '</div>' +
            '</div>';
        }).join('');

        return mapHeader + '<div class="delivery-tickets-list">' + listHtml + '</div>';
      }

      function renderAdminProducts() {
        var products = getProducts();
        var rows = products.length === 0 ? '<div class="empty-state"><h3>No products yet</h3></div>' : products.map(function (p) {
          var cat = categoryById(p.categoryId);
          var st = stockStatus(p);
          return '' +
            '<div class="prod-row">' +
            '<div class="thumb">' + (p.image ? ('<img src="' + p.image + '" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline\';"><span style="display:none;">' + (p.emoji || ICON.box) + '</span>') : ('<span>' + (p.emoji || ICON.box) + '</span>')) + '</div>' +
            '<div class="body"><div class="nm">' + esc(p.name) + '</div><div class="sub">' + esc(cat ? cat.name : '') + ' &middot; ' + peso(p.price) + ' &middot; <span>' + p.stock + ' in stock</span></div></div>' +
            '<div class="acts">' +
            '<button class="icon-sq" title="Edit" onclick="App.openProductModal(\'' + p.id + '\')">' + ICON.edit + '</button>' +
            '<button class="icon-sq" title="Archive/Delete" onclick="App.deleteProduct(\'' + p.id + '\')">' + ICON.trash + '</button>' +
            '</div>' +
            '</div>';
        }).join('');
        return '<button class="btn btn-primary" style="margin-bottom:16px;" onclick="App.openProductModal(null)">' + ICON.plus + ' Add new product</button><div class="prod-list">' + rows + '</div>';
      }

      function renderAdminInventory() {
        var products = getProducts().slice().sort(function (a, b) { return a.stock - b.stock; });
        var rows = products.map(function (p) {
          var st = stockStatus(p);
          var cat = categoryById(p.categoryId);
          return '' +
            '<div class="prod-row">' +
            '<div class="thumb">' + (p.image ? ('<img src="' + p.image + '" onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'inline\';"><span style="display:none;">' + (p.emoji || ICON.box) + '</span>') : ('<span>' + (p.emoji || ICON.box) + '</span>')) + '</div>' +
            '<div class="body"><div class="nm">' + esc(p.name) + ' <span class="p-badge ' + st.cls + '" style="position:static;display:inline-block;margin-left:6px;">' + st.label + '</span></div><div class="sub">' + esc(cat ? cat.name : '') + ' &middot; Stock: ' + p.stock + '</div></div>' +
            '<div class="acts">' +
            '<button class="icon-sq" onclick="App.adjustStock(\'' + p.id + '\',-1)">' + ICON.minus + '</button>' +
            '<button class="icon-sq" onclick="App.adjustStock(\'' + p.id + '\',1)">' + ICON.plus + '</button>' +
            '<button class="icon-sq" onclick="App.adjustStock(\'' + p.id + '\',10)" style="font-size:11px;font-weight:800;">+10</button>' +
            '</div>' +
            '</div>';
        }).join('');
        return '<div class="section-title" style="margin-top:0;">' + ICON.inventory + ' Stock levels (lowest first)</div><div class="prod-list">' + rows + '</div>';
      }

      function renderAdminCustomers() {
        var users = getUsers().filter(function (u) { return u.role === 'customer'; });
        var orders = getOrders();
        if (users.length === 0) return '<div class="empty-state"><h3>No customers yet</h3></div>';
        return '<div class="table-list">' + users.map(function (u) {
          var uo = orders.filter(function (o) { return o.customerId === u.id; });
          var spent = uo.filter(function (o) { return o.status === 'Delivered'; }).reduce(function (s, o) { return s + o.total; }, 0);
          return '' +
            '<div class="trow">' +
            '<div style="font-weight:800;font-size:15px;">' + esc(u.fullName) + '</div>' +
            '<div class="info-row"><span class="k">' + ICON.phone + ' Phone</span><span class="v">' + esc(u.phone) + '</span></div>' +
            '<div class="info-row"><span class="k">' + ICON.pin + ' Address</span><span class="v">' + esc(u.houseStreet + ', ' + u.barangay) + '</span></div>' +
            '<div class="info-row"><span class="k">Orders placed</span><span class="v">' + uo.length + '</span></div>' +
            '<div class="info-row"><span class="k">Total spent (delivered)</span><span class="v">' + peso(spent) + '</span></div>' +
            '</div>';
        }).join('') + '</div>';
      }

      function renderAdminNotifications(user) {
        var items = getNotifs().filter(function (n) { return n.userId === user.id; });
        if (items.length === 0) return '<div class="empty-state"><div class="ic">' + ICON.bell + '</div><h3>No notifications</h3></div>';
        return items.map(function (n) {
          return '<div class="notif-item' + (n.read ? '' : ' unread') + '" onclick="App.readNotif(\'' + n.id + '\')">' +
            '<div class="notif-ic">' + notifIcon(n.type) + '</div>' +
            '<div><div class="notif-text">' + esc(n.message) + '</div><div class="notif-time">' + fmtDateTime(n.createdAt) + '</div></div>' +
            '</div>';
        }).join('');
      }

      /* ---------- Admin: Order detail & confirmation modal ---------- */
      function renderAdminOrderModal() {
        var o = getOrders().filter(function (x) { return x.id === state.orderDetailId; })[0];
        if (!o) return '';

        var modalCoords = getOrderCoords(o);
        var store = (typeof getStoreLocation === 'function') ? getStoreLocation() : STORE_LOCATION;
        var modalDist = modalCoords && hasStoreGps(store) ? calcDistanceKm(store.lat, store.lng, modalCoords.lat, modalCoords.lng) : null;
        var modalDistStr = modalDist !== null ? (modalDist < 1 ? Math.round(modalDist * 1000) + 'm' : modalDist.toFixed(1) + ' km') : (modalCoords ? 'Pinned' : 'No GPS');

        var gmapsUrl = modalCoords
          ? ('https://www.google.com/maps/dir/?api=1&origin=' + store.lat + ',' + store.lng + '&destination=' + modalCoords.lat + ',' + modalCoords.lng)
          : ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((o.delivery.houseStreet || '') + ' ' + (o.delivery.barangay || '')));

        var products = getProducts();
        var allInStock = true;
        var itemsHtml = o.items.map(function (it) {
          var p = products.filter(function (x) { return x.id === it.productId; })[0];
          var hasStock = p && p.stock >= it.qty;
          if (!hasStock) allInStock = false;
          var stockLabel = p ? (p.stock + ' in stock') : 'Item not found';
          return '' +
            '<div class="admin-modal-item-row">' +
              '<div class="item-thumb">' + (p && p.image ? ('<img src="' + p.image + '" alt="' + esc(it.name) + '">') : ('<span>' + (p && p.emoji ? p.emoji : '📦') + '</span>')) + '</div>' +
              '<div class="item-info">' +
                '<div class="item-name">' + esc(it.name) + '</div>' +
                '<div class="item-meta">' + peso(it.price) + ' &times; ' + it.qty + ' &middot; <span class="' + (hasStock ? 'stock-ok' : 'stock-low') + '">' + stockLabel + '</span></div>' +
              '</div>' +
              '<div class="item-total">' + peso(it.price * it.qty) + '</div>' +
            '</div>';
        }).join('');

        var actions = '';
        var isStreaming = (typeof activeStreamingOrderId !== 'undefined' && activeStreamingOrderId === o.id);

        if (o.status === 'Pending') {
          actions = '' +
            '<div class="admin-action-block">' +
              (!allInStock ? '<div class="alert-warn" style="margin-bottom:10px;">⚠️ Some items have lower inventory than requested. Check stock before accepting.</div>' : '<div class="alert-info" style="margin-bottom:10px;">✓ All items in stock. Inventory will be automatically deducted upon acceptance.</div>') +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
                '<button class="btn btn-primary btn-block btn-lg" style="flex:2;" onclick="App.confirmOrder(\'' + o.id + '\')">' + ICON.check + ' Accept & Confirm Order</button>' +
                '<button class="btn btn-outline btn-lg" style="flex:1;color:var(--red-600);border-color:var(--red-200);" onclick="App.rejectOrder(\'' + o.id + '\')">' + ICON.close + ' Reject</button>' +
              '</div>' +
            '</div>';
        } else if (o.status === 'Confirmed') {
          actions = '' +
            '<div class="admin-action-block">' +
              '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
                '<button class="btn btn-primary btn-block btn-lg" style="flex:2;" onclick="App.advanceStatus(\'' + o.id + '\',\'Preparing\')">' + ICON.fire + ' Start Preparing Items</button>' +
                '<button class="btn btn-ghost btn-sm" style="flex:1;color:var(--red-500);" onclick="App.rejectOrder(\'' + o.id + '\')">Cancel order</button>' +
              '</div>' +
            '</div>';
        } else if (o.status === 'Preparing') {
          actions = '' +
            '<div class="admin-action-block">' +
              '<button class="btn btn-primary btn-block btn-lg" onclick="App.advanceStatus(\'' + o.id + '\',\'Out for Delivery\')">' + ICON.truck + ' Dispatch / Mark Out for Delivery</button>' +
            '</div>';
        } else if (o.status === 'Out for Delivery') {
          actions = '' +
            '<div class="admin-action-block" style="display:flex;flex-direction:column;gap:8px;">' +
              '<button class="btn btn-primary btn-block btn-lg" onclick="App.advanceStatus(\'' + o.id + '\',\'Delivered\')">' + ICON.check + ' Mark Delivered & Complete</button>' +
              '<button type="button" class="btn ' + (isStreaming ? 'btn-danger' : 'btn-outline') + ' btn-block" onclick="App.togglePhoneGpsStreaming(\'' + o.id + '\')">' +
                (isStreaming ? '⏹️ Stop Phone GPS Streaming' : '📱 Stream Rider Phone GPS to Customer') +
              '</button>' +
            '</div>';
        } else if (o.status === 'Delivered') {
          actions = '<div class="alert-success">✓ Order delivered and marked completed on ' + fmtDateTime(lastHistTime(o, 'Delivered')) + '</div>';
        } else if (o.status === 'Cancelled') {
          actions = '<div class="alert-danger">✕ This order was cancelled / rejected on ' + fmtDateTime(lastHistTime(o, 'Cancelled')) + '</div>';
        }

        var initials = (o.delivery.fullName || 'Customer').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();

        return '' +
          '<div class="overlay-bg center" onclick="if(event.target===this) App.closeModal()">' +
          '<div class="modal-card admin-order-modal-card">' +
            '<div class="modal-head">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                '<div>' +
                  '<div style="display:flex;align-items:center;gap:8px;">' +
                    '<h3 style="font-size:20px;font-weight:900;">' + esc(o.orderNumber) + '</h3>' +
                    '<span class="status-badge ' + statusClass(o.status) + '">' + esc(o.status) + '</span>' +
                  '</div>' +
                  '<div style="font-size:12px;color:var(--ink-500);margin-top:4px;">Placed ' + fmtDateTime(o.createdAt) + '</div>' +
                '</div>' +
                '<button class="close-x" onclick="App.closeModal()">&times;</button>' +
              '</div>' +
            '</div>' +

            '<div class="modal-body" style="padding-top:14px;">' +
              '<div class="admin-detail-card">' +
                '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">' +
                  '<div style="display:flex;align-items:center;gap:10px;">' +
                    '<div class="admin-avatar">' + initials + '</div>' +
                    '<div>' +
                      '<div style="font-weight:800;font-size:15px;color:var(--ink-900);">' + esc(o.delivery.fullName) + '</div>' +
                      '<div style="font-size:12.5px;color:var(--ink-600);">' + esc(o.delivery.phone) + '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div style="display:flex;gap:6px;align-items:center;">' +
                    '<button type="button" class="btn btn-outline btn-sm" onclick="App.printReceipt(\'' + o.id + '\')" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;padding:6px 10px;">🧾 Receipt</button>' +
                    '<a href="tel:' + esc(o.delivery.phone) + '" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:6px 12px;">' +
                      ICON.phone + ' Call' +
                    '</a>' +
                  '</div>' +
                '</div>' +
                '<div class="divider" style="margin:8px 0;"></div>' +
                '<div class="info-row"><span class="k">📍 Drop-off Address</span><span class="v">' + esc(o.delivery.houseStreet + ', ' + o.delivery.barangay) + '</span></div>' +
                (o.delivery.landmark ? ('<div class="info-row"><span class="k">🏛️ Nearby Landmark</span><span class="v">' + esc(o.delivery.landmark) + '</span></div>') : '') +
                (o.instructions ? ('<div class="admin-instruction-callout"><span class="ic">📝</span> <span><strong>Rider Note:</strong> ' + esc(o.instructions) + '</span></div>') : '') +
              '</div>' +

              '<div class="admin-detail-card" style="margin-top:12px;padding:12px 14px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                  '<div style="font-size:13px;font-weight:800;display:flex;align-items:center;gap:6px;">' +
                    '<span>🗺️ Delivery Route &amp; GPS Pin</span>' +
                    '<span class="badge-dist" id="modal-map-dist-pill">📍 ' + modalDistStr + ' from store</span>' +
                  '</div>' +
                  '<a href="' + gmapsUrl + '" target="_blank" rel="noopener noreferrer" class="btn-gmaps-link">' +
                    'Open in Google Maps ↗' +
                  '</a>' +
                '</div>' +
                '<div id="admin-order-modal-map" class="map-box admin-order-modal-map-view"></div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:11px;color:var(--ink-500);">' +
                  '<span>🏪 NelGlenn\'s Store &rarr; 📍 ' + esc(o.delivery.barangay) + '</span>' +
                  '<span>' + (modalCoords ? (modalCoords.lat.toFixed(5) + ', ' + modalCoords.lng.toFixed(5)) : 'No GPS set') + '</span>' +
                '</div>' +
              '</div>' +

              '<div class="admin-detail-card" style="margin-top:12px;">' +
                '<div style="font-size:14px;font-weight:800;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">' +
                  '<span>📦 Items to Pack (' + o.items.length + ')</span>' +
                  '<span style="font-size:12px;color:var(--ink-500);">' + (allInStock ? '✓ Stock ready' : '⚠️ Stock review') + '</span>' +
                '</div>' +
                '<div class="admin-modal-items-list">' + itemsHtml + '</div>' +
                '<div class="divider" style="margin:10px 0;"></div>' +
                '<div class="summary-row"><span>Items Subtotal</span><span class="val">' + peso(o.total) + '</span></div>' +
                '<div class="summary-row"><span>Delivery Fee</span><span class="val" style="color:var(--green-700);">Free</span></div>' +
                '<div class="summary-row total" style="margin:8px 0 0;padding-top:8px;"><span>Total to Collect</span><span class="val">' + peso(o.total) + '</span></div>' +
                '<div style="font-size:11.5px;color:var(--ink-500);margin-top:4px;">Payment: 💵 Cash on Delivery (COD)</div>' +
              '</div>' +

              '<div style="margin-top:16px;">' + actions + '</div>' +
            '</div>' +
          '</div>' +
          '</div>';
      }

      /* ---------- Admin: Product add/edit modal ---------- */
      function renderProductModal() {
        var editing = state.editingProductId ? productById(state.editingProductId) : null;
        var categories = getCategories();
        var selectedCat = state.productFormCategory || (editing ? editing.categoryId : categories[0].id);
        var img = state.productFormImage !== undefined ? state.productFormImage : (editing ? editing.image : null);
        return '' +
          '<div class="overlay-bg center" onclick="if(event.target===this) App.closeModal()">' +
          '<div class="modal-card">' +
          '<div class="modal-head"><div style="display:flex;justify-content:space-between;align-items:center;"><h3>' + (editing ? 'Edit product' : 'Add new product') + '</h3><button class="close-x" onclick="App.closeModal()">' + ICON.close + '</button></div></div>' +
          '<div class="modal-body">' +
          '<form onsubmit="return App.saveProduct(event)">' +
          '<div class="field"><label>Product image</label>' +
          '<div class="img-upload"><div class="prev" id="prod-img-prev">' + (img ? '<img src="' + img + '">' : '<span>' + ICON.box + '</span>') + '</div>' +
          '<span class="btn btn-outline btn-sm file-btn">Choose image<input type="file" accept="image/*" onchange="App.handleProductImage(event)"></span></div>' +
          '</div>' +
          '<div class="field"><label>Product name</label><input id="pd-name" type="text" value="' + esc(editing ? editing.name : '') + '" required></div>' +
          '<div class="field"><label>Category</label><select id="pd-category" onchange="state.productFormCategory=this.value">' +
          categories.map(function (c) { return '<option value="' + c.id + '" ' + (selectedCat === c.id ? 'selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') +
          '</select></div>' +
          '<div class="field"><label>Description</label><textarea id="pd-desc">' + esc(editing ? editing.description : '') + '</textarea></div>' +
          '<div class="wide-input-row">' +
          '<div class="field"><label>Selling price (\u20b1)</label><input id="pd-price" type="number" min="0" step="0.01" value="' + (editing ? editing.price : '') + '" required></div>' +
          '<div class="field"><label>Stock quantity</label><input id="pd-stock" type="number" min="0" step="1" value="' + (editing !== null ? editing.stock : '') + '" required></div>' +
          '</div>' +
          '<div class="field"><label>Availability</label><select id="pd-status">' +
          '<option value="available" ' + ((!editing || editing.status === 'available') ? 'selected' : '') + '>Available for order</option>' +
          '<option value="unavailable" ' + ((editing && editing.status === 'unavailable') ? 'selected' : '') + '>Mark as unavailable</option>' +
          '</select></div>' +
          '<button type="submit" class="btn btn-primary btn-block">' + (editing ? ICON.check + ' Save changes' : ICON.plus + ' Add product') + '</button>' +
          '</form>' +
          '</div>' +
          '</div>' +
          '</div>';
      }
