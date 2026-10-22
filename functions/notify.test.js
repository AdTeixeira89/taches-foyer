'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('./notify');
const nameOf = n.nameResolver({names: {a: 'Adao', b: 'Maman', c: 'Fille'}, members: [{id: 'mx1', name: 'Mamie'}]});

test('prénoms : base, membres ajoutés, inconnu', () => {
  assert.equal(nameOf('a'), 'Adao');
  assert.equal(nameOf('mx1'), 'Mamie');
  assert.equal(nameOf('zzz'), 'Quelqu’un');
  assert.equal(n.nameResolver(null)('b'), 'Maman');
});

const NOW = 1000000000000, fresh = {createdAt: NOW - 1000};
const create = o => n.planTask(null, Object.assign({title: 'Linge', status: 'todo', by: 'a'}, fresh, o), nameOf, NOW);

test('nouvelle tâche confiée à quelqu\'un : le responsable reçoit un message pour lui, les autres un message « nouvelle tâche »', () => {
  const r = create({owner: 'b'});
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].to, ['b']);
  assert.match(r[0].body, /Adao te confie « Linge »/);
  assert.equal(r[1].to, 'all');
  assert.deepEqual(r[1].except, ['a', 'b'], 'ni l\'auteur ni le responsable (déjà prévenu)');
  assert.match(r[1].body, /Adao a ajouté « Linge » pour Maman/);
});
test('nouvelle tâche « à prendre » : tout le monde sauf l\'auteur', () => {
  const r = create({owner: ''});
  assert.equal(r.length, 1);
  assert.equal(r[0].to, 'all');
  assert.deepEqual(r[0].except, ['a']);
  assert.equal(r[0].title, 'Nouvelle tâche à prendre');
  assert.match(r[0].body, /Qui la prend/);
});
test('nouvelle tâche qu\'on se donne : les autres sont prévenus, pas l\'auteur', () => {
  const r = create({owner: 'a'});
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].except, ['a']);
  assert.equal(r[0].body, 'Adao a ajouté « Linge ».');
});
test('création : rien sans auteur, sans date, trop ancienne, ou déjà terminée', () => {
  assert.equal(create({owner: 'b', by: undefined}).length, 0);
  assert.equal(create({owner: 'b', createdAt: undefined}).length, 0);
  assert.equal(create({owner: 'b', createdAt: NOW - 10 * 60 * 1000}).length, 0, 'tâche recopiée ou restaurée');
  assert.equal(create({owner: 'b', status: 'done'}).length, 0);
});
test('tâche confiée plus tard à quelqu\'un d\'autre : seul le nouveau responsable est prévenu', () => {
  const r = n.planTask({owner: 'a', title: 'Vaisselle'}, {title: 'Vaisselle', owner: 'mx1', by: 'b', status: 'todo'}, nameOf);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].to, ['mx1']);
  assert.match(r[0].body, /Maman te confie « Vaisselle »/);
});
test('tâche modifiée : rien si le responsable ne change pas, si on se l\'attribue, si terminée, sans auteur ou sans responsable', () => {
  assert.equal(n.planTask({owner: 'b'}, {title: 't', owner: 'b', by: 'a', status: 'doing'}, nameOf).length, 0);
  assert.equal(n.planTask({owner: 'b'}, {title: 't', owner: 'a', by: 'a', status: 'todo'}, nameOf).length, 0);
  assert.equal(n.planTask({owner: 'a'}, {title: 't', owner: 'b', by: 'a', status: 'done'}, nameOf).length, 0);
  assert.equal(n.planTask({owner: 'a'}, {title: 't', owner: 'b', status: 'todo'}, nameOf).length, 0);
  assert.equal(n.planTask({owner: 'a'}, {title: 't', owner: '', by: 'a', status: 'todo'}, nameOf).length, 0);
});
test('titre trop long raccourci', () => {
  const r = create({owner: 'b', title: 'x'.repeat(300)});
  assert.ok(r[0].body.length < 140 && r[1].body.length < 140);
});

