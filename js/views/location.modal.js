/* ================= LOCATION PERMISSION PROMPT MODAL ================= */
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

