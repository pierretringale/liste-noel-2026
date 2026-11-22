// [PARENTS] — Connexion par code, puis ajout / modification / suppression des cadeaux
// Trigger    : chargement de parents.html
// Étapes     : vérifier le jeton → connexion si besoin → liste à gauche, fiche à droite → enregistrer
// Contraintes: le code n'est jamais gardé, seul le jeton circule ; photo réduite dans le navigateur
// Cas limites: voir PROJET_ListeNoel.md section "Cas limites"

// === IMPORTS ===
import { getGifts, post, shopOf, priceText, esc, store } from './api.js';

// === ÉTAT ===
const TOKEN_KEY = 'noel:jeton';
const REFRESH_MS = 30000;
const PHOTO_COTE_MAX = 600;
const PHOTO_POIDS_MAX = 400 * 1024;
const MSG_PANNE = 'La liste ne répond pas pour le moment. Réessayez dans un instant.';
const MSG_ENREGISTRE = "C'est enregistré. La liste est à jour pour toute la famille.";
const ERREURS_FICHE = {
  invalid_name: 'Le nom du cadeau doit faire entre 1 et 140 caractères.',
  invalid_url: 'Le lien vers la boutique doit commencer par https://',
  invalid_price: "Ce prix n'est pas reconnu. Exemple : 41,00",
  invalid_note: 'La précision fait 80 caractères au maximum.',
  invalid_photo_url: "L'adresse de la photo doit commencer par https://",
  too_many_gifts: 'La liste est pleine (200 cadeaux).',
  too_large: 'La photo est trop lourde, même réduite.',
  invalid_type: 'Ce format de photo ne passe pas. Essayez une photo JPEG.',
  not_found: "Ce cadeau n'existe plus. La liste a été rechargée."
};

const etat = { cadeaux: [], enCours: null, confirmSuppr: false, occupe: false };
const $ = (id) => document.getElementById(id);

// === JETON ===
function lireJeton() {
  return store.get('localStorage', TOKEN_KEY) ?? store.get('sessionStorage', TOKEN_KEY);
}
function garderJeton(jeton, durable) {
  effacerJeton();
  store.set(durable ? 'localStorage' : 'sessionStorage', TOKEN_KEY, jeton);
}
function effacerJeton() {
  store.del('localStorage', TOKEN_KEY);
  store.del('sessionStorage', TOKEN_KEY);
}

// Appel parents : ajoute le jeton, renvoie à la connexion sur 401.
async function appelParents(corps) {
  const reponseGuichet = await post(Object.assign({ token: lireJeton() }, corps));
  if (reponseGuichet.status === 401) {
    effacerJeton();
    montrerConnexion();
    throw new Error('session_expiree');
  }
  return reponseGuichet;
}

// === VUES ===
function montrerConnexion(message) {
  $('vue-parents').hidden = true;
  $('vue-connexion').hidden = false;
  $('erreur-connexion').textContent = message ?? '';
  $('code').focus();
}

function montrerParents() {
  $('vue-connexion').hidden = true;
  $('vue-parents').hidden = false;
  chargerFiche(null);
  relireListe();
}

// === CONNEXION ===
async function seConnecter(e) {
  e.preventDefault();
  const champ = $('code');
  const durable = $('keep').checked;
  $('btn-entrer').disabled = true;
  $('erreur-connexion').textContent = '';
  try {
    const reponseGuichet = await post({ action: 'login', code: champ.value, remember: durable });
    champ.value = '';
    if (reponseGuichet.status === 200 && reponseGuichet.data.token) {
      garderJeton(reponseGuichet.data.token, durable);
      montrerParents();
    } else if (reponseGuichet.status === 429) {
      $('erreur-connexion').textContent = 'Trop d\'essais. Réessayez dans un quart d\'heure.';
    } else {
      $('erreur-connexion').textContent = 'Ce n\'est pas le bon code.';
    }
  } catch (err) {
    champ.value = '';
    $('erreur-connexion').textContent = MSG_PANNE;
  } finally {
    $('btn-entrer').disabled = false;
  }
}

function seDeconnecter() {
  effacerJeton();
  montrerConnexion();
}

async function verifierSession() {
  if (!lireJeton()) { montrerConnexion(); return; }
  try {
    const reponseGuichet = await post({ action: 'session_check', token: lireJeton() });
    if (reponseGuichet.status === 200) montrerParents();
    else { effacerJeton(); montrerConnexion(); }
  } catch (err) {
    montrerConnexion(MSG_PANNE);
  }
}

// === LISTE DE GAUCHE ===
function sousTitre(cadeau) {
  const morceaux = [typeof cadeau.price === 'number' ? priceText(cadeau.price) : 'Prix à vérifier'];
  const boutique = shopOf(cadeau.url);
  if (boutique) morceaux.push(boutique);
  if (cadeau.note) morceaux.push(cadeau.note);
  return morceaux.join(' · ');
}

