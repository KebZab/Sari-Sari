/* ================= GEOLOCATION & REVERSE GEOCODING ENGINE ================= */
var App = window.App = window.App || {};

/* ================= INITIAL LOCATION & REVERSE GEOCODING ENGINE ================= */
      function reverseGeocode(lat, lng, callback) {
        if (typeof fetch === 'undefined') { callback(null); return; }
        try {
          var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&zoom=18&addressdetails=1';
          fetch(url, { headers: { 'Accept': 'application/json' } })
            .then(function (res) { return res.json(); })
            .then(function (data) {
              if (data && data.address) {
                var addr = data.address;
                var barangay = addr.suburb || addr.quarter || addr.neighbourhood || addr.village || addr.city_district || '';
                var road = addr.road || addr.street || addr.building || '';
                var city = addr.city || addr.town || addr.municipality || '';
                var parts = [];
                if (road) parts.push(road);
                if (barangay) parts.push(barangay);
                if (city && city !== barangay) parts.push(city);
                var shortPlace = parts.length > 0 ? parts.join(', ') : (data.display_name ? data.display_name.split(',').slice(0, 2).join(',') : 'Nearby Place');
                callback({
                  placeName: shortPlace,
                  barangay: barangay || city || 'Local Area',
                  street: road || '',
                  fullAddress: data.display_name || shortPlace
                });
              } else {
                callback(null);
              }
            })
            .catch(function (err) {
              console.warn("Reverse geocode notice:", err);
              callback(null);
            });
        } catch (e) {
          callback(null);
        }
      }

      function renderLocationModal() {
        var isLocating = state.locationStatus === 'requesting';
        var hasCoords = !!state.userCoords;
        var place = state.userPlaceName || (hasCoords ? 'GPS: ' + state.userCoords.lat.toFixed(5) + ', ' + state.userCoords.lng.toFixed(5) : '');
        var acc = hasCoords && state.userCoords.accuracy ? ' (~' + state.userCoords.accuracy + 'm accuracy)' : '';

        return '' +
          '<div class="overlay-bg center" style="z-index:9999;" onclick="if(event.target===this) App.dismissLocationModal()">' +
          '<div class="loc-modal-card">' +
          '<div class="loc-icon-bubble">📍</div>' +
          '<div class="loc-title">' + (hasCoords ? 'Actual Location Detected' : 'Allow Location Access') + '</div>' +
          '<div class="loc-subtitle">' +
          (hasCoords
            ? 'We found your actual location! We will use this to deliver your orders right to your doorstep with accurate road routing.'
            : 'Allow location access so Aling Nena\'s Store can find your actual place, calculate delivery routes, and deliver orders right to your doorstep.') +
          '</div>' +
          (hasCoords
            ? '<div class="loc-detected-badge" style="justify-content:center;"><span>✓</span><span>' + esc(place + acc) + '</span></div>'
            : '') +
          '<div class="loc-actions">' +
          '<button class="loc-btn-primary" onclick="App.requestLocation(true)" ' + (isLocating ? 'disabled style="opacity:0.8;"' : '') + '>' +
          (isLocating ? '<span>📡</span> Detecting Actual Location...' : (hasCoords ? '<span>📍</span> Update My Location' : '<span>📍</span> Allow Location Access')) +
          '</button>' +
          '<button class="loc-btn-secondary" onclick="App.dismissLocationModal()">' +
          (hasCoords ? 'Continue to Store' : 'Skip &amp; Set Pin Manually Later') +
          '</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      }

      App.promptLocation = function (forceModal) {
        state.locationModalOpen = true;
        render();
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          App.requestLocation(false);
        }
      };

      App.dismissLocationModal = function () {
        state.locationModalOpen = false;
        render();
      };

      App.requestLocation = function (showToast) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          if (showToast) toast('Geolocation is not supported by your browser.');
          state.locationStatus = 'unsupported';
          state.locationModalOpen = false;
          render();
          return;
        }

        state.locationStatus = 'requesting';
        if (showToast) toast('📡 Requesting location permission...');
        render();

        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var accuracy = Math.round(pos.coords.accuracy || 15);
          var coords = {
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            manual: false,
            timestamp: new Date().toISOString()
          };
          state.userCoords = coords;
          state.checkoutCoords = coords;
          state.checkoutGpsStatus = 'locked';
          state.locationStatus = 'locked';
          dbSet('sst_user_coords', coords);

          var user = currentUser();
          if (user && user.role === 'admin' && !STORE_LOCATION.isActualGps) {
            setStoreLocation(coords, "Aling Nena's Store", "Actual Store Location (" + lat.toFixed(4) + ", " + lng.toFixed(4) + ")");
          }

          reverseGeocode(lat, lng, function (res) {
            if (res) {
              state.userPlaceName = res.placeName;
              state.detectedBarangay = res.barangay;
              state.detectedStreet = res.street;
              dbSet('sst_user_place', res.placeName);
              if (res.barangay) dbSet('sst_user_brgy', res.barangay);
              if (res.street) dbSet('sst_user_street', res.street);
            } else {
              var fallbackPlace = 'GPS: ' + lat.toFixed(4) + ', ' + lng.toFixed(4);
              state.userPlaceName = fallbackPlace;
              dbSet('sst_user_place', fallbackPlace);
            }
            state.locationModalOpen = false;
            render();
            toast('📍 Location locked: ' + (state.userPlaceName || 'Live GPS') + ' (~' + accuracy + 'm accuracy)');
          });

          if (activeMaps.checkout) {
            activeMaps.checkout.flyTo([lat, lng], 17, { duration: 1.2 });
            if (activeMaps.checkoutMarker) {
              activeMaps.checkoutMarker.setLatLng([lat, lng]);
              if (!activeMaps.checkout.hasLayer(activeMaps.checkoutMarker)) activeMaps.checkoutMarker.addTo(activeMaps.checkout);
              activeMaps.checkoutMarker.bindPopup('🟢 <b>Your Live GPS Locked</b><br>' + esc(state.userPlaceName || 'Actual Location')).openPopup();
            }
            if (activeMaps.checkoutAccuracy) activeMaps.checkout.removeLayer(activeMaps.checkoutAccuracy);
            activeMaps.checkoutAccuracy = L.circle([lat, lng], {
              radius: Math.min(120, accuracy),
              color: '#2DA56E',
              fillColor: '#2DA56E',
              fillOpacity: 0.18,
              weight: 1.5
            }).addTo(activeMaps.checkout);
            if (activeMaps.checkoutUpdateRoute) activeMaps.checkoutUpdateRoute(lat, lng);
          }

          setTimeout(function () {
            state.locationModalOpen = false;
            render();
          }, 400);

        }, function (err) {
          console.warn("Location permission notice:", err);
          state.locationStatus = 'denied';
          state.locationModalOpen = false;
          render();
          if (showToast) {
            toast('Location permission denied or unavailable. Tap map on checkout to set pin!');
          }
        }, {
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });
      };

      function initLocationOnStartup() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        var savedCoords = dbGet('sst_user_coords', null);
        var savedPlace = dbGet('sst_user_place', '');
        var savedBrgy = dbGet('sst_user_brgy', '');
        var savedStreet = dbGet('sst_user_street', '');
        if (savedCoords && Number.isFinite(savedCoords.lat)) {
          state.userCoords = savedCoords;
          state.checkoutCoords = savedCoords;
          state.userPlaceName = savedPlace;
          state.detectedBarangay = savedBrgy;
          state.detectedStreet = savedStreet;
          state.checkoutGpsStatus = 'locked';
        }

        // On first visit without saved coordinates, prompt the modal on web and mobile
        if (!savedCoords) {
          state.locationModalOpen = true;
        }

        // Automatically trigger native browser prompt on launch
        try {
          App.requestLocation(false);
        } catch (e) {
          console.warn("Location auto-request notice:", e);
        }
      }

