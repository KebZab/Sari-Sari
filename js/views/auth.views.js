/* ================= AUTH VIEWS ================= */
var GOOGLE_ICON_SVG = '<svg class="google-icon" viewBox="0 0 24 24" width="18" height="18" style="vertical-align:middle;flex-shrink:0;">' +
  '<path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>' +
  '<path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>' +
  '<path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>' +
  '<path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>' +
  '</svg>';

      function renderLogin() {
        return '' +
          '<div class="auth-bg">' +
          '<div class="auth-card">' +
          '<div class="auth-logo"><div class="mark">' + ICON.store + '</div><div><div class="auth-title">NelGlenn\'s</div></div></div>' +
          '<div class="auth-sub">Sari-sari store online ordering &amp; delivery</div>' +
          (state.loginError ? '<div class="field-error" style="display:block;margin-bottom:12px;font-weight:600;">' + esc(state.loginError) + '</div>' : '') +
          '<button type="button" class="btn btn-google btn-block" id="btn-google-login" onclick="App.handleGoogleSignIn()">' +
          GOOGLE_ICON_SVG +
          '<span>Sign in with Google</span>' +
          '</button>' +
          '<div class="auth-divider"><span>or sign in with your account</span></div>' +
          '<form onsubmit="return App.handleLogin(event)">' +
          '<div class="field"><label>Phone or Email</label><input type="text" id="login-phone" placeholder="09XXXXXXXXX or email" required></div>' +
          '<div class="field"><label>Password</label><input type="password" id="login-password" placeholder="Enter your password" required></div>' +
          '<button type="submit" class="btn btn-primary btn-block">Log in</button>' +
          '</form>' +
          '<div class="auth-switch">New customer? <button onclick="App.go(\'auth-register\')">Create an account</button></div>' +
          '</div>' +
          '</div>' +
          (state.showGoogleNoticeModal ? renderGoogleAuthNoticeModal() : '');
      }

      function renderRegister() {
        var err = state.registerError || {};
        function ef(field) { return err[field] ? ' has-error' : ''; }
        function em(field) { return err[field] ? '<div class="field-error">' + esc(err[field]) + '</div>' : ''; }

        var provOptionsHtml = (typeof PhLocationAPI !== 'undefined' && PhLocationAPI.getProvinceOptionsHtml)
          ? PhLocationAPI.getProvinceOptionsHtml()
          : '<option value="">Select Province or Metro Manila...</option>';

        return '' +
          '<div class="auth-bg">' +
          '<div class="auth-card" style="max-width:480px;">' +
          '<div class="auth-logo"><div class="mark">' + ICON.store + '</div><div class="auth-title">Create account</div></div>' +
          '<div class="auth-sub">Register to order from the sari-sari store</div>' +
          (state.userPlaceName ? '<div class="loc-detected-badge" style="margin-bottom:12px;width:100%;"><span>📍</span><span>Auto-detected: ' + esc(state.userPlaceName) + '</span></div>' : '') +
          '<button type="button" class="btn btn-google btn-block" id="btn-google-register" onclick="App.handleGoogleSignIn()">' +
          GOOGLE_ICON_SVG +
          '<span>Sign up with Google</span>' +
          '</button>' +
          '<div class="auth-divider"><span>or register with phone / email</span></div>' +
          '<form onsubmit="return App.handleRegister(event)" oninput="App.clearRegisterError(event)">' +
          '<div class="field' + ef('fullName') + '"><label>Full name</label><input id="reg-fullname" type="text" placeholder="Juan Dela Cruz">' + em('fullName') + '</div>' +
          '<div class="field' + ef('phone') + '"><label>Phone number</label><input id="reg-phone" type="tel" placeholder="09XXXXXXXXX">' + em('phone') + '</div>' +
          '<div class="field' + ef('email') + '"><label>Email address (for login)</label><input id="reg-email" type="email" placeholder="name@example.com">' + em('email') + '</div>' +
          '<div class="field"><label>Province / Area</label><select id="reg-province" onchange="App.onProvinceChange(this.value, \'reg-\')">' + provOptionsHtml + '</select></div>' +
          '<div class="field"><label>City / Municipality</label><select id="reg-city" onchange="App.onCityChange(this.value, \'reg-\')"><option value="">Select City / Municipality...</option></select></div>' +
          '<div class="field' + ef('barangay') + '"><label>Barangay</label><select id="reg-barangay-select" style="margin-bottom:6px;" onchange="App.onBarangaySelectChange(this.value, \'reg-\')"><option value="">Select Barangay...</option></select><input id="reg-barangay" type="text" placeholder="Barangay / Village" value="' + esc(state.detectedBarangay || '') + '">' + em('barangay') + '</div>' +

          '<div class="field' + ef('houseStreet') + '"><label>House number / street</label><input id="reg-housestreet" type="text" placeholder="123 Mabini St." value="' + esc(state.detectedStreet || '') + '">' + em('houseStreet') + '</div>' +
          '<div class="field' + ef('landmark') + '"><label>Nearby landmark</label><input id="reg-landmark" type="text" placeholder="Near the covered court">' + em('landmark') + '</div>' +
          '<div class="field' + ef('password') + '"><label>Password</label><input id="reg-password" type="password" placeholder="At least 6 characters">' + em('password') + '</div>' +
          '<div class="field' + ef('confirm') + '"><label>Confirm password</label><input id="reg-confirm" type="password" placeholder="Re-enter password">' + em('confirm') + '</div>' +
          '<button type="submit" class="btn btn-primary btn-block">Register</button>' +
          '</form>' +
          '<div class="auth-switch">Already have an account? <button onclick="App.go(\'auth-login\')">Log in</button></div>' +
          '</div>' +
          '</div>' +
          (state.showGoogleNoticeModal ? renderGoogleAuthNoticeModal() : '');
      }

      function renderGoogleAuthNoticeModal() {
        var errCode = (state.googleAuthError && state.googleAuthError.code) || 'Notice';
        return '' +
          '<div class="overlay-bg" style="z-index:9999;" onclick="if(event.target===this) App.closeGoogleAuthModal()">' +
          '<div class="google-notice-modal">' +
          '<div class="google-notice-head">' +
          GOOGLE_ICON_SVG +
          '<h3>Google Sign-In Activation</h3>' +
          '</div>' +
          '<p style="font-size:13px;color:var(--ink-600);margin:0 0 10px;line-height:1.5;">' +
          'Google Sign-In is integrated with Firebase Auth (<code>sarisaristore-ffa71</code>). If live Google OAuth popup is pending activation in your Firebase Console:' +
          '</p>' +
          '<div class="google-notice-steps">' +
          '<strong>To enable in Firebase Console:</strong>' +
          '<ol>' +
          '<li>Go to <strong>Authentication &gt; Sign-in method</strong>.</li>' +
          '<li>Click <strong>Google</strong> and toggle <strong>Enable</strong>.</li>' +
          '<li>Under <strong>Authorized domains</strong>, ensure <code>sari-sari-mu.vercel.app</code> is listed.</li>' +
          '</ol>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:10px;">' +
          '<button type="button" class="btn btn-primary btn-block" onclick="App.demoGoogleLogin()">' +
          GOOGLE_ICON_SVG + ' Continue with Instant Google Demo Account' +
          '</button>' +
          '<button type="button" class="btn btn-outline btn-block" onclick="App.closeGoogleAuthModal()">' +
          'Close &amp; Use Phone Login' +
          '</button>' +
          '</div>' +
          '</div>' +
          '</div>';
      }

