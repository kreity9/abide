// Cross-device sync. The backend is picked automatically:
//   claude.ai artifact  -> the artifact's private per-user database
//   hosted copy          -> Supabase (js/config.js), behind an email + password sign-in
//   neither              -> no sync; the notebook stays on this device
// Newest `updatedAt` wins. Deletes are written as tombstones so another
// device can't resurrect them.
import { SUPABASE, SUPABASE_JS } from "./config.js";

export const COLLECTIONS = ["days", "prayers", "favorites", "meta"];
const LOCAL_ONLY_META = new Set(["bgImage", "setting:lastBackup"]);

let backend = null;   // { readAll, set, listen, stop }
const queue = new Map();
let onStatus = () => {};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (row) => JSON.parse(JSON.stringify(row));

export const syncable = (coll, key) => !(coll === "meta" && LOCAL_ONLY_META.has(key));
export const isOn = () => !!backend;

// ---------------------------------------------------------------- claude.ai backend
/** Document ids allow letters, digits and _ - . ~ : @ + only. */
export const docId = (key) => String(key).replace(/[^A-Za-z0-9_\-.:@+]/g, (c) => `~${c.charCodeAt(0).toString(16)}`);

async function claudeBackend() {
  const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
  const id = db && user ? await user.id() : null;
  if (!id) return null;
  const base = db.doc(`data/users/${id}/notebook`);
  let subs = [];
  return {
    async readAll(coll, keyField) {
      const snap = await base.collection(coll).get();
      const out = new Map();
      for (const d of snap.docs) { const r = d.data(); if (r && r[keyField] != null) out.set(r[keyField], r); }
      return out;
    },
    set: (coll, key, body) => base.collection(coll).doc(docId(key)).set(body),
    listen(keyFields, apply) {
      subs = COLLECTIONS.map((coll) => base.collection(coll).onSnapshot((snap) => {
        for (const ch of snap.docChanges()) {
          if (ch.type === "removed") continue;
          const r = ch.doc.data();
          if (r && r[keyFields[coll]] != null) apply(coll, structuredClone(r));
        }
      }, () => onStatus("error")));
    },
    stop() { subs.forEach((u) => u()); subs = []; },
  };
}

// ---------------------------------------------------------------- Supabase backend
let sb = null;

export const usesSupabase = () => !window.claude?.use && !!(SUPABASE.url && SUPABASE.key);

/** Load the Supabase client. Null when offline or not configured. */
export async function supabase() {
  if (sb || !usesSupabase()) return sb;
  try {
    const { createClient } = await import(SUPABASE_JS);
    sb = createClient(SUPABASE.url, SUPABASE.key, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch {
    sb = null;
  }
  return sb;
}

export async function currentUser() {
  const c = await supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session?.user || null;
}

async function supabaseBackend() {
  const c = await supabase();
  const user = await currentUser();
  if (!c || !user) return null;
  let channel = null;
  const fail = (error) => { if (error) throw Object.assign(new Error(error.message), { code: error.code }); };
  return {
    async readAll(coll, keyField) {
      const out = new Map();
      for (let from = 0; ; from += 1000) {
        const { data, error } = await c.from("notebook").select("key, body").eq("coll", coll).range(from, from + 999);
        fail(error);
        for (const r of data) if (r.body?.[keyField] != null) out.set(r.body[keyField], r.body);
        if (data.length < 1000) break;
      }
      return out;
    },
    async set(coll, key, body) {
      const { error } = await c.from("notebook").upsert(
        { user_id: user.id, coll, key: String(key), body, updated_at: body.updatedAt || new Date().toISOString() },
        { onConflict: "user_id,coll,key" },
      );
      fail(error);
    },
    listen(keyFields, apply) {
      channel = c.channel(`notebook-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notebook", filter: `user_id=eq.${user.id}` }, (p) => {
          const r = p.new;
          if (r?.coll && r.body?.[keyFields[r.coll]] != null) apply(r.coll, r.body);
        })
        .subscribe((state) => { if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") onStatus("error"); });
    },
    stop() { if (channel) c.removeChannel(channel); channel = null; },
  };
}

// ---------------------------------------------------------------- shared
export async function connect(statusFn) {
  onStatus = statusFn || onStatus;
  try {
    backend = window.claude?.use ? await claudeBackend() : usesSupabase() ? await supabaseBackend() : null;
  } catch {
    backend = null;
  }
  if (!backend) onStatus("local");
  return !!backend;
}

export const readAll = (coll, keyField) => backend.readAll(coll, keyField);

/** Queue a write. One write in flight per record; bursts coalesce to the latest. */
export function push(coll, key, row) {
  if (!backend || !syncable(coll, key)) return;
  const path = `${coll}/${key}`;
  const q = queue.get(path) || { pending: null, busy: false };
  q.pending = { coll, key, body: clean(row) };
  queue.set(path, q);
  if (!q.busy) drain(path);
}

export function tombstone(coll, key, keyField) {
  push(coll, key, { [keyField]: key, _deleted: true, updatedAt: new Date().toISOString() });
}

async function drain(path) {
  const q = queue.get(path);
  q.busy = true;
  onStatus("syncing");
  let failed = false;
  while (q.pending) {
    const job = q.pending;
    q.pending = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await backend.set(job.coll, job.key, job.body);
        break;
      } catch (err) {
        if (attempt < 2) { await sleep(1200 * (attempt + 1) + Math.random() * 800); continue; }
        failed = true;
        onStatus("error", err);
      }
    }
    await sleep(400); // gentle spacing between writes to one record
  }
  q.busy = false;
  if (!failed && [...queue.values()].every((x) => !x.busy)) onStatus("synced");
}

/** Live updates from other devices. `apply(coll, row)` decides whether it's newer. */
export function listen(keyFields, apply) {
  backend.stop();
  backend.listen(keyFields, apply);
}

export function stop() {
  backend?.stop();
}
