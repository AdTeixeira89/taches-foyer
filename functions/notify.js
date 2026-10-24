'use strict';
/* Family Play : qui doit être prévenu, et de quoi. Logique pure (sans Firebase), testée dans notify.test.js.
   Chaque fonction reçoit l'état d'un document avant/après son écriture et renvoie une liste de messages :
   { to: ['m1', ...] | 'all', except: identifiant(s) évité(s) quand to = 'all', title, body, tag } */

const clip = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > (n || 80) ? s.slice(0, (n || 80) - 1) + '…' : s; };
const quote = s => '« ' + clip(s) + ' »';

// prénoms : a, b, c puis les membres ajoutés (settings/family.members)
function nameResolver(settings){
  const names = Object.assign({a: 'Adao', b: 'Maman', c: 'Fille'}, (settings && settings.names) || {});
  ((settings && settings.members) || []).forEach(m => { if (m && m.id) names[m.id] = m.name || 'Membre'; });
  return k => names[k] || 'Quelqu’un';
}

// responsables d'une tâche : champ facultatif owners (plusieurs participants), sinon owner (un seul, anciennes données)
function ownersOf(t){
  const l = Array.isArray(t && t.owners) && t.owners.length ? t.owners : (t && t.owner ? [t.owner] : []);
  return Array.from(new Set(l.filter(x => typeof x === 'string' && x)));
}
const joinNames = (list, nameOf) => list.map(nameOf).join(list.length > 2 ? ', ' : ' et ').replace(/, ([^,]*)$/, ' et $1');

// une tâche : à sa création, tout le monde sauf l'auteur est prévenu ; chaque personne à qui elle est confiée
// reçoit un message qui lui est destiné (et pas deux). Plus tard, une tâche confiée à quelqu'un d'autre le prévient.
const FRESH_MS = 5 * 60 * 1000;  // on ne prévient que pour une création récente (pas pour une tâche recopiée ou restaurée)
function planTask(before, after, nameOf, now){
  if (!after || after.status === 'done') return [];
  const owners = ownersOf(after), tag = 'task-' + (after.title || '');
  const forYou = (author, others) => author + ' te confie ' + quote(after.title) + (others.length ? ' avec ' + joinNames(others, nameOf) : '');
  if (!before) {
    if (!after.by || !(Number(after.createdAt) > 0) || (now || Date.now()) - Number(after.createdAt) > FRESH_MS) return [];
    const out = [], title = quote(after.title), author = nameOf(after.by);
    const targets = owners.filter(o => o !== after.by);
    targets.forEach(o => out.push({to: [o], title: 'Une tâche pour toi', body: forYou(author, owners.filter(x => x !== o)), tag}));
    const skip = [after.by].concat(targets);
    if (!owners.length) out.push({to: 'all', except: skip, title: 'Nouvelle tâche à prendre', body: author + ' a ajouté ' + title + '. Qui la prend ?', tag: 'task-new-' + (after.title || '')});
    else {
      const forWho = owners.length === 1 && owners[0] === after.by ? '' : ' pour ' + joinNames(owners, nameOf);
      out.push({to: 'all', except: skip, title: 'Nouvelle tâche', body: author + ' a ajouté ' + title + forWho + '.', tag: 'task-new-' + (after.title || '')});
    }
    return out;
  }
  if (!owners.length || !after.by) return [];
  const before0 = ownersOf(before);
  return owners.filter(o => before0.indexOf(o) < 0 && o !== after.by)
    .map(o => ({to: [o], title: 'Une tâche pour toi', body: forYou(nameOf(after.by), owners.filter(x => x !== o)), tag}));
}

// rappel d'une tâche à l'heure choisie (champ remindAt, en millisecondes) : aux responsables, ou à tous si la tâche est « à prendre »
const REMIND_WINDOW_MS = 60 * 60 * 1000;  // un rappel manqué de plus d'une heure n'est plus envoyé
function planReminder(task, now){
  const at = Number(task && task.remindAt), t = now || Date.now();
  if (!(at > 0) || task.status === 'done' || at > t || t - at > REMIND_WINDOW_MS) return [];
  const title = quote(task.title), owners = ownersOf(task);
  return [{to: owners.length ? owners : 'all', except: '', title: 'Rappel', body: owners.length ? 'C’est l’heure : ' + title : 'Une tâche à prendre : ' + title, tag: 'remind-' + (task.title || '')}];
}

