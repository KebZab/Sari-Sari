/* ================= GEOLOCATION & REVERSE GEOCODING ENGINE ================= */
var App = window.App = window.App || {};

/* ================= 2-TIER GEOLOCATION ENGINE (HIGH ACCURACY -> CELL/WIFI FALLBACK) ================= */
      function tryGeolocation(onSuccess, onError, options) {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          if (onError) onError({ code: 0, message: 'Geolocation not supported' });
          return;
        }

        var highOpts = Object.assign({
          enableHighAccuracy: true,
          timeout: 9000,
          maximumAge: 10000
        }, options || {});

        var lowOpts = {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 120000
        };

        // Attempt 1: High accuracy GPS
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            onSuccess(pos);
          },
          function (firstErr) {
            console.warn("[Geolocation] High-accuracy attempt failed/timed out:", firstErr && firstErr.message);
            // If user explicitly denied permission, report immediately without retrying low accuracy
            if (firstErr && firstErr.code === 1) { // PERMISSION_DENIED
              if (onError) onError(firstErr);
              return;
            }
            // Attempt 2: Standard/network accuracy (WiFi / Cellular triangulation)
            navigator.geolocation.getCurrentPosition(
              function (pos) {
                console.log("[Geolocation] Fallback standard accuracy succeeded:", pos.coords.latitude, pos.coords.longitude);
                onSuccess(pos);
              },
              function (secondErr) {
                console.warn("[Geolocation] Fallback standard accuracy also failed:", secondErr && secondErr.message);
                if (onError) onError(secondErr || firstErr);
              },
              lowOpts
            );
          },
          highOpts
        );
      }

