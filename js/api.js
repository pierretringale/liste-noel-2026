// [API] — Appels au guichet « noel » et petits outils partagés par les deux pages
// Trigger    : importé par liste.js et parents.js
// Étapes     : fetch JSON avec délai maximal → { status, data } ou erreur « guichet indisponible »
// Contraintes: aucune clé Supabase ici ; la page ne parle qu'à la fonction noel
// Cas limites: voir PROJET_ListeNoel.md section "Cas limites"

// === CONFIGURATION ===
const NOEL_URL = 'https://eqlofgcravaihvfaysdb.supabase.co/functions/v1/noel';
const TIMEOUT_MS = 12000;

// Renvoie { status, data }. Lève une erreur si le guichet ne répond pas.
async function noelFetch(options) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(NOEL_URL, Object.assign({ signal: ctrl.signal, cache: 'no-store' }, options));
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status >= 500 || data === null) throw new Error('guichet_indisponible');
    return { status: res.status, data: data };
  } finally {
    clearTimeout(timer);
  }
}

export function getGifts() {
  return noelFetch({ method: 'GET' });
}

export function post(body) {
  return noelFetch({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

// ---------- Petits outils partagés ----------
export function shopOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
}

export function priceText(price) {
  if (typeof price !== 'number') return '';
  return price.toFixed(2).replace('.', ',') + ' €';
}

export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Lecture et écriture locales protégées (navigation privée, stockage bloqué…).
export const store = {
  get(area, key) { try { return window[area].getItem(key); } catch (e) { return null; } },
  set(area, key, value) { try { window[area].setItem(key, value); } catch (e) { /* rien */ } },
  del(area, key) { try { window[area].removeItem(key); } catch (e) { /* rien */ } }
};
