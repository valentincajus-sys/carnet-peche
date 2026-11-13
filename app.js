/* Carnet de pêche — application locale (données dans le navigateur), interface SB Admin 2 */
(() => {
'use strict';

const KEY = 'peche.db.v1';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const nf = (n, d = 1) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: d });
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fa = (n, cls = '') => `<i class="fas fa-${n}${cls ? ' ' + cls : ''}" aria-hidden="true"></i>`;

const METEO = { 'Ensoleillé': 'sun', 'Nuageux': 'cloud', 'Variable': 'cloud-sun', 'Pluvieux': 'cloud-rain', 'Orageux': 'bolt', 'Neigeux/Pluvieux': 'snowflake', 'Neigeux': 'snowflake', 'Voilé': 'smog', 'Brouillard': 'smog' };
const meteoIc = v => fa(METEO[v] || 'cloud-sun');
const COMPASS = ['Nord-Ouest', 'Nord', 'Nord-Est', 'Ouest', 'Sans', 'Est', 'Sud-Ouest', 'Sud', 'Sud-Est'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const PALETTE = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'];

/* ---------------- Stockage ---------------- */
function freshDb() {
  const d = JSON.parse(JSON.stringify(window.SEED || { catches: [], sessions: [] }));
  d.live = null; d.settings = {}; d.spots = {};
  return d;
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.catches) && Array.isArray(d.sessions)) { d.settings = d.settings || {}; d.spots = d.spots || {}; return d; }
  } catch (e) { /* données illisibles : on repart de la base d'origine */ }
  return freshDb();
}
let db = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch (e) { toast('Enregistrement impossible : stockage du navigateur indisponible'); }
}

/* ---------------- Dates ---------------- */
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const toDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtD = (s, o = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => s ? toDate(s).toLocaleDateString('fr-FR', o) : '';
const D_SHORT = { day: 'numeric', month: 'short', year: 'numeric' };
const mins = t => t ? +t.slice(0, 2) * 60 + +t.slice(3, 5) : null;
const fmtDur = m => { m = Math.round(m); const h = Math.floor(m / 60); return h ? `${h} h ${pad(m % 60)}` : `${m} min`; };
function sDur(s) {
  const a = mins(s.debut); let b = mins(s.fin);
  if (a == null) return 0;
  if (b == null) { if (db.live === s.id) b = (s.date === today() ? mins(nowHM()) : 24 * 60); else return 0; }
  return Math.max(0, b - a);
}
const byRecent = (a, b) => (b.date + (b.time || b.debut || '')).localeCompare(a.date + (a.time || a.debut || ''));
const sorted = t => [...db[t]].sort(byRecent);
const liveSession = () => db.sessions.find(s => s.id === db.live) || null;

/* ---------------- Listes de valeurs ---------------- */
const FIELDS = {
  poisson: { label: 'Poisson', nw: 'Nouveau poisson', src: [['catches', 'poisson']] },
  technique: { label: 'Technique', nw: 'Nouvelle technique', src: [['catches', 'technique']] },
  equipement: { label: 'Équipement', nw: 'Nouvel équipement', src: [['catches', 'equipement']] },
  leurre: { label: 'Appât / Leurre', nw: 'Nouvel appât / leurre', src: [['catches', 'leurre']] },
  riviere: { label: "Cours d'eau", nw: "Nouveau cours d'eau", src: [['catches', 'riviere'], ['sessions', 'coursEau']] },
  spot: { label: 'Spot', nw: 'Nouveau spot', src: [['catches', 'spot'], ['sessions', 'spot']] },
  commune: { label: 'Commune', nw: 'Nouvelle commune', src: [['sessions', 'commune']] },
  departement: { label: 'Département', nw: 'Nouveau département', src: [['sessions', 'departement']] },
  cible: { label: 'Poisson recherché', nw: 'Nouveau poisson recherché', src: [['sessions', 'cible']] },
  meteo: { label: 'Météo', nw: 'Nouvelle météo', src: [['sessions', 'meteo']] },
  vent: { label: 'Vent', nw: 'Nouveau vent', src: [['sessions', 'vent']] },
};
function counts(field) {
  const m = new Map();
  for (const [t, f] of FIELDS[field].src) for (const o of db[t]) if (o[f]) m.set(o[f], (m.get(o[f]) || 0) + 1);
  return m;
}
/* Les valeurs utilisées récemment d'abord (pratique au bord de l'eau), puis par fréquence. */
function options(field) {
  const m = counts(field), recent = [];
  for (const [t, f] of FIELDS[field].src) for (const o of sorted(t).slice(0, 30)) if (o[f] && !recent.includes(o[f])) recent.push(o[f]);
  const head = recent.slice(0, 5);
  const rest = [...m.keys()].filter(v => !head.includes(v)).sort((a, b) => m.get(b) - m.get(a) || a.localeCompare(b));
  return [...head, ...rest].map(v => ({ v, n: m.get(v) }));
}
const alpha = field => [...counts(field).keys()].sort((a, b) => a.localeCompare(b));
function typicalSize(poisson) {
  const a = db.catches.filter(c => c.poisson === poisson && c.taille).map(c => c.taille).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : null;
}

/* ---------------- Toast ---------------- */
let toastT;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2400);
}

/* ---------------- Feuilles modales ---------------- */
const stack = [];
function sheet({ render, on = {}, input }) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = '<div class="sheet-bg" data-act="close"></div><div class="sheet modal-content shadow-lg" role="dialog" aria-modal="true"></div>';
  const panel = wrap.lastChild;
  const api = {
    el: panel,
    close() {
      wrap.classList.remove('open'); stack.splice(stack.indexOf(api), 1);
      if (!stack.length) document.body.classList.remove('locked');
      setTimeout(() => wrap.remove(), 300);
    },
    refresh() {
      const sc = $('.modal-body', panel)?.scrollTop || 0;
      panel.innerHTML = render();
      const b = $('.modal-body', panel); if (b) b.scrollTop = sc;
    },
  };
  wrap.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return;
    if (t.dataset.act === 'close') return api.close();
    on[t.dataset.act]?.(t, api);
  });
  if (input) wrap.addEventListener('input', e => input(e.target, api));
  $('#sheets').appendChild(wrap); api.refresh(); stack.push(api);
  document.body.classList.add('locked');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('open')));
  return api;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && stack.length) stack[stack.length - 1].close(); });

const head = t => `<div class="modal-header"><h5 class="modal-title">${esc(t)}</h5><button type="button" class="close" data-act="close" aria-label="Fermer"><span aria-hidden="true">&times;</span></button></div>`;
const foot = (label, extra = '') => `<div class="modal-footer">${extra}<button type="button" class="btn btn-primary btn-lg" data-act="save">${label}</button></div>`;
const pickRow = (label, field, key, val) =>
  `<button type="button" class="list-group-item list-group-item-action pick" data-act="pick" data-field="${field}" data-key="${key}"><span>${label}</span><b class="${val ? '' : 'none'}">${esc(val) || 'Choisir'}</b>${fa('chevron-right')}</button>`;
const chip = (key, v, on, label = esc(v)) => `<button type="button" class="btn rounded-pill chip ${on ? 'btn-primary' : 'btn-outline-primary'}" data-act="set" data-key="${key}" data-val="${esc(v)}">${label}</button>`;
const newChip = (field, key) => `<button type="button" class="btn btn-light rounded-pill chip text-success font-weight-bold" data-act="new" data-field="${field}" data-key="${key}">${fa('plus', 'mr-1')}Nouveau</button>`;
const normKey = v => String(v).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
/* Saisie d'une nouvelle valeur (nouveau spot, nouveau poisson, etc.). Une valeur déjà connue est réutilisée telle quelle. */
function newValue(field, cb, initial = '') {
  let v = initial;
  const submit = api => {
    let val = v.replace(/\s+/g, ' ').trim();
    val = val.charAt(0).toUpperCase() + val.slice(1);
    if (!val) return toast('Écris un nom');
    const known = [...counts(field).keys()].find(x => normKey(x) === normKey(val));
    api.close(); cb(known || val);
    if (known) toast(`« ${known} » existe déjà : sélectionné`);
  };
  const api = sheet({
    render: () => `${head(FIELDS[field].nw)}<div class="modal-body">
      <label class="small font-weight-bold text-gray-600 mt-2" for="nv">Nom</label>
      <input id="nv" type="text" class="form-control form-control-lg" data-nv value="${esc(v)}" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="${esc(FIELDS[field].label)}">
      <p class="small text-gray-500 mt-2 mb-0">Il sera ajouté à la liste et proposé les prochaines fois.</p></div>
      ${foot(`${fa('plus', 'mr-1')}Ajouter`)}`,
    input: t => { if (t.matches('[data-nv]')) v = t.value; },
    on: { save: (t, api) => submit(api) },
  });
  const inp = $('[data-nv]', api.el);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(api); } });
  inp.focus();
}
function chipList(key, field, val, max = 7, deco = v => esc(v)) {
  let list = options(field).slice(0, max).map(o => o.v);
  if (val && !list.includes(val)) list = [val, ...list.slice(0, max - 1)];
  return `<div class="chips">${list.map(v => chip(key, v, v === val, deco(v))).join('')}
    ${newChip(field, key)}<button type="button" class="btn btn-light rounded-pill chip text-primary" data-act="pick" data-field="${field}" data-key="${key}">${fa('list', 'mr-1')}Tous…</button></div>`;
}
const stepper = (key, val, unit, cls = '', min = 0) =>
  `<div class="input-group stepper ${cls}"><div class="input-group-prepend"><button type="button" class="btn btn-outline-primary" data-act="step" data-key="${key}" data-d="-1" data-min="${min}" aria-label="Moins">−</button></div>
   <input type="number" inputmode="decimal" class="form-control" data-f="${key}" value="${val ?? ''}" placeholder="–" aria-label="${key}">
   <div class="input-group-append">${unit ? `<span class="input-group-text">${unit}</span>` : ''}<button type="button" class="btn btn-outline-primary" data-act="step" data-key="${key}" data-d="1" data-min="${min}" aria-label="Plus">+</button></div></div>`;
const lbl = (t, extra = '') => `<div class="fl"><span>${t}</span>${extra}</div>`;

function picker(field, current, cb) {
  let q = '';
  const list = () => {
    const all = options(field), k = q.trim().toLowerCase();
    const shown = k ? all.filter(o => o.v.toLowerCase().includes(k)) : all;
    const exact = all.some(o => o.v.toLowerCase() === k);
    return `<div class="list-group opt-list">${k && !exact ? `<button type="button" class="list-group-item list-group-item-action text-primary" data-act="create"><span>${fa('plus', 'mr-2')}Créer « ${esc(q.trim())} »</span></button>` : ''}
      ${shown.map(o => `<button type="button" class="list-group-item list-group-item-action${o.v === current ? ' active' : ''}" data-act="choose" data-val="${esc(o.v)}"><span>${esc(o.v)}</span><span class="badge badge-pill ${o.v === current ? 'badge-light' : 'badge-secondary'}">${o.n}</span></button>`).join('')}
      ${!k && current ? '<button type="button" class="list-group-item list-group-item-action text-gray-500" data-act="choose" data-val="">Aucun (vider)</button>' : ''}</div>`;
  };
  sheet({
    render: () => `${head(FIELDS[field].label)}<div class="modal-body">
      <div class="input-group mb-3"><div class="input-group-prepend"><span class="input-group-text bg-light border-0">${fa('search', 'fa-sm')}</span></div>
      <input type="search" class="form-control bg-light border-0" placeholder="Rechercher…" data-q autocomplete="off" autocapitalize="sentences"></div>
      <button type="button" class="btn btn-success btn-block mb-3" data-act="new">${fa('plus', 'mr-1')}${esc(FIELDS[field].nw)}</button>
      <div data-list>${list()}</div></div>`,
    input: (t, api) => { if (t.matches('[data-q]')) { q = t.value; $('[data-list]', api.el).innerHTML = list(); } },
    on: {
      new: (t, api) => { api.close(); newValue(field, cb, q.trim()); },
      choose: (t, api) => { api.close(); cb(t.dataset.val); },
      create: (t, api) => { api.close(); cb(q.trim()); },
    },
  });
}

