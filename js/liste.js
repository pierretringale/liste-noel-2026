// [LISTE] — Page famille : afficher les souhaits, réserver avec un prénom, libérer
// Trigger    : chargement de index.html, puis toutes les 30 s quand l'onglet est visible
// Étapes     : lire la liste → dessiner les cartes → réserver (claim) / libérer (release) → relire
// Contraintes: textes de la maquette mot pour mot ; jamais de page blanche si le guichet tombe
// Cas limites: voir PROJET_ListeNoel.md section "Cas limites"

// === IMPORTS ===
import { getGifts, post, shopOf, priceText, esc, store } from './api.js';

// === ÉTAT DE LA PAGE ===
const REFRESH_MS = 30000;
const CHILDREN = ['Loula', 'Sacha', 'Les deux'];
const idDeSection = (enfant) => enfant.replace(/ /g, '-');
const CACHE_KEY = 'noel:derniere-liste';
const NAME_KEY = 'noel:prenom';

const etat = {
  cadeaux: [],
  filtre: 'all',
  // Par cadeau : { mode: 'asking' | 'release' | null, brouillon, occupe, message }
  carte: {},
  photosCassees: new Set(),
  lectureEnCours: false,
  empreinte: ''
};

// === PICTOGRAMMES (maquette) ===
const PICTOS = {
  gift: '<svg aria-hidden="true" viewBox="0 0 96 96" fill="none" stroke="#ffd23f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="40" width="64" height="42" rx="4"></rect><rect x="10" y="26" width="76" height="14" rx="4"></rect><path d="M48 26v56"></path><path d="M48 26c-6-14-24-14-22-4 1 6 12 6 22 4z"></path><path d="M48 26c6-14 24-14 22-4-1 6-12 6-22 4z"></path></svg>',
  figure: '<svg aria-hidden="true" viewBox="0 0 96 96" fill="none" stroke="#ffd23f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="48" cy="22" r="11"></circle><rect x="33" y="37" width="30" height="28" rx="7"></rect><path d="M33 44l-12 12"></path><path d="M63 44l12 12"></path><path d="M41 65v19"></path><path d="M55 65v19"></path></svg>',
  costume: '<svg aria-hidden="true" viewBox="0 0 96 96" fill="none" stroke="#ffd23f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M48 24c0-5 6-5 6-10a6 6 0 0 0-12 0"></path><path d="M48 24L18 42h60z"></path><path d="M28 42l-6 42h52l-6-42"></path><path d="M40 60h16"></path></svg>',
  saber: (t) => '<svg aria-hidden="true" viewBox="0 0 96 96" fill="none" stroke-linecap="round"><path d="M38 58L80 16" stroke="' + t + '" stroke-width="14" opacity=".35"></path><path d="M38 58L80 16" stroke="' + t + '" stroke-width="6"></path><path d="M16 80l20-20" stroke="#ffd23f" stroke-width="9"></path><path d="M30 54l12 12" stroke="#ffd23f" stroke-width="4"></path></svg>'
};
const TEINTES = [[/bleu/i, '#5b8fe0'], [/vert/i, '#5fd98a'], [/rouge/i, '#ee5a40'], [/violet/i, '#8a3440']];

function deduirePicto(cadeau) {
  const nom = cadeau.name.toLowerCase();
  if (nom.includes('sabre')) {
    const trouvee = TEINTES.find(([motif]) => motif.test(cadeau.note ?? ''));
    return PICTOS.saber(trouvee ? trouvee[1] : '#ffd23f');
  }
  if (nom.includes('déguisement') || nom.includes('deguisement')) return PICTOS.costume;
  if (nom.includes('figurine')) return PICTOS.figure;
  return PICTOS.gift;
}

