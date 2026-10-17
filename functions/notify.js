'use strict';
/* Family Play : qui doit être prévenu, et de quoi. Logique pure (sans Firebase), testée dans notify.test.js.
   Chaque fonction reçoit l'état d'un document avant/après son écriture et renvoie une liste de messages :
   { to: ['m1', ...] | 'all', except: identifiant évité quand to = 'all', title, body, tag } */

const clip = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > (n || 80) ? s.slice(0, (n || 80) - 1) + '…' : s; };
const quote = s => '« ' + clip(s) + ' »';

// prénoms : a, b, c puis les membres ajoutés (settings/family.members)
function nameResolver(settings){
  const names = Object.assign({a: 'Adao', b: 'Maman', c: 'Fille'}, (settings && settings.names) || {});
  ((settings && settings.members) || []).forEach(m => { if (m && m.id) names[m.id] = m.name || 'Membre'; });
  return k => names[k] || 'Quelqu’un';
}

// une tâche confiée à quelqu'un d'autre que soi
function planTask(before, after, nameOf){
  if (!after || after.status === 'done' || !after.owner) return [];
  if (before && before.owner === after.owner) return [];
  if (!after.by || after.by === after.owner) return [];
  return [{to: [after.owner], title: 'Une tâche pour toi', body: nameOf(after.by) + ' te confie ' + quote(after.title), tag: 'task-' + (after.title || '')}];
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

// semaine terminée : le champion est connu
function planWeek(before, after, nameOf){
  if (before || !after || !Array.isArray(after.champions) || !after.champions.length) return [];
  const who = after.champions.map(nameOf).join(' et ');
  return [{to: 'all', except: '', title: 'Champion de la semaine', body: who + ' (' + (Number(after.max) || 0) + ' pts). Bravo à toute la famille !', tag: 'week'}];
}

// quels appareils reçoivent un message ?
function pickDevices(devices, msg){
  return devices.filter(d => d && d.token && (msg.to === 'all' ? d.who !== msg.except : msg.to.indexOf(d.who) >= 0));
}

module.exports = {clip, nameResolver, planTask, planJoker, planEvent, planWeek, pickDevices, dateLabel};