/* ---- Real-Time Customer GPS Actions ---- */
      App.detectCustomerGps = function (showToast) {
        if (showToast === undefined) showToast = true;
        var btnText = document.getElementById('gps-btn-text');
        if (btnText) btnText.textContent = 'Locating...';
        state.checkoutGpsStatus = 'locating';
        updateCheckoutGpsUi();

        if (!navigator.geolocation) {
          if (showToast) toast('Geolocation not supported by this browser. You can tap or drag the pin on the map!');
          state.checkoutGpsStatus = state.checkoutCoords ? 'manual' : 'idle';
          if (btnText) btnText.textContent = 'Detect My GPS';
          updateCheckoutGpsUi();
          return;
        }

        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var accuracy = Math.round(pos.coords.accuracy || 15);
          state.checkoutCoords = {
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            manual: false,
            timestamp: new Date().toISOString()
          };
          state.checkoutGpsStatus = 'locked';
          if (btnText) btnText.textContent = 'GPS Locked ✓';

          if (activeMaps.checkout) {
            activeMaps.checkout.flyTo([lat, lng], 17, { duration: 1.2 });
            if (activeMaps.checkoutMarker) {
              activeMaps.checkoutMarker.setLatLng([lat, lng]);
              if (!activeMaps.checkout.hasLayer(activeMaps.checkoutMarker)) activeMaps.checkoutMarker.addTo(activeMaps.checkout);
              activeMaps.checkoutMarker.bindPopup('🟢 <b>Your Live GPS Locked</b><br>Accurate to ~' + accuracy + 'm').openPopup();
            }
            if (activeMaps.checkoutAccuracy) {
              activeMaps.checkout.removeLayer(activeMaps.checkoutAccuracy);
            }
            activeMaps.checkoutAccuracy = L.circle([lat, lng], {
              radius: Math.min(120, accuracy),
              color: '#2DA56E',
              fillColor: '#2DA56E',
              fillOpacity: 0.18,
              weight: 1.5
            }).addTo(activeMaps.checkout);

            if (activeMaps.checkoutUpdateRoute) activeMaps.checkoutUpdateRoute(lat, lng);
          }
          updateCheckoutGpsUi();
          if (showToast) toast('📍 Live GPS location locked (~' + accuracy + 'm accuracy)');
        }, function (err) {
          console.warn("GPS detection failed/denied:", err);
          state.checkoutGpsStatus = state.checkoutCoords ? 'manual' : 'idle';
          if (btnText) btnText.textContent = 'Detect My GPS';
          updateCheckoutGpsUi();
          if (showToast) toast('Location permission denied or unavailable. Tap or drag the pin on the map!');
        }, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 5000
        });
      };

