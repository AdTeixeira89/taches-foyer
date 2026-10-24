'use strict';
/* Family Play : envoie les notifications push (Firebase Cloud Messaging).
   Chaque foyer vit sous foyers/<code> dans Firestore. Quand une tâche, un joker, un événement ou une semaine
   est écrit, on calcule qui prévenir (notify.js) puis on envoie aux téléphones enregistrés sous
   foyers/<code>/devices (jeton + profil choisi sur l'appareil). */
const {onDocumentWritten} = require('firebase-functions/v2/firestore');
const {onSchedule} = require('firebase-functions/v2/scheduler');
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
      webpush: {fcmOptions: {link: SITE + (m.link || '')}, notification: {icon: SITE + 'icon-192.png', badge: SITE + 'icon-192.png', tag: m.tag}}
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

// Un document foyers/<code>/reminderLog/<clé> est créé avant chaque envoi planifié : il ne part jamais deux fois.
const homeCode = d => { const home = d.ref.parent.parent; return home && home.parent && home.parent.id === 'foyers' && /^[A-Z0-9]{12}$/.test(home.id) ? home.id : null; };
async function claim(db, code, key){
  try { await db.doc('foyers/' + code + '/reminderLog/' + key).create({at: Date.now()}); return true; }
  catch (e) { if (e && (e.code === 6 || /already exists/i.test(String(e.message || '')))) return false; throw e; }
}

// Rappels de tâches : chaque minute, on cherche les tâches dont l'heure de rappel vient de passer.
exports.sendReminders = onSchedule({schedule: 'every 1 minutes', region: REGION, timeoutSeconds: 120}, async () => {
  const db = getFirestore(), now = Date.now();
  const snap = await db.collectionGroup('tasks').where('remindAt', '>=', now - notify.REMIND_WINDOW_MS).where('remindAt', '<=', now).get();
  const byCode = {};
  for (const d of snap.docs) {
    const code = homeCode(d);
    if (!code) continue;
    const task = d.data(), messages = notify.planReminder(task, now);
    if (!messages.length || !(await claim(db, code, d.id + '_' + task.remindAt))) continue;
    (byCode[code] = byCode[code] || []).push(...messages);
  }
  for (const code of Object.keys(byCode)) await deliver(code, byCode[code]);
});

// Événements du calendrier : chaque soir à 18 h, on prévient pour le lendemain.
exports.sendEventReminders = onSchedule({schedule: '0 18 * * *', timeZone: notify.TIMEZONE, region: REGION, timeoutSeconds: 120}, async () => {
  const db = getFirestore(), tomorrow = notify.addDaysYmd(notify.ymdInZone(Date.now(), notify.TIMEZONE), 1);
  const snap = await db.collectionGroup('events').where('date', '==', tomorrow).get();
  const byCode = {};
  for (const d of snap.docs) {
    const code = homeCode(d);
    if (!code) continue;
    const messages = notify.planEventTomorrow(d.data());
    if (!messages.length || !(await claim(db, code, 'event_' + d.id + '_' + tomorrow))) continue;
    (byCode[code] = byCode[code] || []).push(...messages);
  }
  for (const code of Object.keys(byCode)) await deliver(code, byCode[code]);
});

// Tâches en retard : chaque matin à 9 h, on demande si la tâche dont la date limite est passée est faite (une seule fois par date limite).
exports.sendOverdue = onSchedule({schedule: '0 9 * * *', timeZone: notify.TIMEZONE, region: REGION, timeoutSeconds: 120}, async () => {
  const db = getFirestore(), today = notify.ymdInZone(Date.now(), notify.TIMEZONE);
  const snap = await db.collectionGroup('tasks').where('due', '>=', notify.addDaysYmd(today, -notify.OVERDUE_DAYS)).where('due', '<', today).get();
  const byCode = {};
  for (const d of snap.docs) {
    const code = homeCode(d);
    if (!code) continue;
    const task = d.data(), messages = notify.planOverdue(task, today, d.id);
    if (!messages.length || !(await claim(db, code, 'overdue_' + d.id + '_' + task.due))) continue;
    (byCode[code] = byCode[code] || []).push(...messages);
  }
  for (const code of Object.keys(byCode)) await deliver(code, byCode[code]);
});

exports.notifyTask = watch('foyers/{code}/tasks/{id}', notify.planTask);
exports.notifyJoker = watch('foyers/{code}/jokers/{id}', notify.planJoker);
exports.notifyEvent = watch('foyers/{code}/events/{id}', notify.planEvent);
exports.notifyWeek = watch('foyers/{code}/weeks/{id}', notify.planWeek);
