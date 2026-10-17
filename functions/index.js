'use strict';
/* Family Play : envoie les notifications push (Firebase Cloud Messaging).
   Chaque foyer vit sous foyers/<code> dans Firestore. Quand une tâche, un joker, un événement ou une semaine
   est écrit, on calcule qui prévenir (notify.js) puis on envoie aux téléphones enregistrés sous
   foyers/<code>/devices (jeton + profil choisi sur l'appareil). */
const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const notify = require('./notify');

initializeApp();
const REGION = 'europe-west1';
const SITE = 'https://adteixeira89.github.io/taches-foyer/';
const DEAD = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];

async function deliver(code, messages){
  const db = getFirestore();
  const snap = await db.collection('foyers/' + code + '/devices').get();
  const devices = snap.docs.map(d => ({ref: d.ref, token: d.get('token'), who: d.get('who')}));
  const dead = new Set();
  for (const m of messages) {
    const tokens = Array.from(new Set(notify.pickDevices(devices, m).map(d => d.token)));
    if (!tokens.length) continue;
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {title: m.title, body: m.body},
      webpush: {fcmOptions: {link: SITE}, notification: {icon: SITE + 'icon-192.png', badge: SITE + 'icon-192.png', tag: m.tag}}
    });
    res.responses.forEach((r, i) => { if (!r.success && r.error && DEAD.indexOf(r.error.code) >= 0) dead.add(tokens[i]); });
  }
  // un jeton périmé (appli désinstallée, notifications retirées) est effacé
  await Promise.all(devices.filter(d => dead.has(d.token)).map(d => d.ref.delete()));
}

function watch(path, plan){
  return onDocumentWritten({document: path, region: REGION}, async event => {
    const code = event.params.code;
    if (!/^[A-Z0-9]{12}$/.test(code)) return;
    const after = event.data.after.exists ? event.data.after.data() : null;
    if (!after) return;
    const before = event.data.before.exists ? event.data.before.data() : null;
    const settings = await getFirestore().doc('foyers/' + code + '/settings/family').get();
    const messages = plan(before, after, notify.nameResolver(settings.exists ? settings.data() : null));
    if (messages.length) await deliver(code, messages);
  });
}

exports.notifyTask = watch('foyers/{code}/tasks/{id}', notify.planTask);
exports.notifyJoker = watch('foyers/{code}/jokers/{id}', notify.planJoker);
exports.notifyEvent = watch('foyers/{code}/events/{id}', notify.planEvent);
exports.notifyWeek = watch('foyers/{code}/weeks/{id}', notify.planWeek);
