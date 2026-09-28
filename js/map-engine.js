/* ================= REALTIME MAP & ROUTING ENGINE ================= */
// Map instances and timers (prevents container re-init crashes)
      var activeMaps = {
        checkout: null,
        customerTracking: null,
        adminDeliveries: null,
        adminOrderModal: null
      };
      var trackingTimers = {};

      function destroyMap(key) {
        if (trackingTimers[key]) {
          clearInterval(trackingTimers[key]);
          trackingTimers[key] = null;
        }
        if (activeMaps[key]) {
          try {
            if (activeMaps[key].stopLocate) activeMaps[key].stopLocate();
            activeMaps[key].remove();
          } catch (e) { }
          activeMaps[key] = null;
        }
      }

      function calcDistanceKm(lat1, lon1, lat2, lon2) {
        var R = 6371;
        var dLat = (lat2 - lat1) * Math.PI / 180;
        var dLon = (lon2 - lon1) * Math.PI / 180;
        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      }

      // Get non-overlapping, deterministic coordinates for ANY order (guarantees multi-buyer concurrency without clashing)
      function getOrderCoords(order) {
        if (order && order.delivery && typeof order.delivery.lat === 'number' && typeof order.delivery.lng === 'number' && !isNaN(order.delivery.lat) && !isNaN(order.delivery.lng)) {
          return { lat: order.delivery.lat, lng: order.delivery.lng };
        }
        return null;
      }

      function createStoreIcon() {
        return L.divIcon({
          className: 'leaflet-store-marker',
          html: '<div class="store-pin-inner"><span class="store-emoji">🏪</span><span class="store-label">NelGlenn\'s</span></div>',
          iconSize: [130, 44],
          iconAnchor: [65, 44],
          popupAnchor: [0, -44]
        });
      }

      function createCustomerIcon(name, orderNumber, isCurrent) {
        var initials = (name || 'Buyer').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
        var display = esc((name || 'Customer').trim().split(/\s+/)[0]);
        if (orderNumber) display += ' #' + esc(orderNumber.slice(-4));
        return L.divIcon({
          className: 'leaflet-customer-marker' + (isCurrent ? ' current-buyer' : ''),
          html: '<div class="cust-pin-inner"><div class="cust-pulse"></div><div class="cust-badge">' + esc(initials) + '</div><div class="cust-name" title="' + esc(name || 'Customer') + '">' + display + '</div></div>',
          iconSize: [130, 58],
          iconAnchor: [65, 58],
          popupAnchor: [0, -58]
        });
      }

      function createRiderIcon(orderNumber) {
        return L.divIcon({
          className: 'leaflet-rider-marker',
          html: '<div class="rider-pin-inner"><div class="rider-pulse"></div><span>🛵</span><span>Courier ' + (orderNumber ? esc(orderNumber.slice(-4)) : '') + '</span></div>',
          iconSize: [110, 36],
          iconAnchor: [55, 36],
          popupAnchor: [0, -36]
        });
      }