function dessinerLigne(cadeau) {
  const vignette = cadeau.photo_url
    ? '<div class="p-row-thumb has-photo" aria-hidden="true"><img src="' + esc(cadeau.photo_url) + '" alt="" loading="lazy" referrerpolicy="no-referrer"></div>'
    : '<div class="p-row-thumb" aria-hidden="true"></div>';
  const statut = cadeau.claimed_by
    ? '<span class="tag-taken">Réservé par ' + esc(cadeau.claimed_by) + '</span>'
    : '<span class="tag-free">Libre</span>';
  return '<div class="p-row' + (etat.enCours === cadeau.id ? ' is-current' : '') + '">' + vignette +
    '<div class="p-row-text"><span class="p-row-name">' + esc(cadeau.name) + '</span>' +
    '<span class="p-row-sub">' + esc(sousTitre(cadeau)) + '</span></div>' + statut +
    '<button type="button" class="btn-edit" data-id="' + esc(cadeau.id) + '" aria-label="Modifier ' + esc(cadeau.name) + '">Modifier</button></div>';
}

function dessinerListe() {
  const reserves = etat.cadeaux.filter((c) => c.claimed_by).length;
  $('resume').textContent = etat.cadeaux.length + ' cadeaux, dont ' + reserves + (reserves > 1 ? ' réservés' : ' réservé');
  for (const enfant of ['Loula', 'Sacha']) {
    $('liste-' + enfant).innerHTML = etat.cadeaux.filter((c) => c.child === enfant).map(dessinerLigne).join('');
  }
  dessinerBarreReserve();
}

async function relireListe() {
  try {
    const reponseGuichet = await getGifts();
    etat.cadeaux = reponseGuichet.data.gifts ?? [];
    $('alerte-parents').hidden = true;
    dessinerListe();
  } catch (err) {
    $('alerte-parents').hidden = false;
  }
}

// === FICHE DE DROITE ===
function cadeauEnCours() {
  return etat.cadeaux.find((c) => c.id === etat.enCours) ?? null;
}

function chargerFiche(cadeauId) {
  etat.enCours = cadeauId;
  etat.confirmSuppr = false;
  const c = cadeauEnCours() ?? { child: 'Loula', name: '', url: '', price: null, note: '', photo_url: '' };
  $('fiche-titre').textContent = etat.enCours ? 'Modifier le cadeau' : 'Ajouter un cadeau';
  $('f-child').value = c.child;
  $('f-name').value = c.name;
  $('f-url').value = c.url ?? '';
  $('f-price').value = typeof c.price === 'number' ? c.price.toFixed(2).replace('.', ',') : '';
  $('f-note').value = c.note ?? '';
  $('f-photo').value = c.photo_url ?? '';
  $('f-file').value = '';
  $('etat-photo').textContent = '';
  $('msg-enregistre').textContent = '';
  $('erreur-fiche').textContent = '';
  dessinerSuppression();
  dessinerListe();
}

function dessinerBarreReserve() {
  const c = cadeauEnCours();
  $('barre-reserve').hidden = !(c && c.claimed_by);
  $('reserve-par').textContent = c && c.claimed_by ? 'Réservé par ' + c.claimed_by : '';
}

function dessinerSuppression() {
  $('btn-supprimer').hidden = !etat.enCours || etat.confirmSuppr;
  $('confirm-suppr').hidden = !etat.enCours || !etat.confirmSuppr;
}

// Accepte 41, 41,00, 41.00, 41 €. Renvoie null (vide), un nombre, ou NaN (illisible).
function lirePrix(texte) {
  const propre = texte.replace(/€/g, '').replace(/[\s  ]/g, '').replace(',', '.');
  if (propre === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return NaN;
  return Number(propre);
}

function occuper(oui) {
  etat.occupe = oui;
  for (const id of ['btn-enregistrer', 'btn-annuler', 'btn-liberer', 'btn-suppr-oui']) $(id).disabled = oui;
}

// === PHOTO : réduction dans le navigateur ===
function chargerImage(fichier) {
  return new Promise((ok, ko) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('image_illisible')); };
    img.src = url;
  });
}

function versBlob(toile, qualite) {
  return new Promise((ok) => toile.toBlob(ok, 'image/jpeg', qualite));
}

function blobEnBase64(blob) {
  return new Promise((ok, ko) => {
    const lecteur = new FileReader();
    lecteur.onload = () => ok(String(lecteur.result).split(',')[1]);
    lecteur.onerror = () => ko(new Error('lecture_impossible'));
    lecteur.readAsDataURL(blob);
  });
}

async function reduirePhoto(fichier) {
  const img = await chargerImage(fichier);
  const echelle = Math.min(1, PHOTO_COTE_MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const toile = document.createElement('canvas');
  toile.width = Math.max(1, Math.round(img.naturalWidth * echelle));
  toile.height = Math.max(1, Math.round(img.naturalHeight * echelle));
  const ctx = toile.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, toile.width, toile.height);
  ctx.drawImage(img, 0, 0, toile.width, toile.height);
  for (const qualite of [0.82, 0.7, 0.6, 0.5]) {
    const blob = await versBlob(toile, qualite);
    if (blob && blob.size <= PHOTO_POIDS_MAX) return blobEnBase64(blob);
  }
  throw new Error('too_large');
}