// date limite dépassée : le matin suivant, on demande aux responsables (ou à tous si « à prendre ») si la tâche est faite, et par qui, ou de repousser la date.
// Un message par tâche et par date limite (le lien ouvre directement la question dans l'app) ; au-delà de OVERDUE_DAYS jours, on n'insiste plus.
const OVERDUE_DAYS = 7;
function planOverdue(task, today, id){
  if (!task || task.status === 'done' || !/^\d{4}-\d{2}-\d{2}$/.test(task.due || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return [];
  if (task.due >= today || task.due < addDaysYmd(today, -OVERDUE_DAYS)) return [];
  const owners = ownersOf(task), when = dateLabel(task.due);
  return [{to: owners.length ? owners : 'all', except: '', title: 'Tâche en retard : est-elle faite ?',
    body: quote(task.title) + ' était prévue ' + (when ? 'le ' + when : 'avant aujourd’hui') + '. Dis qui l’a faite, ou repousse la date.',
    tag: 'overdue-' + (id || task.title || ''), link: id ? '?retard=' + encodeURIComponent(id) : ''}];
}

// jokers : demande d'échange ou d'aide, puis réponse
function planJoker(before, after, nameOf){
  if (!after) return [];
  const t = quote(after.taskTitle);
  if (!before) {
    if (after.kind === 'swap' && after.status === 'pending' && after.to) {
      return [{to: [after.to], title: 'Demande d’échange', body: nameOf(after.who) + ' aimerait te passer ' + t + '. Ouvre l’app pour répondre.', tag: 'joker-swap'}];
    }
    if (after.kind === 'help' && after.status === 'open') {
      return after.want
        ? [{to: [after.want], title: 'Un coup de main ?', body: nameOf(after.who) + ' aimerait de l’aide pour ' + t + '.', tag: 'joker-help'}]
        : [{to: 'all', except: after.who, title: 'Un coup de main ?', body: nameOf(after.who) + ' aimerait de l’aide pour ' + t + '.', tag: 'joker-help'}];
    }
    return [];
  }
  if (before.status === after.status) return [];
  if (after.kind === 'swap' && before.status === 'pending') {
    if (after.status === 'accepted') return [{to: [after.who], title: 'Échange accepté', body: nameOf(after.to) + ' prend ' + t + '.', tag: 'joker-swap-answer'}];
    if (after.status === 'refused') return [{to: [after.who], title: 'Échange non retenu', body: nameOf(after.to) + ' ne peut pas prendre ' + t + ' cette fois.', tag: 'joker-swap-answer'}];
  }
  if (after.kind === 'help' && before.status === 'open' && after.status === 'accepted' && after.helper) {
    return [{to: [after.who], title: 'Merci à ' + nameOf(after.helper) + ' !', body: nameOf(after.helper) + ' s’en occupe : ' + t + '.', tag: 'joker-help-answer'}];
  }
  return [];
}

// événement du calendrier créé par quelqu'un d'autre
const FR_DATE = new Intl.DateTimeFormat('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'});
function dateLabel(d){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
  return m ? FR_DATE.format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))) : '';
}
function planEvent(before, after, nameOf){
  if (before || !after || !after.title) return [];
  const when = [dateLabel(after.date), after.time ? 'à ' + after.time : ''].filter(Boolean).join(' ');
  const body = clip(after.title) + (when ? ' · ' + when : '');
  if (!after.who || after.who === 'all') return [{to: 'all', except: after.by || '', title: 'Nouvel événement', body, tag: 'event'}];
  if (after.who === after.by) return [];
  return [{to: [after.who], title: 'Nouvel événement pour toi', body, tag: 'event'}];
}

// la veille d'un événement du calendrier : la personne concernée, ou toute la famille (auteur compris)
const TIMEZONE = 'Europe/Paris';  // fuseau de la famille : « la veille à 18 h » se calcule dans ce fuseau
function ymdInZone(ms, tz){
  const p = {};
  new Intl.DateTimeFormat('en-CA', {timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
function addDaysYmd(s, n){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}
function planEventTomorrow(event){
  if (!event || !event.title || !/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) return [];
  const all = !event.who || event.who === 'all';
  const body = clip(event.title) + (event.time ? ' à ' + event.time : '') + (all ? ' (toute la famille)' : '');
  return [{to: all ? 'all' : [event.who], except: '', title: 'Demain dans le calendrier', body, tag: 'event-tomorrow'}];
}

// semaine terminée : le champion est connu
function planWeek(before, after, nameOf){
  if (before || !after || !Array.isArray(after.champions) || !after.champions.length) return [];
  const who = after.champions.map(nameOf).join(' et ');
  return [{to: 'all', except: '', title: 'Champion de la semaine', body: who + ' (' + (Number(after.max) || 0) + ' pts). Bravo à toute la famille !', tag: 'week'}];
}

// quels appareils reçoivent un message ?
function pickDevices(devices, msg){
  const except = [].concat(msg.except || []).filter(Boolean);
  return devices.filter(d => d && d.token && (msg.to === 'all' ? except.indexOf(d.who) < 0 : msg.to.indexOf(d.who) >= 0));
}

module.exports = {ownersOf, clip, nameResolver, planTask, planJoker, planEvent, planWeek, planReminder, planOverdue, planEventTomorrow, ymdInZone, addDaysYmd, pickDevices, dateLabel, REMIND_WINDOW_MS, OVERDUE_DAYS, TIMEZONE};
