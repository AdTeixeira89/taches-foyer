'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const n = require('./notify');
const nameOf = n.nameResolver({names: {a: 'Adao', b: 'Maman', c: 'Fille'}, members: [{id: 'mx1', name: 'Mamie'}]});

test('prénoms : base, membres ajoutés, inconnu', () => {
  assert.equal(nameOf('a'), 'Adao');
  assert.equal(nameOf('mx1'), 'Mamie');
  assert.equal(nameOf('zzz'), 'Quelqu’un');
  assert.equal(n.nameResolver(null)('b'), 'Parent 2');
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
  assert.equal(n.planTask({owner: 'a', status: 'done'}, {title: 't', owner: 'b', by: 'a', status: 'done'}, nameOf).length, 0, 'déjà terminée : rien');
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

test('la veille d\'un événement : la personne concernée, ou toute la famille', () => {
  const one = n.planEventTomorrow({title: 'Dentiste', date: '2026-10-23', time: '14:30', who: 'c'});
  assert.deepEqual(one[0].to, ['c']);
  assert.equal(one[0].title, 'Demain dans le calendrier');
  assert.equal(one[0].body, 'Dentiste à 14:30');
  const all = n.planEventTomorrow({title: 'Anniversaire', date: '2026-10-23', who: 'all'});
  assert.equal(all[0].to, 'all');
  assert.deepEqual([].concat(all[0].except).filter(Boolean), [], 'auteur compris : on rappelle à tout le monde');
  assert.equal(all[0].body, 'Anniversaire (toute la famille)');
  assert.equal(n.planEventTomorrow({title: 'Sans qui', date: '2026-10-23'})[0].to, 'all');
  assert.equal(n.planEventTomorrow({title: '', date: '2026-10-23'}).length, 0);
  assert.equal(n.planEventTomorrow({title: 'x', date: 'demain'}).length, 0);
  assert.equal(n.planEventTomorrow(null).length, 0);
});
test('jour de demain dans le fuseau de la famille', () => {
  // 18 h à Paris le jeudi 22 octobre 2026 (heure d'été, UTC+2) = 16 h UTC
  assert.equal(n.ymdInZone(Date.UTC(2026, 9, 22, 16, 0), 'Europe/Paris'), '2026-10-22');
  // 23 h 30 UTC = déjà le lendemain à Paris
  assert.equal(n.ymdInZone(Date.UTC(2026, 9, 22, 23, 30), 'Europe/Paris'), '2026-10-23');
  // changement d'heure (fin octobre 2026 : le 25) : 18 h à Paris est 17 h UTC l'hiver
  assert.equal(n.ymdInZone(Date.UTC(2026, 9, 25, 17, 0), 'Europe/Paris'), '2026-10-25');
  assert.equal(n.addDaysYmd('2026-10-22', 1), '2026-10-23');
  assert.equal(n.addDaysYmd('2026-10-31', 1), '2026-11-01');
  assert.equal(n.addDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(n.addDaysYmd('2028-02-28', 1), '2028-02-29', 'année bissextile');
});

test('appareils visés', () => {
  const devices = [{token: 't1', who: 'a'}, {token: 't2', who: 'b'}, {token: 't3', who: 'a'}, {token: '', who: 'b'}, null];
  assert.deepEqual(n.pickDevices(devices, {to: ['b']}).map(d => d.token), ['t2']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: 'a'}).map(d => d.token), ['t2']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: ''}).map(d => d.token), ['t1', 't2', 't3']);
  assert.deepEqual(n.pickDevices(devices, {to: 'all', except: ['a', 'b']}).map(d => d.token), [], 'plusieurs personnes exclues');
  assert.deepEqual(n.pickDevices([{token: 't1', who: 'a'}, {token: 't2', who: 'c'}], {to: 'all', except: ['a', 'b']}).map(d => d.token), ['t2']);
});

test('plusieurs responsables : chacun reçoit son message avec les autres, les autres membres un message commun', () => {
  const r = create({owner: 'b', owners: ['b', 'c', 'mx1']});
  const perso = r.filter(m => m.to !== 'all');
  assert.deepEqual(perso.map(m => m.to[0]), ['b', 'c', 'mx1']);
  assert.match(perso[0].body, /Adao te confie « Linge » avec Fille et/);
  assert.equal(perso[0].body.includes('Maman'), false, 'on ne cite pas la personne elle-même');
  const all = r.find(m => m.to === 'all');
  assert.deepEqual(all.except, ['a', 'b', 'c', 'mx1']);
  assert.match(all.body, /pour Maman, Fille et /);
});
test('auteur parmi plusieurs responsables : il n\'est pas prévenu', () => {
  const r = create({owner: 'a', owners: ['a', 'b']});
  assert.deepEqual(r.filter(m => m.to !== 'all').map(m => m.to[0]), ['b']);
  assert.match(r[0].body, /avec Adao/);
  assert.deepEqual(r.find(m => m.to === 'all').except, ['a', 'b']);
});
test('responsable ajouté plus tard à une tâche : seul le nouveau est prévenu', () => {
  const r = n.planTask({owner: 'a', title: 'T'}, {title: 'T', owner: 'a', owners: ['a', 'b'], by: 'a', status: 'todo'}, nameOf);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].to, ['b']);
  assert.match(r[0].body, /avec Adao/);
  assert.equal(n.planTask({owners: ['a', 'b'], title: 'T'}, {title: 'T', owner: 'a', owners: ['a', 'b'], by: 'a', status: 'doing'}, nameOf).length, 0);
});
test('rappel d\'une tâche à plusieurs responsables : tous prévenus', () => {
  const T = 1000000000000;
  const r = n.planReminder({title: 'x', owner: 'a', owners: ['a', 'c'], remindAt: T - 1000, status: 'todo'}, T);
  assert.deepEqual(r[0].to, ['a', 'c']);
});
test('ownersOf : ancien champ owner, doublons et valeurs vides ignorés', () => {
  assert.deepEqual(n.ownersOf({owner: 'a'}), ['a']);
  assert.deepEqual(n.ownersOf({owner: 'a', owners: ['b', 'b', '', 3]}), ['b']);
  assert.deepEqual(n.ownersOf({owner: ''}), []);
  assert.deepEqual(n.ownersOf(null), []);
});