// === ENREGISTRER ===
async function enregistrer(e) {
  e.preventDefault();
  if (etat.occupe) return;
  $('msg-enregistre').textContent = '';
  $('erreur-fiche').textContent = '';
  const prix = lirePrix($('f-price').value);
  if (Number.isNaN(prix)) { $('erreur-fiche').textContent = ERREURS_FICHE.invalid_price; $('f-price').focus(); return; }
  const fichier = $('f-file').files[0] ?? null;
  const cadeau = {
    child: $('f-child').value,
    name: $('f-name').value.trim(),
    url: $('f-url').value.trim() || null,
    price: prix,
    note: $('f-note').value.trim() || null,
    photo_url: $('f-photo').value.trim() || null
  };
  occuper(true);
  try {
    let photoBase64 = null;
    if (fichier) {
      $('etat-photo').textContent = 'Préparation de la photo…';
      photoBase64 = await reduirePhoto(fichier);
    }
    const reponseGuichet = etat.enCours
      ? await appelParents({ action: 'gift_update', gift_id: etat.enCours, gift: cadeau })
      : await appelParents({ action: 'gift_create', gift: cadeau });
    if (!reponseGuichet.data.ok) return afficherErreurFiche(reponseGuichet.data.error);
    etat.enCours = reponseGuichet.data.gift.id;
    if (photoBase64) {
      const reponsePhoto = await appelParents({ action: 'photo_upload', gift_id: etat.enCours, content_type: 'image/jpeg', data_base64: photoBase64 });
      if (!reponsePhoto.data.ok) return afficherErreurFiche(reponsePhoto.data.error);
    }
    await relireListe();
    chargerFiche(etat.enCours);
    $('msg-enregistre').textContent = MSG_ENREGISTRE;
  } catch (err) {
    if (err.message === 'session_expiree') return;
    $('etat-photo').textContent = '';
    $('erreur-fiche').textContent = err.message === 'image_illisible'
      ? 'Cette image ne peut pas être lue. Essayez une photo JPEG.'
      : err.message === 'too_large' ? ERREURS_FICHE.too_large : MSG_PANNE;
  } finally {
    occuper(false);
  }
}

function afficherErreurFiche(code) {
  $('etat-photo').textContent = '';
  $('erreur-fiche').textContent = ERREURS_FICHE[code] ?? 'Une valeur ne passe pas. Vérifiez la fiche.';
  if (code === 'not_found') { relireListe(); chargerFiche(null); $('erreur-fiche').textContent = ERREURS_FICHE.not_found; }
}

// === LIBÉRER, SUPPRIMER, ANNULER ===
async function libererCadeau() {
  if (!etat.enCours) return;
  occuper(true);
  try {
    await post({ action: 'release', gift_id: etat.enCours });
    await relireListe();
  } catch (err) {
    $('erreur-fiche').textContent = MSG_PANNE;
  } finally {
    occuper(false);
  }
}

async function supprimerCadeau() {
  if (!etat.enCours) return;
  occuper(true);
  try {
    await appelParents({ action: 'gift_delete', gift_id: etat.enCours });
    await relireListe();
    chargerFiche(null);
  } catch (err) {
    if (err.message !== 'session_expiree') $('erreur-fiche').textContent = MSG_PANNE;
  } finally {
    occuper(false);
  }
}

function demanderSuppression(oui) {
  etat.confirmSuppr = oui;
  dessinerSuppression();
  (oui ? $('btn-suppr-non') : $('btn-supprimer')).focus();
}

function surModifier(e) {
  const bouton = e.target.closest('.btn-edit');
  if (!bouton) return;
  chargerFiche(bouton.dataset.id);
  $('fiche-titre').focus();
}

// === DÉMARRAGE ===
function demarrerPage() {
  $('form-connexion').addEventListener('submit', seConnecter);
  $('btn-deconnexion').addEventListener('click', seDeconnecter);
  $('btn-ajouter').addEventListener('click', () => { chargerFiche(null); $('f-name').focus(); });
  $('liste-Loula').addEventListener('click', surModifier);
  $('liste-Sacha').addEventListener('click', surModifier);
  $('fiche').addEventListener('submit', enregistrer);
  $('btn-annuler').addEventListener('click', () => chargerFiche(null));
  $('btn-liberer').addEventListener('click', libererCadeau);
  $('btn-supprimer').addEventListener('click', () => demanderSuppression(true));
  $('btn-suppr-non').addEventListener('click', () => demanderSuppression(false));
  $('btn-suppr-oui').addEventListener('click', supprimerCadeau);
  $('f-file').addEventListener('change', () => {
    $('etat-photo').textContent = $('f-file').files[0] ? 'Le fichier sera réduit et envoyé à l\'enregistrement.' : '';
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && !$('vue-parents').hidden) relireListe();
  }, REFRESH_MS);
  verifierSession();
}

demarrerPage();
