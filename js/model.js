// Pure notebook logic: no DOM, no storage. Tested in tests/model.test.mjs.
import { addDays, dayNumber } from "./dates.js";

export const PRIORITIES = { high: "High", medium: "Medium", low: "Low" };

export const DEFAULT_CATEGORIES = [
  { id: "faith", name: "Faith", hue: 42, icon: "cross" },
  { id: "personal", name: "Personal", hue: 210, icon: "user" },
  { id: "education", name: "Education", hue: 265, icon: "book" },
  { id: "work", name: "Work", hue: 190, icon: "briefcase" },
  { id: "health", name: "Health & well-being", hue: 140, icon: "heart" },
  { id: "relationships", name: "Relationships", hue: 340, icon: "users" },
  { id: "home", name: "Home", hue: 25, icon: "home" },
  { id: "other", name: "Other", hue: 0, icon: "dot" },
];

export const REFLECTION_PROMPTS = [
  { id: "grateful", text: "What am I grateful for today?" },
  { id: "learned", text: "What did I learn?" },
  { id: "well", text: "What went well?" },
  { id: "improve", text: "What could I improve tomorrow?" },
  { id: "faith", text: "How did I make time for my faith?" },
  { id: "pray", text: "What do I want to pray about?" },
];

export const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function emptyDay(date) {
  return { date, intention: "", verseRef: "", objectives: [], notes: "", reflection: {}, updatedAt: null };
}

export function newObjective(title, extra = {}) {
  const t = String(title || "").trim();
  if (!t) throw new Error("An objective needs a title.");
  return {
    id: uid(), title: t.slice(0, 300), description: "", done: false, doneAt: null,
    priority: "", category: "", time: "", duration: "", note: "",
    movedTo: "", carriedFrom: "", createdAt: new Date().toISOString(), ...extra,
  };
}

/** Objectives that still belong to the day (moved-away items are shown but not counted). */
export const counted = (day) => (day?.objectives || []).filter((o) => !o.movedTo);

export function dayStats(day) {
  const list = counted(day);
  const done = list.filter((o) => o.done).length;
  const total = list.length;
  return { total, done, remaining: total - done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function hasActivity(day) {
  if (!day) return false;
  const r = day.reflection || {};
  return (day.objectives?.length || 0) > 0 || !!day.notes?.trim() || !!day.intention?.trim() ||
    Object.values(r).some((v) => String(v || "").trim());
}

export function rangeStats(days) {
  let total = 0, done = 0, active = 0;
  const byCategory = {};
  for (const d of days) {
    const s = dayStats(d);
    total += s.total;
    done += s.done;
    if (hasActivity(d)) active++;
    for (const o of counted(d)) {
      const c = o.category || "none";
      byCategory[c] = byCategory[c] || { total: 0, done: 0 };
      byCategory[c].total++;
      if (o.done) byCategory[c].done++;
    }
  }
  return { total, done, remaining: total - done, pct: total ? Math.round((done / total) * 100) : 0, activeDays: active, byCategory };
}

export function setDone(o, done, now = new Date()) {
  return { ...o, done: !!done, doneAt: done ? now.toISOString() : null };
}

export function move(list, from, to) {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list.slice();
  const out = list.slice();
  const [item] = out.splice(from, 1);
  out.splice(to, 0, item);
  return out;
}

/**
 * Carry unfinished objectives from one day to another, only when asked.
 * Originals stay unfinished and are marked as moved (never marked complete).
 * Returns { from, to } as new day objects.
 */
export function carry(fromDay, toDay, ids = null) {
  const pick = (o) => !o.done && !o.movedTo && (ids === null || ids.includes(o.id));
  const moving = fromDay.objectives.filter(pick);
  const copies = moving.map((o) => ({
    ...o, id: uid(), done: false, doneAt: null, movedTo: "", carriedFrom: fromDay.date, createdAt: new Date().toISOString(),
  }));
  return {
    from: { ...fromDay, objectives: fromDay.objectives.map((o) => (pick(o) ? { ...o, movedTo: toDay.date } : o)) },
    to: { ...toDay, objectives: [...toDay.objectives, ...copies] },
    count: copies.length,
  };
}

export function unfinished(day) {
  return (day?.objectives || []).filter((o) => !o.done && !o.movedTo);
}

/** Deterministic verse for a calendar day: same day, same verse, everywhere. */
export function verseIndex(dateKey, count) {
  if (!count) return -1;
  // simple multiplicative hash so consecutive days don't walk the list in order
  return ((dayNumber(dateKey) * 2654435761) >>> 0) % count;
}

export function verseHistory(firstDate, todayKey, verses, limit = 60) {
  const out = [];
  for (let k = todayKey; k >= firstDate && out.length < limit; k = addDays(k, -1)) {
    out.push({ date: k, verse: verses[verseIndex(k, verses.length)] });
  }
  return out;
}

export const ENCOURAGEMENTS = [
  "Small faithful steps still move you forward. Begin with one.",
  "You don't have to finish everything to have a good day. Do the next right thing.",
  "Give the day to God first, then give it your best.",
  "Rest is part of the work. Grace covers what today couldn't.",
  "Gratitude turns what you have into enough. Name one good thing.",
  "Discipline is a quiet kind of worship. Show up gently.",
  "Progress, not perfection. Tomorrow's mercies are new.",
  "Work with your whole heart, and leave the outcome in His hands.",
  "Pause, breathe, pray — then choose what matters most.",
  "Whatever today holds, you are not walking it alone.",
];

export function encouragement(dateKey) {
  return ENCOURAGEMENTS[(dayNumber(dateKey) * 7 + 3) % ENCOURAGEMENTS.length];
}

/** Validate and normalise an imported backup. Throws on anything malformed. */
export function validateBackup(data) {
  if (!data || data.app !== "abide-notebook" || typeof data.version !== "number") {
    throw new Error("This file is not an Abide notebook backup.");
  }
  const days = Array.isArray(data.days) ? data.days : [];
  for (const d of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date || "") || !Array.isArray(d.objectives)) {
      throw new Error(`Backup has a malformed day: ${JSON.stringify(d?.date)}`);
    }
  }
  return {
    days, prayers: Array.isArray(data.prayers) ? data.prayers : [],
    favorites: Array.isArray(data.favorites) ? data.favorites : [],
    meta: Array.isArray(data.meta) ? data.meta.filter((m) => m && m.key !== "bgImage") : [],
  };
}

/** Merge two lists of records keyed by `k`; the newer updatedAt wins, nothing is dropped. */
export function mergeRecords(current, incoming, k) {
  const map = new Map(current.map((r) => [r[k], r]));
  for (const r of incoming) {
    const old = map.get(r[k]);
    if (!old || (r.updatedAt || "") >= (old.updatedAt || "")) map.set(r[k], r);
  }
  return [...map.values()];
}