/* ---------------- Saisie d'une prise ---------------- */
function catchSheet(orig, preset = {}) {
  const isNew = !orig;
  const sess = isNew ? (preset.sessionId ? db.sessions.find(s => s.id === preset.sessionId) : liveSession()) : null;
  const all = sorted('catches');
  const ref = (sess && (all.find(c => c.sessionId === sess.id) || all.find(c => c.spot && c.spot === sess.spot)
    || all.find(c => sess.cible && c.poisson.startsWith(sess.cible)))) || all[0] || {};
  const f = orig ? { ...orig } : {
    id: uid('c'), date: sess ? sess.date : today(), time: nowHM(),
    riviere: sess ? sess.coursEau : ref.riviere || '', spot: sess ? sess.spot : ref.spot || '',
    poisson: ref.poisson || '', nbre: 1, taille: null, sort: 'Relâché',
    technique: ref.technique || '', equipement: ref.equipement || '', leurre: ref.leurre || '', note: '',
    sessionId: sess ? sess.id : undefined, ...preset,
  };
  let sizeTouched = !isNew;
  const apply = (key, v, api) => {
    f[key] = v;
    if (key === 'poisson' && !sizeTouched) f.taille = typicalSize(v);
    if (key === 'spot' && v) { const p = all.find(c => c.spot === v && c.riviere); if (p) f.riviere = p.riviere; }
    api.refresh();
  };
  if (isNew && f.taille == null) f.taille = typicalSize(f.poisson);
  const num = k => ['taille', 'nbre'].includes(k);
  let posTouched = !isNew, spotTouched = !isNew || !!sess, locating = isNew, posErr = '';
  const posBlock = () => {
    const sp = spotPos(f.spot);
    const txt = f.lat != null ? `${fa('map-marker-alt', 'text-primary mr-2')}<b>Position GPS</b> <span class="text-gray-500">${f.acc ? '±' + f.acc + ' m' : '(placée à la main)'}</span>`
      : locating ? `${fa('spinner', 'fa-spin text-gray-400 mr-2')}Recherche de ta position GPS…`
      : sp ? `${fa('map-marker-alt', 'text-success mr-2')}Position du spot « ${esc(f.spot)} »${posErr ? ` <span class="text-gray-500">(${esc(posErr)})</span>` : ''}`
      : `${fa('map-marker-alt', 'text-gray-300 mr-2')}<span class="text-gray-500">${esc(posErr || 'Pas de position')}</span>`;
    return `<div class="list-group-item d-flex align-items-center flex-wrap" style="gap:.5rem" data-pos><span class="flex-fill small">${txt}</span>
      <button type="button" class="btn btn-sm btn-outline-primary" data-act="adjust">${fa('crosshairs', 'mr-1')}${f.lat != null ? 'Ajuster' : 'Placer'}</button>
      ${f.lat != null ? `<button type="button" class="btn btn-sm btn-light" data-act="clearpos" aria-label="Effacer la position">${fa('times')}</button>` : ''}</div>`;
  };
  const updPos = () => { const el = $('[data-pos]', api.el); if (el) el.outerHTML = posBlock(); };

  const api = sheet({
    render: () => `${head(isNew ? 'Nouvelle prise' : 'Modifier la prise')}
      <div class="modal-body">
        ${lbl('Poisson')}${chipList('poisson', 'poisson', f.poisson, 7)}
        ${lbl('Taille')}${stepper('taille', f.taille, 'cm', 'big', 1)}
        <input type="range" class="custom-range" min="5" max="130" step="1" value="${f.taille || 5}" data-f="taille" aria-label="Taille en centimètres">
        <div class="form-row">
          <div class="col-6">${lbl('Nombre')}${stepper('nbre', f.nbre, '', '', 1)}</div>
          <div class="col-6">${lbl('Devenir')}<div class="btn-group d-flex" role="group">${['Relâché', 'Prélevé'].map(v => `<button type="button" class="btn w-100 ${f.sort === v ? 'btn-primary' : 'btn-outline-primary'}" style="min-height:calc(1.5em + .75rem + 2px)" data-act="set" data-key="sort" data-val="${v}">${v}</button>`).join('')}</div></div>
        </div>
        ${lbl('Montage')}
        <div class="list-group">${pickRow('Appât / Leurre', 'leurre', 'leurre', f.leurre)}${pickRow('Technique', 'technique', 'technique', f.technique)}${pickRow('Équipement', 'equipement', 'equipement', f.equipement)}</div>
        ${lbl('Lieu')}
        <div class="list-group">${pickRow('Spot', 'spot', 'spot', f.spot)}${pickRow("Cours d'eau", 'riviere', 'riviere', f.riviere)}${posBlock()}</div>
        ${lbl('Moment')}
        <div class="form-row"><div class="col"><input type="date" class="form-control" data-f="date" value="${f.date}" aria-label="Date"></div><div class="col"><input type="time" class="form-control" data-f="time" value="${f.time}" aria-label="Heure"></div></div>
        ${lbl('Note')}<textarea class="form-control" rows="2" data-f="note" placeholder="Facultatif">${esc(f.note || '')}</textarea>
        ${isNew ? '' : `<button type="button" class="btn btn-outline-danger btn-block mt-4" data-act="del">${fa('trash', 'mr-1')} Supprimer cette prise</button>`}
      </div>${foot(isNew ? `${fa('check', 'mr-1')} Enregistrer la prise` : 'Enregistrer')}`,
    input: (t, api) => {
      const k = t.dataset.f; if (!k) return;
      f[k] = num(k) ? (t.value === '' ? null : +t.value) : t.value;
      if (k === 'taille') { sizeTouched = true; $$('[data-f="taille"]', api.el).forEach(el => { if (el !== t) el.value = f.taille ?? ''; }); }
    },
    on: {
      set: (t, api) => {
        f[t.dataset.key] = t.dataset.val;
        if (t.dataset.key === 'poisson' && !sizeTouched) f.taille = typicalSize(f.poisson);
        api.refresh();
      },
      step: (t, api) => {
        const k = t.dataset.key; f[k] = Math.max(+t.dataset.min, (+f[k] || 0) + +t.dataset.d);
        if (k === 'taille') sizeTouched = true;
        $$(`[data-f="${k}"]`, api.el).forEach(el => { el.value = f[k]; });
      },
      pick: (t, api) => picker(t.dataset.field, f[t.dataset.key], v => { if (t.dataset.key === 'spot') spotTouched = true; apply(t.dataset.key, v, api); }),
      new: (t, api) => newValue(t.dataset.field, v => { if (t.dataset.key === 'spot') spotTouched = true; apply(t.dataset.key, v, api); }),
      adjust: () => pickLocation({ title: 'Position de la prise', start: f.lat != null ? [f.lat, f.lng] : spotPos(f.spot), cb: p => { [f.lat, f.lng] = p; f.acc = null; posTouched = true; locating = false; updPos(); } }),
      clearpos: () => { delete f.lat; delete f.lng; delete f.acc; posTouched = true; locating = false; updPos(); },
      save: (t, api) => {
        if (!f.poisson) return toast('Choisis un poisson');
        if (!f.date || !f.time) return toast('Date et heure requises');
        f.nbre = Math.max(1, Math.round(+f.nbre || 1));
        const s = db.sessions.find(x => x.id === f.sessionId);
        if (isNew) { db.catches.push(f); if (s) s.pris = (s.pris || 0) + f.nbre; }
        else { if (s) s.pris = Math.max(0, (s.pris || 0) + f.nbre - (orig.nbre || 1)); db.catches[db.catches.findIndex(c => c.id === f.id)] = f; }
        if (f.acc === null) delete f.acc;
        let placed = false;
        if (f.lat != null && f.spot && !db.spots[f.spot]) { db.spots[f.spot] = { lat: f.lat, lng: f.lng }; placed = true; }
        save(); api.close(); render();
        toast((isNew ? `${f.poisson}${f.taille ? ' de ' + f.taille + ' cm' : ''} enregistré` : 'Prise modifiée') + (placed ? ` · spot « ${f.spot} » placé sur la carte` : ''));
      },
      del: (t, api) => {
        if (!confirm('Supprimer définitivement cette prise ?')) return;
        const s = db.sessions.find(x => x.id === orig.sessionId);
        if (s) s.pris = Math.max(0, (s.pris || 0) - (orig.nbre || 1));
        db.catches = db.catches.filter(c => c.id !== orig.id);
        save(); api.close(); render(); toast('Prise supprimée');
      },
    },
  });
  if (isNew) gps.once().then(p => {
    locating = false;
    if (posTouched) return updPos();
    f.lat = p.lat; f.lng = p.lng; f.acc = p.acc;
    const n = !spotTouched && nearestSpot([p.lat, p.lng]);
    if (n && n.n !== f.spot) { apply('spot', n.n, api); toast(`Spot le plus proche : ${n.n} (${fmtDist(n.d)})`); } else updPos();
  }).catch(e => { locating = false; posErr = e.message; updPos(); });
}

/* ---------------- Saisie d'une session ---------------- */
function sessionSheet(orig, mode) { // mode : 'start' | 'edit' | 'end' | 'past'
  const last = sorted('sessions')[0] || {};
  const f = orig ? { ...orig } : {
    id: uid('s'), date: today(), debut: nowHM(), fin: mode === 'past' ? nowHM() : '',
    departement: last.departement || '', commune: last.commune || '', spot: last.spot || '', coursEau: last.coursEau || '',
    tAir: null, tEau: null, meteo: '', vent: '', cible: last.cible || '', pris: 0, rates: 0, leurresPerdus: 0, note: '',
  };
  if (mode === 'end') f.fin = nowHM();
  const title = { start: 'Démarrer une session', edit: 'Modifier la session', end: 'Terminer la session', past: 'Ajouter une session passée' }[mode];
  const numKeys = ['tAir', 'tEau', 'pris', 'rates', 'leurresPerdus'];
  const winds = [...COMPASS, ...options('vent').map(o => o.v).filter(v => !COMPASS.includes(v))];
  let busy = false;
  const apply = (key, v, api) => {
    f[key] = v;
    if (key === 'spot' && v) { // un spot connu remplit le reste du lieu
      const p = sorted('sessions').find(s => s.spot === v);
      if (p) { f.coursEau = p.coursEau; f.commune = p.commune; f.departement = p.departement; }
      else { const c = sorted('catches').find(x => x.spot === v && x.riviere); if (c) f.coursEau = c.riviere; }
    }
    api.refresh();
  };
  const numIn = (k, l) => `<div class="col-4"><label class="small text-gray-600 mb-1 d-block text-truncate">${l}</label><input type="number" inputmode="numeric" min="0" class="form-control text-center font-weight-bold" data-f="${k}" value="${f[k] ?? 0}"></div>`;

  sheet({
    render: () => `${head(title)}
      <div class="modal-body">
        ${lbl('Lieu')}
        <div class="list-group">${pickRow('Spot', 'spot', 'spot', f.spot)}${pickRow("Cours d'eau", 'riviere', 'coursEau', f.coursEau)}${pickRow('Commune', 'commune', 'commune', f.commune)}${pickRow('Département', 'departement', 'departement', f.departement)}</div>
        ${lbl('Poisson recherché')}${chipList('cible', 'cible', f.cible, 6)}
        ${lbl('Météo', `<button type="button" class="btn btn-link" data-act="auto">${fa('location-arrow', 'mr-1')}${busy ? 'Recherche…' : 'Remplir automatiquement'}</button>`)}
        ${chipList('meteo', 'meteo', f.meteo, 8, v => meteoIc(v) + ' ' + esc(v))}
        <div class="form-row">
          <div class="col-6">${lbl('T° air')}${stepper('tAir', f.tAir, '°C', '', -30)}</div>
          <div class="col-6">${lbl('T° eau')}${stepper('tEau', f.tEau, '°C', '', 0)}</div>
        </div>
        ${lbl('Vent')}
        <div class="compass">${winds.map(v => chip('vent', v, f.vent === v, v === 'Sans' ? 'Sans vent' : esc(v))).join('')}${newChip('vent', 'vent')}</div>
        ${lbl('Horaires')}
        <div class="form-row">
          <div class="col"><label class="small text-gray-600 mb-1">Date</label><input type="date" class="form-control" data-f="date" value="${f.date}"></div>
          <div class="col"><label class="small text-gray-600 mb-1">Début</label><input type="time" class="form-control" data-f="debut" value="${f.debut}"></div>
          ${mode === 'start' ? '' : `<div class="col"><label class="small text-gray-600 mb-1">Fin</label><input type="time" class="form-control" data-f="fin" value="${f.fin}"></div>`}
        </div>
        ${mode === 'start' ? '' : `${lbl('Bilan')}<div class="form-row">${numIn('pris', 'Poissons pris')}${numIn('rates', 'Poissons ratés')}${numIn('leurresPerdus', 'Leurres perdus')}</div>`}
        ${lbl('Note')}<textarea class="form-control" rows="2" data-f="note" placeholder="Niveau d'eau, couleur, observations…">${esc(f.note || '')}</textarea>
        ${mode === 'edit' ? `<button type="button" class="btn btn-outline-danger btn-block mt-4" data-act="del">${fa('trash', 'mr-1')} Supprimer cette session</button>` : ''}
      </div>${foot({ start: `${fa('play', 'mr-1')} Démarrer la session`, end: `${fa('flag-checkered', 'mr-1')} Terminer la session` }[mode] || 'Enregistrer')}`,
    input: t => { const k = t.dataset.f; if (k) f[k] = numKeys.includes(k) ? (t.value === '' ? null : +t.value) : t.value; },
    on: {
      set: (t, api) => { f[t.dataset.key] = f[t.dataset.key] === t.dataset.val && t.dataset.key !== 'cible' ? '' : t.dataset.val; api.refresh(); },
      step: (t, api) => {
        const k = t.dataset.key;
        f[k] = f[k] == null ? (k === 'tAir' ? last.tAir ?? 15 : last.tEau ?? 12) : Math.max(+t.dataset.min, f[k] + +t.dataset.d);
        $(`[data-f="${k}"]`, api.el).value = f[k];
      },
      pick: (t, api) => picker(t.dataset.field, f[t.dataset.key], v => apply(t.dataset.key, v, api)),
      new: (t, api) => newValue(t.dataset.field, v => apply(t.dataset.key, v, api)),
      auto: async (t, api) => {
        if (busy) return;
        busy = true; api.refresh();
        try { Object.assign(f, await autoWeather()); toast('Météo du lieu récupérée'); }
        catch (e) { toast(e.message || 'Météo indisponible'); }
        busy = false; api.refresh();
      },
      save: (t, api) => {
        if (!f.date || !f.debut) return toast('Date et heure de début requises');
        if (mode !== 'start' && !f.fin && db.live !== f.id) return toast('Heure de fin requise');
        for (const k of ['pris', 'rates', 'leurresPerdus']) f[k] = Math.max(0, Math.round(+f[k] || 0));
        if (orig) db.sessions[db.sessions.findIndex(s => s.id === f.id)] = f; else db.sessions.push(f);
        if (mode === 'start') db.live = f.id;
        if (mode === 'end') db.live = null;
        save(); api.close();
        if (mode === 'start') location.hash = '#/';
        render();
        toast({ start: 'Session démarrée — bonne pêche !', end: 'Session terminée', edit: 'Session modifiée', past: 'Session ajoutée' }[mode]);
      },
      del: (t, api) => {
        const n = db.catches.filter(c => c.sessionId === orig.id).length;
        if (!confirm(`Supprimer définitivement cette session ?${n ? `\nSes ${n} prise(s) restent dans le journal.` : ''}`)) return;
        db.sessions = db.sessions.filter(s => s.id !== orig.id);
        db.catches.forEach(c => { if (c.sessionId === orig.id) delete c.sessionId; });
        if (db.live === orig.id) db.live = null;
        save(); api.close(); location.hash = '#/sessions'; render(); toast('Session supprimée');
      },
    },
  });
}