/* ---- Real-Time Admin Store GPS Update ---- */
      App.updateStoreToActualGps = function (silent) {
        if (!navigator.geolocation) {
          toast('Geolocation is not supported by your browser.');
          return;
        }
        if (!silent) toast('📡 Detecting admin device GPS location...');
        navigator.geolocation.getCurrentPosition(function (pos) {
          var lat = pos.coords.latitude;
          var lng = pos.coords.longitude;
          var accuracy = Math.round(pos.coords.accuracy || 10);
          setStoreLocation({
            lat: lat,
            lng: lng,
            accuracy: accuracy,
            address: "Admin Store Live GPS (" + lat.toFixed(5) + ", " + lng.toFixed(5) + ")"
          });
          toast('✅ Admin map updated to this device GPS (~' + accuracy + 'm accuracy)');
          render();
        }, function (err) {
          console.warn("Admin GPS error:", err);
          if (!silent) toast('Could not detect GPS: ' + (err.message || 'Permission denied'));
        }, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      };

      App.recenterTrackingMap = function () {
        if (activeMaps.customerTracking) {
          var o = getOrders().filter(function (x) { return x.id === state.orderDetailId; })[0];
          if (o && getOrderCoords(o)) {
            var c = getOrderCoords(o);
            var store = getStoreLocation();
            if (hasStoreGps(store)) activeMaps.customerTracking.fitBounds([
              [store.lat, store.lng],
              [c.lat, c.lng]
            ], { padding: [40, 40] });
            else activeMaps.customerTracking.setView([c.lat, c.lng], 15);
          }
        }
      };

      function renderInPlace() { render(); }

