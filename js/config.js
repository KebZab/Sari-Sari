/* ================= CONFIGURATION & CONSTANTS ================= */
var App = window.App = window.App || {};

/* ================= CONSTANTS ================= */
      var LOW_STOCK_THRESHOLD = 8;
      var K = {
        USERS: 'sst_users', PRODUCTS: 'sst_products', CATEGORIES: 'sst_categories',
        ORDERS: 'sst_orders', NOTIFS: 'sst_notifications', SESSION: 'sst_session',
        SEEDED: 'sst_seeded_v2', COUNTER: 'sst_order_counter'
      };

/* ================= DEFAULT STORE LOCATION ================= */
var DEFAULT_STORE_LOCATION = {
  lat: null,
  lng: null,
  name: "NelGlenn's Store",
  address: "Store GPS has not been set",
  isActualGps: false
};

/* ================= FIREBASE CLOUD CONFIG ================= */
      var firebaseConfig = {
        projectId: "sarisaristore-ffa71",
        appId: "1:937245949484:web:d4129068aece4360ba9b89",
        storageBucket: "sarisaristore-ffa71.firebasestorage.app",
        apiKey: "AIzaSyAtmLw9Gd7b-ONuMjgUzy04GR6XrP-QO4s",
        authDomain: "sarisaristore-ffa71.firebaseapp.com",
        databaseURL: "https://sarisaristore-ffa71-default-rtdb.asia-southeast1.firebasedatabase.app",
        messagingSenderId: "937245949484",
        measurementId: "G-PSRD8L9PEW"
      };

var STATUS_FLOW = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered'];
      var CATEGORY_LIST = [
        { name: 'Snacks', emoji: '\ud83c\udf7f' },
        { name: 'Biscuits', emoji: '\ud83c\udf6a' },
        { name: 'Instant Noodles', emoji: '\ud83c\udf5c' },
        { name: 'Canned Goods', emoji: '\ud83e\udd6b' },
        { name: 'Rice', emoji: '\ud83c\udf5a' },
        { name: 'Coffee', emoji: '\u2615' },
        { name: 'Drinks', emoji: '\ud83e\uddc3' },
        { name: 'Soft Drinks', emoji: '\ud83e\udd64' },
        { name: 'Water', emoji: '\ud83d\udca7' },
        { name: 'Personal Care', emoji: '\ud83e\uddf4' },
        { name: 'Household Items', emoji: '\ud83e\uddf9' },
        { name: 'School Supplies', emoji: '\u270f\ufe0f' },
        { name: 'Other Products', emoji: '\ud83d\uded2' }
      ];

/* ================= ICONS (inline emoji-based, no external deps) ================= */
      var ICON = {
        home: '\ud83c\udfe0', cart: '\ud83d\uded2', orders: '\ud83e\uddfe', profile: '\ud83d\udc64',
        bell: '\ud83d\udd14', search: '\ud83d\udd0d', dash: '\ud83d\udcca', delivery: '\ud83d\udeb2',
        products: '\ud83d\udce6', inventory: '\ud83d\udccb', customers: '\ud83d\udc65', logout: '\u23fb',
        plus: '+', minus: '\u2212', trash: '\ud83d\uddd1', edit: '\u270e', check: '\u2713', close: '\u2715',
        store: '\ud83c\udfea', menu: '\u2630', pin: '\ud83d\udccd', phone: '\ud83d\udcde', truck: '\ud83d\ude9a',
        clock: '\u23f1', money: '\ud83d\udcb5', box: '\ud83d\udce6',
        sparkle: '\u2728', chart: '\ud83d\udcc8', warning: '\u26a0\ufe0f', fire: '\ud83d\udd25',
        package: '\ud83d\udce6', star: '\u2b50'
      };

