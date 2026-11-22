// Fonction guichet « noel » — Liste de Noël 2026.
// La page ne parle jamais à la base : tout passe par ici.
// Déployée avec verify_jwt = false (la famille n'a ni compte ni clé).
import { createClient } from "npm:@supabase/supabase-js@2";

// ---------- Réglages ----------
const MAX_BODY = 600 * 1024; // 600 Ko
const MAX_GIFTS = 200;
const MAX_PHOTO = 400 * 1024; // 400 Ko
const BUCKET = "noel-photos";
const CHILDREN = ["Loula", "Sacha"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_LONG = 30 * 24 * 3600 * 1000; // « rester connecté »
const TOKEN_SHORT = 12 * 3600 * 1000;
const MAX_FAILS = 10;
const FAIL_WINDOW = 15 * 60 * 1000;

// ---------- Clé de service ----------
// Nouvelles clés (sb_secret_…) en priorité, clé historique en repli.
function serviceKey(): string {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const k = JSON.parse(raw)["default"];
      if (k) return k;
    } catch { /* repli ci-dessous */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}
const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- Réponses ----------
function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = (Deno.env.get("NOEL_ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

function json(req: Request, status: number, body: unknown): Response {
  const h = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "vary": "Origin",
  });
  const o = allowedOrigin(req);
  if (o) h.set("access-control-allow-origin", o);
  return new Response(JSON.stringify(body), { status, headers: h });
}
const fail = (req: Request, status: number, error: string, extra = {}) =>
  json(req, status, { ok: false, error, ...extra });

// ---------- Outils crypto ----------
const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const tokenSecret = () => Deno.env.get("NOEL_TOKEN_SECRET") ?? "";

// Jeton = base64url({"exp":…}) + "." + base64url(HMAC)
async function makeToken(ms: number): Promise<{ token: string; expires_at: string }> {
  const exp = Date.now() + ms;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(9)));
  const payload = b64url(enc.encode(JSON.stringify({ exp, n: nonce })));
  const sig = b64url(await hmac(tokenSecret(), payload));
  return { token: `${payload}.${sig}`, expires_at: new Date(exp).toISOString() };
}
async function checkToken(token: unknown): Promise<boolean> {
  const secret = tokenSecret();
  if (!secret || typeof token !== "string" || token.length > 300) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const expected = await hmac(secret, payload);
    if (!sameBytes(expected, fromB64url(sig))) return false;
    const { exp } = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

// ---------- Validation d'un cadeau ----------
type GiftIn = Partial<Record<"child" | "name" | "url" | "price" | "note" | "photo_url", unknown>>;
// Renvoie les champs propres, ou une chaîne d'erreur.
function cleanGift(g: GiftIn, creating: boolean): Record<string, unknown> | string {
  if (!g || typeof g !== "object") return "invalid_gift";
  const out: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(g, k);
  const optText = (v: unknown) => (v === null || v === undefined ? null : String(v).trim() || null);

  if (creating || has("child")) {
    if (!CHILDREN.includes(String(g.child))) return "invalid_child";
    out.child = g.child;
  }
  if (creating || has("name")) {
    const n = String(g.name ?? "").trim();
    if (n.length < 1 || n.length > 140) return "invalid_name";
    out.name = n;
  }
  if (has("url")) {
    const u = optText(g.url);
    if (u !== null && (!/^https?:\/\//i.test(u) || u.length > 2000)) return "invalid_url";
    out.url = u;
  }
  if (has("price")) {
    const p = g.price;
    if (p === null || p === "" || p === undefined) out.price = null;
    else {
      const n = typeof p === "number" ? p : Number(String(p).replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || n >= 1e6) return "invalid_price";
      out.price = Math.round(n * 100) / 100;
    }
  }
  if (has("note")) {
    const n = optText(g.note);
    if (n !== null && n.length > 80) return "invalid_note";
    out.note = n;
  }
  if (has("photo_url")) {
    const u = optText(g.photo_url);
    if (u !== null && (!/^https:\/\//i.test(u) || u.length > 2000)) return "invalid_photo_url";
    out.photo_url = u;
  }
  return out;
}

const GIFT_COLS = "id,child,name,url,price,note,photo_url,position,noel_claims(name)";
// deno-lint-ignore no-explicit-any
function shape(row: any) {
  const c = Array.isArray(row.noel_claims) ? row.noel_claims[0] : row.noel_claims;
  return {
    id: row.id, child: row.child, name: row.name, url: row.url,
    price: row.price === null ? null : Number(row.price),
    note: row.note, photo_url: row.photo_url, position: row.position,
    claimed_by: c?.name ?? null,
  };
}
async function oneGift(id: string) {
  const { data, error } = await db.from("noel_gifts").select(GIFT_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? shape(data) : null;
}

// Supprime l'ancienne photo si elle venait de notre bucket.
async function removeOwnPhoto(url: string | null) {
  if (!url) return;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  await db.storage.from(BUCKET).remove([url.slice(i + marker.length)]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- Actions ----------
// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;

async function listGifts(req: Request) {
  const { data, error } = await db.from("noel_gifts").select(GIFT_COLS)
    .order("child").order("position").order("created_at").limit(MAX_GIFTS);
  if (error) throw error;
  return json(req, 200, { gifts: (data ?? []).map(shape) });
}

async function claim(req: Request, b: Body) {
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (name.length < 1 || name.length > 40) return fail(req, 400, "invalid_name");
  if (typeof b.gift_id !== "string" || !UUID_RE.test(b.gift_id)) return fail(req, 404, "not_found");
  const { error } = await db.from("noel_claims").insert({ gift_id: b.gift_id, name });
  if (!error) return json(req, 200, { ok: true, claimed_by: name });
  if (error.code === "23503") return fail(req, 404, "not_found");
  if (error.code === "23505") {
    const { data } = await db.from("noel_claims").select("name").eq("gift_id", b.gift_id).maybeSingle();
    return fail(req, 409, "already_claimed", { claimed_by: data?.name ?? null });
  }
  throw error;
}

async function release(req: Request, b: Body) {
  if (typeof b.gift_id !== "string" || !UUID_RE.test(b.gift_id)) return json(req, 200, { ok: true });
  const { error } = await db.from("noel_claims").delete().eq("gift_id", b.gift_id);
  if (error) throw error;
  return json(req, 200, { ok: true });
}

async function login(req: Request, b: Body) {
  const code = Deno.env.get("NOEL_PARENTS_CODE") ?? "";
  const secret = tokenSecret();
  if (code.length < 12 || !secret) return fail(req, 503, "not_configured");

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "inconnue";
  const ipHash = b64url(await hmac(secret, "ip:" + ip));
  const now = Date.now();

  // Purge des essais de plus de 24 h.
  await db.from("noel_login_attempts").delete().lt("at", new Date(now - 24 * 3600 * 1000).toISOString());

  const { count, error } = await db.from("noel_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash).gte("at", new Date(now - FAIL_WINDOW).toISOString());
  if (error) throw error;
  if ((count ?? 0) >= MAX_FAILS) return fail(req, 429, "too_many_attempts");

  // Comparaison en temps constant : on compare les HMAC des deux codes.
  const given = typeof b.code === "string" ? b.code : "";
  const ok = sameBytes(await hmac(secret, "code:" + given), await hmac(secret, "code:" + code));
  if (!ok) {
    await db.from("noel_login_attempts").insert({ ip_hash: ipHash });
    await sleep(800);
    return fail(req, 401, "bad_code");
  }
  const t = await makeToken(b.remember === true ? TOKEN_LONG : TOKEN_SHORT);
  return json(req, 200, { ok: true, ...t });
}

async function giftCreate(req: Request, b: Body) {
  const g = cleanGift(b.gift, true);
  if (typeof g === "string") return fail(req, 400, g);
  const { count, error: e1 } = await db.from("noel_gifts").select("id", { count: "exact", head: true });
  if (e1) throw e1;
  if ((count ?? 0) >= MAX_GIFTS) return fail(req, 400, "too_many_gifts");
  const { data: last, error: e2 } = await db.from("noel_gifts").select("position")
    .eq("child", g.child as string).order("position", { ascending: false }).limit(1);
  if (e2) throw e2;
  g.position = (last?.[0]?.position ?? 0) + 10;
  const { data, error } = await db.from("noel_gifts").insert(g).select(GIFT_COLS).single();
  if (error) throw error;
  return json(req, 201, { ok: true, gift: shape(data) });
}

async function giftUpdate(req: Request, b: Body) {
  if (typeof b.gift_id !== "string" || !UUID_RE.test(b.gift_id)) return fail(req, 404, "not_found");
  const g = cleanGift(b.gift, false);
  if (typeof g === "string") return fail(req, 400, g);
  const before = await oneGift(b.gift_id);
  if (!before) return fail(req, 404, "not_found");
  g.updated_at = new Date().toISOString();
  const { error } = await db.from("noel_gifts").update(g).eq("id", b.gift_id);
  if (error) throw error;
  if ("photo_url" in g && g.photo_url !== before.photo_url) await removeOwnPhoto(before.photo_url);
  return json(req, 200, { ok: true, gift: await oneGift(b.gift_id) });
}

async function giftDelete(req: Request, b: Body) {
  if (typeof b.gift_id !== "string" || !UUID_RE.test(b.gift_id)) return json(req, 200, { ok: true });
  const before = await oneGift(b.gift_id);
  const { error } = await db.from("noel_gifts").delete().eq("id", b.gift_id);
  if (error) throw error;
  if (before) await removeOwnPhoto(before.photo_url);
  return json(req, 200, { ok: true });
}

async function photoUpload(req: Request, b: Body) {
  if (typeof b.gift_id !== "string" || !UUID_RE.test(b.gift_id)) return fail(req, 404, "not_found");
  const ext = ({ "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[b.content_type];
  if (!ext) return fail(req, 400, "invalid_type");
  if (typeof b.data_base64 !== "string") return fail(req, 400, "invalid_data");
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b.data_base64), (c) => c.charCodeAt(0));
  } catch {
    return fail(req, 400, "invalid_data");
  }
  if (bytes.length === 0 || bytes.length > MAX_PHOTO) return fail(req, 400, "too_large");
  const before = await oneGift(b.gift_id);
  if (!before) return fail(req, 404, "not_found");

  const path = `${b.gift_id}-${b64url(crypto.getRandomValues(new Uint8Array(6)))}.${ext}`;
  const { error } = await db.storage.from(BUCKET).upload(path, bytes, {
    contentType: b.content_type, upsert: false, cacheControl: "31536000",
  });
  if (error) throw error;
  const photo_url = db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error: e2 } = await db.from("noel_gifts")
    .update({ photo_url, updated_at: new Date().toISOString() }).eq("id", b.gift_id);
  if (e2) throw e2;
  await removeOwnPhoto(before.photo_url);
  return json(req, 200, { ok: true, photo_url });
}

const PARENT_ACTIONS: Record<string, (req: Request, b: Body) => Promise<Response>> = {
  session_check: (req) => Promise.resolve(json(req, 200, { ok: true })),
  gift_create: giftCreate,
  gift_update: giftUpdate,
  gift_delete: giftDelete,
  photo_upload: photoUpload,
};

// ---------- Point d'entrée ----------
Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      const o = allowedOrigin(req);
      const h = new Headers({ "vary": "Origin" });
      if (o) {
        h.set("access-control-allow-origin", o);
        h.set("access-control-allow-methods", "GET, POST, OPTIONS");
        h.set("access-control-allow-headers", "content-type");
        h.set("access-control-max-age", "86400");
      }
      return new Response(null, { status: 204, headers: h });
    }
    if (req.method === "GET") return await listGifts(req);
    if (req.method !== "POST") return fail(req, 405, "method_not_allowed");

    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return fail(req, 413, "too_large");
    const text = await req.text();
    if (text.length > MAX_BODY) return fail(req, 413, "too_large");
    let b: Body;
    try {
      b = JSON.parse(text);
    } catch {
      return fail(req, 400, "invalid_json");
    }
    if (!b || typeof b !== "object") return fail(req, 400, "invalid_json");

    switch (b.action) {
      case "claim": return await claim(req, b);
      case "release": return await release(req, b);
      case "login": return await login(req, b);
    }
    if (typeof b.action !== "string" || !Object.hasOwn(PARENT_ACTIONS, b.action)) {
      return fail(req, 400, "unknown_action");
    }
    const parent = PARENT_ACTIONS[b.action];
    if (!(await checkToken(b.token))) return fail(req, 401, "unauthorized");
    return await parent(req, b);
  } catch (e) {
    // Jamais de trace technique vers le client.
    console.error("noel:", (e as { code?: string; message?: string })?.code ?? "", (e as Error)?.message ?? "erreur");
    return fail(req, 500, "server_error");
  }
});