/* Météo actuelle du lieu (position GPS → service gratuit Open-Meteo). Uniquement sur demande. */
async function autoWeather() {
  if (!navigator.geolocation) throw new Error('Géolocalisation indisponible');
  const pos = await new Promise((ok, ko) => navigator.geolocation.getCurrentPosition(ok, () => ko(new Error('Position GPS refusée ou indisponible')), { timeout: 12000, maximumAge: 600000 }));
  const { latitude: la, longitude: lo } = pos.coords;
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la.toFixed(3)}&longitude=${lo.toFixed(3)}&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m`);
  if (!r.ok) throw new Error('Service météo indisponible');
  const c = (await r.json()).current, w = c.weather_code;
  const meteo = w === 0 ? 'Ensoleillé' : w <= 2 ? 'Variable' : w === 3 ? 'Nuageux' : w <= 48 ? 'Voilé' : w >= 95 ? 'Orageux' : (w >= 71 && w <= 77) || w === 85 || w === 86 ? 'Neigeux/Pluvieux' : 'Pluvieux';
  const dirs = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Sud-Ouest', 'Ouest', 'Nord-Ouest'];
  return { tAir: Math.round(c.temperature_2m), meteo, vent: c.wind_speed_10m < 6 ? 'Sans' : dirs[Math.round(c.wind_direction_10m / 45) % 8] };
}

function addMenu() {
  if (liveSession()) return catchSheet();
  const item = (act, icon, color, t, s) => `<button type="button" class="list-group-item list-group-item-action menu-item" data-act="${act}"><div class="icon-circle bg-${color}">${fa(icon, 'text-white')}</div><span><b>${t}</b><small>${s}</small></span></button>`;
  sheet({
    render: () => `${head('Ajouter')}<div class="modal-body"><div class="list-group">
      ${item('start', 'play', 'success', 'Démarrer une session', 'Chrono, météo, puis prises en un geste')}
      ${item('catch', 'fish', 'primary', 'Ajouter une prise', 'Sans session en cours')}
      ${item('past', 'history', 'info', 'Ajouter une session passée', 'Saisie après coup, avec début et fin')}
    </div></div>`,
    on: {
      start: (t, api) => { api.close(); sessionSheet(null, 'start'); },
      catch: (t, api) => { api.close(); catchSheet(); },
      past: (t, api) => { api.close(); sessionSheet(null, 'past'); },
    },
  });
}

/* ---------------- Fragments d'affichage (SB Admin 2) ---------------- */
const where = c => [c.riviere, c.spot].filter(Boolean).join(' · ');
const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
function groupSum(arr, keyF, valF = () => 1) { const m = new Map(); for (const x of arr) { const k = keyF(x); if (k === '' || k == null) continue; m.set(k, (m.get(k) || 0) + valF(x)); } return m; }
const top = (m, n = 10) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([l, v]) => ({ l, v }));
const years = arr => [...new Set(arr.map(x => x.date.slice(0, 4)))].sort().reverse();
const relBadge = c => c.sort === 'Prélevé' ? '<span class="badge badge-warning">Prélevé</span>' : '<span class="badge badge-light text-gray-600">Relâché</span>';

const pageHeading = (title, sub = '', right = '') => `<div class="d-flex align-items-center justify-content-between flex-wrap mb-4" style="gap:.75rem">
  <div><h1 class="h3 mb-0 text-gray-800">${title}</h1>${sub ? `<div class="small text-gray-600 mt-1">${sub}</div>` : ''}</div>${right}</div>`;
const card = (title, body, right = '', cls = '') => `<div class="card shadow mb-4 ${cls}"><div class="card-header py-3 d-flex flex-row align-items-center justify-content-between">
  <h6 class="m-0 font-weight-bold text-primary">${title}</h6>${right}</div><div class="card-body">${body}</div></div>`;
const kpi = (label, val, icon, color = 'primary', sub = '') => `<div class="col-6 col-xl-3 mb-4 kpi"><div class="card border-left-${color} shadow h-100 py-2"><div class="card-body py-2"><div class="row no-gutters align-items-center">
  <div class="col mr-2" style="min-width:0"><div class="text-xs font-weight-bold text-${color} text-uppercase mb-1">${label}</div><div class="h5 mb-0 font-weight-bold text-gray-800 num">${val}</div>${sub ? `<div class="small text-gray-500 text-truncate">${sub}</div>` : ''}</div>
  <div class="col-auto d-none d-sm-block">${fa(icon, 'fa-2x text-gray-300')}</div></div></div></div></div>`;
const unitV = (v, u) => v === '–' ? v : `${v}<small class="text-gray-500 font-weight-bold ml-1" style="font-size:.7em">${u}</small>`;
const sel = (path, label, opts, val) => `<select class="custom-select custom-select-sm mr-2 mb-2" data-ui="${path}" aria-label="${label}"><option value="">${label}</option>${opts.map(o => `<option${String(o) === String(val) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
const bars = (items, fmt = v => nf(v)) => {
  if (!items.length) return '<p class="text-gray-500 mb-0">Pas de données.</p>';
  const mx = Math.max(...items.map(i => i.v)) || 1;
  return items.map(i => `<div class="bar-row"><div class="lbl"><span>${esc(i.l)}${i.sub ? `<small>${esc(i.sub)}</small>` : ''}</span><span class="num">${fmt(i.v)}</span></div>
    <div class="progress"><div class="progress-bar bg-primary" role="progressbar" style="width:${Math.max(1, i.v / mx * 100)}%"></div></div></div>`).join('');
};
const catchItem = (c, withDate) => `<button type="button" class="list-group-item list-group-item-action catch-item d-flex align-items-center justify-content-between" data-cmd="edit-catch" data-id="${c.id}" style="gap:.75rem">
  <div style="min-width:0"><div class="font-weight-bold text-gray-800">${esc(c.poisson)}${c.nbre > 1 ? ` <span class="badge badge-primary">× ${c.nbre}</span>` : ''} ${c.sort === 'Prélevé' ? '<span class="badge badge-warning">Prélevé</span>' : ''}</div>
  <div class="small text-gray-600 text-truncate">${esc(c.leurre)}</div><div class="small text-gray-500 text-truncate">${withDate ? fmtD(c.date, D_SHORT) + ' · ' : ''}${c.time}${where(c) ? ' · ' + esc(where(c)) : ''}</div></div>
  <div class="size num">${c.taille ?? '–'}<small>cm</small></div></button>`;
const sessBadges = s => `<span class="badge badge-${s.pris ? 'success' : 'light text-gray-500'} mr-1">${s.pris} pris</span><span class="badge badge-${s.rates ? 'warning' : 'light text-gray-500'} mr-1">${s.rates} raté${s.rates > 1 ? 's' : ''}</span><span class="badge badge-${s.leurresPerdus ? 'danger' : 'light text-gray-500'}">${s.leurresPerdus} leurre${s.leurresPerdus > 1 ? 's' : ''} perdu${s.leurresPerdus > 1 ? 's' : ''}</span>`;
const sessMeta = s => `<div class="meta">
  <span>${fa('clock')}${s.debut}${s.fin ? '–' + s.fin + ' · ' + fmtDur(sDur(s)) : ' · en cours'}</span>
  ${s.meteo ? `<span>${meteoIc(s.meteo)}${esc(s.meteo)}</span>` : ''}${s.tAir != null ? `<span>${fa('thermometer-half')}${s.tAir} °C</span>` : ''}
  ${s.vent ? `<span>${fa('wind')}${s.vent === 'Sans' ? 'Sans vent' : esc(s.vent)}</span>` : ''}${s.cible ? `<span>${fa('bullseye')}${esc(s.cible)}</span>` : ''}</div>`;
const sessionCard = s => `<div class="col-xl-4 col-md-6 mb-4"><div class="card border-left-${db.live === s.id ? 'info' : s.pris ? 'success' : 'secondary'} shadow h-100 session-card" data-cmd="open-session" data-id="${s.id}" role="link" tabindex="0">
  <div class="card-body"><div class="text-xs font-weight-bold text-uppercase mb-1 text-${db.live === s.id ? 'info' : s.pris ? 'success' : 'secondary'}">${fmtD(s.date, { weekday: 'long', day: 'numeric', month: 'long' })}${db.live === s.id ? ' · en cours' : ''}</div>
  <div class="h5 font-weight-bold text-gray-800 mb-0 text-truncate">${esc(s.spot || 'Session')}</div>
  <div class="small text-gray-600 mb-2 text-truncate">${esc([s.coursEau, s.commune].filter(Boolean).join(' · ')) || '&nbsp;'}</div>
  ${sessMeta(s)}<div class="mt-2">${sessBadges(s)}</div></div></div></div>`;
const recRow = (c, i, extra = '') => `<button type="button" class="list-group-item list-group-item-action rec d-flex align-items-center" data-cmd="edit-catch" data-id="${c.id}" style="gap:.75rem">
  <span class="font-weight-bold text-gray-400 num" style="width:1.4rem">${i + 1}</span><div style="min-width:0;flex:1"><div class="font-weight-bold text-gray-800">${esc(c.poisson)}</div>
  <div class="small text-gray-500 text-truncate">${fmtD(c.date, D_SHORT)}${c.spot ? ' · ' + esc(c.spot) : ''}${extra}</div></div><div class="size num">${c.taille}<small>cm</small></div></button>`;

/* ---------------- Géolocalisation : GPS, suivi, tracé ---------------- */
const DEFAULT_C = [45.68, -0.62];
function dist(a, b) {
  const t = Math.PI / 180, dLa = (b[0] - a[0]) * t, dLo = (b[1] - a[1]) * t;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * t) * Math.cos(b[0] * t) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}
const fmtDist = m => m < 1000 ? Math.round(m) + ' m' : nf(m / 1000, 1) + ' km';
const r6 = x => Math.round(x * 1e6) / 1e6;
const spotPos = name => name && db.spots[name] ? [db.spots[name].lat, db.spots[name].lng] : null;
const catchPos = c => c.lat != null ? [c.lat, c.lng] : spotPos(c.spot);
const trackLL = tr => (tr || []).map(p => [p[0], p[1]]);
const trackLen = tr => { let d = 0; for (let i = 1; i < (tr?.length || 0); i++) d += dist(tr[i - 1], tr[i]); return d; };
const spotHref = n => '#/spot/' + encodeURIComponent(n);
function nearestSpot(p, max = 400) {
  let best = null;
  for (const [n, v] of Object.entries(db.spots)) { const d = dist(p, [v.lat, v.lng]); if (d <= max && (!best || d < best.d)) best = { n, d }; }
  return best;
}

const gps = {
  pos: null, watchId: null, err: '', subs: new Set(),
  fresh(ms = 60000) { return this.pos && Date.now() - this.pos.t < ms ? this.pos : null; },
  start() {
    if (this.watchId != null || !navigator.geolocation) return;
    this.watchId = navigator.geolocation.watchPosition(p => this.update(p),
      e => { this.err = e.code === 1 ? 'Position refusée (réglages de Safari)' : 'GPS indisponible'; this.emit(); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });
  },
  stop() { if (this.watchId != null) { navigator.geolocation.clearWatch(this.watchId); this.watchId = null; } },
  update(p) {
    this.err = '';
    this.pos = { lat: r6(p.coords.latitude), lng: r6(p.coords.longitude), acc: Math.round(p.coords.accuracy), t: Date.now() };
    recordTrack(this.pos); this.emit();
  },
  emit() { this.subs.forEach(f => { try { f(this.pos); } catch (e) { /* abonné détruit */ } }); },
  once(timeout = 15000) {
    return new Promise((ok, ko) => {
      const f = this.fresh(20000);
      if (f && f.acc <= 100) return ok(f);
      if (!navigator.geolocation) return ko(new Error('Géolocalisation indisponible'));
      navigator.geolocation.getCurrentPosition(p => { this.update(p); ok(this.pos); },
        e => ko(new Error(e.code === 1 ? 'Position refusée (réglages de Safari)' : 'GPS indisponible')),
        { enableHighAccuracy: true, timeout, maximumAge: 10000 });
    });
  },
};
/* Pendant une session, chaque déplacement de plus de 12 m (précision ≤ 40 m) prolonge le tracé. */
let trackSaveT = 0;
function recordTrack(p) {
  const s = liveSession(); if (!s || p.acc > 40) return;
  s.track = s.track || [];
  const last = s.track[s.track.length - 1];
  if (last && dist(last, [p.lat, p.lng]) < 12) return;
  s.track.push([p.lat, p.lng, Math.round(p.t / 1000)]);
  if (Date.now() - trackSaveT > 20000) { trackSaveT = Date.now(); save(); }
}
/* Le GPS reste allumé pendant une session ou sur la carte (page visible) ; l'écran reste allumé pendant une session. */
function syncGps() {
  const need = !document.hidden && (liveSession() || /^#\/carte/.test(location.hash));
  if (need) gps.start(); else gps.stop();
  wake(!document.hidden && !!liveSession());
}
let wakeLock = null;
async function wake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* non pris en charge */ }
}
document.addEventListener('visibilitychange', () => { if (document.hidden && liveSession()) save(); syncGps(); });
const gpsLine = s => {
  const p = gps.pos, tr = s?.track;
  return `${fa('location-arrow', 'mr-1')}${gps.err ? gps.err : p ? 'GPS ±' + p.acc + ' m' : 'Recherche GPS…'}${tr?.length > 1 ? ' · tracé ' + fmtDist(trackLen(tr)) : ''}`;
};
gps.subs.add(() => { const s = liveSession(); $$('[data-gps]').forEach(el => { el.innerHTML = gpsLine(s); }); });

/* ---------------- Cartes (Leaflet : satellite Esri + plan OpenStreetMap) ---------------- */
let liveMaps = [], cleanups = [], afterRender = [];
function baseLayers() {
  const sat = L.layerGroup([
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 18, attribution: 'Imagerie © Esri, Maxar, Earthstar Geographics' }),
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 20, maxNativeZoom: 18 }),
  ]);
  const plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© contributeurs OpenStreetMap' });
  return { Satellite: sat, Plan: plan };
}
function newMap(el, opts = {}, keep = true) {
  const map = L.map(el, { zoomControl: true, ...opts }).setView(DEFAULT_C, 11); // vue provisoire, ajustée ensuite
  const bases = baseLayers();
  (bases[ui.map.base] || bases.Satellite).addTo(map);
  map.on('baselayerchange', e => { ui.map.base = e.name; });
  if (keep) liveMaps.push(map);
  setTimeout(() => map.invalidateSize(), 80);
  return { map, bases };
}
const ICON = {};
const icCatch = approx => ICON['c' + approx] || (ICON['c' + approx] = L.divIcon({ className: '', html: `<div class="mk-catch${approx ? ' approx' : ''}"></div>`, iconSize: [16, 16], iconAnchor: [8, 8], popupAnchor: [0, -8] }));
const icSpot = () => ICON.s || (ICON.s = L.divIcon({ className: '', html: `<div class="mk-spot">${fa('map-marker-alt')}</div>`, iconSize: [28, 34], iconAnchor: [14, 32], popupAnchor: [0, -30] }));
const icMe = () => ICON.m || (ICON.m = L.divIcon({ className: '', html: '<div class="mk-me"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }));
const icDot = color => L.divIcon({ className: '', html: `<div class="mk-dot" style="background:${color}"></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
const catchPopup = c => `<div class="font-weight-bold text-gray-800">${esc(c.poisson)}${c.taille ? ` · ${c.taille} cm` : ''}${c.nbre > 1 ? ` (× ${c.nbre})` : ''}</div>
  <div class="text-gray-600">${fmtD(c.date, D_SHORT)} · ${c.time}</div><div>${esc(c.leurre)}</div>
  <div class="text-gray-500 small">${c.lat != null ? 'Position GPS' : 'Position du spot'}${c.spot ? ' · ' + esc(c.spot) : ''}</div>
  <div class="mt-2"><button type="button" class="btn btn-sm btn-primary" data-cmd="edit-catch" data-id="${c.id}">Modifier</button>${c.spot ? ` <a class="btn btn-sm btn-light" href="${spotHref(c.spot)}">Fiche du spot</a>` : ''}</div>`;
function spotStats(name) {
  const cs = db.catches.filter(c => c.spot === name), ss = db.sessions.filter(s => s.spot === name);
  const big = cs.filter(c => c.taille).sort((a, b) => b.taille - a.taille)[0];
  const riv = top(groupSum([...cs.map(c => c.riviere), ...ss.map(s => s.coursEau)], x => x), 1)[0]?.l || '';
  const commune = top(groupSum(ss, s => s.commune), 1)[0]?.l || '';
  return { cs, ss, fish: sum(cs, c => c.nbre), big, riv, commune };
}
const spotPopup = name => {
  const st = spotStats(name);
  return `<div class="font-weight-bold text-gray-800">${esc(name)}</div><div class="text-gray-600 small">${esc([st.riv, st.commune].filter(Boolean).join(' · '))}</div>
    <div class="mt-1">${st.fish} poisson${st.fish > 1 ? 's' : ''} · ${st.ss.length} session${st.ss.length > 1 ? 's' : ''}${st.big ? `<br>Record : ${esc(st.big.poisson)} ${st.big.taille} cm` : ''}</div>
    <div class="mt-2"><a class="btn btn-sm btn-primary" href="${spotHref(name)}">Fiche du spot</a> <button type="button" class="btn btn-sm btn-light" data-cmd="place-spot" data-name="${esc(name)}">Déplacer</button></div>`;
};

/* Choisir une position : la carte se déplace sous la cible centrale. */
function pickLocation({ title, start, zoom, sub = '', cb }) {
  let map;
  const doSearch = async api => {
    const q = $('[data-geo]', api.el).value.trim(), box = $('[data-georesults]', api.el);
    if (!q) return;
    box.innerHTML = '<div class="small text-gray-500 pt-2">Recherche…</div>';
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=fr&countrycodes=fr&q=${encodeURIComponent(q)}`);
      const js = await r.json();
      box.innerHTML = js.length ? `<div class="list-group mt-2">${js.map(x => `<button type="button" class="list-group-item list-group-item-action py-2 small" data-act="goto" data-lat="${x.lat}" data-lng="${x.lon}">${esc(x.display_name)}</button>`).join('')}</div>` : '<div class="small text-gray-500 pt-2">Aucun résultat</div>';
    } catch (e) { box.innerHTML = '<div class="small text-danger pt-2">Recherche indisponible (pas de réseau ?)</div>'; }
  };
  const api = sheet({
    render: () => `${head(title)}<div class="modal-body p-0 d-flex flex-column">
      <div class="p-2 border-bottom"><div class="input-group"><input type="search" class="form-control" placeholder="Aller à un lieu (commune, rivière…)" data-geo enterkeyhint="search" autocomplete="off">
        <div class="input-group-append"><button type="button" class="btn btn-primary" data-act="geo" aria-label="Rechercher">${fa('search')}</button></div></div><div data-georesults></div></div>
      <div class="pick-map-wrap"><div class="pick-map" data-map></div><div class="crosshair">${fa('crosshairs')}</div>
        <button type="button" class="btn btn-light shadow map-me" data-act="me" aria-label="Ma position">${fa('location-arrow')}</button></div>
      <div class="small text-gray-600 px-3 py-2">${sub || 'Déplace la carte pour placer la cible sur le bon endroit.'}</div></div>
      ${foot(`${fa('check', 'mr-1')}Valider cette position`)}`,
    on: {
      geo: (t, api) => doSearch(api),
      goto: (t, api) => { map.setView([+t.dataset.lat, +t.dataset.lng], 15); $('[data-georesults]', api.el).innerHTML = ''; },
      me: async () => { try { const p = await gps.once(); map.setView([p.lat, p.lng], 18); } catch (e) { toast(e.message); } },
      save: (t, api) => { const c = map.getCenter(); api.close(); setTimeout(() => map.remove(), 350); cb([r6(c.lat), r6(c.lng)]); },
    },
  });
  $('[data-geo]', api.el).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(api); } });
  const fresh = gps.fresh();
  ({ map } = newMap($('[data-map]', api.el), {}, false));
  map.setView(start || (fresh ? [fresh.lat, fresh.lng] : DEFAULT_C), zoom || (start || fresh ? 17 : 11));
  setTimeout(() => map.invalidateSize(), 380);
}
function placeSpot(name, done) {
  const st = spotStats(name);
  let start = spotPos(name);
  if (!start && st.riv) for (const n of Object.keys(db.spots)) if (spotStats(n).riv === st.riv) { start = spotPos(n); break; }
  pickLocation({
    title: `${spotPos(name) ? 'Déplacer' : 'Placer'} « ${name} »`, start, zoom: spotPos(name) ? 17 : start ? 14 : null,
    sub: `${esc([st.riv, st.commune].filter(Boolean).join(' · ') || 'Spot')} — déplace la carte pour mettre la cible sur le spot.`,
    cb: p => { db.spots[name] = { lat: p[0], lng: p[1] }; save(); toast(`« ${name} » placé sur la carte`); if (done) done(); else render(); },
  });
}
function spotsSheet() {
  const body = () => {
    const m = counts('spot'), names = [...m.keys()];
    const todo = names.filter(n => !db.spots[n]).sort((a, b) => m.get(b) - m.get(a));
    const done = names.filter(n => db.spots[n]).sort((a, b) => a.localeCompare(b));
    const row = (n, placed) => `<div class="list-group-item d-flex align-items-center" style="gap:.5rem">
      <a href="${spotHref(n)}" data-act="close" class="flex-fill text-decoration-none" style="min-width:0"><div class="font-weight-bold text-gray-800 text-truncate">${esc(n)}</div>
      <div class="small text-gray-500 text-truncate">${m.get(n)} entrée${m.get(n) > 1 ? 's' : ''}${spotStats(n).riv ? ' · ' + esc(spotStats(n).riv) : ''}</div></a>
      <button type="button" class="btn btn-sm ${placed ? 'btn-light' : 'btn-success'}" data-act="place" data-name="${esc(n)}">${fa('crosshairs', 'mr-1')}${placed ? 'Déplacer' : 'Placer'}</button></div>`;
    return `${todo.length ? `${lbl(`À placer (${todo.length})`)}<p class="small text-gray-600 mb-2">Place chaque spot une fois : toutes ses prises passées apparaîtront sur la carte. Les plus fréquentés sont en haut.</p>
      <div class="list-group">${todo.map(n => row(n, false)).join('')}</div>` : '<div class="alert alert-success mt-2">Tous les spots sont placés.</div>'}
      ${done.length ? `${lbl(`Placés (${done.length})`)}<div class="list-group">${done.map(n => row(n, true)).join('')}</div>` : ''}`;
  };
  const api = sheet({
    render: () => `${head('Spots')}<div class="modal-body">${body()}</div>`,
    on: { place: (t, api) => placeSpot(t.dataset.name, () => { api.refresh(); render(); }) },
  });
  return api;
}
function mapFilters() {
  const f = ui.map;
  const opt = (v, l, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(l)}</option>`;
  sheet({
    render: () => `${head('Filtres de la carte')}<div class="modal-body">
      ${lbl('Espèce')}<select class="custom-select" data-mf="poisson">${opt('', 'Toutes les espèces', f.poisson)}${alpha('poisson').map(v => opt(v, v, f.poisson)).join('')}</select>
      ${lbl('Année')}<select class="custom-select" data-mf="year">${opt('', 'Toutes les années', f.year)}${years(db.catches).map(v => opt(v, v, f.year)).join('')}</select>
      ${lbl('Période')}<select class="custom-select" data-mf="period">${[['', 'Tout'], ['30', '30 derniers jours'], ['90', '3 derniers mois'], ['365', '12 derniers mois']].map(([v, l]) => opt(v, l, f.period)).join('')}</select>
      ${lbl('Session')}<select class="custom-select" data-mf="session">${opt('', 'Toutes les sessions', f.session)}${sorted('sessions').map(s => opt(s.id, `${fmtD(s.date, D_SHORT)} · ${s.spot || 'Session'}${s.track?.length > 1 ? ' · tracé' : ''}`, f.session)).join('')}</select>
      </div><div class="modal-footer"><button type="button" class="btn btn-light btn-lg" data-act="clear">Tout effacer</button><button type="button" class="btn btn-primary btn-lg" data-act="save">Appliquer</button></div>`,
    on: {
      clear: (t, api) => { f.poisson = f.year = f.period = f.session = ''; f.view = null; api.close(); render(); },
      save: (t, api) => { $$('[data-mf]', api.el).forEach(s => { f[s.dataset.mf] = s.value; }); f.view = null; api.close(); render(); },
    },
  });
}
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
function mapCatches() {
  const f = ui.map, since = f.period ? daysAgo(+f.period) : '';
  return db.catches.filter(c => (!f.poisson || c.poisson === f.poisson) && (!f.year || c.date.startsWith(f.year)) && (!since || c.date >= since) && (!f.session || c.sessionId === f.session));
}
function mapSessions() {
  const f = ui.map, since = f.period ? daysAgo(+f.period) : '';
  return db.sessions.filter(s => (!f.year || s.date.startsWith(f.year)) && (!since || s.date >= since) && (!f.session || s.id === f.session));
}
const trackPopup = s => `<div class="font-weight-bold text-gray-800">${esc(s.spot || 'Session')}</div><div class="text-gray-600">${fmtD(s.date, D_SHORT)} · ${s.debut}${s.fin ? '–' + s.fin : ''}</div>
  <div>Tracé : ${fmtDist(trackLen(s.track))} · ${s.pris} pris</div><div class="mt-2"><a class="btn btn-sm btn-primary" href="#/session/${s.id}">Voir la session</a></div>`;

function viewCarte() {
  const f = ui.map, cs = mapCatches(), m = counts('spot');
  const onMap = cs.filter(c => catchPos(c)), todo = [...m.keys()].filter(n => !db.spots[n]).length;
  const nf_ = [f.poisson, f.year, f.period, f.session].filter(Boolean).length;
  const sess = f.session && db.sessions.find(s => s.id === f.session);
  return `${pageHeading('Carte des prises', `${sum(onMap, c => c.nbre)} poisson${sum(onMap, c => c.nbre) > 1 ? 's' : ''} sur la carte · ${cs.length - onMap.length} ligne${cs.length - onMap.length > 1 ? 's' : ''} sans position${sess ? ` · session du ${fmtD(sess.date, D_SHORT)}` : ''}`,
      `<div class="d-flex flex-wrap" style="gap:.5rem"><button type="button" class="btn btn-sm ${nf_ ? 'btn-primary' : 'btn-light'} shadow-sm" data-cmd="map-filters">${fa('filter', 'fa-sm mr-1')}Filtres${nf_ ? ` (${nf_})` : ''}</button>
       <button type="button" class="btn btn-sm ${todo ? 'btn-warning' : 'btn-light'} shadow-sm" data-cmd="spots">${fa('map-marker-alt', 'fa-sm mr-1')}Spots${todo ? ` · ${todo} à placer` : ''}</button></div>`)}
    <div class="card shadow mb-2 overflow-hidden"><div id="bigmap" class="big-map"></div></div>
    <div class="map-legend small text-gray-600 mb-4"><span><span class="mk-catch d-inline-block"></span> Prise (GPS)</span><span><span class="mk-catch approx d-inline-block"></span> Prise (position du spot)</span>
      <span class="text-success">${fa('map-marker-alt')} Spot</span><span><span class="lg-line" style="background:#f6c23e"></span> Tracé</span><span><span class="mk-me d-inline-block" style="width:12px;height:12px"></span> Toi</span></div>`;
}
function initCarte() {
  const el = $('#bigmap'); if (!el || !window.L) return;
  const f = ui.map;
  const { map, bases } = newMap(el);
  const bounds = [];
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 45, spiderfyOnMaxZoom: true,
    iconCreateFunction: cl => { const n = cl.getChildCount(), s = n < 10 ? 34 : n < 100 ? 40 : 48; return L.divIcon({ className: '', html: `<div class="cl" style="width:${s}px;height:${s}px">${n}</div>`, iconSize: [s, s] }); },
  });
  const heatPts = new Map();
  for (const c of mapCatches()) {
    const p = catchPos(c); if (!p) continue;
    cluster.addLayer(L.marker(p, { icon: icCatch(c.lat == null) }).bindPopup(catchPopup(c)));
    const k = p.join(','); heatPts.set(k, (heatPts.get(k) || 0) + c.nbre); bounds.push(p);
  }
  const hmax = Math.max(1, ...heatPts.values());
  const heat = L.heatLayer([...heatPts].map(([k, v]) => [...k.split(',').map(Number), Math.max(0.2, v / hmax)]), { radius: 30, blur: 24, maxZoom: 15, max: 1 });
  const spots = L.layerGroup(), spotMarkers = {};
  const sess = f.session && db.sessions.find(s => s.id === f.session);
  for (const n of Object.keys(db.spots)) {
    if (sess && n !== sess.spot) continue;
    spotMarkers[n] = L.marker(spotPos(n), { icon: icSpot(), zIndexOffset: -100 }).bindPopup(() => spotPopup(n)).addTo(spots);
    if (sess) bounds.push(spotPos(n));
  }
  const tracks = L.layerGroup();
  for (const s of mapSessions()) {
    if (!(s.track?.length > 1) || s.id === db.live) continue;
    const ll = trackLL(s.track);
    L.polyline(ll, { color: '#f6c23e', weight: 5, opacity: .9 }).bindPopup(trackPopup(s)).addTo(tracks);
    L.marker(ll[0], { icon: icDot('#1cc88a'), interactive: false }).addTo(tracks);
    L.marker(ll[ll.length - 1], { icon: icDot('#e74a3b'), interactive: false }).addTo(tracks);
    bounds.push(...ll);
  }
  const overlays = { Prises: cluster, 'Carte de chaleur': heat, Spots: spots, 'Tracés GPS': tracks };
  for (const [k, lay] of Object.entries(overlays)) if (f.layers[k]) lay.addTo(map);
  L.control.layers(bases, overlays, { position: 'topright' }).addTo(map);
  map.on('overlayadd', e => { f.layers[e.name] = true; });
  map.on('overlayremove', e => { f.layers[e.name] = false; });
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);

  // Bouton « me suivre »
  let locBtn;
  const Loc = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const d = L.DomUtil.create('div', 'leaflet-bar map-ctl');
      d.innerHTML = `<a href="#" role="button" title="Me suivre" aria-label="Me suivre" class="${f.follow ? 'on' : ''}">${fa('location-arrow')}</a>`;
      locBtn = d.firstChild;
      L.DomEvent.disableClickPropagation(d);
      L.DomEvent.on(locBtn, 'click', e => {
        L.DomEvent.preventDefault(e); f.follow = !f.follow; locBtn.classList.toggle('on', f.follow);
        if (f.follow) { if (gps.pos) map.setView([gps.pos.lat, gps.pos.lng], Math.max(map.getZoom(), 17)); else toast(gps.err || 'Recherche de ta position…'); }
      });
      return d;
    },
  });
  new Loc().addTo(map);
  map.on('dragstart', () => { if (f.follow) { f.follow = false; locBtn?.classList.remove('on'); } });

  // Position en direct + tracé de la session en cours
  let me = null, accC = null, liveLine = null;
  const onGps = p => {
    const s = liveSession();
    if (s?.track?.length > 1) { if (!liveLine) liveLine = L.polyline(trackLL(s.track), { color: '#1cc88a', weight: 5 }).addTo(map); else liveLine.setLatLngs(trackLL(s.track)); }
    if (!p) return;
    const ll = [p.lat, p.lng];
    if (!me) { accC = L.circle(ll, { radius: p.acc, color: '#2e6bff', weight: 1, fillOpacity: .12, interactive: false }).addTo(map); me = L.marker(ll, { icon: icMe(), zIndexOffset: 1000, interactive: false }).addTo(map); }
    else { me.setLatLng(ll); accC.setLatLng(ll).setRadius(p.acc); }
    if (f.follow) map.panTo(ll);
  };
  gps.subs.add(onGps); cleanups.push(() => gps.subs.delete(onGps)); onGps(gps.pos);

  if (f.focus && spotMarkers[f.focus]) { map.setView(spotPos(f.focus), 17); setTimeout(() => spotMarkers[f.focus]?.openPopup(), 300); f.focus = ''; }
  else if (f.view) map.setView(f.view.c, f.view.z);
  else if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
  else map.setView(gps.pos ? [gps.pos.lat, gps.pos.lng] : DEFAULT_C, gps.pos ? 15 : 11);
  map.on('moveend', () => { try { f.view = { c: map.getCenter(), z: map.getZoom() }; } catch (e) { /* carte retirée */ } });
}
function initMiniMap(id, { spot, catches = [], sessions = [] }) {
  const el = document.getElementById(id); if (!el || !window.L) return;
  const { map, bases } = newMap(el, { scrollWheelZoom: false });
  L.control.layers(bases, null, { position: 'topright' }).addTo(map);
  const b = [], sp = spotPos(spot);
  if (sp) { L.marker(sp, { icon: icSpot() }).bindPopup(() => spotPopup(spot)).addTo(map); b.push(sp); }
  for (const s of sessions) if (s.track?.length > 1) {
    const ll = trackLL(s.track);
    L.polyline(ll, { color: s.id === db.live ? '#1cc88a' : '#f6c23e', weight: 5 }).bindPopup(trackPopup(s)).addTo(map);
    L.marker(ll[0], { icon: icDot('#1cc88a'), interactive: false }).addTo(map);
    b.push(...ll);
  }
  const cl = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 30, iconCreateFunction: g => L.divIcon({ className: '', html: `<div class="cl" style="width:32px;height:32px">${g.getChildCount()}</div>`, iconSize: [32, 32] }) });
  for (const c of catches) { const p = catchPos(c); if (!p) continue; cl.addLayer(L.marker(p, { icon: icCatch(c.lat == null) }).bindPopup(catchPopup(c))); b.push(p); }
  cl.addTo(map);
  if (b.length > 1) map.fitBounds(b, { padding: [30, 30], maxZoom: 17 }); else map.setView(b[0] || DEFAULT_C, b.length ? 17 : 11);
}

