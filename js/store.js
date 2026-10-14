// Local-first persistence in IndexedDB. All records are loaded into memory at
// start (a personal notebook is small), and every change is written through
// immediately (text fields are debounced). When the notebook runs as a
// claude.ai artifact, sync.js also mirrors every change to the viewer's
// private cloud store so phone and computer share one notebook.
import { emptyDay, mergeRecords, validateBackup, DEFAULT_CATEGORIES } from "./model.js";
import { today } from "./dates.js";
import * as sync from "./sync.js";

const DB_NAME = "abide-notebook";
const DB_VERSION = 1;
const STORES = { days: "date", prayers: "id", favorites: "ref", meta: "key", snapshots: "date" };
const KEEP_SNAPSHOTS = 14;

export const DEFAULT_SETTINGS = {
  name: "", theme: "dark", accent: "gold", translation: "kjv", showVerse: true,
  motion: "auto", intro: true, celebrate: true, weekStartsOn: 0, reminders: false,
  categories: DEFAULT_CATEGORIES, lastBackup: "", firstOpen: "",
};

const events = new EventTarget();
const cache = { days: new Map(), prayers: new Map(), favorites: new Map(), meta: new Map() };
let db = null;
let pending = 0;
const timers = new Map();

export const on = (type, fn) => events.addEventListener(type, (e) => fn(e.detail));
const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));

function req(r) {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      // additive only: never deletes an existing store
      for (const [name, keyPath] of Object.entries(STORES)) {
        if (!r.result.objectStoreNames.contains(name)) r.result.createObjectStore(name, { keyPath });
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error("Close other Abide tabs and reload."));
  });
}

const tx = (store, mode = "readonly") => db.transaction(store, mode).objectStore(store);

async function write(store, value) {
  if (sync.COLLECTIONS.includes(store)) sync.push(store, value[STORES[store]], value);
  if (!db) return emit("status", "saved");   // cloud-only view (artifact without IndexedDB)
  pending++;
  emit("status", "saving");
  try {
    await req(tx(store, "readwrite").put(value));
    emit("status", --pending ? "saving" : "saved");
  } catch (err) {
    pending--;
    emit("status", "error");
    emit("error", err);
    throw err;
  }
}

async function remove(store, id) {
  if (sync.COLLECTIONS.includes(store)) sync.tombstone(store, id, STORES[store]);
  if (!db) return;
  pending++;
  emit("status", "saving");
  try {
    await req(tx(store, "readwrite").delete(id));
    emit("status", --pending ? "saving" : "saved");
  } catch (err) {
    pending--;
    emit("status", "error");
    throw err;
  }
}

export async function init() {
  try {
    db = await open();
  } catch (err) {
    // an artifact view can still work from the cloud copy; the local app can't
    if (!window.claude?.use) throw err;
    db = null;
  }
  if (db) {
    for (const name of ["days", "prayers", "favorites", "meta"]) {
      const rows = await req(tx(name).getAll());
      for (const r of rows) cache[name].set(r[STORES[name]], r);
    }
  }
  await replayWal();
  if (!getSetting("firstOpen")) await setSetting("firstOpen", today());
  // ask the browser not to evict our data under storage pressure
  try { await navigator.storage?.persist?.(); } catch { /* optional */ }
  await snapshot();
}

// ---------------------------------------------------------------- settings / meta
export function getSetting(k) {
  const row = cache.meta.get(`setting:${k}`);
  return row ? row.value : DEFAULT_SETTINGS[k];
}

export function settings() {
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((k) => [k, getSetting(k)]));
}

export async function setSetting(k, value) {
  const row = { key: `setting:${k}`, value, updatedAt: new Date().toISOString() };
  cache.meta.set(row.key, row);
  emit("settings", { [k]: value });
  await write("meta", row);
}

export function getMeta(k, fallback = null) {
  return cache.meta.get(k)?.value ?? fallback;
}

export async function setMeta(k, value) {
  const row = { key: k, value, updatedAt: new Date().toISOString() };
  cache.meta.set(k, row);
  await write("meta", row);
}