/* ================= REVERSE GEOCODING ENGINE ================= */
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

        tryGeolocation(function (pos) {
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
            if (showToast) toast('📍 Location locked: ' + (state.userPlaceName || 'Live GPS') + ' (~' + accuracy + 'm accuracy)');
          });

          if (activeMaps.checkout) {
            try {
              activeMaps.checkout.flyTo([lat, lng], 17, { duration: 1.0 });
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
            } catch (e) {}
          }

          setTimeout(function () {
            state.locationModalOpen = false;
            render();
          }, 350);

        }, function (err) {
          console.warn("Location permission notice:", err);
          state.locationStatus = (err && err.code === 1) ? 'denied' : 'unavailable';
          state.locationModalOpen = false;
          render();
          if (showToast) {
            if (err && err.code === 1) {
              toast('Location permission denied. Tap 🔒 in your address bar to enable, or tap the map to place your pin!');
            } else {
              toast('Location unavailable. Tap or drag the pin directly on the map!');
            }
          }
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
        if (showToast) toast('📡 Detecting your GPS location...');
        var btnText = document.getElementById('gps-btn-text');
        if (btnText) btnText.textContent = 'Locating...';
        state.checkoutGpsStatus = 'locating';
        updateCheckoutGpsUi();

        if (!navigator.geolocation) {
          if (showToast) toast('Geolocation not supported by this browser. Tap or drag the pin on the map!');
          state.checkoutGpsStatus = state.checkoutCoords ? 'manual' : 'idle';
          if (btnText) btnText.textContent = 'Detect My GPS';
          updateCheckoutGpsUi();
          return;
        }

        tryGeolocation(function (pos) {
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
          state.checkoutCoords = coords;
          state.userCoords = coords;
          state.checkoutGpsStatus = 'locked';
          dbSet('sst_user_coords', coords);
          if (btnText) btnText.textContent = 'GPS Locked ✓';

          if (activeMaps.checkout) {
            try {
              activeMaps.checkout.invalidateSize();
              activeMaps.checkout.flyTo([lat, lng], 17, { duration: 1.0 });
              if (activeMaps.checkoutMarker) {
                activeMaps.checkoutMarker.setLatLng([lat, lng]);
                if (!activeMaps.checkout.hasLayer(activeMaps.checkoutMarker)) {
                  activeMaps.checkoutMarker.addTo(activeMaps.checkout);
                }
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
            } catch (mapErr) {
              console.warn("[Checkout Map] GPS update error:", mapErr);
            }
          }
          updateCheckoutGpsUi();

          // Reverse geocode to auto-fill address
          reverseGeocode(lat, lng, function (res) {
            if (res) {
              state.userPlaceName = res.placeName;
              state.detectedBarangay = res.barangay;
              state.detectedStreet = res.street;
              dbSet('sst_user_place', res.placeName);
              if (res.barangay) dbSet('sst_user_brgy', res.barangay);
              if (res.street) dbSet('sst_user_street', res.street);

              // Auto-fill delivery address on customer object if empty or default
              var user = currentUser();
              if (user) {
                var users = getUsers();
                var u = users.filter(function (x) { return x.id === user.id; })[0];
                if (u) {
                  var modified = false;
                  if (!u.barangay || u.barangay === 'Barangay San Isidro') { u.barangay = res.barangay || u.barangay; modified = true; }
                  if (!u.houseStreet || u.houseStreet === '123 Mabini St.') { u.houseStreet = res.street || u.houseStreet; modified = true; }
                  if (!u.landmark && res.placeName) { u.landmark = 'Near ' + res.placeName; modified = true; }
                  u.lat = lat;
                  u.lng = lng;
                  if (modified) saveUsers(users);
                }
              }
              var chkBrgy = document.getElementById('chk-barangay');
              if (chkBrgy && (!chkBrgy.value || chkBrgy.value === 'Barangay San Isidro')) chkBrgy.value = res.barangay || '';
              var chkStreet = document.getElementById('chk-housestreet');
              if (chkStreet && (!chkStreet.value || chkStreet.value === '123 Mabini St.')) chkStreet.value = res.street || '';
              var chkLandmark = document.getElementById('chk-landmark');
              if (chkLandmark && !chkLandmark.value && res.placeName) chkLandmark.value = 'Near ' + res.placeName;
            }
            updateCheckoutGpsUi();
          });

          if (showToast) toast('📍 Live GPS location locked (~' + accuracy + 'm accuracy)');
        }, function (err) {
          console.warn("GPS detection failed:", err);
          // If state.userCoords is already known from startup or storage, adopt it as a fallback!
          if (state.userCoords && Number.isFinite(state.userCoords.lat) && Number.isFinite(state.userCoords.lng)) {
            state.checkoutCoords = state.userCoords;
            state.checkoutGpsStatus = 'locked';
            if (btnText) btnText.textContent = 'GPS Locked ✓';
            if (activeMaps.checkout) {
              try {
                activeMaps.checkout.flyTo([state.userCoords.lat, state.userCoords.lng], 16);
                if (activeMaps.checkoutMarker) {
                  activeMaps.checkoutMarker.setLatLng([state.userCoords.lat, state.userCoords.lng]);
                  if (!activeMaps.checkout.hasLayer(activeMaps.checkoutMarker)) activeMaps.checkoutMarker.addTo(activeMaps.checkout);
                }
              } catch (e) {}
            }
            updateCheckoutGpsUi();
            if (showToast) toast('📍 Using detected location. You can also tap the map to fine-tune your pin.');
            return;
          }

          state.checkoutGpsStatus = state.checkoutCoords ? 'manual' : 'idle';
          if (btnText) btnText.textContent = 'Detect My GPS';
          updateCheckoutGpsUi();
          if (showToast) {
            if (err && err.code === 1) {
              toast('Location access blocked in browser. Tap 🔒 in your address bar to allow, or tap the map to place your pin!');
            } else {
              toast('GPS signal weak or unavailable. Tap or drag the pin directly on the map to set your gate!');
            }
          }
        });
      };

/* ---- Real-Time Admin Store GPS Update ---- */
      App.updateStoreToActualGps = function (silent) {
        if (!navigator.geolocation) {
          toast('Geolocation is not supported by your browser.');
          return;
        }
        if (!silent) toast('📡 Detecting admin device GPS location...');
        tryGeolocation(function (pos) {
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
          if (!silent) {
            if (err && err.code === 1) {
              toast('Could not detect GPS: Permission denied. Check browser location settings.');
            } else {
              toast('Could not detect GPS fix. Please ensure location services are enabled on this device.');
            }
          }
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