function viewSpot(name) {
  const m = counts('spot');
  if (!m.has(name) && !db.spots[name]) return `${pageHeading('Spot introuvable')}<a href="#/carte" class="btn btn-light">${fa('arrow-left', 'mr-1')} Carte</a>`;
  const st = spotStats(name), pos = spotPos(name), n = c => c.nbre;
  const done = st.ss.filter(s => s.fin), h = sum(done, sDur) / 60, p = sum(done, s => s.pris);
  const perHour = groupSum(st.cs, c => +c.time.slice(0, 2), n), hrs = [...perHour.keys()];
  const hourItems = []; if (hrs.length) for (let x = Math.min(6, ...hrs); x <= Math.max(21, ...hrs); x++) hourItems.push({ l: x + 'h', t: `De ${x} h à ${x + 1} h`, v: perHour.get(x) || 0 });
  const sized = st.cs.filter(c => c.taille);
  const withMax = (mm, key) => top(mm, 8).map(i => { const mx = Math.max(0, ...sized.filter(c => c[key] === i.l).map(c => c.taille)); return { ...i, sub: mx ? `max ${mx} cm` : '' }; });
  if (pos) afterRender.push(() => initMiniMap('spotmap', { spot: name, catches: st.cs.filter(c => c.lat != null), sessions: st.ss }));
  const lastSess = [...st.ss].sort(byRecent).slice(0, 6), lastCatches = [...st.cs].sort(byRecent).slice(0, 10);
  return `<a href="#/carte" class="btn btn-link px-0 mb-2">${fa('arrow-left', 'mr-1')} Carte</a>
    ${pageHeading(esc(name), esc([st.riv, st.commune].filter(Boolean).join(' · ')) || 'Spot',
      `<div class="d-flex flex-wrap" style="gap:.5rem"><button type="button" class="btn btn-sm ${pos ? 'btn-light' : 'btn-success'} shadow-sm" data-cmd="place-spot" data-name="${esc(name)}">${fa('crosshairs', 'fa-sm mr-1')}${pos ? 'Déplacer' : 'Placer sur la carte'}</button>
       ${pos ? `<button type="button" class="btn btn-sm btn-primary shadow-sm" data-cmd="spot-on-map" data-name="${esc(name)}">${fa('map', 'fa-sm mr-1')}Voir sur la carte</button>` : ''}</div>`)}
    <div class="row">
      ${kpi('Poissons', nf(st.fish), 'fish', 'primary', `${st.cs.length} ligne${st.cs.length > 1 ? 's' : ''} au journal`)}
      ${kpi('Record', st.big ? unitV(st.big.taille, 'cm') : '–', 'trophy', 'warning', st.big ? `${esc(st.big.poisson)} · ${fmtD(st.big.date, D_SHORT)}` : '')}
      ${kpi('Sessions', st.ss.length, 'stopwatch', 'success', h ? `${fmtDur(h * 60)} au total` : '')}
      ${kpi('Rendement', h ? unitV(nf(p / h, 2), '/h') : '–', 'tachometer-alt', 'info', done.length ? `${Math.round(100 * done.filter(s => !s.pris).length / done.length)} % de bredouilles` : '')}
    </div>
    <div class="row">
      <div class="col-lg-6">${card('Emplacement', pos ? '<div id="spotmap" class="mini-map"></div>' : `<p class="text-gray-600">Ce spot n’est pas encore placé sur la carte.</p><button type="button" class="btn btn-success" data-cmd="place-spot" data-name="${esc(name)}">${fa('crosshairs', 'mr-1')}Placer le spot</button>`)}</div>
      <div class="col-lg-6">${card('Espèces prises ici', bars(withMax(groupSum(st.cs, c => c.poisson, n), 'poisson')))}</div>
      <div class="col-lg-6">${card('Appâts et leurres qui marchent ici', bars(withMax(groupSum(st.cs, c => c.leurre, n), 'leurre')))}</div>
      <div class="col-lg-6">${card('Heures de prise', hourItems.length ? chartBox({ labels: hourItems.map(i => i.l), titles: hourItems.map(i => i.t), data: hourItems.map(i => i.v) }) : '<p class="text-gray-500 mb-0">Pas de données.</p>')}</div>
    </div>
    ${lastSess.length ? `<h2 class="h5 text-gray-800 mb-3">Dernières sessions ici</h2><div class="row">${lastSess.map(sessionCard).join('')}</div>` : ''}
    <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Dernières prises ici</h6></div>
      ${lastCatches.length ? `<div class="list-group list-group-flush">${lastCatches.map(c => catchItem(c, true)).join('')}</div>` : '<div class="card-body text-gray-500">Aucune prise.</div>'}</div>`;
}

