'use strict';
/* Envoi des notifications : Firestore et Cloud Messaging sont remplacés par des doublures (rien n'est envoyé pour de vrai). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CODE = 'ABCD2345EFGH';
const state = {devices: [], settings: null, sent: [], deleted: [], failToken: null, failCode: 'messaging/registration-token-not-registered'};

function stub(id, exports){ const f = require.resolve(id); require.cache[f] = {id: f, filename: f, loaded: true, exports}; }
stub('firebase-admin/app', {initializeApp(){}});
stub('firebase-admin/firestore', {getFirestore: () => ({
  collection: p => ({get: async () => ({docs: state.devices.map(d => ({ref: {delete: async () => { state.deleted.push(d.id); }}, get: k => d[k]}))})}),
  doc: p => ({get: async () => ({exists: !!state.settings, data: () => state.settings})})
})});
stub('firebase-admin/messaging', {getMessaging: () => ({sendEachForMulticast: async msg => {
  state.sent.push(msg);
  return {responses: msg.tokens.map(t => t === state.failToken ? {success: false, error: {code: state.failCode}} : {success: true})};
}})});

const fns = require('./index.js');
const ev = (before, after, code) => ({params: {code: code || CODE, id: 'x'}, data: {
  before: {exists: !!before, data: () => before}, after: {exists: !!after, data: () => after}}});
const reset = () => { state.devices = [
  {id: 'd1', token: 'tok-a', who: 'a'}, {id: 'd2', token: 'tok-b', who: 'b'}, {id: 'd3', token: 'tok-b2', who: 'b'}];
  state.settings = {names: {a: 'Adao', b: 'Maman', c: 'Fille'}}; state.sent = []; state.deleted = []; state.failToken = null; };

test('tâche confiée : seuls les téléphones du destinataire reçoivent, avec le bon texte et le lien', async () => {
  reset();
  await fns.notifyTask.run(ev(null, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.sent[0].tokens, ['tok-b', 'tok-b2']);
  assert.equal(state.sent[0].notification.title, 'Une tâche pour toi');
  assert.match(state.sent[0].notification.body, /Adao te confie « Linge »/);
  assert.equal(state.sent[0].webpush.fcmOptions.link, 'https://adteixeira89.github.io/taches-foyer/');
});
test('champion : tous les téléphones', async () => {
  reset();
  await fns.notifyWeek.run(ev(null, {champions: ['a'], max: 7}));
  assert.deepEqual(state.sent[0].tokens, ['tok-a', 'tok-b', 'tok-b2']);
});
test('événement pour toute la famille : l\'auteur n\'est pas prévenu', async () => {
  reset();
  await fns.notifyEvent.run(ev(null, {title: 'Cinéma', date: '2026-11-02', who: 'all', by: 'b'}));
  assert.deepEqual(state.sent[0].tokens, ['tok-a']);
});
test('aucun message si personne à prévenir ou document supprimé', async () => {
  reset();
  await fns.notifyTask.run(ev(null, {title: 'x', owner: 'a', by: 'a', status: 'todo'}));
  await fns.notifyTask.run(ev({title: 'x', owner: 'b'}, null));
  await fns.notifyTask.run(ev(null, {title: 'x', owner: 'c', by: 'a', status: 'todo'})); // aucun téléphone pour « c »
  assert.equal(state.sent.length, 0);
});
test('code de foyer invalide : ignoré', async () => {
  reset();
  await fns.notifyTask.run(ev(null, {title: 'x', owner: 'b', by: 'a', status: 'todo'}, 'pas-un-code'));
  assert.equal(state.sent.length, 0);
});
test('jeton périmé : le téléphone est retiré de la liste, les autres sont servis', async () => {
  reset(); state.failToken = 'tok-b';
  await fns.notifyTask.run(ev(null, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.deepEqual(state.deleted, ['d2']);
  reset(); state.failToken = 'tok-b'; state.failCode = 'messaging/internal-error';
  await fns.notifyTask.run(ev(null, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.deepEqual(state.deleted, [], 'une erreur passagère ne retire rien');
});
