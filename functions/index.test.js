'use strict';
/* Envoi des notifications : Firestore et Cloud Messaging sont remplacés par des doublures (rien n'est envoyé pour de vrai). */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const CODE = 'ABCD2345EFGH';
const state = {devices: [], settings: null, sent: [], deleted: [], failToken: null, failCode: 'messaging/registration-token-not-registered', tasks: [], logged: new Set()};

function stub(id, exports){ const f = require.resolve(id); require.cache[f] = {id: f, filename: f, loaded: true, exports}; }
stub('firebase-admin/app', {initializeApp(){}});
stub('firebase-admin/firestore', {getFirestore: () => ({
  collection: p => ({get: async () => ({docs: state.devices.map(d => ({ref: {delete: async () => { state.deleted.push(d.id); }}, get: k => d[k]}))})}),
  doc: p => ({
    get: async () => ({exists: !!state.settings, data: () => state.settings}),
    create: async () => { if (state.logged.has(p)) { const e = new Error('6 ALREADY_EXISTS: Document already exists'); e.code = 6; throw e; } state.logged.add(p); }
  }),
  collectionGroup: () => { const q = {where: () => q, get: async () => ({docs: state.tasks.map(t => ({id: t.id, data: () => t.data, ref: {parent: {parent: {id: t.code, parent: {id: t.parent || 'foyers'}}}}}))})}; return q; }
})});
stub('firebase-admin/messaging', {getMessaging: () => ({sendEachForMulticast: async msg => {
  state.sent.push(msg);
  return {responses: msg.tokens.map(t => t === state.failToken ? {success: false, error: {code: state.failCode}} : {success: true})};
}})});

const fns = require('./index.js');
const ev = (before, after, code) => ({params: {code: code || CODE, id: 'x'}, data: {
  before: {exists: !!before, data: () => before}, after: {exists: !!after, data: () => after}}});
const reset = () => { state.tasks = []; state.logged = new Set(); state.devices = [
  {id: 'd1', token: 'tok-a', who: 'a'}, {id: 'd2', token: 'tok-b', who: 'b'}, {id: 'd3', token: 'tok-b2', who: 'b'}];
  state.settings = {names: {a: 'Adao', b: 'Maman', c: 'Fille'}}; state.sent = []; state.deleted = []; state.failToken = null; };