// === DESSIN D'UNE CARTE ===
function dessinerVignette(cadeau, reserve) {
  const classes = 'thumb' + (reserve ? ' is-dim' : '');
  if (cadeau.photo_url && !etat.photosCassees.has(cadeau.id)) {
    return '<div class="' + classes + ' has-photo"><img src="' + esc(cadeau.photo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-photo="' + esc(cadeau.id) + '"></div>';
  }
  return '<div class="' + classes + '">' + deduirePicto(cadeau) + '<span class="thumb-label">Photo à venir</span></div>';
}

function dessinerReservation(cadeau, ui) {
  const id = esc(cadeau.id);
  const occupe = ui.occupe ? ' disabled' : '';
  if (cadeau.claimed_by && ui.mode === 'release') {
    return '<p class="resa-ask">Libérer ce souhait, réservé par ' + esc(cadeau.claimed_by) + ' ?</p>' +
      '<div class="resa-actions"><button type="button" class="btn-ink" data-act="release-yes" id="oui-' + id + '"' + occupe + '>Oui</button>' +
      '<button type="button" class="btn-paper" data-act="release-no"' + occupe + '>Non</button></div>';
  }
  if (cadeau.claimed_by) {
    return '<label class="check" for="cb-' + id + '"><input type="checkbox" id="cb-' + id + '" checked data-act="toggle"><span>Réservé par ' + esc(cadeau.claimed_by) + '</span></label>';
  }
  if (ui.mode === 'asking') {
    return '<form class="resa-form" data-act="claim">' +
      '<label class="resa-label" for="nm-' + id + '">Votre prénom</label>' +
      '<input class="resa-input" type="text" id="nm-' + id + '" value="' + esc(ui.brouillon) + '" maxlength="40" autocomplete="given-name" required' + occupe + '>' +
      '<div class="resa-actions"><button type="submit" class="btn-ink"' + occupe + '>Valider</button>' +
      '<button type="button" class="btn-paper" data-act="cancel"' + occupe + '>Annuler</button></div></form>';
  }
  return '<label class="check" for="cb-' + id + '"><input type="checkbox" id="cb-' + id + '" data-act="toggle">Je l\'offre</label>';
}

function dessinerCarte(cadeau) {
  const ui = etat.carte[cadeau.id] ?? {};
  const reserve = !!cadeau.claimed_by;
  const prix = typeof cadeau.price === 'number'
    ? '<span class="card-price">' + priceText(cadeau.price) + '</span>'
    : '<span class="card-noprice">Prix à vérifier</span>';
  const lien = cadeau.url
    ? '<a class="card-link" href="' + esc(cadeau.url) + '" target="_blank" rel="noopener noreferrer">Voir chez ' + esc(shopOf(cadeau.url)) + '</a>'
    : '';
  return '<div class="card-wrap" data-id="' + esc(cadeau.id) + '"><div class="dots" aria-hidden="true"></div>' +
    '<article class="card' + (reserve ? ' is-taken' : '') + '">' +
    (reserve ? '<div class="stamp" aria-hidden="true">Réservé</div>' : '') +
    '<div class="card-top">' + dessinerVignette(cadeau, reserve) +
    '<div class="card-info"><h3 class="card-name">' + esc(cadeau.name) + '</h3>' +
    (cadeau.note ? '<p class="card-note">' + esc(cadeau.note) + '</p>' : '') +
    '<div class="card-buy">' + prix + lien + '</div></div></div>' +
    '<div class="resa' + (ui.mode === 'asking' && !reserve ? ' is-asking' : '') + '">' + dessinerReservation(cadeau, ui) +
    '<p class="resa-msg" role="status">' + esc(ui.message ?? '') + '</p></div>' +
    '</article></div>';
}

// === DESSIN DE LA PAGE ===
function ligneCompte(liste) {
  const libres = liste.filter((c) => !c.claimed_by).length;
  return libres + (libres > 1 ? ' encore libres sur ' : ' encore libre sur ') + liste.length;
}

function memoriserFocus() {
  const el = document.activeElement;
  if (!el || !el.id) return null;
  return { id: el.id, debut: el.selectionStart, fin: el.selectionEnd };
}

function restaurerFocus(f) {
  if (!f) return;
  const el = document.getElementById(f.id);
  if (!el) return;
  el.focus({ preventScroll: true });
  if (typeof f.debut === 'number' && el.setSelectionRange) {
    try { el.setSelectionRange(f.debut, f.fin); } catch (e) { /* champ sans sélection */ }
  }
}

function dessinerPage() {
  const focus = memoriserFocus();
  const tous = etat.cadeaux;
  const reserves = tous.filter((c) => c.claimed_by).length;
  document.getElementById('n-total').textContent = tous.length;
  document.getElementById('n-taken').textContent = reserves;
  document.getElementById('n-free').textContent = tous.length - reserves;

  for (const enfant of CHILDREN) {
    const siens = tous.filter((c) => c.child === enfant);
    const visibles = siens.filter((c) => etat.filtre === 'all' || !c.claimed_by);
    const suffixe = idDeSection(enfant);
    const grille = document.getElementById('grid-' + suffixe);
    grille.closest('section').hidden = siens.length === 0;
    document.getElementById('count-' + suffixe).textContent = ligneCompte(siens);
    document.getElementById('empty-' + suffixe).hidden = visibles.length !== 0;
    grille.innerHTML = visibles.map(dessinerCarte).join('');
  }
  restaurerFocus(focus);
}

function annoncer(texte) {
  const zone = document.getElementById('announce');
  zone.textContent = '';
  setTimeout(() => { zone.textContent = texte; }, 50);
}

function afficherPanne(enPanne) {
  document.getElementById('alert').hidden = !enPanne;
}

// === LECTURE DE LA LISTE ===
async function relireListe() {
  if (etat.lectureEnCours) return;
  etat.lectureEnCours = true;
  try {
    const reponseGuichet = await getGifts();
    const cadeaux = reponseGuichet.data.gifts;
    if (!Array.isArray(cadeaux)) throw new Error('reponse_inattendue');
    afficherPanne(false);
    const empreinte = JSON.stringify(cadeaux);
    if (empreinte !== etat.empreinte) {
      etat.empreinte = empreinte;
      etat.cadeaux = cadeaux;
      store.set('localStorage', CACHE_KEY, empreinte);
      nettoyerEtatCartes();
      dessinerPage();
    }
  } catch (e) {
    afficherPanne(true);
  } finally {
    etat.lectureEnCours = false;
  }
}

function nettoyerEtatCartes() {
  const ids = new Set(etat.cadeaux.map((c) => c.id));
  for (const id of Object.keys(etat.carte)) if (!ids.has(id)) delete etat.carte[id];
}

function majCarte(cadeauId, changement) {
  etat.carte[cadeauId] = Object.assign({}, etat.carte[cadeauId] ?? {}, changement);
}

function trouverCadeau(cadeauId) {
  return etat.cadeaux.find((c) => c.id === cadeauId);
}

// === RÉSERVER ===
async function reserverCadeau(cadeauId) {
  const ui = etat.carte[cadeauId] ?? {};
  const prenom = (ui.brouillon ?? '').trim();
  if (!prenom) { document.getElementById('nm-' + cadeauId)?.focus(); return; }
  majCarte(cadeauId, { occupe: true, message: '' });
  dessinerPage();
  try {
    const reponseGuichet = await post({ action: 'claim', gift_id: cadeauId, name: prenom });
    const cadeau = trouverCadeau(cadeauId);
    if (reponseGuichet.status === 200) {
      store.set('localStorage', NAME_KEY, prenom);
      if (cadeau) cadeau.claimed_by = reponseGuichet.data.claimed_by;
      majCarte(cadeauId, { mode: null, occupe: false, message: '' });
      annoncer('Réservé par ' + reponseGuichet.data.claimed_by);
      etat.empreinte = '';
      dessinerPage();
      document.getElementById('cb-' + cadeauId)?.focus();
    } else if (reponseGuichet.status === 409) {
      if (cadeau) cadeau.claimed_by = reponseGuichet.data.claimed_by;
      const texte = 'Trop tard, ce souhait vient d\'être réservé par ' + (reponseGuichet.data.claimed_by ?? 'quelqu\'un') + '.';
      majCarte(cadeauId, { mode: null, occupe: false, message: texte });
      etat.empreinte = '';
      dessinerPage();
      annoncer(texte);
    } else {
      majCarte(cadeauId, { mode: null, occupe: false });
      etat.empreinte = '';
    }
    afficherPanne(false);
  } catch (e) {
    majCarte(cadeauId, { occupe: false });
    dessinerPage();
    afficherPanne(true);
  }
  relireListe();
}

// === LIBÉRER ===
async function libererCadeau(cadeauId) {
  majCarte(cadeauId, { occupe: true, message: '' });
  dessinerPage();
  try {
    await post({ action: 'release', gift_id: cadeauId });
    const cadeau = trouverCadeau(cadeauId);
    if (cadeau) cadeau.claimed_by = null;
    majCarte(cadeauId, { mode: null, occupe: false });
    etat.empreinte = '';
    dessinerPage();
    annoncer('Souhait libéré');
    document.getElementById('cb-' + cadeauId)?.focus();
    afficherPanne(false);
  } catch (e) {
    majCarte(cadeauId, { occupe: false });
    dessinerPage();
    afficherPanne(true);
  }
  relireListe();
}

// === ÉVÉNEMENTS DES CARTES ===
function idDeCarte(el) {
  const carte = el.closest('.card-wrap');
  return carte ? carte.dataset.id : null;
}

function surCoche(e) {
  if (e.target.dataset.act !== 'toggle') return;
  const cadeauId = idDeCarte(e.target);
  const cadeau = trouverCadeau(cadeauId);
  if (!cadeau) return;
  if (cadeau.claimed_by) {
    majCarte(cadeauId, { mode: 'release', message: '' });
    dessinerPage();
    document.getElementById('oui-' + cadeauId)?.focus();
  } else {
    majCarte(cadeauId, { mode: 'asking', brouillon: store.get('localStorage', NAME_KEY) ?? '', message: '' });
    dessinerPage();
    const champ = document.getElementById('nm-' + cadeauId);
    if (champ) { champ.focus(); champ.select(); }
  }
}

function surClic(e) {
  const bouton = e.target.closest('[data-act]');
  if (!bouton || bouton.tagName !== 'BUTTON') return;
  const cadeauId = idDeCarte(bouton);
  const action = bouton.dataset.act;
  if (action === 'cancel' || action === 'release-no') {
    majCarte(cadeauId, { mode: null, message: '' });
    dessinerPage();
    document.getElementById('cb-' + cadeauId)?.focus();
  } else if (action === 'release-yes') {
    libererCadeau(cadeauId);
  }
}

function surSaisie(e) {
  if (!e.target.classList.contains('resa-input')) return;
  majCarte(idDeCarte(e.target), { brouillon: e.target.value });
}

function surEnvoi(e) {
  if (e.target.dataset.act !== 'claim') return;
  e.preventDefault();
  reserverCadeau(idDeCarte(e.target));
}

function surPhotoCassee(e) {
  const img = e.target;
  if (img.tagName !== 'IMG' || !img.dataset.photo) return;
  etat.photosCassees.add(img.dataset.photo);
  dessinerPage();
}

// === FILTRE ===
function choisirFiltre(filtre) {
  etat.filtre = filtre;
  document.getElementById('f-all').setAttribute('aria-pressed', String(filtre === 'all'));
  document.getElementById('f-free').setAttribute('aria-pressed', String(filtre === 'free'));
  dessinerPage();
}

// === DÉMARRAGE ===
function demarrerPage() {
  const enCache = store.get('localStorage', CACHE_KEY);
  if (enCache) {
    try { etat.cadeaux = JSON.parse(enCache); dessinerPage(); } catch (e) { /* cache illisible */ }
  }
  for (const enfant of CHILDREN) {
    const grille = document.getElementById('grid-' + idDeSection(enfant));
    grille.addEventListener('change', surCoche);
    grille.addEventListener('click', surClic);
    grille.addEventListener('input', surSaisie);
    grille.addEventListener('submit', surEnvoi);
    grille.addEventListener('error', surPhotoCassee, true);
  }
  document.getElementById('f-all').addEventListener('click', () => choisirFiltre('all'));
  document.getElementById('f-free').addEventListener('click', () => choisirFiltre('free'));

  relireListe();
  setInterval(() => { if (document.visibilityState === 'visible') relireListe(); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') relireListe(); });
}

demarrerPage();
