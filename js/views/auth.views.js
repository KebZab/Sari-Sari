/* ================= AUTH VIEWS ================= */
/* ================= AUTH VIEWS ================= */
      function renderLogin() {
        return '' +
          '<div class="auth-bg">' +
          '<div class="auth-card">' +
          '<div class="auth-logo"><div class="mark">' + ICON.store + '</div><div><div class="auth-title">Aling Nena\'s</div></div></div>' +
          '<div class="auth-sub">Sari-sari store online ordering &amp; delivery</div>' +
          (state.loginError ? '<div class="field-error" style="display:block;margin-bottom:12px;font-weight:600;">' + esc(state.loginError) + '</div>' : '') +
          '<form onsubmit="return App.handleLogin(event)">' +
          '<div class="field"><label>Phone number</label><input type="tel" id="login-phone" placeholder="09XXXXXXXXX" required></div>' +
          '<div class="field"><label>Password</label><input type="password" id="login-password" placeholder="Enter your password" required></div>' +
          '<button type="submit" class="btn btn-primary btn-block">Log in</button>' +
          '</form>' +
          '<div class="auth-switch">New customer? <button onclick="App.go(\'auth-register\')">Create an account</button></div>' +
          '</div>' +
          '</div>';
      }

      function renderRegister() {
        var err = state.registerError || {};
        function ef(field) { return err[field] ? ' has-error' : ''; }
        function em(field) { return err[field] ? '<div class="field-error">' + esc(err[field]) + '</div>' : ''; }
        return '' +
          '<div class="auth-bg">' +
          '<div class="auth-card" style="max-width:460px;">' +
          '<div class="auth-logo"><div class="mark">' + ICON.store + '</div><div class="auth-title">Create account</div></div>' +
          '<div class="auth-sub">Register to order from the sari-sari store</div>' +
          '<form onsubmit="return App.handleRegister(event)">' +
          (state.userPlaceName ? '<div class="loc-detected-badge" style="margin-bottom:12px;width:100%;"><span>📍</span><span>Auto-detected: ' + esc(state.userPlaceName) + '</span></div>' : '') + '' +
          '<div class="field' + ef('fullName') + '"><label>Full name</label><input id="reg-fullname" type="text" placeholder="Juan Dela Cruz">' + em('fullName') + '</div>' +
          '<div class="field' + ef('phone') + '"><label>Phone number</label><input id="reg-phone" type="tel" placeholder="09XXXXXXXXX">' + em('phone') + '</div>' +
          '<div class="field' + ef('barangay') + '"><label>Barangay</label><input id="reg-barangay" type="text" placeholder="Barangay San Isidro" value="' + esc(state.detectedBarangay || '') + '">' + em('barangay') + '</div>' +
          '<div class="field' + ef('houseStreet') + '"><label>House number / street</label><input id="reg-housestreet" type="text" placeholder="123 Mabini St." value="' + esc(state.detectedStreet || '') + '">' + em('houseStreet') + '</div>' +
          '<div class="field' + ef('landmark') + '"><label>Nearby landmark</label><input id="reg-landmark" type="text" placeholder="Near the covered court">' + em('landmark') + '</div>' +
          '<div class="field' + ef('password') + '"><label>Password</label><input id="reg-password" type="password" placeholder="At least 6 characters">' + em('password') + '</div>' +
          '<div class="field' + ef('confirm') + '"><label>Confirm password</label><input id="reg-confirm" type="password" placeholder="Re-enter password">' + em('confirm') + '</div>' +
          '<button type="submit" class="btn btn-primary btn-block">Register</button>' +
          '</form>' +
          '<div class="auth-switch">Already have an account? <button onclick="App.go(\'auth-login\')">Log in</button></div>' +
          '</div>' +
          '</div>';
      }

