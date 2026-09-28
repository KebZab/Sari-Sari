/* ================= GLOBAL APPLICATION REACTIVE STATE ================= */
/* ================= APP STATE ================= */
      var state = {
        view: 'auth-login',
        userCoords: null,
        userPlaceName: '',
        detectedBarangay: '',
        detectedStreet: '',
        locationModalOpen: false,
        locationStatus: 'idle',
        adminSection: 'dashboard',
        selectedDeliveryOrderId: null,
        sidebarOpen: false,
        cartOpen: false,
        notifOpen: false,
        search: '',
        activeCategoryId: null,
        orderDetailId: null,
        editingProductId: null,
        productFormCategory: null,
        productFormImage: null,
        orderFilter: 'All',
        deliveryFilter: 'active',
        addressEditing: false,
        checkoutInstructions: '',
        checkoutCoords: null,
        checkoutGpsStatus: 'idle',
        adminGpsAttempted: false,
        loginError: '',
        registerError: {},
        showGoogleNoticeModal: false,
        googleAuthError: null
      };
window.state = state;