/* ================= REALTIME MAP & ROUTING ENGINE (React + Leaflet + OpenStreetMap + OSRM + Firebase) ================= */

      function createOsmTileLayer() {
        return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        });
      }

      var OSRM_CACHE = {};
      function fetchOSRMRoute(startLat, startLng, endLat, endLng, callback) {
        var key = [startLat.toFixed(5), startLng.toFixed(5), endLat.toFixed(5), endLng.toFixed(5)].join(';');
        if (OSRM_CACHE[key]) {
          callback(OSRM_CACHE[key]);
          return;
        }
        var url = 'https://router.project-osrm.org/route/v1/driving/' +
          startLng + ',' + startLat + ';' + endLng + ',' + endLat +
          '?overview=full&geometries=geojson';
        fetch(url)
          .then(function (res) { return res.json(); })
          .then(function (data) {
            if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
              var r = data.routes[0];
              var latLngs = r.geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
              var routeInfo = {
                latLngs: latLngs,
                distanceMeters: r.distance,
                distanceKm: r.distance / 1000,
                durationSec: r.duration,
                etaMinutes: Math.max(1, Math.ceil(r.duration / 60))
              };
              OSRM_CACHE[key] = routeInfo;
              callback(routeInfo);
            } else {
              throw new Error('No OSRM route found');
            }
          })
          .catch(function (err) {
            console.warn('Road route unavailable:', err);
            callback(null);
          });
      }

      /* ================= FIREBASE REALTIME LOCATION SHARING ================= */
      /* Delivery rider: 📱 GPS → Firebase Realtime Database → Customer */

      function publishRiderLocation(orderId, locData) {
        var payload = {
          orderId: orderId,
          latitude: locData.lat,
          longitude: locData.lng,
          lat: locData.lat,
          lng: locData.lng,
          accuracy: locData.accuracy || null,
          speed: locData.speed || null,
          heading: locData.heading || null,
          timestamp: locData.timestamp || new Date().toISOString(),
          riderName: locData.riderName || 'Store courier',
          status: locData.status || 'in_transit'
        };

        // 1. Firebase Realtime Database
        if (fbRtdb) {
          try {
            fbRtdb.ref('deliveries/' + orderId).set(payload).catch(function (err) {
              console.warn("[Firebase RTDB] write notice:", err.message);
            });
            fbRtdb.ref('rider_locations/' + orderId).set(payload).catch(function () { });
          } catch (e) { }
        }

        // 2. Cloud Firestore
        if (firestoreDb) {
          try {
            firestoreDb.collection('rider_locations').doc(orderId).set(payload, { merge: true }).catch(function (err) {
              console.warn("[Firestore] rider location write:", err.message);
            });
          } catch (e) { }
        }

        // 3. Local BroadcastChannel for instant inter-tab communication
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            if (!window.sstRiderChannel) window.sstRiderChannel = new BroadcastChannel('sst_rider_gps');
            window.sstRiderChannel.postMessage({
              orderId: orderId,
              coords: payload
            });
          }
        } catch (e) { }

        // 4. LocalStorage
        try {
          localStorage.setItem('sst_rider_loc_' + orderId, JSON.stringify(payload));
        } catch (e) { }
      }

      function subscribeToRiderLocation(orderId, callback) {
        var unsubs = [];
        var latestTimestamp = 0;
        function emitLatest(loc) {
          if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
          var timestamp = Date.parse(loc.timestamp);
          if (!Number.isFinite(timestamp) || timestamp <= latestTimestamp) return;
          latestTimestamp = timestamp;
          callback(loc);
        }

        // 1. Firebase Realtime Database
        if (fbRtdb) {
          try {
            var rtdbRef = fbRtdb.ref('deliveries/' + orderId);
            var rtdbHandler = function (snap) {
              var val = snap.val();
              if (val && typeof val.latitude === 'number' && typeof val.longitude === 'number') {
                emitLatest({
                  lat: val.latitude,
                  lng: val.longitude,
                  speed: val.speed,
                  heading: val.heading,
                  accuracy: val.accuracy,
                  timestamp: val.timestamp,
                  isSimulation: val.isSimulation,
                  riderName: val.riderName,
                  source: 'Firebase Realtime Database'
                });
              }
            };
            rtdbRef.on('value', rtdbHandler);
            unsubs.push(function () { rtdbRef.off('value', rtdbHandler); });
          } catch (e) { }
        }

        // 2. Cloud Firestore Real-time listener
        if (firestoreDb) {
          try {
            var unsubFs = firestoreDb.collection('rider_locations').doc(orderId)
              .onSnapshot(function (doc) {
                if (doc.exists) {
                  var d = doc.data();
                  if (d && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
                    emitLatest({
                      lat: d.latitude,
                      lng: d.longitude,
                      speed: d.speed,
                      heading: d.heading,
                      accuracy: d.accuracy,
                      timestamp: d.timestamp,
                      isSimulation: d.isSimulation,
                      riderName: d.riderName,
                      source: 'Cloud Firestore'
                    });
                  }
                }
              }, function (err) { });
            unsubs.push(unsubFs);
          } catch (e) { }
        }

        // 3. BroadcastChannel listener
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            if (!window.sstRiderChannel) window.sstRiderChannel = new BroadcastChannel('sst_rider_gps');
            var bcHandler = function (e) {
              if (e.data && e.data.orderId === orderId && e.data.coords) {
                emitLatest(Object.assign({}, e.data.coords, { source: 'BroadcastChannel' }));
              }
            };
            window.sstRiderChannel.addEventListener('message', bcHandler);
            unsubs.push(function () {
              if (window.sstRiderChannel) window.sstRiderChannel.removeEventListener('message', bcHandler);
            });
          }
        } catch (e) { }

        // 4. Initial cached location
        try {
          var cached = localStorage.getItem('sst_rider_loc_' + orderId);
          if (cached) {
            var parsed = JSON.parse(cached);
            if (parsed && Number.isFinite(parsed.lat) && Number.isFinite(parsed.lng)) {
              emitLatest(Object.assign({}, parsed, { source: 'Local Cache' }));
            }
          }
        } catch (e) { }

        return function () {
          unsubs.forEach(function (fn) {
            try { fn(); } catch (e) { }
          });
        };
      }

      function hasStoreGps(store) {
        return !!(store && store.isActualGps && Number.isFinite(store.lat) && Number.isFinite(store.lng));
      }

      function isRecentLocation(loc) {
        if (!loc || loc.isSimulation || /Road Sim/i.test(loc.riderName || '') || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return false;
        var time = Date.parse(loc.timestamp);
        return Number.isFinite(time) && time <= Date.now() + 30000 && Date.now() - time <= 120000;
      }

      var activeRiderWatchId = null;
      var activeRiderWatchingOrderId = null;

      function startRiderDeviceGps(orderId) {
        var order = getOrders().filter(function (o) { return o.id === orderId; })[0];
        if (!order || order.status !== 'Out for Delivery') {
          toast('Mark the order Out for Delivery before sharing rider GPS.');
          return false;
        }
        if (!navigator.geolocation) {
          toast('Geolocation is not supported on this device.');
          return false;
        }
        stopRiderDeviceGps();
        activeRiderWatchingOrderId = orderId;
        activeRiderWatchId = navigator.geolocation.watchPosition(function (pos) {
          if (pos.coords.accuracy > 200) return;
          var loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : null,
            heading: pos.coords.heading || null,
            accuracy: Math.round(pos.coords.accuracy || 10),
            timestamp: new Date().toISOString(),
            isLivePhoneGps: true,
            riderName: "Express Courier (Phone GPS)"
          };
          publishRiderLocation(orderId, loc);
        }, function (err) {
          console.warn("[Rider Phone GPS] watch error:", err);
          if (err && err.code === 1) { // PERMISSION_DENIED
            toast('Rider GPS permission denied. Please allow location in your browser settings.');
            stopRiderDeviceGps();
          } else {
            console.warn("[Rider Phone GPS] Temporary signal drop or timeout, maintaining watch stream.");
          }
        }, {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 10000
        });
        toast('📱 Phone GPS streaming active for Order ' + (orderId ? orderId.slice(-4) : ''));
        return true;
      }

      function stopRiderDeviceGps() {
        if (activeRiderWatchId !== null) {
          navigator.geolocation.clearWatch(activeRiderWatchId);
          activeRiderWatchId = null;
          activeRiderWatchingOrderId = null;
          toast('Rider GPS streaming stopped.');
        }
      }

      /* ================= REACT + LEAFLET COMPONENTS ================= */
      var h = React.createElement;

      function LiveCustomerTrackingReact(props) {
        var order = props.order;
        var store = getStoreLocation();
        var custCoords = getOrderCoords(order);
        if (!custCoords) return h('div', { className: 'card' }, 'This order has no saved drop-off pin. Ask the customer to provide their actual location.');

        var _r = React.useState(null);
        var riderLoc = _r[0];
        var setRiderLoc = _r[1];

        var _rt = React.useState(null);
        var routeInfo = _rt[0];
        var setRouteInfo = _rt[1];

        var mapElRef = React.useRef(null);
        var mapInstanceRef = React.useRef(null);
        var riderMarkerRef = React.useRef(null);
        var routeLineRef = React.useRef(null);
        var lastRiderRouteRef = React.useRef(0);

        // 1. Fetch OSRM Road Route
        React.useEffect(function () {
          if (!hasStoreGps(store)) return;
          var routeActive = true;
          fetchOSRMRoute(store.lat, store.lng, custCoords.lat, custCoords.lng, function (info) {
            if (routeActive && info) setRouteInfo(Object.assign({}, info, { source: 'store' }));
          });
          return function () { routeActive = false; };
        }, [store.lat, store.lng, custCoords.lat, custCoords.lng]);

        // 2. Initialize Leaflet Map with OpenStreetMap
        React.useEffect(function () {
          if (!mapElRef.current || typeof L === 'undefined') return;

          var map = L.map(mapElRef.current, {
            zoomControl: false,
            attributionControl: false
          });
          L.control.zoom({ position: 'bottomright' }).addTo(map);

          createOsmTileLayer().addTo(map);

          // Store Marker (Admin actual store GPS)
          if (hasStoreGps(store)) L.marker([store.lat, store.lng], { icon: createStoreIcon() }).addTo(map)
            .bindPopup('<b>' + esc(store.name) + '</b><br>Store GPS location');

          // Customer Marker (Customer actual drop-off GPS)
          var custMarker = L.marker([custCoords.lat, custCoords.lng], {
            icon: createCustomerIcon(order.delivery.fullName, order.orderNumber, true)
          }).addTo(map);
          custMarker.bindPopup('<b>Customer Drop-off</b><br>' + esc(order.delivery.houseStreet) + ', ' + esc(order.delivery.barangay));

          if (hasStoreGps(store)) map.fitBounds([[store.lat, store.lng], [custCoords.lat, custCoords.lng]], {
            padding: [80, 80], maxZoom: 16
          });
          else map.setView([custCoords.lat, custCoords.lng], 15);

          mapInstanceRef.current = map;

          return function () {
            try { map.remove(); } catch (e) { }
            mapInstanceRef.current = null;
            riderMarkerRef.current = null;
            routeLineRef.current = null;
          };
        }, [store.lat, store.lng, custCoords.lat, custCoords.lng]);

        // 3. Draw OSRM turn-by-turn road polyline
        React.useEffect(function () {
          var map = mapInstanceRef.current;
          if (!map || !routeInfo || !routeInfo.latLngs) return;

          if (routeLineRef.current) {
            map.removeLayer(routeLineRef.current);
            routeLineRef.current = null;
          }

          var polyline = L.polyline(routeInfo.latLngs, {
            color: '#2DA56E',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: order.status === 'Out for Delivery' ? '8, 8' : null
          }).addTo(map);

          routeLineRef.current = polyline;

          if (routeInfo.latLngs.length > 1) {
            map.fitBounds(polyline.getBounds(), { padding: [80, 80], maxZoom: 16 });
          }
        }, [routeInfo, order.status]);

        // 4. Real-time Rider Location Subscription (Firebase Realtime Database / Firestore / BroadcastChannel)
        React.useEffect(function () {
          var unsub = subscribeToRiderLocation(order.id, function (loc) {
            if (!isRecentLocation(loc)) return;
            setRiderLoc(loc);
            if (order.status === 'Out for Delivery' && Date.now() - lastRiderRouteRef.current > 15000) {
              lastRiderRouteRef.current = Date.now();
              fetchOSRMRoute(loc.lat, loc.lng, custCoords.lat, custCoords.lng, function (info) {
                if (info) setRouteInfo(Object.assign({}, info, { source: 'rider' }));
              });
            }
            var map = mapInstanceRef.current;
            if (!map) return;

            if (!riderMarkerRef.current) {
              var rm = L.marker([loc.lat, loc.lng], { icon: createRiderIcon(order.orderNumber) }).addTo(map);
              rm.bindPopup('🛵 <b>Courier on the way</b><br>' + (loc.speed ? loc.speed + ' km/h' : 'Live'));
              riderMarkerRef.current = rm;
            } else {
              riderMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            }
          });
          var freshnessTimer = setInterval(function () {
            setRiderLoc(function (current) {
              if (current && Date.now() - Date.parse(current.timestamp) > 120000) {
                if (riderMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(riderMarkerRef.current);
                riderMarkerRef.current = null;
                return null;
              }
              return current;
            });
          }, 15000);

          return function () {
            clearInterval(freshnessTimer);
            if (unsub) unsub();
            if (riderMarkerRef.current && mapInstanceRef.current) {
              try { mapInstanceRef.current.removeLayer(riderMarkerRef.current); } catch (e) { }
              riderMarkerRef.current = null;
            }
          };
        }, [order.id, order.status]);

        var isOut = (order.status === 'Out for Delivery');
        var remainingDistKm = routeInfo ? routeInfo.distanceKm : null;
        var distStr = remainingDistKm === null ? '' : (remainingDistKm < 1 ? Math.round(remainingDistKm * 1000) + ' m' : remainingDistKm.toFixed(2) + ' km');
        var etaStr = isOut ? (riderLoc && routeInfo && routeInfo.source === 'rider' ? '~' + routeInfo.etaMinutes + ' min road ETA' : 'Waiting for rider route') : (order.status === 'Preparing' ? 'Prepping Order' : 'Confirmed');

        var recenter = function () {
          if (mapInstanceRef.current) {
            if (riderMarkerRef.current && custCoords) {
              mapInstanceRef.current.fitBounds([
                riderMarkerRef.current.getLatLng(),
                [custCoords.lat, custCoords.lng]
              ], { padding: [80, 80] });
            } else if (hasStoreGps(store)) {
              mapInstanceRef.current.fitBounds([
                [store.lat, store.lng],
                [custCoords.lat, custCoords.lng]
              ], { padding: [80, 80] });
            } else {
              mapInstanceRef.current.setView([custCoords.lat, custCoords.lng], 15);
            }
          }
        };

        var routeOrigin = riderLoc || (hasStoreGps(store) ? store : null);
        var customerMapsUrl = routeOrigin ? 'https://www.google.com/maps/dir/?api=1&origin=' +
          routeOrigin.lat + ',' + routeOrigin.lng + '&destination=' + custCoords.lat + ',' + custCoords.lng +
          '&travelmode=driving' : '';

        return h('div', { className: 'card live-tracking-card' },
          h('div', { className: 'tracking-eta-box' },
            h('div', { className: 'eta-left' },
              h('div', { className: 'eta-status' },
                isOut ? h('span', null, '🛵 Courier in Transit (Real-Time GPS)') :
                  (order.status === 'Preparing' ? '🔥 Being Prepared in Store' : '📍 Drop-off Pin Locked')
              ),
              h('div', { className: 'eta-time', id: 'tracking-eta-time' }, etaStr)
            ),
            h('div', { className: 'eta-dist', id: 'tracking-eta-dist' },
              h('div', { style: { fontWeight: '800', fontSize: '14px' } }, routeInfo && (!isOut || (riderLoc && routeInfo.source === 'rider')) ? distStr + ' road route' : 'Route unavailable'),
              h('div', { style: { fontSize: '11px', color: 'var(--ink-500)', marginTop: '2px' } },
                riderLoc ? (h('span', { style: { color: 'var(--green-600)', fontWeight: '700' } }, '● Live GPS Active ' + (riderLoc.speed ? '(' + riderLoc.speed + ' km/h)' : ''))) :
                  (routeInfo ? 'Road route from confirmed store GPS' : (store.isActualGps ? 'Road route unavailable' : 'Waiting for admin to set store GPS'))
              )
            )
          ),
          h('div', {
            ref: mapElRef,
            className: 'map-box customer-tracking-view',
            style: { height: '300px' }
          }),
          h('div', { className: 'tracking-meta-strip' },
            h('span', { className: 'cloud-badge-tag' }, '🗺️ OpenStreetMap & OSRM Routing'),
            h('span', { className: 'cloud-badge-tag' }, '📡 Firebase Realtime Database')
          ),
          h('div', { className: 'tracking-actions', style: { marginTop: '10px' } },
            h('button', { className: 'btn btn-outline btn-sm', type: 'button', onClick: recenter }, '🎯 Center on Route'),
            customerMapsUrl ? h('a', { className: 'btn btn-outline btn-sm', href: customerMapsUrl, target: '_blank', rel: 'noopener noreferrer' }, 'Open Route') : null,
            h('a', { className: 'btn btn-outline btn-sm', href: 'tel:09171234567' }, '📞 Call Store Owner')
          )
        );
      }

      function AdminDispatchRadarReact(props) {
        var orders = props.orders || [];
        var store = getStoreLocation();

        var _st = React.useState(activeRiderWatchingOrderId);
        var activeStreamingOrderId = _st[0];
        var setActiveStreamingOrderId = _st[1];

        var _rp = React.useState({});
        var riderPositions = _rp[0];
        var setRiderPositions = _rp[1];

        // Track which order is selected for navigation
        var _sel = React.useState(state.selectedDeliveryOrderId || null);
        var selectedOrderId = _sel[0];
        var setSelectedOrderId = _sel[1];

        // Track route info for display
        var _ri = React.useState(null);
        var selectedRouteInfo = _ri[0];
        var setSelectedRouteInfo = _ri[1];

        var mapElRef = React.useRef(null);
        var mapInstanceRef = React.useRef(null);
        var riderMarkersRef = React.useRef({});
        var customerMarkersRef = React.useRef({});
        var routePolylinesRef = React.useRef({});
        var storeMarkerRef = React.useRef(null);
        var orderSignature = orders.map(function (o) {
          var c = getOrderCoords(o);
          return [o.id, o.status, c ? c.lat : '', c ? c.lng : ''].join(':');
        }).join('|');

        // Initialize Map
        React.useEffect(function () {
          if (!mapElRef.current || typeof L === 'undefined') return;

          var map = L.map(mapElRef.current, {
            zoomControl: false,
            attributionControl: false
          });
          L.control.zoom({ position: 'bottomright' }).addTo(map);

          createOsmTileLayer().addTo(map);

          // Store marker (Admin's actual store location)
          if (hasStoreGps(store)) {
            storeMarkerRef.current = L.marker([store.lat, store.lng], { icon: createStoreIcon() }).addTo(map)
              .bindPopup('<b>' + esc(store.name) + '</b><br>Admin GPS location');
          }

          var allPoints = hasStoreGps(store) ? [[store.lat, store.lng]] : [];

          // Plot each active order as a customer marker (no routes drawn yet)
          orders.forEach(function (o) {
            var c = getOrderCoords(o);
            if (!c) return;
            allPoints.push([c.lat, c.lng]);

            var cm = L.marker([c.lat, c.lng], {
              icon: createCustomerIcon(o.delivery.fullName, o.orderNumber, o.status === 'Out for Delivery'),
              opacity: 0.7
            }).addTo(map);

            var distKm = hasStoreGps(store) ? calcDistanceKm(store.lat, store.lng, c.lat, c.lng) : null;
            var distStr = distKm === null ? 'distance unavailable' : (distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(2) + ' km');

            var popupHtml = '' +
              '<div style="min-width:180px;">' +
              '<div style="font-weight:800;font-size:13px;color:var(--green-900);">' + esc(o.orderNumber) + '</div>' +
              '<div style="font-weight:700;font-size:12.5px;margin-top:2px;">' + esc(o.delivery.fullName) + ' &middot; ' + distStr + ' away</div>' +
              '<div style="font-size:11.5px;color:#555;margin-top:2px;">' + esc(o.delivery.houseStreet + ', ' + o.delivery.barangay) + '</div>' +
              '<div style="font-size:11.5px;color:#555;">📞 ' + esc(o.delivery.phone) + '</div>' +
              '<div style="font-size:12px;font-weight:700;margin-top:4px;">Total: ' + peso(o.total) + ' &middot; <span class="status-badge ' + statusClass(o.status) + '" style="font-size:10px;">' + esc(o.status) + '</span></div>' +
              '<div style="margin-top:8px;display:flex;gap:6px;">' +
              '<button class="btn btn-primary btn-sm" style="font-size:11px;padding:4px 8px;" onclick="App.openOrderModal(\'' + o.id + '\')">Details</button>' +
              (o.status === 'Preparing' ? '<button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;" onclick="App.advanceStatus(\'' + o.id + '\',\'Out for Delivery\')">Dispatch 🛵</button>' : '') +
              (o.status === 'Out for Delivery' ? '<button class="btn btn-outline btn-sm" style="font-size:11px;padding:4px 8px;" onclick="App.advanceStatus(\'' + o.id + '\',\'Delivered\')">Delivered ✓</button>' : '') +
              '</div>' +
              '</div>';
            cm.bindPopup(popupHtml);

            // Store the marker reference for later highlighting
            customerMarkersRef.current[o.id] = cm;

            // Clicking a customer marker on the map also selects that order
            cm.on('click', function () {
              state.selectedDeliveryOrderId = o.id;
              setSelectedOrderId(o.id);
            });
          });

          if (allPoints.length > 1) {
            map.fitBounds(allPoints, { padding: [80, 80], maxZoom: 16 });
          } else if (allPoints.length === 1) {
            map.setView(allPoints[0], 15);
          } else {
            map.setView([14.5995, 120.9842], 14);
          }

          mapInstanceRef.current = map;

          return function () {
            try { map.remove(); } catch (e) { }
            mapInstanceRef.current = null;
            riderMarkersRef.current = {};
            customerMarkersRef.current = {};
            routePolylinesRef.current = {};
            storeMarkerRef.current = null;
          };
        }, [store.lat, store.lng, orderSignature]);

        // When selectedOrderId changes, fetch and draw the route for ONLY that order
        React.useEffect(function () {
          var map = mapInstanceRef.current;
          if (!map) return;
          var routeActive = true;

          // Remove all existing route polylines
          Object.keys(routePolylinesRef.current).forEach(function (key) {
            try { map.removeLayer(routePolylinesRef.current[key]); } catch (e) { }
          });
          routePolylinesRef.current = {};

          // Dim all customer markers, then highlight selected
          Object.keys(customerMarkersRef.current).forEach(function (oid) {
            var m = customerMarkersRef.current[oid];
            if (m) m.setOpacity(selectedOrderId ? (oid === selectedOrderId ? 1.0 : 0.4) : 0.7);
          });

          if (!selectedOrderId) {
            setSelectedRouteInfo(null);
            // Fit all points when nothing is selected
            var allPts = hasStoreGps(store) ? [[store.lat, store.lng]] : [];
            orders.forEach(function (o) {
              var c = getOrderCoords(o);
              if (c) allPts.push([c.lat, c.lng]);
            });
            if (allPts.length > 1) map.fitBounds(allPts, { padding: [80, 80], maxZoom: 16 });
            return function () { routeActive = false; };
          }

          var selectedOrder = orders.filter(function (o) { return o.id === selectedOrderId; })[0];
          if (!selectedOrder) {
            state.selectedDeliveryOrderId = null;
            setSelectedOrderId(null);
            return function () { routeActive = false; };
          }

          var coords = getOrderCoords(selectedOrder);
          if (!coords || !hasStoreGps(store)) {
            setSelectedRouteInfo(null);
            return function () { routeActive = false; };
          }

          // Fetch and draw OSRM road route for this single order
          fetchOSRMRoute(store.lat, store.lng, coords.lat, coords.lng, function (rInfo) {
            if (!routeActive || !mapInstanceRef.current || !rInfo) return;

            // Draw the actual road route polyline (solid green, thick)
            var routeLine = L.polyline(rInfo.latLngs, {
              color: '#1A6B49',
              weight: 6,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(mapInstanceRef.current);

            // Also draw a semi-transparent wider "glow" behind the route
            var routeGlow = L.polyline(rInfo.latLngs, {
              color: '#2DA56E',
              weight: 12,
              opacity: 0.25,
              lineCap: 'round',
              lineJoin: 'round'
            }).addTo(mapInstanceRef.current);
            routeGlow.bringToBack();

            routePolylinesRef.current['glow'] = routeGlow;
            routePolylinesRef.current[selectedOrderId] = routeLine;

            // Zoom to fit the route
            if (rInfo.latLngs.length > 1) {
              mapInstanceRef.current.fitBounds(routeLine.getBounds(), { padding: [80, 80], maxZoom: 16 });
            }

            // Update route info for the info bar
            setSelectedRouteInfo({
              distanceKm: rInfo.distanceKm,
              etaMinutes: rInfo.etaMinutes,
              orderNumber: selectedOrder.orderNumber,
              customerName: selectedOrder.delivery.fullName,
              address: selectedOrder.delivery.houseStreet + ', ' + selectedOrder.delivery.barangay
            });
          });

          // Also open the customer marker popup
          if (customerMarkersRef.current[selectedOrderId]) {
            customerMarkersRef.current[selectedOrderId].openPopup();
          }
          return function () { routeActive = false; };
        }, [selectedOrderId, orderSignature, store.lat, store.lng]);

        // Subscribe to live rider updates for all active orders
        React.useEffect(function () {
          var unsubs = [];
          orders.forEach(function (o) {
            var unsub = subscribeToRiderLocation(o.id, function (loc) {
              if (!isRecentLocation(loc)) return;
              setRiderPositions(function (prev) {
                var next = Object.assign({}, prev);
                next[o.id] = loc;
                return next;
              });

              var map = mapInstanceRef.current;
              if (!map) return;

              if (!riderMarkersRef.current[o.id]) {
                var rm = L.marker([loc.lat, loc.lng], { icon: createRiderIcon(o.orderNumber) }).addTo(map);
                rm.bindPopup('🛵 <b>Courier for ' + esc(o.delivery.fullName) + '</b><br>' + esc(o.orderNumber) + (loc.speed ? '<br>' + loc.speed + ' km/h' : ''));
                riderMarkersRef.current[o.id] = rm;
              } else {
                riderMarkersRef.current[o.id].setLatLng([loc.lat, loc.lng]);
              }
            });
            unsubs.push(unsub);
          });
          var freshnessTimer = setInterval(function () {
            setRiderPositions(function (previous) {
              var next = Object.assign({}, previous);
              Object.keys(next).forEach(function (orderId) {
                if (!isRecentLocation(next[orderId])) {
                  delete next[orderId];
                  if (riderMarkersRef.current[orderId] && mapInstanceRef.current) {
                    mapInstanceRef.current.removeLayer(riderMarkersRef.current[orderId]);
                    delete riderMarkersRef.current[orderId];
                  }
                }
              });
              return next;
            });
          }, 15000);

          return function () {
            clearInterval(freshnessTimer);
            unsubs.forEach(function (u) { if (u) u(); });
          };
        }, [orderSignature]);

        var handleSetStoreGps = function () {
          App.updateStoreToActualGps();
        };

        var handleTogglePhoneGps = function (orderId) {
          if (activeStreamingOrderId === orderId) {
            stopRiderDeviceGps();
            setActiveStreamingOrderId(null);
          } else {
            var started = startRiderDeviceGps(orderId);
            if (started) setActiveStreamingOrderId(orderId);
          }
        };

        var handleSelectOrder = function (orderId) {
          setSelectedOrderId(function (prev) {
            state.selectedDeliveryOrderId = prev === orderId ? null : orderId;
            return state.selectedDeliveryOrderId;
          });
        };

        // Navigation info bar (shows when an order is selected)
        var navInfoBar = null;
        if (selectedOrderId && selectedRouteInfo) {
          var gmapsUrl = '';
          var selOrder = orders.filter(function (o) { return o.id === selectedOrderId; })[0];
          var selCoords = selOrder ? getOrderCoords(selOrder) : null;
          if (selCoords && hasStoreGps(store)) {
            gmapsUrl = 'https://www.google.com/maps/dir/?api=1&origin=' + store.lat + ',' + store.lng + '&destination=' + selCoords.lat + ',' + selCoords.lng + '&travelmode=driving';
          }
          navInfoBar = h('div', { className: 'nav-info-bar' },
            h('div', { className: 'nav-info-route' },
              h('div', { className: 'nav-info-icon' }, '🧭'),
              h('div', { className: 'nav-info-details' },
                h('div', { className: 'nav-info-title' }, 'Navigation to ' + selectedRouteInfo.customerName),
                h('div', { className: 'nav-info-subtitle' }, selectedRouteInfo.address)
              ),
              h('div', { className: 'nav-info-stats' },
                h('div', { className: 'nav-stat' },
                  h('span', { className: 'nav-stat-value' }, selectedRouteInfo.distanceKm < 1 ? Math.round(selectedRouteInfo.distanceKm * 1000) + 'm' : selectedRouteInfo.distanceKm.toFixed(1) + ' km'),
                  h('span', { className: 'nav-stat-label' }, 'Distance')
                ),
                h('div', { className: 'nav-stat' },
                  h('span', { className: 'nav-stat-value' }, '~' + selectedRouteInfo.etaMinutes + ' min'),
                  h('span', { className: 'nav-stat-label' }, 'ETA')
                )
              )
            ),
            h('div', { className: 'nav-info-actions' },
              gmapsUrl ? h('a', {
                href: gmapsUrl,
                target: '_blank',
                rel: 'noopener noreferrer',
                className: 'btn btn-primary btn-sm',
                style: { fontSize: '12px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }
              }, '🗺️ Open in Google Maps') : null,
              h('button', {
                className: 'btn btn-outline btn-sm',
                type: 'button',
                style: { fontSize: '12px', padding: '6px 14px' },
                onClick: function () { state.selectedDeliveryOrderId = null; setSelectedOrderId(null); }
              }, '✕ Clear Route')
            )
          );
        }

        return h('div', { className: 'admin-radar-card' },
          h('div', { className: 'admin-radar-head' },
            h('div', null,
              h('h3', { style: { fontSize: '16px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' } },
                h('span', { className: 'radar-ping' }),
                'Live Multi-Buyer Dispatch Radar'
              ),
              h('p', { style: { fontSize: '12.5px', color: 'var(--ink-500)', marginTop: '2px' } },
                'Tap an order below to show its road navigation route'
              )
            ),
            h('div', { className: 'radar-badges' },
              h('button', {
                className: 'btn btn-outline btn-sm',
                type: 'button',
                style: { fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' },
                onClick: handleSetStoreGps
              },
                h('span', null, '🎯'),
                store.isActualGps ? 'Store GPS Set ✓' : 'Set Store GPS (while at store)'
              ),
              h('span', { className: 'badge-count' },
                h('span', { className: 'cloud-dot' }),
                ' ' + orders.length + ' Active Deliveries'
              )
            )
          ),
          navInfoBar,
          h('div', {
            ref: mapElRef,
            className: 'map-box admin-radar-map-view',
            style: { height: '420px' }
          }),
          h('div', { className: 'radar-legend', style: { justifyContent: 'space-between', alignItems: 'center' } },
            h('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap' } },
              h('span', null, '🏪 ' + (hasStoreGps(store) ? 'Admin GPS pin' : 'Admin GPS not set')),
              h('span', null, '📍 Active Customer Drop-off'),
              h('span', null, '🛵 Courier in Transit (Live GPS)')
            ),
            h('span', { style: { fontSize: '11px', color: 'var(--ink-400)' } }, 'Tap an order to show route')
          ),
          orders.length > 0 ? h('div', { className: 'delivery-order-selector' },
            h('div', { style: { fontSize: '12.5px', fontWeight: '800', marginBottom: '8px', color: 'var(--ink-700)', display: 'flex', alignItems: 'center', gap: '8px' } },
              '🧭 Select an order to navigate',
              selectedOrderId ? h('span', { style: { fontSize: '11px', color: 'var(--green-600)', fontWeight: '600' } }, '● Route active') : null
            ),
            h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
              orders.map(function (o) {
                var isSelected = (selectedOrderId === o.id);
                var isStreaming = (activeStreamingOrderId === o.id);
                var pos = riderPositions[o.id];
                var c = getOrderCoords(o);
                var distKm = c && hasStoreGps(store) ? calcDistanceKm(store.lat, store.lng, c.lat, c.lng) : null;
                var distStr = distKm !== null ? (distKm < 1 ? Math.round(distKm * 1000) + 'm' : distKm.toFixed(1) + ' km') : 'No GPS';

                return h('div', {
                  key: o.id,
                  className: 'delivery-nav-ticket' + (isSelected ? ' selected' : ''),
                  onClick: function () { handleSelectOrder(o.id); },
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: isSelected ? 'var(--green-50, rgba(45,165,110,0.1))' : 'var(--surface-2)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid var(--green-500)' : '2px solid transparent',
                    transition: 'all 0.2s ease'
                  }
                },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '1' } },
                    h('div', {
                      style: {
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: isSelected ? 'var(--green-600)' : 'var(--surface-3, rgba(255,255,255,0.1))',
                        color: isSelected ? '#fff' : 'var(--ink-600)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                        fontWeight: '800',
                        transition: 'all 0.2s ease',
                        flexShrink: '0'
                      }
                    }, isSelected ? '🧭' : '📍'),
                    h('div', { style: { flex: '1', minWidth: '0' } },
                      h('div', { style: { fontWeight: '700', fontSize: '13px', color: isSelected ? 'var(--green-700, #1A6B49)' : 'var(--ink-800)' } },
                        o.orderNumber + ' · ' + o.delivery.fullName
                      ),
                      h('div', { style: { fontSize: '11px', color: 'var(--ink-500)', marginTop: '2px' } },
                        o.delivery.houseStreet + ', ' + o.delivery.barangay,
                        ' · ',
                        h('strong', null, distStr)
                      )
                    )
                  ),
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: '0' } },
                    h('span', {
                      className: 'status-badge ' + statusClass(o.status),
                      style: { fontSize: '10px' }
                    }, esc(o.status)),
                    pos ? h('span', { style: { color: 'var(--green-600)', fontWeight: '600', fontSize: '11px' } },
                      '● ' + (pos.speed ? pos.speed + ' km/h' : 'Live')
                    ) : null,
                    o.status === 'Out for Delivery' ? h('button', {
                      className: 'btn ' + (isStreaming ? 'btn-danger' : 'btn-outline') + ' btn-sm',
                      style: { fontSize: '10px', padding: '3px 8px' },
                      type: 'button',
                      onClick: function (e) { e.stopPropagation(); handleTogglePhoneGps(o.id); }
                    }, isStreaming ? '⏹️ Stop GPS' : '📱 Stream GPS') : null
                  )
                );
              })
            )
          ) : null
        );
      }

      /* ================= CHECKOUT MAP INITIALIZER ================= */
      function initCheckoutMap() {
        var container = document.getElementById('checkout-map');
        if (!container || typeof L === 'undefined') return;
        destroyMap('checkout');

        var user = currentUser();
        var store = getStoreLocation();

        // Adopt pre-detected user coordinates or customer profile coordinates if checkoutCoords is null
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

        var defaultPos = state.checkoutCoords
          ? [state.checkoutCoords.lat, state.checkoutCoords.lng]
          : (hasStoreGps(store) ? [store.lat, store.lng] : [14.5995, 120.9842]);
        var initialZoom = state.checkoutCoords || hasStoreGps(store) ? 16 : 14;

        var map = L.map(container, {
          center: defaultPos,
          zoom: initialZoom,
          zoomControl: false,
          attributionControl: false
        });
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        createOsmTileLayer().addTo(map);

        // Store marker
        if (hasStoreGps(store)) L.marker([store.lat, store.lng], { icon: createStoreIcon() }).addTo(map)
          .bindPopup('<b>' + esc(store.name) + '</b><br>Store GPS location');

        // Draggable customer pin
        var custMarker = L.marker(defaultPos, {
          draggable: true,
          icon: createCustomerIcon(user ? user.fullName : 'Delivery Point', null, true)
        });
        if (state.checkoutCoords) custMarker.addTo(map);

        custMarker.bindPopup('📍 Drag to your exact gate or tap "Detect My GPS"');

        var routeLine = null;
        var routeRequest = 0;
        function updateRoute(destLat, destLng) {
          if (!hasStoreGps(store)) return;
          var request = ++routeRequest;
          fetchOSRMRoute(store.lat, store.lng, destLat, destLng, function (rInfo) {
            if (!activeMaps.checkout || request !== routeRequest) return;
            if (routeLine) {
              activeMaps.checkout.removeLayer(routeLine);
              routeLine = null;
            }
            if (!rInfo) return;
            routeLine = L.polyline(rInfo.latLngs, {
              color: '#2DA56E',
              weight: 4,
              opacity: 0.85,
              dashArray: '6, 6'
            }).addTo(activeMaps.checkout);
          });
        }

        if (state.checkoutCoords) updateRoute(defaultPos[0], defaultPos[1]);

        var accuracyCircle = null;
        if (state.checkoutCoords && state.checkoutCoords.accuracy) {
          accuracyCircle = L.circle(defaultPos, {
            radius: Math.min(100, state.checkoutCoords.accuracy),
            color: '#2DA56E',
            fillColor: '#2DA56E',
            fillOpacity: 0.15,
            weight: 1.5
          }).addTo(map);
        }

        function onPosChange(newLat, newLng, isManual) {
          state.checkoutCoords = {
            lat: newLat,
            lng: newLng,
            accuracy: isManual ? null : (state.checkoutCoords ? state.checkoutCoords.accuracy : null),
            manual: isManual,
            timestamp: new Date().toISOString()
          };
          custMarker.setLatLng([newLat, newLng]);
          if (!map.hasLayer(custMarker)) custMarker.addTo(map);
          if (accuracyCircle && isManual) {
            map.removeLayer(accuracyCircle);
            accuracyCircle = null;
          }
          updateRoute(newLat, newLng);
          updateCheckoutGpsUi();
        }

        custMarker.on('dragend', function (e) {
          var pos = e.target.getLatLng();
          onPosChange(pos.lat, pos.lng, true);
        });

        map.on('click', function (e) {
          onPosChange(e.latlng.lat, e.latlng.lng, true);
        });

        activeMaps.checkout = map;
        activeMaps.checkoutMarker = custMarker;
        activeMaps.checkoutAccuracy = accuracyCircle;
        activeMaps.checkoutUpdateRoute = updateRoute;

        setTimeout(function () {
          if (activeMaps.checkout) activeMaps.checkout.invalidateSize();
        }, 120);
      }

      function updateCheckoutGpsUi() {
        var el = document.getElementById('checkout-gps-status');
        if (!el) return;
        var coords = state.checkoutCoords;
        var store = getStoreLocation();
        if (!coords) {
          el.innerHTML = '<span class="gps-badge-pill searching">📍 Detect GPS or tap the map</span><span>No drop-off location selected</span>';
          return;
        }
        var dist = hasStoreGps(store) ? calcDistanceKm(store.lat, store.lng, coords.lat, coords.lng) : null;
        var distStr = dist === null ? 'Store GPS not set' : (dist < 1 ? Math.round(dist * 1000) + 'm from store' : dist.toFixed(2) + ' km from store');
        if (coords.manual) {
          el.innerHTML = '<span class="gps-badge-pill manual">📍 Pin Set on Map</span><span>' + distStr + ' &middot; ' + coords.lat.toFixed(5) + ', ' + coords.lng.toFixed(5) + '</span>';
        } else {
          var acc = coords.accuracy ? ' (~' + coords.accuracy + 'm accuracy)' : '';
          el.innerHTML = '<span class="gps-badge-pill locked"><span class="cloud-dot"></span> GPS Locked' + acc + '</span><span>' + distStr + '</span>';
        }
      }

      var reactRoots = {
        customerTracking: null,
        adminRadar: null
      };

      function mountCustomerTrackingReact(order) {
        var container = document.getElementById('customer-tracking-react-root');
        if (!container || typeof ReactDOM === 'undefined' || !ReactDOM.createRoot) return;
        if (reactRoots.customerTracking) {
          try { reactRoots.customerTracking.unmount(); } catch (e) { }
          reactRoots.customerTracking = null;
        }
        try {
          reactRoots.customerTracking = ReactDOM.createRoot(container);
          reactRoots.customerTracking.render(React.createElement(LiveCustomerTrackingReact, { order: order }));
        } catch (e) {
          console.error("Failed to mount LiveCustomerTrackingReact:", e);
        }
      }

      function mountAdminRadarReact(orders) {
        var container = document.getElementById('admin-radar-react-root');
        if (!container || typeof ReactDOM === 'undefined' || !ReactDOM.createRoot) return;
        if (reactRoots.adminRadar) {
          try { reactRoots.adminRadar.unmount(); } catch (e) { }
          reactRoots.adminRadar = null;
        }
        try {
          reactRoots.adminRadar = ReactDOM.createRoot(container);
          reactRoots.adminRadar.render(React.createElement(AdminDispatchRadarReact, { orders: orders }));
        } catch (e) {
          console.error("Failed to mount AdminDispatchRadarReact:", e);
        }
      }

      function initAdminOrderModalMap() {
        destroyMap('adminOrderModal');
        var mapEl = document.getElementById('admin-order-modal-map');
        if (!mapEl || typeof L === 'undefined') return;

        var order = getOrders().filter(function (x) { return x.id === state.orderDetailId; })[0];
        if (!order) return;

        var coords = getOrderCoords(order);
        var store = (typeof getStoreLocation === 'function') ? getStoreLocation() : STORE_LOCATION;

        var initialLat = (coords && Number.isFinite(coords.lat)) ? (coords.lat + store.lat) / 2 : store.lat;
        var initialLng = (coords && Number.isFinite(coords.lng)) ? (coords.lng + store.lng) / 2 : store.lng;

        try {
          var map = L.map('admin-order-modal-map', {
            zoomControl: true,
            attributionControl: false
          }).setView([initialLat, initialLng], 14);

          activeMaps.adminOrderModal = map;
          createOsmTileLayer().addTo(map);

          // Add Store Marker
          var storeMarker = L.marker([store.lat, store.lng], { icon: createStoreIcon() }).addTo(map);
          storeMarker.bindPopup('<b>🏪 NelGlenn\'s Store</b><br>Fulfillment Base');

          if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
            // Add Customer Drop-off Marker
            var custMarker = L.marker([coords.lat, coords.lng], {
              icon: createCustomerIcon(order.delivery.fullName, order.orderNumber, true)
            }).addTo(map);
            custMarker.bindPopup('<b>📍 ' + esc(order.delivery.fullName) + '</b><br>' + esc(order.delivery.houseStreet + ', ' + order.delivery.barangay) + '<br><b>Order:</b> ' + esc(order.orderNumber)).openPopup();

            // Fetch and draw road route via OSRM
            fetchOSRMRoute(store.lat, store.lng, coords.lat, coords.lng, function (route) {
              if (route && route.latLngs && activeMaps.adminOrderModal === map) {
                L.polyline(route.latLngs, {
                  color: '#1A6B49',
                  weight: 5,
                  opacity: 0.85,
                  lineJoin: 'round'
                }).addTo(map);

                var distBadge = document.getElementById('modal-map-dist-pill');
                if (distBadge) {
                  distBadge.innerHTML = '🚗 ' + route.distanceKm.toFixed(1) + ' km road &middot; ~' + route.etaMinutes + ' mins drive';
                }
              }
            });

            // Fit bounds to show both store and customer
            map.fitBounds([
              [store.lat, store.lng],
              [coords.lat, coords.lng]
            ], { padding: [80, 80], maxZoom: 16 });
          } else {
            map.setView([store.lat, store.lng], 15);
          }

          setTimeout(function () {
            if (map && activeMaps.adminOrderModal === map) map.invalidateSize();
          }, 150);
        } catch (err) {
          console.error("Failed to init adminOrderModal map:", err);
        }
      }

      function scheduleMapInitialization() {
        setTimeout(function () {
          var user = currentUser();
          if (state.view === 'customer-checkout') {
            initCheckoutMap();
          } else if (state.view === 'customer-order-detail') {
            var o = getOrders().filter(function (x) { return x.id === state.orderDetailId; })[0];
            if (o) mountCustomerTrackingReact(o);
          } else if (state.view === 'admin-order-modal') {
            initAdminOrderModalMap();
          } else if (user && user.role === 'admin' && state.adminSection === 'deliveries') {
            if (!state.adminGpsAttempted) {
              state.adminGpsAttempted = true;
              App.updateStoreToActualGps(true);
            }
            var activeOrders = getOrders().filter(function (o) { return o.status === 'Preparing' || o.status === 'Out for Delivery'; });
            mountAdminRadarReact(activeOrders);
          }
        }, 60);
      }