// ---------------------------------------------------------------- days
export function getDay(date) {
  return structuredClone(cache.days.get(date) || emptyDay(date));
}

export function allDays() {
  return [...cache.days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function saveDay(day) {
  const row = { ...day, updatedAt: new Date().toISOString() };
  cache.days.set(day.date, row);
  clearTimeout(timers.get(day.date));
  timers.delete(day.date);
  walPut(row);
  emit("day", row);
  return writeDay(row);
}

// Write-ahead journal: IndexedDB writes can't finish while a page unloads, so
// every debounced edit is also copied synchronously to localStorage and
// replayed on the next start. The copy is removed once IndexedDB has it.
const WAL = "abide-wal:";

function walPut(row) {
  try { localStorage.setItem(WAL + row.date, JSON.stringify(row)); } catch { /* storage full or blocked */ }
}

async function writeDay(row) {
  await write("days", row);
  try {
    const pending = localStorage.getItem(WAL + row.date);
    if (pending && JSON.parse(pending).updatedAt <= row.updatedAt) localStorage.removeItem(WAL + row.date);
  } catch { /* ignore */ }
}

async function replayWal() {
  let keys = [];
  try { keys = Object.keys(localStorage).filter((k) => k.startsWith(WAL)); } catch { return; }
  for (const k of keys) {
    try {
      const row = JSON.parse(localStorage.getItem(k));
      const have = cache.days.get(row.date);
      if (!have || (row.updatedAt || "") > (have.updatedAt || "")) {
        cache.days.set(row.date, row);
        await writeDay(row);
      } else localStorage.removeItem(k);
    } catch { /* malformed entry: leave it for manual recovery */ }
  }
}

/** Debounced save for typing; the in-memory copy and the journal update at once so nothing is lost. */
export function saveDaySoon(day, ms = 500) {
  const row = { ...day, updatedAt: new Date().toISOString() };
  cache.days.set(day.date, row);
  walPut(row);
  emit("status", "saving");
  clearTimeout(timers.get(day.date));
  timers.set(day.date, setTimeout(() => { timers.delete(day.date); writeDay(cache.days.get(day.date)); }, ms));
}

/** Write any debounced text immediately (used on navigation and when the tab hides). */
export function flush() {
  for (const [date, t] of timers) {
    clearTimeout(t);
    writeDay(cache.days.get(date));
  }
  timers.clear();
}

// ---------------------------------------------------------------- prayers
export const prayers = () => [...cache.prayers.values()].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

export function savePrayer(p) {
  const row = { ...p, updatedAt: new Date().toISOString() };
  cache.prayers.set(p.id, row);
  return write("prayers", row);
}

export function deletePrayer(id) {
  cache.prayers.delete(id);
  return remove("prayers", id);
}

// ---------------------------------------------------------------- favourite verses
export const favorites = () => [...cache.favorites.values()].sort((a, b) => (b.savedAt || "").localeCompare(a.savedAt || ""));
export const isFavorite = (ref) => cache.favorites.has(ref);

export function saveFavorite(f) {
  const row = { savedAt: new Date().toISOString(), note: "", ...f, updatedAt: new Date().toISOString() };
  cache.favorites.set(f.ref, row);
  return write("favorites", row);
}

export function deleteFavorite(ref) {
  cache.favorites.delete(ref);
  return remove("favorites", ref);
}

// ---------------------------------------------------------------- backup / restore
export function exportData() {
  return {
    app: "abide-notebook", version: 1, exportedAt: new Date().toISOString(),
    days: allDays(), prayers: prayers(), favorites: favorites(),
    meta: [...cache.meta.values()].filter((m) => m.key !== "bgImage"),
  };
}

/** mode "merge" keeps everything and lets newer entries win; "replace" swaps it all (after a safety snapshot). */
export async function importData(raw, mode = "merge") {
  const data = validateBackup(raw);
  await snapshot(true);
  if (mode === "replace") {
    const keep = { days: new Set(data.days.map((d) => d.date)), prayers: new Set(data.prayers.map((p) => p.id)),
      favorites: new Set(data.favorites.map((f) => f.ref)) };
    for (const name of ["days", "prayers", "favorites"]) {
      for (const key of cache[name].keys()) if (!keep[name].has(key)) sync.tombstone(name, key, STORES[name]);
      if (db) await req(tx(name, "readwrite").clear());
      cache[name].clear();
    }
  }
  const plan = [["days", data.days], ["prayers", data.prayers], ["favorites", data.favorites], ["meta", data.meta]];
  for (const [name, rows] of plan) {
    const keyName = STORES[name];
    const merged = mergeRecords([...cache[name].values()], rows, keyName);
    for (const r of merged) {
      cache[name].set(r[keyName], r);
      await write(name, r);
    }
  }
  emit("imported", null);
}

// ---------------------------------------------------------------- cloud sync (claude.ai only)
const isNewer = (a, b) => (a?.updatedAt || "") > (b?.updatedAt || "");

async function applyRow(coll, row, { local = true } = {}) {
  const key = row[STORES[coll]];
  if (row._deleted) {
    cache[coll].delete(key);
    if (local && db) await req(tx(coll, "readwrite").delete(key));
  } else {
    cache[coll].set(key, row);
    if (local && db) await req(tx(coll, "readwrite").put(row));
  }
}

/**
 * Connect to the private cloud copy, merge both ways (newest edit wins,
 * deletions included), then stay live. Resolves true when syncing.
 */
export async function connectSync() {
  const on = await sync.connect((s) => emit("sync", s));
  if (!on) return false;
  emit("sync", "syncing");
  try {
    for (const coll of sync.COLLECTIONS) {
      const remoteRows = await sync.readAll(coll, STORES[coll]);
      for (const [key, r] of remoteRows) {
        if (isNewer(r, cache[coll].get(key)) && sync.syncable(coll, key)) await applyRow(coll, r);
      }
      for (const [key, l] of cache[coll]) {
        if (isNewer(l, remoteRows.get(key))) sync.push(coll, key, l);   // local-only or newer here
      }
    }
  } catch (err) {
    emit("sync", "error");
    return false;
  }
  emit("remote", null);
  sync.listen(STORES, async (coll, row) => {
    const key = row[STORES[coll]];
    if (!sync.syncable(coll, key)) return;
    const have = cache[coll].get(key);
    if (!isNewer(row, have)) return;            // our own echo, or older
    if (coll === "days" && timers.has(key)) return; // you're typing on this day right now
    await applyRow(coll, row);
    emit("remote", coll);
  });
  emit("sync", "synced");
  return true;
}

export const syncing = () => sync.isOn();

/** Keep one automatic full copy per day (last 14) inside IndexedDB as an undo net. */
export async function snapshot(force = false) {
  if (!db) return;
  const date = force ? new Date().toISOString() : today();
  const existing = await req(tx("snapshots").getAllKeys());
  if (!force && existing.includes(date)) return;
  await req(tx("snapshots", "readwrite").put({ date, data: exportData() }));
  const keys = (await req(tx("snapshots").getAllKeys())).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_SNAPSHOTS))) {
    await req(tx("snapshots", "readwrite").delete(k));
  }
}

export async function listSnapshots() {
  if (!db) return [];
  const rows = await req(tx("snapshots").getAll());
  return rows.map((r) => ({ date: r.date, days: r.data.days.length, prayers: r.data.prayers.length }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function restoreSnapshot(date) {
  const row = await req(tx("snapshots").get(date));
  if (!row) throw new Error("That snapshot no longer exists.");
  await importData(row.data, "replace");
}

// ---------------------------------------------------------------- background image (optional, stays local)
export async function setBackground(blob) {
  const row = { key: "bgImage", value: blob, updatedAt: new Date().toISOString() };
  cache.meta.set("bgImage", row);
  await write("meta", row);
  emit("settings", { bgImage: true });
}

export async function clearBackground() {
  cache.meta.delete("bgImage");
  await remove("meta", "bgImage");
  emit("settings", { bgImage: false });
}

export const background = () => cache.meta.get("bgImage")?.value || null;

export async function usage() {
  try {
    const est = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    return { used: est.usage || 0, quota: est.quota || 0, persisted: !!persisted };
  } catch {
    return null;
  }
}
