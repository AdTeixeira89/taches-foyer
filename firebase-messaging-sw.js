/* Family Play : service worker des notifications push (Firebase Cloud Messaging).
   Il reçoit les messages quand l'application est fermée ou en arrière-plan et les affiche ;
   un appui sur la notification ouvre l'application. La configuration est publique (comme dans index.html). */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyB8HXhrtFJyC-zelf3KE4KA2yPKMPbNRII",
  authDomain: "taches-foyer.firebaseapp.com",
  projectId: "taches-foyer",
  storageBucket: "taches-foyer.firebasestorage.app",
  messagingSenderId: "391719656519",
  appId: "1:391719656519:web:d5d2cec57ed372447f2562"
});
firebase.messaging();