/* ---------------- Graphiques Chart.js (style du template) ---------------- */
let charts = [], pending = [], dt = null;
if (window.Chart) {
  Chart.defaults.global.defaultFontFamily = 'Nunito, -apple-system, system-ui, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  Chart.defaults.global.defaultFontColor = '#858796';
}
const TIP = { titleMarginBottom: 10, titleFontColor: '#6e707e', titleFontSize: 14, backgroundColor: 'rgb(255,255,255)', bodyFontColor: '#858796', borderColor: '#dddfeb', borderWidth: 1, xPadding: 15, yPadding: 15, displayColors: false, caretPadding: 10 };
let chartN = 0;
function chartBox(spec, cls = 'chart-area') { const id = 'ch' + (++chartN); pending.push({ id, ...spec }); return `<div class="${cls}"><canvas id="${id}"></canvas></div>`; }
function drawCharts() {
  charts.forEach(c => c.destroy()); charts = [];
  for (const s of pending) {
    const el = document.getElementById(s.id); if (!el || !window.Chart) continue;
    const unit = s.unit || 'poissons', titles = s.titles || s.labels;
    if (s.type === 'doughnut') {
      charts.push(new Chart(el, { type: 'doughnut', data: { labels: s.labels, datasets: [{ data: s.data, backgroundColor: PALETTE, hoverBorderColor: 'rgba(234,236,244,1)' }] },
        options: { maintainAspectRatio: false, cutoutPercentage: 75, legend: { display: false }, tooltips: { ...TIP, callbacks: { label: (t, d) => `${d.labels[t.index]} : ${nf(d.datasets[0].data[t.index])} ${unit}` } } } }));
      continue;
    }
    const line = s.type === 'line';
    charts.push(new Chart(el, {
      type: s.type || 'bar',
      data: { labels: s.labels, datasets: [line
        ? { label: unit, lineTension: .3, backgroundColor: 'rgba(78,115,223,0.05)', borderColor: 'rgba(78,115,223,1)', pointRadius: 3, pointBackgroundColor: 'rgba(78,115,223,1)', pointBorderColor: 'rgba(78,115,223,1)', pointHoverRadius: 4, pointHitRadius: 12, pointBorderWidth: 2, data: s.data }
        : { label: unit, backgroundColor: '#4e73df', hoverBackgroundColor: '#2e59d9', borderColor: '#4e73df', data: s.data }] },
      options: {
        maintainAspectRatio: false, layout: { padding: { left: 6, right: 16, top: 16, bottom: 0 } }, legend: { display: false },
        scales: {
          xAxes: [{ gridLines: { display: false, drawBorder: false }, ticks: { maxTicksLimit: s.maxX || 12, autoSkip: true, maxRotation: 0 }, maxBarThickness: 28 }],
          yAxes: [{ ticks: { min: 0, maxTicksLimit: 5, padding: 10, precision: 0, callback: v => nf(v) }, gridLines: { color: 'rgb(234,236,244)', zeroLineColor: 'rgb(234,236,244)', drawBorder: false, borderDash: [2], zeroLineBorderDash: [2] } }],
        },
        tooltips: { ...TIP, intersect: !line, mode: 'index', callbacks: { title: t => titles[t[0].index], label: t => `${nf(t.yLabel)} ${unit}` } },
      },
    }));
  }
  pending = [];
}
const doughnutLegend = items => `<div class="mt-3 text-center legend-line">${items.map((i, k) => `<span><i class="fas fa-circle mr-1" style="color:${PALETTE[k]}" aria-hidden="true"></i>${esc(i.l)} <b class="text-gray-700">${nf(i.v)}</b></span>`).join('')}</div>`;