test('nouvelle tâche confiée : le responsable reçoit son message, les autres « nouvelle tâche », l\'auteur rien', async () => {
  reset();
  state.devices.push({id: 'd4', token: 'tok-c', who: 'c'});
  await fns.notifyTask.run(ev(null, {title: 'Linge', owner: 'b', by: 'a', status: 'todo', createdAt: Date.now()}));
  assert.equal(state.sent.length, 2);
  const pour = state.sent.find(m => m.notification.title === 'Une tâche pour toi'), autres = state.sent.find(m => m.notification.title === 'Nouvelle tâche');
  assert.deepEqual(pour.tokens, ['tok-b', 'tok-b2']);
  assert.match(pour.notification.body, /Adao te confie « Linge »/);
  assert.deepEqual(autres.tokens, ['tok-c']);
  assert.match(autres.notification.body, /Adao a ajouté « Linge » pour Maman/);
  assert.equal(pour.webpush.fcmOptions.link, 'https://adteixeira89.github.io/taches-foyer/');
});
test('nouvelle tâche « à prendre » : tous les téléphones sauf ceux de l\'auteur', async () => {
  reset();
  await fns.notifyTask.run(ev(null, {title: 'Poubelles', owner: '', by: 'a', status: 'todo', createdAt: Date.now()}));
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.sent[0].tokens, ['tok-b', 'tok-b2']);
  assert.equal(state.sent[0].notification.title, 'Nouvelle tâche à prendre');
});
test('tâche confiée plus tard : seuls les téléphones du nouveau responsable', async () => {
  reset();
  await fns.notifyTask.run(ev({title: 'Linge', owner: 'a'}, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.sent[0].tokens, ['tok-b', 'tok-b2']);
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
  await fns.notifyTask.run(ev({title: 'x', owner: 'a'}, {title: 'x', owner: 'a', by: 'a', status: 'todo'}));
  await fns.notifyTask.run(ev({title: 'x', owner: 'b'}, null));
  await fns.notifyTask.run(ev({title: 'x', owner: 'a'}, {title: 'x', owner: 'c', by: 'a', status: 'todo'})); // aucun téléphone pour « c »
  assert.equal(state.sent.length, 0);
});
test('code de foyer invalide : ignoré', async () => {
  reset();
  await fns.notifyTask.run(ev(null, {title: 'x', owner: 'b', by: 'a', status: 'todo', createdAt: Date.now()}, 'pas-un-code'));
  assert.equal(state.sent.length, 0);
});
test('jeton périmé : le téléphone est retiré de la liste, les autres sont servis', async () => {
  reset(); state.failToken = 'tok-b';
  await fns.notifyTask.run(ev({title: 'Linge', owner: 'a'}, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.deepEqual(state.deleted, ['d2']);
  reset(); state.failToken = 'tok-b'; state.failCode = 'messaging/internal-error';
  await fns.notifyTask.run(ev({title: 'Linge', owner: 'a'}, {title: 'Linge', owner: 'b', by: 'a', status: 'todo'}));
  assert.deepEqual(state.deleted, [], 'une erreur passagère ne retire rien');
});

const T = () => Date.now();
test('rappels : envoyés une seule fois, même si la fonction repasse chaque minute', async () => {
  reset();
  state.tasks = [{id: 't1', code: CODE, data: {title: 'Médicament', owner: 'b', status: 'todo', remindAt: T() - 20000}}];
  await fns.sendReminders.run({});
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.sent[0].tokens, ['tok-b', 'tok-b2']);
  assert.equal(state.sent[0].notification.title, 'Rappel');
  await fns.sendReminders.run({});
  await fns.sendReminders.run({});
  assert.equal(state.sent.length, 1, 'pas de doublon aux passages suivants');
});
test('rappels : une nouvelle heure sur la même tâche est de nouveau envoyée', async () => {
  reset();
  const at1 = T() - 20000, at2 = T() - 10000;
  state.tasks = [{id: 't1', code: CODE, data: {title: 'X', owner: 'a', status: 'todo', remindAt: at1}}];
  await fns.sendReminders.run({});
  state.tasks = [{id: 't1', code: CODE, data: {title: 'X', owner: 'a', status: 'todo', remindAt: at2}}];
  await fns.sendReminders.run({});
  assert.equal(state.sent.length, 2);
});
test('rappels : tâche terminée, ancienne ou hors structure foyers ignorées ; « à prendre » à tous', async () => {
  reset();
  state.tasks = [
    {id: 'a', code: CODE, data: {title: 'Finie', owner: 'a', status: 'done', remindAt: T() - 1000}},
    {id: 'b', code: CODE, data: {title: 'Vieille', owner: 'a', status: 'todo', remindAt: T() - 3 * 3600000}},
    {id: 'c', code: CODE, parent: 'autre', data: {title: 'Ailleurs', owner: 'a', status: 'todo', remindAt: T() - 1000}},
    {id: 'd', code: 'pas-un-code', data: {title: 'Code faux', owner: 'a', status: 'todo', remindAt: T() - 1000}},
    {id: 'e', code: CODE, data: {title: 'Poubelles', owner: '', status: 'todo', remindAt: T() - 1000}}];
  await fns.sendReminders.run({});
  assert.equal(state.sent.length, 1);
  assert.deepEqual(state.sent[0].tokens, ['tok-a', 'tok-b', 'tok-b2']);
  assert.match(state.sent[0].notification.body, /Poubelles/);
});