test('date limite dépassée : le responsable est interrogé, lien direct vers la tâche', () => {
  const r = n.planOverdue({title: 'Linge', owner: 'b', due: '2026-10-12', status: 'todo'}, '2026-10-13', 't1');
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].to, ['b']);
  assert.match(r[0].title, /en retard/);
  assert.match(r[0].body, /« Linge » était prévue le lundi 12 octobre/);
  assert.match(r[0].body, /qui l’a faite|repousse/);
  assert.equal(r[0].link, '?retard=t1');
});
test('date limite dépassée : plusieurs responsables, ou tout le monde si « à prendre »', () => {
  assert.deepEqual(n.planOverdue({title: 'x', owner: 'a', owners: ['a', 'c'], due: '2026-10-12'}, '2026-10-13', 't')[0].to, ['a', 'c']);
  assert.equal(n.planOverdue({title: 'x', owner: '', due: '2026-10-12'}, '2026-10-13', 't')[0].to, 'all');
});
test('date limite dépassée : rien si faite, pas encore passée, trop ancienne ou sans date', () => {
  const t = {title: 'x', owner: 'a', due: '2026-10-12', status: 'todo'};
  assert.equal(n.planOverdue(Object.assign({}, t, {status: 'done'}), '2026-10-13', 't').length, 0);
  assert.equal(n.planOverdue(t, '2026-10-12', 't').length, 0, 'le jour même : pas encore en retard');
  assert.equal(n.planOverdue(t, '2026-10-19', 't').length, 1);
  assert.equal(n.planOverdue(t, '2026-10-20', 't').length, 0, 'plus de 7 jours : on n\'insiste plus');
  assert.equal(n.planOverdue(Object.assign({}, t, {due: ''}), '2026-10-13', 't').length, 0);
  assert.equal(n.planOverdue(null, '2026-10-13', 't').length, 0);
});

test('tâche terminée : tous les autres sont prévenus, pas celui qui a validé', () => {
  const r = n.planTask({title: 'Linge', owner: 'b', status: 'doing'}, {title: 'Linge', owner: 'b', status: 'done', doneBy: 'b', pts: 3}, nameOf);
  assert.equal(r.length, 1);
  assert.equal(r[0].to, 'all');
  assert.equal(r[0].except, 'b');
  assert.equal(r[0].kind, 'done');
  assert.equal(r[0].title, 'Tâche terminée !');
  assert.match(r[0].body, /Maman a terminé « Linge » · \+3 pts\. Bravo !/);
  assert.ok(Array.isArray(r[0].vibrate));
});
test('tâche terminée à plusieurs : tous les participants nommés, points chacun', () => {
  const r = n.planTask({title: 'Garage', owner: 'a', owners: ['a', 'c'], status: 'todo'}, {title: 'Garage', owner: 'a', owners: ['a', 'c'], status: 'done', doneBy: 'a', pts: 2}, nameOf);
  assert.match(r[0].body, /Adao et Fille ont terminé « Garage » · \+2 pts chacun/);
  assert.equal(r[0].except, 'a');
});
test('tâche terminée : rien à la création, ni si elle était déjà terminée, ni quand elle est rouverte', () => {
  assert.equal(n.planTask(null, {title: 'x', status: 'done', createdAt: NOW, by: 'a'}, nameOf, NOW).length, 0);
  assert.equal(n.planTask({title: 'x', status: 'done'}, {title: 'x', status: 'done', doneBy: 'a'}, nameOf).length, 0);
  assert.equal(n.planTask({title: 'x', status: 'done', owner: 'a'}, {title: 'x', status: 'todo', owner: 'a'}, nameOf).length, 0);
});
test('tâche terminée sans doneBy (ancien appareil) : tout le monde est prévenu', () => {
  const r = n.planDone({title: 'x', owner: '', status: 'done'}, nameOf);
  assert.equal(r[0].except, '');
  assert.match(r[0].body, /Quelqu’un a terminé « x » · \+2 pts/);
});
