// Logic tests (no browser). Run: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import * as D from "../js/dates.js";
import * as M from "../js/model.js";
import { VERSES } from "../js/verses.js";

test("date keys are local, validated, and survive DST and month/year boundaries", () => {
  assert.equal(D.addDays("2026-01-31", 1), "2026-02-01");
  assert.equal(D.addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(D.addDays("2028-02-28", 1), "2028-02-29");          // leap year
  assert.equal(D.addDays("2026-03-08", 1), "2026-03-09");          // US DST start
  assert.equal(D.addDays("2026-11-01", 1), "2026-11-02");          // US DST end
  assert.equal(D.diffDays("2026-03-07", "2026-03-10"), 3);
  assert.ok(D.isKey("2026-10-14"));
  assert.ok(!D.isKey("2026-02-30"));
  assert.ok(!D.isKey("hello"));
  assert.equal(D.key(new Date(2026, 9, 14, 23, 59)), "2026-10-14");
});

test("weeks and month grids", () => {
  assert.equal(D.weekStart("2026-10-14", 0), "2026-10-11");       // Wed -> Sun
  assert.equal(D.weekStart("2026-10-14", 1), "2026-10-12");       // Wed -> Mon
  assert.equal(D.weekStart("2026-10-11", 0), "2026-10-11");
  const g = D.monthGrid("2026-10", 0);
  assert.equal(g.length, 42);
  assert.equal(g.filter((c) => c.inMonth).length, 31);
  assert.equal(g[0].key, "2026-09-27");
  assert.equal(D.addMonths("2026-12", 1), "2027-01");
  assert.equal(D.addMonths("2026-01", -1), "2025-12");
  assert.equal(D.daysInMonth("2028-02"), 29);
});

test("objectives: create, stats, toggle, reorder", () => {
  assert.throws(() => M.newObjective("   "));
  const day = M.emptyDay("2026-10-14");
  day.objectives = [M.newObjective("Pray"), M.newObjective("Study"), M.newObjective("Run")];
  assert.deepEqual(M.dayStats(day), { total: 3, done: 0, remaining: 3, pct: 0 });
  day.objectives[0] = M.setDone(day.objectives[0], true);
  assert.deepEqual(M.dayStats(day), { total: 3, done: 1, remaining: 2, pct: 33 });
  day.objectives[0] = M.setDone(day.objectives[0], false);
  assert.equal(day.objectives[0].doneAt, null);
  assert.equal(M.dayStats(day).done, 0);
  const ids = day.objectives.map((o) => o.id);
  assert.deepEqual(M.move(day.objectives, 0, 2).map((o) => o.id), [ids[1], ids[2], ids[0]]);
  assert.deepEqual(M.move(day.objectives, 0, 9).map((o) => o.id), ids);   // out of range = unchanged
  assert.deepEqual(M.dayStats(M.emptyDay("2026-10-14")), { total: 0, done: 0, remaining: 0, pct: 0 });
});

test("carry moves only unfinished, never completes, and doesn't double count", () => {
  const a = M.emptyDay("2026-10-13"), b = M.emptyDay("2026-10-14");
  a.objectives = [M.setDone(M.newObjective("Done one"), true), M.newObjective("Open one"), M.newObjective("Open two")];
  const keep = a.objectives[2].id;
  const r = M.carry(a, b, [a.objectives[1].id]);
  assert.equal(r.count, 1);
  assert.equal(r.to.objectives.length, 1);
  assert.equal(r.to.objectives[0].done, false);
  assert.equal(r.to.objectives[0].carriedFrom, "2026-10-13");
  assert.equal(r.from.objectives[1].movedTo, "2026-10-14");
  assert.equal(r.from.objectives[1].done, false);                     // never marked complete
  assert.deepEqual(M.dayStats(r.from), { total: 2, done: 1, remaining: 1, pct: 50 });
  assert.equal(M.unfinished(r.from)[0].id, keep);
  const again = M.carry(r.from, r.to);                               // carry all remaining
  assert.equal(again.count, 1);
  assert.equal(M.unfinished(again.from).length, 0);
});

test("range stats and activity", () => {
  const a = M.emptyDay("2026-10-01"), b = M.emptyDay("2026-10-02"), c = M.emptyDay("2026-10-03");
  a.objectives = [M.setDone(M.newObjective("x", { category: "faith" }), true), M.newObjective("y", { category: "faith" })];
  b.notes = "Grateful today.";
  const s = M.rangeStats([a, b, c]);
  assert.equal(s.total, 2); assert.equal(s.done, 1); assert.equal(s.pct, 50); assert.equal(s.activeDays, 2);
  assert.deepEqual(s.byCategory.faith, { total: 2, done: 1 });
});

test("verse of the day is stable and every verse has both translations", () => {
  assert.ok(VERSES.length >= 70);
  for (const v of VERSES) { assert.ok(v.text.kjv.length > 20, v.ref); assert.ok(v.text.web.length > 20, v.ref); }
  assert.equal(M.verseIndex("2026-10-14", VERSES.length), M.verseIndex("2026-10-14", VERSES.length));
  const week = Array.from({ length: 7 }, (_, i) => M.verseIndex(D.addDays("2026-10-14", i), VERSES.length));
  assert.ok(new Set(week).size >= 5, "consecutive days should mostly differ");
  const h = M.verseHistory("2026-10-10", "2026-10-14", VERSES);
  assert.equal(h.length, 5); assert.equal(h[0].date, "2026-10-14");
});

test("backup validation and merge never drops records", () => {
  assert.throws(() => M.validateBackup({ hello: 1 }));
  assert.throws(() => M.validateBackup({ app: "abide-notebook", version: 1, days: [{ date: "bad", objectives: [] }] }));
  const ok = M.validateBackup({ app: "abide-notebook", version: 1, days: [{ date: "2026-10-14", objectives: [] }],
    meta: [{ key: "bgImage", value: 1 }, { key: "setting:name", value: "D" }] });
  assert.equal(ok.meta.length, 1);                                    // images are never imported
  const cur = [{ date: "a", updatedAt: "2026-10-02" }, { date: "b", updatedAt: "2026-10-05", v: "mine" }];
  const inc = [{ date: "b", updatedAt: "2026-10-03", v: "old" }, { date: "c", updatedAt: "2026-10-01" }];
  const m = M.mergeRecords(cur, inc, "date");
  assert.equal(m.length, 3);
  assert.equal(m.find((r) => r.date === "b").v, "mine");              // newer edit wins
});