/* ---------------- Vues ---------------- */
const ui = { prises: { year: '', poisson: '', riviere: '', technique: '', q: '', page: 0, order: [[0, 'desc']] }, sessions: { year: '', cible: '' }, stats: { year: '', poisson: '', cible: '' }, listField: 'spot',
  map: { base: 'Satellite', layers: { Prises: true, 'Carte de chaleur': false, Spots: true, 'Tracés GPS': true }, follow: false, view: null, poisson: '', year: '', period: '', session: '', focus: '' } };

function viewHome() {
  const live = liveSession(), cs = sorted('catches');
  const ys = years(db.catches), y = ys.includes(today().slice(0, 4)) ? today().slice(0, 4) : ys[0] || today().slice(0, 4);
  const yc = db.catches.filter(c => c.date.startsWith(y)), ysess = db.sessions.filter(s => s.date.startsWith(y) && s.fin);
  const big = [...yc].sort((a, b) => (b.taille || 0) - (a.taille || 0))[0];
  const hours = sum(ysess, sDur) / 60;
  let hero;
  if (live) {
    const cnt = (k, label, color, plusCmd) => `<div class="col-4 px-1"><div class="card bg-${color} text-white shadow counter h-100"><div class="card-body">
      <div class="lbl">${label}</div><div class="val">${live[k] || 0}</div>
      <div class="d-flex mt-1" style="gap:.35rem">${plusCmd ? '' : `<button type="button" class="btn btn-light btn-sm flex-fill text-${color}" data-cmd="live-inc" data-key="${k}" data-d="-1" aria-label="${label} moins un">−</button>`}
      <button type="button" class="btn btn-light btn-sm flex-fill text-${color}" ${plusCmd ? `data-cmd="${plusCmd}"` : `data-cmd="live-inc" data-key="${k}" data-d="1"`} aria-label="${label} plus un" style="flex-grow:1.6!important">+</button></div></div></div></div>`;
    hero = `<div class="card border-left-success shadow mb-4"><div class="card-body">
      <div class="d-flex justify-content-between align-items-start flex-wrap" style="gap:.5rem">
        <div style="min-width:0"><div class="text-xs font-weight-bold text-success text-uppercase mb-1">${fa('circle', 'pulse mr-1')} Session en cours · depuis ${live.debut}</div>
          <div class="h4 font-weight-bold text-gray-800 mb-1">${esc(live.spot || 'Session')}</div>${sessMeta(live)}<div class="small text-primary font-weight-bold mt-1" data-gps>${gpsLine(live)}</div></div>
        <div class="timer" data-timer>${fmtDur(sDur(live))}</div></div>
      <div class="row mx-n1 my-3">${cnt('pris', 'Pris', 'success', 'new-catch')}${cnt('rates', 'Ratés', 'warning')}${cnt('leurresPerdus', 'Perdus', 'danger')}</div>
      <div class="row"><div class="col-md-8 mb-2"><button type="button" class="btn btn-primary btn-lg btn-block" data-cmd="new-catch">${fa('plus', 'mr-2')}Nouvelle prise</button></div>
      <div class="col-md-4 mb-2"><button type="button" class="btn btn-outline-secondary btn-lg btn-block" data-cmd="end-session">${fa('flag-checkered', 'mr-2')}Terminer</button></div></div>
    </div></div>`;
  } else {
    const last = sorted('sessions')[0];
    hero = `<div class="card shadow mb-4 border-left-primary"><div class="card-body d-md-flex align-items-center justify-content-between" style="gap:1rem">
      <div class="mb-3 mb-md-0"><div class="h5 font-weight-bold text-gray-800 mb-1">Prêt à pêcher ?</div>
      <div class="text-gray-600 small">${last ? `Dernière sortie : ${fmtD(last.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${esc(last.spot)}` : 'Démarre ta première session.'}</div></div>
      <div class="d-flex flex-wrap hero-actions" style="gap:.5rem"><button type="button" class="btn btn-success btn-lg btn-icon-split" data-cmd="start-session"><span class="icon text-white-50">${fa('play')}</span><span class="text">Démarrer une session</span></button>
      <button type="button" class="btn btn-light btn-lg btn-icon-split" data-cmd="new-catch"><span class="icon text-gray-600">${fa('fish')}</span><span class="text">Prise hors session</span></button></div>
    </div></div>`;
  }
  const perMonth = groupSum(yc, c => +c.date.slice(5, 7), c => c.nbre);
  const sp = top(groupSum(yc, c => c.poisson, c => c.nbre), 99), spTop = sp.slice(0, 5);
  if (sp.length > 5) spTop.push({ l: 'Autres', v: sum(sp.slice(5), i => i.v) });
  const records = top(groupSum(db.catches, c => c.poisson, c => c.nbre), 6).map(({ l }) => [...db.catches.filter(c => c.poisson === l)].sort((a, b) => (b.taille || 0) - (a.taille || 0))[0]);
  return `${pageHeading('Tableau de bord', fmtD(today(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      `<a href="#/stats" class="d-none d-sm-inline-block btn btn-sm btn-primary shadow-sm">${fa('chart-bar', 'fa-sm text-white-50 mr-1')} Statistiques</a>`)}
    ${hero}
    <div class="row">
      ${kpi(`Poissons ${y}`, nf(sum(yc, c => c.nbre)), 'fish', 'primary', `${yc.length} lignes au journal`)}
      ${kpi(`Sessions ${y}`, ysess.length, 'calendar-alt', 'success', ysess.length ? `${Math.round(100 * ysess.filter(s => !s.pris).length / ysess.length)} % de bredouilles` : '')}
      ${kpi('Au bord de l’eau', unitV(nf(hours, 0), 'h'), 'clock', 'info', hours ? `${nf(sum(ysess, s => s.pris) / hours, 2)} poisson/h` : '')}
      ${kpi('Plus gros', big ? unitV(big.taille, 'cm') : '–', 'trophy', 'warning', big ? `${esc(big.poisson)} · ${fmtD(big.date, { day: 'numeric', month: 'short' })}` : '')}
    </div>
    <div class="row">
      <div class="col-xl-8 col-lg-7">${card(`Poissons pris par mois — ${y}`, chartBox({ type: 'line', labels: MONTHS, titles: MONTHS, data: MONTHS.map((m, i) => perMonth.get(i + 1) || 0) }))}</div>
      <div class="col-xl-4 col-lg-5">${card(`Espèces — ${y}`, spTop.length ? chartBox({ type: 'doughnut', labels: spTop.map(i => i.l), data: spTop.map(i => i.v) }, 'chart-pie pt-2') + doughnutLegend(spTop) : '<p class="text-gray-500 mb-0">Pas de données.</p>')}</div>
    </div>
    <div class="row">
      <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3 d-flex align-items-center justify-content-between"><h6 class="m-0 font-weight-bold text-primary">Dernières prises</h6><a href="#/prises" class="small font-weight-bold">Tout voir ${fa('arrow-right', 'fa-sm')}</a></div>
        <div class="list-group list-group-flush">${cs.slice(0, 6).map(c => catchItem(c, true)).join('') || '<div class="card-body text-gray-500">Aucune prise.</div>'}</div></div></div>
      <div class="col-lg-6"><div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Records par espèce</h6></div>
        <div class="list-group list-group-flush">${records.map((c, i) => recRow(c, i)).join('')}</div></div></div>
    </div>`;
}

function prisesFiltered() {
  const f = ui.prises;
  return db.catches.filter(c => (!f.year || c.date.startsWith(f.year)) && (!f.poisson || c.poisson === f.poisson) && (!f.riviere || c.riviere === f.riviere) && (!f.technique || c.technique === f.technique));
}
function viewPrises() {
  const f = ui.prises;
  return `${pageHeading('Journal des prises', `${db.catches.length} lignes · ${nf(sum(db.catches, c => c.nbre))} poissons depuis ${years(db.catches).slice(-1)[0] || '—'}`,
      `<button type="button" class="btn btn-sm btn-primary shadow-sm d-none d-md-inline-block" data-cmd="new-catch">${fa('plus', 'fa-sm text-white-50 mr-1')} Nouvelle prise</button>`)}
    <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Toutes les prises</h6></div><div class="card-body">
      <div class="filters d-flex flex-wrap">${sel('prises.year', 'Toutes les années', years(db.catches), f.year)}${sel('prises.poisson', 'Tous les poissons', alpha('poisson'), f.poisson)}${sel('prises.riviere', "Tous les cours d'eau", [...new Set(db.catches.map(c => c.riviere).filter(Boolean))].sort((a, b) => a.localeCompare(b)), f.riviere)}${sel('prises.technique', 'Toutes les techniques', alpha('technique'), f.technique)}</div>
      <div class="small text-gray-600 mb-1" id="psum"></div>
      <div class="table-responsive"><table class="table table-bordered table-hover" id="tbl" width="100%" cellspacing="0"><thead><tr>
        <th>Date</th><th>Poisson</th><th>Taille</th><th class="d-none d-lg-table-cell">Nbre</th><th class="d-none d-md-table-cell">Lieu</th><th class="d-none d-md-table-cell">Appât / Leurre</th><th class="d-none d-xl-table-cell">Technique</th><th class="d-none d-lg-table-cell">Devenir</th>
      </tr></thead></table></div>
    </div></div>`;
}
const DT_FR = { sProcessing: 'Traitement…', sSearch: 'Rechercher :', sLengthMenu: 'Afficher _MENU_', sInfo: 'Lignes _START_ à _END_ sur _TOTAL_', sInfoEmpty: 'Aucune ligne', sInfoFiltered: '(sur _MAX_)', sZeroRecords: 'Aucune prise ne correspond', sEmptyTable: 'Aucune prise', oPaginate: { sFirst: 'Début', sPrevious: '‹', sNext: '›', sLast: 'Fin' } };
function initTable() {
  const f = ui.prises, el = $('#tbl');
  if (!el || !window.jQuery?.fn?.DataTable) return;
  const small = innerWidth < 768;
  dt = jQuery(el).DataTable({
    data: prisesFiltered(), deferRender: true, pageLength: 25, lengthMenu: [10, 25, 50, 100], order: f.order, search: { search: f.q }, language: DT_FR,
    pagingType: small ? 'simple' : 'simple_numbers', autoWidth: false,
    dom: "<'row'<'col-sm-12 col-md-6'l><'col-sm-12 col-md-6'f>><'row'<'col-sm-12'tr>><'row'<'col-sm-12 col-md-5'i><'col-sm-12 col-md-7'p>>",
    columns: [
      { data: c => c.date + ' ' + c.time, render: (d, t, c) => t === 'display' ? `<span class="text-nowrap">${fmtD(c.date, small ? { day: 'numeric', month: 'short', year: '2-digit' } : D_SHORT)}</span> <span class="small text-gray-500">${c.time}</span>` : d },
      { data: 'poisson', render: (d, t, c) => t === 'display' ? `<span class="font-weight-bold text-gray-800">${esc(d)}</span>${c.nbre > 1 ? ` <span class="badge badge-primary d-lg-none">× ${c.nbre}</span>` : ''}${c.sort === 'Prélevé' ? ' <span class="badge badge-warning d-lg-none">P</span>' : ''}` : d },
      { data: c => c.taille ?? -1, className: 'taille', render: (d, t) => t === 'display' ? (d < 0 ? '–' : d + ' <small class="text-gray-500">cm</small>') : d },
      { data: 'nbre', className: 'd-none d-lg-table-cell num' },
      { data: c => where(c), className: 'd-none d-md-table-cell', render: d => esc(d) },
      { data: 'leurre', className: 'd-none d-md-table-cell', render: d => esc(d) },
      { data: 'technique', className: 'd-none d-xl-table-cell small', render: (d, t, c) => esc([d, c.equipement].filter(Boolean).join(' · ')) },
      { data: 'sort', className: 'd-none d-lg-table-cell', render: (d, t, c) => t === 'display' ? relBadge(c) : d },
    ],
  });
  const summary = () => {
    const rows = dt.rows({ search: 'applied' }).data().toArray(), n = sum(rows, c => c.nbre), sz = rows.filter(c => c.taille);
    $('#psum').textContent = `${rows.length} ligne${rows.length > 1 ? 's' : ''} · ${nf(n)} poisson${n > 1 ? 's' : ''}${sz.length ? ` · taille moyenne ${nf(sum(sz, c => c.taille * c.nbre) / sum(sz, c => c.nbre))} cm` : ''}`;
  };
  dt.on('draw', () => { summary(); f.page = dt.page(); f.order = dt.order(); f.q = dt.search(); });
  if (f.page) dt.page(Math.min(f.page, Math.max(0, dt.page.info().pages - 1))).draw(false);
  summary();
  jQuery(el).on('click', 'tbody tr', function () { const c = dt.row(this).data(); if (c) catchSheet(c); });
}

function viewSessions() {
  const f = ui.sessions;
  const list = sorted('sessions').filter(s => (!f.year || s.date.startsWith(f.year)) && (!f.cible || s.cible === f.cible));
  let html = '', month = null;
  for (const s of list) {
    const m = s.date.slice(0, 7);
    if (m !== month) {
      if (month) html += '</div>';
      month = m;
      const ms = list.filter(x => x.date.startsWith(m));
      html += `<div class="month-head"><span>${fmtD(m + '-01', { month: 'long', year: 'numeric' })}</span><span>${ms.length} session${ms.length > 1 ? 's' : ''} · ${sum(ms, x => x.pris)} pris</span></div><div class="row">`;
    }
    html += sessionCard(s);
  }
  if (month) html += '</div>';
  return `${pageHeading('Sessions de pêche', `${db.sessions.length} sorties · ${fmtDur(sum(db.sessions, sDur))} au bord de l’eau`,
      `<button type="button" class="btn btn-sm btn-outline-primary shadow-sm" data-cmd="past-session">${fa('plus', 'fa-sm mr-1')} Session passée</button>`)}
    <div class="filters d-flex flex-wrap mb-2">${sel('sessions.year', 'Toutes les années', years(db.sessions), f.year)}${sel('sessions.cible', 'Tous les poissons recherchés', options('cible').map(o => o.v), f.cible)}</div>
    ${html || '<div class="card shadow mb-4"><div class="card-body text-gray-500 text-center">Aucune session.</div></div>'}`;
}

function viewSession(id) {
  const s = db.sessions.find(x => x.id === id);
  if (!s) return `${pageHeading('Session introuvable')}<a href="#/sessions" class="btn btn-light">${fa('arrow-left', 'mr-1')} Sessions</a>`;
  const cs = sorted('catches').filter(c => c.sessionId === id).reverse();
  const live = db.live === id, d = sDur(s);
  const hasMap = s.track?.length > 1 || cs.some(c => catchPos(c)) || !!spotPos(s.spot);
  if (hasMap) afterRender.push(() => initMiniMap('sessmap', { spot: s.spot, catches: cs, sessions: [s] }));
  const fact = (l, v, icon) => `<div class="col-6 col-md-3 mb-3"><div class="text-xs font-weight-bold text-primary text-uppercase mb-1">${fa(icon, 'mr-1 text-gray-300')}${l}</div><div class="font-weight-bold text-gray-800">${v || '—'}</div></div>`;
  return `<a href="#/sessions" class="btn btn-link px-0 mb-2">${fa('arrow-left', 'mr-1')} Sessions</a>
    ${pageHeading(esc(s.spot || 'Session'), fmtD(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + (live ? ' · <span class="text-success font-weight-bold">en cours</span>' : ''),
      `<div class="d-flex flex-wrap" style="gap:.5rem"><button type="button" class="btn btn-sm btn-primary shadow-sm" data-cmd="session-catch" data-id="${id}">${fa('plus', 'fa-sm text-white-50 mr-1')} Prise</button>
       ${s.spot ? `<a class="btn btn-sm btn-light shadow-sm" href="${spotHref(s.spot)}">${fa('map-marker-alt', 'fa-sm mr-1')} Fiche du spot</a>` : ''}
       <button type="button" class="btn btn-sm btn-light shadow-sm" data-cmd="edit-session" data-id="${id}">${fa('pen', 'fa-sm mr-1')} Modifier</button>${live ? `<button type="button" class="btn btn-sm btn-success shadow-sm" data-cmd="end-session">${fa('flag-checkered', 'fa-sm mr-1')} Terminer</button>` : ''}</div>`)}
    <div class="row">
      ${kpi('Poissons pris', s.pris, 'fish', 'success')}${kpi('Poissons ratés', s.rates, 'times-circle', 'warning')}
      ${kpi('Leurres perdus', s.leurresPerdus, 'anchor', 'danger')}${kpi('Rendement', d && s.fin ? unitV(nf(s.pris / (d / 60), 2), '/h') : '–', 'tachometer-alt', 'info', s.pris + s.rates ? `${Math.round(100 * s.pris / (s.pris + s.rates))} % des touches converties` : '')}
    </div>
    ${card('Détails de la session', `<div class="row">
      ${fact('Horaires', `${s.debut}${s.fin ? ' – ' + s.fin : ''}`, 'clock')}${fact('Durée', d ? fmtDur(d) : '', 'hourglass-half')}${fact("Cours d'eau", esc(s.coursEau), 'water')}${fact('Commune', esc(s.commune), 'map-marker-alt')}
      ${fact('Département', esc(s.departement), 'map')}${fact('Poisson recherché', esc(s.cible), 'bullseye')}${fact('Météo', s.meteo ? meteoIc(s.meteo) + ' ' + esc(s.meteo) : '', 'cloud-sun')}${fact('Vent', s.vent === 'Sans' ? 'Sans vent' : esc(s.vent), 'wind')}
      ${fact('T° air', s.tAir != null ? s.tAir + ' °C' : '', 'thermometer-half')}${fact('T° eau', s.tEau != null ? s.tEau + ' °C' : '', 'tint')}</div>
      ${s.note ? `<div class="border-top pt-3" style="white-space:pre-wrap">${esc(s.note)}</div>` : ''}`)}
    ${hasMap ? card('Carte de la session', '<div id="sessmap" class="mini-map"></div>', s.track?.length > 1 ? `<span class="small text-gray-600">${fa('route', 'mr-1')}Tracé ${fmtDist(trackLen(s.track))}</span>` : '') : ''}
    <div class="card shadow mb-4"><div class="card-header py-3 d-flex justify-content-between"><h6 class="m-0 font-weight-bold text-primary">Prises détaillées</h6><span class="small text-gray-500">${cs.length} ligne${cs.length > 1 ? 's' : ''}</span></div>
    ${cs.length ? `<div class="list-group list-group-flush">${cs.map(c => catchItem(c)).join('')}</div>` : `<div class="card-body text-gray-500">Aucune prise détaillée rattachée à cette session${s.pris ? ` (${s.pris} notée${s.pris > 1 ? 's' : ''} au bilan)` : ''}.</div>`}</div>`;
}

function viewStats() {
  const f = ui.stats;
  const cs = db.catches.filter(c => (!f.year || c.date.startsWith(f.year)) && (!f.poisson || c.poisson === f.poisson));
  const n = c => c.nbre, total = sum(cs, n), sized = cs.filter(c => c.taille);
  const big = [...sized].sort((a, b) => b.taille - a.taille);
  const days = new Set(cs.map(c => c.date)).size;
  const rel = sum(cs.filter(c => c.sort === 'Relâché'), n);
  const perYear = groupSum(cs, c => c.date.slice(0, 4), n), perMonth = groupSum(cs, c => +c.date.slice(5, 7), n), perHour = groupSum(cs, c => +c.time.slice(0, 2), n);
  const step = f.poisson ? 5 : 10, bins = groupSum(sized, c => Math.floor(c.taille / step) * step, n);
  const binKeys = [...bins.keys()], b0 = Math.min(...binKeys), b1 = Math.max(...binKeys);
  const hist = []; if (binKeys.length) for (let b = b0; b <= b1; b += step) hist.push({ l: String(b), t: `${b} à ${b + step - 1} cm`, v: bins.get(b) || 0 });
  const hrs = [...perHour.keys()], h0 = Math.min(6, ...hrs), h1 = Math.max(21, ...hrs);
  const hourItems = []; for (let h = h0; h <= h1; h++) hourItems.push({ l: h + 'h', t: `De ${h} h à ${h + 1} h`, v: perHour.get(h) || 0 });
  const withMax = (m, key, k = 10) => top(m, k).map(i => { const mx = Math.max(0, ...sized.filter(c => c[key] === i.l).map(c => c.taille)); return { ...i, sub: mx ? `max ${mx} cm` : '' }; });
  const yearItems = [...perYear].sort().map(([l, v]) => ({ l, v }));
  const bar = (items, cls) => chartBox({ labels: items.map(i => i.l), titles: items.map(i => i.t || i.l), data: items.map(i => i.v) }, cls);
  const col = (html, w = 'col-lg-6') => `<div class="${w}">${html}</div>`;

  const ss = db.sessions.filter(s => s.fin && (!f.year || s.date.startsWith(f.year)) && (!f.cible || s.cible === f.cible));
  const sh = sum(ss, sDur) / 60, sp = sum(ss, s => s.pris), sr = sum(ss, s => s.rates);
  const rate = (keyF, order) => {
    const g = new Map();
    for (const s of ss) { const k = keyF(s); if (k == null || k === '') continue; const o = g.get(k) || { p: 0, h: 0, n: 0 }; o.p += s.pris; o.h += sDur(s) / 60; o.n++; g.set(k, o); }
    let items = [...g].map(([l, o]) => ({ l: l === 'Sans' ? 'Sans vent' : l, v: o.h ? o.p / o.h : 0, sub: `${o.n} session${o.n > 1 ? 's' : ''} · ${o.p} pris`, k: l }));
    items = order ? items.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)) : items.sort((a, b) => b.v - a.v);
    return bars(items, v => nf(v, 2) + ' /h');
  };
  const tBins = ['< 10 °C', '10–14 °C', '15–19 °C', '20–24 °C', '25–29 °C', '≥ 30 °C'], slots = ['Matin (avant 11 h)', 'Midi (11–14 h)', 'Après-midi (14–17 h)', 'Soir (après 17 h)'];
  const sessYears = years(db.sessions);
  const sessNote = f.year && !sessYears.includes(f.year) ? `Aucune session enregistrée en ${f.year} (les sessions commencent en ${sessYears[sessYears.length - 1] || '—'}).` : f.poisson ? 'Les sessions ne sont pas filtrées par poisson pris ; utilise « Poisson recherché ».' : '';

  return `${pageHeading('Statistiques', f.year ? 'Année ' + f.year : 'Toutes les années')}
    <div class="filters d-flex flex-wrap mb-2">${sel('stats.year', 'Toutes les années', years(db.catches), f.year)}${sel('stats.poisson', 'Tous les poissons', top(groupSum(db.catches, c => c.poisson, n), 99).map(i => i.l), f.poisson)}</div>
    ${!cs.length ? '<div class="card shadow mb-4"><div class="card-body text-center text-gray-500">Aucune prise pour ce filtre.</div></div>' : `
    <div class="row">
      ${kpi('Poissons', nf(total), 'fish', 'primary', `${cs.length} lignes · ${days} jours avec prise`)}
      ${kpi('Taille moyenne', sized.length ? unitV(nf(sum(sized, c => c.taille * c.nbre) / sum(sized, n)), 'cm') : '–', 'ruler-horizontal', 'success')}
      ${kpi('Plus gros', big[0] ? unitV(big[0].taille, 'cm') : '–', 'trophy', 'warning', big[0] ? `${esc(big[0].poisson)} · ${fmtD(big[0].date, D_SHORT)}` : '')}
      ${kpi('Relâchés', unitV(total ? Math.round(100 * rel / total) : 0, '%'), 'hand-holding-water', 'info', `${total - rel} prélevé${total - rel > 1 ? 's' : ''}`)}
    </div>
    <div class="row">
      ${f.year ? '' : col(card('Poissons par année', bar(yearItems)))}
      ${col(card('Saisonnalité — poissons par mois', chartBox({ type: 'line', labels: MONTHS.map(m => m.replace('.', '')), titles: MONTHS, data: MONTHS.map((m, i) => perMonth.get(i + 1) || 0) })))}
      ${col(card('Heures de prise', bar(hourItems)))}
      ${col(card(`Tailles (tranches de ${step} cm)`, hist.length ? bar(hist) : '<p class="text-gray-500 mb-0">Pas de données.</p>'))}
      ${f.poisson ? '' : col(card('Espèces', bars(withMax(groupSum(cs, c => c.poisson, n), 'poisson', 16))))}
      ${col(card('Appâts et leurres les plus prenants', bars(withMax(groupSum(cs, c => c.leurre, n), 'leurre'))))}
      ${col(card('Spots les plus productifs', bars(withMax(groupSum(cs, c => c.spot, n), 'spot'))))}
      ${col(card("Cours d'eau les plus productifs", bars(withMax(groupSum(cs, c => c.riviere, n), 'riviere'))))}
      ${col(card('Techniques', bars(top(groupSum(cs, c => c.technique, n)))))}
      ${col(card('Équipement', bars(withMax(groupSum(cs, c => c.equipement, n), 'equipement'))))}
    </div>
    <div class="card shadow mb-4"><div class="card-header py-3"><h6 class="m-0 font-weight-bold text-primary">Top 10 des plus gros poissons</h6></div>
      <div class="list-group list-group-flush">${big.slice(0, 10).map((c, i) => recRow(c, i, ' · ' + esc(c.leurre))).join('')}</div></div>`}
    <h2 class="h4 text-gray-800 mt-5 mb-3">Analyse des sessions</h2>
    <div class="filters d-flex flex-wrap mb-2">${sel('stats.cible', 'Tous les poissons recherchés', options('cible').map(o => o.v), f.cible)}</div>
    ${sessNote ? `<div class="alert alert-info small py-2">${sessNote}</div>` : ''}
    ${!ss.length ? '<div class="card shadow mb-4"><div class="card-body text-center text-gray-500">Aucune session pour ce filtre.</div></div>' : `
    <div class="row">
      ${kpi('Sessions', ss.length, 'calendar-alt', 'primary', `durée moyenne ${fmtDur(sh * 60 / ss.length)}`)}
      ${kpi('Temps de pêche', unitV(nf(sh, 0), 'h'), 'clock', 'success', `${nf(sp / sh, 2)} poisson/h`)}
      ${kpi('Bredouilles', unitV(Math.round(100 * ss.filter(s => !s.pris).length / ss.length), '%'), 'times-circle', 'danger', `${ss.filter(s => !s.pris).length} sessions sans prise`)}
      ${kpi('Touches converties', unitV(sp + sr ? Math.round(100 * sp / (sp + sr)) : 0, '%'), 'bullseye', 'warning', `${sp} pris · ${sr} ratés · ${sum(ss, s => s.leurresPerdus)} leurres perdus`)}
    </div>
    <p class="small text-gray-600">Rendement = poissons pris par heure de pêche.</p>
    <div class="row">
      ${col(card('Selon la météo', rate(s => s.meteo)))}
      ${col(card('Selon le vent', rate(s => s.vent)))}
      ${col(card('Selon la température de l’air', rate(s => s.tAir == null ? null : tBins[s.tAir < 10 ? 0 : s.tAir >= 30 ? 5 : Math.floor(s.tAir / 5) - 1], tBins)))}
      ${col(card('Selon l’heure de début', rate(s => { const h = mins(s.debut) / 60; return slots[h < 11 ? 0 : h < 14 ? 1 : h < 17 ? 2 : 3]; }, slots)))}
      ${col(card('Par spot', rate(s => s.spot)))}
      ${col(card("Par cours d'eau", rate(s => s.coursEau)))}
    </div>`}`;
}

