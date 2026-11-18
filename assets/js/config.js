/* Mr Butler's CTF — site settings.
   The site's data lives in Firebase (project ergs-ctf, free Spark plan): see teacher-sync/FIREBASE.md.
   apiUrl is only an internal address that assets/js/fbapi.js answers itself — nothing is sent to it.
   legacyUrl is the old Google Apps Script: still used to email you a forgotten password, and to check an
   old PIN the first time a pupil signs in after the move (their Firebase account is then made).
   USE_FIREBASE: true = Firebase, false = the old Google Sheet. Add ?fb=1 / ?fb=0 to the address to try the other
   one on a single computer. */
(function () {
  var USE_FIREBASE = false;
  var legacy = 'https://script.google.com/macros/s/AKfycbxhmdYT_6aTnokjqv3hjz1jg35FD47Z_0Y3xMkU6pYR3Dc5lTzIJdJUbFUbU9Ah3i2MMQ/exec';
  var api = 'https://ergs-ctf.firebaseapp.com/__mbctf_api';
  var on = USE_FIREBASE;
  try {
    var m = /[?&]fb=([01])/.exec(location.search);
    if (m) localStorage.setItem('mbctf-fb', m[1]);
    var v = localStorage.getItem('mbctf-fb'); if (v === '1') on = true; else if (v === '0') on = false;
  } catch (e) { }
  window.CTF_CONFIG = {
    syncUrl: on ? api : legacy,
    apiUrl: api,
    legacyUrl: legacy,
    firebase: {
      apiKey: 'AIzaSyBJsg2mmHPhc2-U8IPkxczOaTcgjRAHGOU',
      authDomain: 'ergs-ctf.firebaseapp.com',
      projectId: 'ergs-ctf',
      storageBucket: 'ergs-ctf.firebasestorage.app',
      messagingSenderId: '760925960645',
      appId: '1:760925960645:web:8bd8e5d5a730fe8e9a73ac'
    },
    // Google accounts that can use the Teacher tab (others can be added to the Firestore "staff" collection)
    teachers: ['jbutler483@gmail.com', 'jbutler803@c2ken.net']
  };
})();