test('joker échange : demande puis réponse', () => {
  const j = {kind: 'swap', who: 'a', to: 'b', taskTitle: 'Linge', status: 'pending'};
  const ask = n.planJoker(null, j, nameOf);
  assert.deepEqual(ask[0].to, ['b']);
  assert.match(ask[0].body, /Adao aimerait te passer « Linge »/);
  const ok = n.planJoker(j, Object.assign({}, j, {status: 'accepted'}), nameOf);
  assert.deepEqual(ok[0].to, ['a']);
  assert.equal(ok[0].title, 'Échange accepté');
  const no = n.planJoker(j, Object.assign({}, j, {status: 'refused'}), nameOf);
  assert.deepEqual(no[0].to, ['a']);
  assert.doesNotMatch(no[0].body, /refus/i);
  assert.equal(n.planJoker(j, Object.assign({}, j, {status: 'cancelled'}), nameOf).length, 0);
});
test('joker aide : à une personne précise, ou à tous sauf le demandeur', () => {
  const one = n.planJoker(null, {kind: 'help', who: 'a', want: 'c', taskTitle: 'Devoirs', status: 'open'}, nameOf);
  assert.deepEqual(one[0].to, ['c']);
  const any = n.planJoker(null, {kind: 'help', who: 'a', want: '', taskTitle: 'Devoirs', status: 'open'}, nameOf);
  assert.equal(any[0].to, 'all');
  assert.equal(any[0].except, 'a');
  const got = n.planJoker({kind: 'help', who: 'a', status: 'open'}, {kind: 'help', who: 'a', taskTitle: 'Devoirs', status: 'accepted', helper: 'mx1'}, nameOf);
  assert.deepEqual(got[0].to, ['a']);
  assert.match(got[0].title, /Mamie/);
});
test('joker choix : aucune notification', () => {
  assert.equal(n.planJoker(null, {kind: 'choice', who: 'a', status: 'active'}, nameOf).length, 0);
});

test('événement : pour toute la famille (sauf l\'auteur) ou pour une personne', () => {
  const all = n.planEvent(null, {title: 'Anniversaire', date: '2026-10-22', time: '18:30', who: 'all', by: 'a'}, nameOf);
  assert.equal(all[0].to, 'all');
  assert.equal(all[0].except, 'a');
  assert.match(all[0].body, /Anniversaire · jeudi 22 octobre à 18:30/);
  const one = n.planEvent(null, {title: 'Dentiste', date: '2026-10-23', who: 'c', by: 'a'}, nameOf);
  assert.deepEqual(one[0].to, ['c']);
  assert.equal(n.planEvent(null, {title: 'Moi', date: '2026-10-23', who: 'a', by: 'a'}, nameOf).length, 0);
  assert.equal(n.planEvent({title: 'x'}, {title: 'x', who: 'all'}, nameOf).length, 0);
});
test('date invalide : pas de date dans le message', () => {
  assert.equal(n.dateLabel('n’importe quoi'), '');
  const r = n.planEvent(null, {title: 'Truc', date: '', who: 'all', by: 'a'}, nameOf);
  assert.equal(r[0].body, 'Truc');
});

test('champion de la semaine : toute la famille, égalité incluse', () => {
  const r = n.planWeek(null, {champions: ['a', 'mx1'], max: 12}, nameOf);
  assert.equal(r[0].to, 'all');
  assert.match(r[0].body, /Adao et Mamie \(12 pts\)/);
  assert.equal(n.planWeek(null, {champions: [], max: 0}, nameOf).length, 0);
  assert.equal(n.planWeek({champions: ['a']}, {champions: ['a']}, nameOf).length, 0);
});

test('rappel : au responsable, ou à tous si la tâche est à prendre', () => {
  const T = 1000000000000;
  const own = n.planReminder({title: 'Médicament', owner: 'b', remindAt: T - 30000, status: 'todo'}, T);
  assert.equal(own.length, 1);
  assert.deepEqual(own[0].to, ['b']);
  assert.equal(own[0].title, 'Rappel');
  assert.match(own[0].body, /C’est l’heure : « Médicament »/);
  const pool = n.planReminder({title: 'Poubelles', owner: '', remindAt: T - 1000, status: 'todo'}, T);
  assert.equal(pool[0].to, 'all');
  assert.match(pool[0].body, /Une tâche à prendre : « Poubelles »/);
});
test('rappel : rien si pas encore l\'heure, trop ancien, terminé, ou sans heure', () => {
  const T = 1000000000000, base = {title: 'x', owner: 'a', status: 'todo'};
  assert.equal(n.planReminder(Object.assign({}, base, {remindAt: T + 1000}), T).length, 0, 'pas encore');
  assert.equal(n.planReminder(Object.assign({}, base, {remindAt: T - n.REMIND_WINDOW_MS - 1}), T).length, 0, 'raté depuis plus d\'une heure');
  assert.equal(n.planReminder(Object.assign({}, base, {remindAt: T - 1000, status: 'done'}), T).length, 0, 'tâche terminée');
  assert.equal(n.planReminder(base, T).length, 0);
  assert.equal(n.planReminder(Object.assign({}, base, {remindAt: 'abc'}), T).length, 0);
});

test('appareils visés', () => {
  const devices = [{token: 't1', who: 'a'}, {token: 't2', who: 'b'}, {token: 't3', who: 'a'}, {token: '', who: 'b'}, null];
  assert.deepEqual(n.pickDevices(devices, {to: ['b']}).map(d => d.token), ['t2']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: 'a'}).map(d => d.token), ['t2']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: ''}).map(d => d.token), ['t1', 't2', 't3']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: ['a', 'b']}).map(d => d.token), [], 'plusieurs personnes exclues');
  assert.deepEqual(n.pickDevices([{token: 't1', who: 'a'}, {token: 't2', who: 'c'}], {to: 'all', except: ['a', 'b']}).map(d => d.token), ['t2']);
});