function viewSettings() {
  const lf = ui.listField;
  const vals = [...counts(lf)].sort((a, b) => a[0].localeCompare(b[0]));
  return `${pageHeading('Réglages')}
    <div class="row"><div class="col-lg-6">
    ${card('Mes données', `<p class="mb-2"><b>${db.catches.length}</b> lignes de prises · <b>${db.sessions.length}</b> sessions, enregistrées dans ce navigateur, sur cet appareil.</p>
      <p class="small text-gray-600">Les données ne sont pas synchronisées entre appareils : exporte une sauvegarde régulièrement, et importe-la pour passer d’un appareil à l’autre.</p>
      <div class="d-flex flex-wrap" style="gap:.5rem">
        <button type="button" class="btn btn-primary btn-icon-split" data-cmd="export-json"><span class="icon text-white-50">${fa('download')}</span><span class="text">Exporter une sauvegarde</span></button>
        <label class="btn btn-light btn-icon-split mb-0"><span class="icon text-gray-600">${fa('upload')}</span><span class="text">Importer une sauvegarde</span><input type="file" accept="application/json,.json" data-import hidden></label>
      </div><hr>
      <div class="d-flex flex-wrap" style="gap:.5rem">
        <button type="button" class="btn btn-success btn-icon-split" data-cmd="export-csv" data-val="catches"><span class="icon text-white-50">${fa('file-csv')}</span><span class="text">Prises → Excel</span></button>
        <button type="button" class="btn btn-success btn-icon-split" data-cmd="export-csv" data-val="sessions"><span class="icon text-white-50">${fa('file-csv')}</span><span class="text">Sessions → Excel</span></button>
      </div><hr>
      <button type="button" class="btn btn-outline-danger btn-sm" data-cmd="reset">${fa('undo', 'mr-1')} Revenir à la base d’origine (Pêche.xlsx)</button>`)}
    ${card('Sur iPhone', '<p class="mb-0">Une fois le site ouvert dans Safari : bouton <b>Partager</b>, puis <b>Sur l’écran d’accueil</b>. L’app s’ouvre alors en plein écran et fonctionne sans réseau.</p>')}
    </div><div class="col-lg-6">
    ${card('Listes de valeurs', `<p class="small text-gray-600">Clique une valeur pour la renommer partout. Lui donner le nom d’une valeur existante fusionne les deux.</p>
      <select class="custom-select mb-3" data-cmd-change="list-field">${Object.entries(FIELDS).map(([k, v]) => `<option value="${k}"${k === lf ? ' selected' : ''}>${v.label}</option>`).join('')}</select>
      <div class="list-group opt-list">${vals.map(([v, nb]) => `<button type="button" class="list-group-item list-group-item-action" data-cmd="rename" data-val="${esc(v)}"><span>${esc(v)}</span><span class="badge badge-secondary badge-pill">${nb}</span></button>`).join('')}</div>`)}
    </div></div>`;
}

/* ---------------- Coque : barre latérale, barre du haut, onglets mobiles ---------------- */
function renderShell(tab) {
  const live = liveSession();
  const item = (t, href, icon, label) => `<li class="nav-item${tab === t ? ' active' : ''}"><a class="nav-link" href="${href}">${fa(icon, 'fa-fw')}<span>${label}</span></a></li>`;
  $('#accordionSidebar').innerHTML = `
    <a class="sidebar-brand d-flex align-items-center justify-content-center" href="#/"><div class="sidebar-brand-icon rotate-n-15">${fa('fish')}</div><div class="sidebar-brand-text mx-3">Carnet de pêche</div></a>
    <hr class="sidebar-divider my-0">
    ${item('home', '#/', 'tachometer-alt', 'Tableau de bord')}
    <hr class="sidebar-divider"><div class="sidebar-heading">Journal</div>
    ${item('prises', '#/prises', 'fish', 'Prises')}${item('sessions', '#/sessions', 'stopwatch', 'Sessions')}
    <hr class="sidebar-divider"><div class="sidebar-heading">Analyse</div>
    ${item('stats', '#/stats', 'chart-bar', 'Statistiques')}${item('carte', '#/carte', 'map-marked-alt', 'Carte')}
    <hr class="sidebar-divider"><div class="sidebar-heading">Outils</div>
    ${item('reglages', '#/reglages', 'cog', 'Réglages')}
    <hr class="sidebar-divider d-none d-md-block">
    <div class="text-center d-none d-md-inline"><button class="rounded-circle border-0" id="sidebarToggle" aria-label="Réduire le menu"></button></div>
    <div class="sidebar-card d-none d-lg-flex">${live
      ? `<div class="small text-white-50 text-uppercase font-weight-bold mb-1">${fa('circle', 'pulse mr-1')}En session</div><div class="h4 mb-1" data-timer>${fmtDur(sDur(live))}</div><p class="text-center mb-2 small">${esc(live.spot)} · ${live.pris || 0} pris</p><button class="btn btn-success btn-sm" data-cmd="new-catch">${fa('plus', 'mr-1')}Nouvelle prise</button>`
      : `<div class="mb-2">${fa('fish', 'fa-2x text-white-50')}</div><p class="text-center mb-2"><strong>Au bord de l’eau ?</strong> Lance le chrono et note tes prises en un geste.</p><button class="btn btn-success btn-sm" data-cmd="start-session">${fa('play', 'mr-1')}Démarrer une session</button>`}</div>`;
  if (document.body.classList.contains('sidebar-toggled')) $('#accordionSidebar').classList.add('toggled');

  $('#topbar').innerHTML = `
    <a href="#/" class="d-md-none font-weight-bold text-primary text-decoration-none mr-auto" style="font-size:1.05rem">${fa('fish', 'mr-1')} Carnet de pêche</a>
    <form class="d-none d-md-inline-block form-inline mr-auto ml-md-3 my-2 my-md-0 mw-100 navbar-search" data-search>
      <div class="input-group"><input type="search" class="form-control bg-light border-0 small" placeholder="Rechercher une prise (poisson, spot, leurre…)" aria-label="Rechercher" value="${tab === 'prises' ? esc(ui.prises.q) : ''}">
      <div class="input-group-append"><button class="btn btn-primary" type="submit" aria-label="Rechercher">${fa('search', 'fa-sm')}</button></div></div></form>
    <ul class="navbar-nav ml-auto align-items-center">
      ${live ? `<li class="nav-item mx-1"><a href="#/" class="btn btn-success btn-icon-split btn-sm live-btn"><span class="icon text-white-50">${fa('circle', 'pulse')}</span><span class="text" data-timer>${fmtDur(sDur(live))}</span></a></li>` : ''}
      <li class="nav-item mx-1 d-none d-md-block"><button type="button" class="btn btn-primary btn-sm shadow-sm" data-cmd="add">${fa('plus', 'fa-sm mr-1')}${live ? 'Nouvelle prise' : 'Ajouter'}</button></li>
      <div class="topbar-divider d-none d-sm-block"></div>
      <li class="nav-item"><a class="nav-link${tab === 'reglages' ? ' text-primary' : ''}" href="#/reglages" aria-label="Réglages">${fa('cog', 'fa-fw')}</a></li>
    </ul>`;

  const mi = (t, href, icon, label) => `<a href="${href}" class="${tab === t ? 'active' : ''}">${fa(icon)}<span>${label}</span></a>`;
  $('#mobile-nav').innerHTML = `${mi('home', '#/', 'tachometer-alt', 'Accueil')}${mi('prises', '#/prises', 'fish', 'Prises')}${mi('sessions', '#/sessions', 'stopwatch', 'Sessions')}
    <button type="button" class="add${live ? ' live' : ''}" data-cmd="add" aria-label="${live ? 'Nouvelle prise' : 'Ajouter'}">${fa('plus')}</button>
    ${mi('carte', '#/carte', 'map-marked-alt', 'Carte')}${mi('stats', '#/stats', 'chart-bar', 'Stats')}`;
}

/* ---------------- Rendu et navigation ---------------- */
let lastRoute = null;
function render() {
  const h = location.hash.replace(/^#\/?/, ''), [page, arg] = h.split('/');
  const tab = { '': 'home', prises: 'prises', sessions: 'sessions', session: 'sessions', stats: 'stats', reglages: 'reglages', carte: 'carte', spot: 'carte' }[page] || 'home';
  cleanups.forEach(fn => fn()); cleanups = [];
  liveMaps.forEach(m => m.remove()); liveMaps = []; afterRender = [];
  if (dt) { dt.destroy(); dt = null; }
  renderShell(tab);
  pending = [];
  $('#view').innerHTML = page === 'prises' ? viewPrises() : page === 'sessions' ? viewSessions() : page === 'session' ? viewSession(arg) : page === 'stats' ? viewStats() : page === 'reglages' ? viewSettings() : page === 'carte' ? viewCarte() : page === 'spot' ? viewSpot(decodeURIComponent(arg || '')) : viewHome();
  drawCharts();
  afterRender.forEach(fn => fn()); afterRender = [];
  if (page === 'prises') initTable();
  if (page === 'carte') initCarte();
  syncGps();
  if (lastRoute !== h) { scrollTo(0, 0); lastRoute = h; }
}
addEventListener('hashchange', render);
setInterval(() => { const s = liveSession(); if (s) $$('[data-timer]').forEach(el => { el.textContent = fmtDur(sDur(s)); }); }, 15000);
const toTop = $('#toTop');
addEventListener('scroll', () => { toTop.style.display = scrollY > 300 ? 'inline' : 'none'; }, { passive: true });
toTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function csv(kind) {
  const fr = d => d.split('-').reverse().join('/'), q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = kind === 'catches'
    ? [['Année', 'Date', 'Heure', 'Rivière', 'Spot', 'Poisson', 'Nbre', 'Taille', 'Relâché/Prélevé', 'Technique', 'Équipement', 'Appât/Leurre', 'Note', 'Latitude', 'Longitude'],
      ...sorted('catches').reverse().map(c => [c.date.slice(0, 4), fr(c.date), c.time, c.riviere, c.spot, c.poisson, c.nbre, c.taille, c.sort, c.technique, c.equipement, c.leurre, c.note, ...(catchPos(c) || ['', ''])])]
    : [['Date', 'Début', 'Fin', 'Durée', 'Département', 'Commune', 'Spot', "Cours d'eau", 'T° air', 'T° eau', 'Météo', 'Vent', 'Poisson recherché', 'Poissons pris', 'Poissons ratés', 'Leurres perdus', 'Note'],
      ...sorted('sessions').reverse().map(s => { const d = sDur(s); return [fr(s.date), s.debut, s.fin, s.fin ? pad(Math.floor(d / 60)) + ':' + pad(d % 60) : '', s.departement, s.commune, s.spot, s.coursEau, s.tAir, s.tEau, s.meteo, s.vent, s.cible, s.pris, s.rates, s.leurresPerdus, s.note]; })];
  download(`peche-${kind === 'catches' ? 'prises' : 'sessions'}-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}

const CMD = {
  add: addMenu,
  'new-catch': () => catchSheet(),
  'start-session': () => sessionSheet(null, 'start'),
  'past-session': () => sessionSheet(null, 'past'),
  'end-session': () => { const s = liveSession(); if (s) sessionSheet(s, 'end'); },
  'open-session': t => { location.hash = '#/session/' + t.dataset.id; },
  'edit-catch': t => { const c = db.catches.find(x => x.id === t.dataset.id); if (c) catchSheet(c); },
  'edit-session': t => { const s = db.sessions.find(x => x.id === t.dataset.id); if (s) sessionSheet(s, 'edit'); },
  'session-catch': t => { const s = db.sessions.find(x => x.id === t.dataset.id); catchSheet(null, { sessionId: s.id, time: db.live === s.id ? nowHM() : s.debut }); },
  'live-inc': t => { const s = liveSession(); if (!s) return; s[t.dataset.key] = Math.max(0, (s[t.dataset.key] || 0) + +t.dataset.d); save(); render(); },
  'map-filters': () => mapFilters(),
  spots: () => spotsSheet(),
  'place-spot': t => placeSpot(t.dataset.name),
  'spot-on-map': t => { ui.map.focus = t.dataset.name; ui.map.view = null; location.hash = '#/carte'; },
  'export-json': () => download(`peche-sauvegarde-${today()}.json`, JSON.stringify(db), 'application/json'),
  'export-csv': t => csv(t.dataset.val),
  reset: () => { if (confirm('Remplacer toutes les données de cet appareil par la base d’origine ?\nLes saisies faites depuis seront perdues (pense à exporter une sauvegarde avant). Les spots placés sur la carte sont conservés.')) { const sp = db.spots; db = freshDb(); db.spots = sp; save(); render(); toast('Base d’origine restaurée'); } },
  rename: t => {
    const old = t.dataset.val, v = (prompt(`Renommer « ${old} » en :`, old) || '').trim();
    if (!v || v === old) return;
    for (const [tb, f] of FIELDS[ui.listField].src) for (const o of db[tb]) if (o[f] === old) o[f] = v;
    if (ui.listField === 'spot' && db.spots[old]) { if (!db.spots[v]) db.spots[v] = db.spots[old]; delete db.spots[old]; }
    save(); render(); toast('Valeur renommée partout');
  },
};
document.addEventListener('click', e => {
  if (e.target.closest('#sidebarToggle')) {
    document.body.classList.toggle('sidebar-toggled'); $('#accordionSidebar').classList.toggle('toggled'); return;
  }
  const t = e.target.closest('[data-cmd]'); if (t && !t.closest('.sheet-wrap')) CMD[t.dataset.cmd]?.(t);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('.session-card')) CMD['open-session'](e.target); });
document.addEventListener('submit', e => {
  if (!e.target.matches('[data-search]')) return;
  e.preventDefault();
  ui.prises.q = $('input', e.target).value.trim(); ui.prises.page = 0;
  if (location.hash === '#/prises') render(); else location.hash = '#/prises';
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ui) { const [a, b] = t.dataset.ui.split('.'); ui[a][b] = t.value; if (a === 'prises') ui.prises.page = 0; render(); }
  if (t.dataset.cmdChange === 'list-field') { ui.listField = t.value; render(); }
  if (t.matches('[data-import]') && t.files[0]) {
    t.files[0].text().then(txt => {
      const d = JSON.parse(txt);
      if (!Array.isArray(d.catches) || !Array.isArray(d.sessions)) throw new Error('format');
      if (!confirm(`Remplacer les données de cet appareil par cette sauvegarde ?\n${d.catches.length} lignes de prises · ${d.sessions.length} sessions`)) return;
      db = { v: 1, catches: d.catches, sessions: d.sessions, live: d.live || null, settings: d.settings || {}, spots: d.spots || db.spots || {} };
      save(); render(); toast('Sauvegarde importée');
    }).catch(() => toast('Fichier de sauvegarde invalide'));
  }
});

if (!localStorage.getItem(KEY)) save();
render();
navigator.storage?.persist?.().catch(() => {});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
