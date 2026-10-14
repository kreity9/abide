// Progress: the last 30 days of notebook activity. Activity, not worth.
import * as store from "../store.js";
import { today, addDays, fmtShort, parse } from "../dates.js";
import { dayStats, rangeStats, hasActivity } from "../model.js";
import { catOf } from "../objectives.js";
import { icon } from "../icons.js";
import { esc, ring, stagger } from "../ui.js";

export function render(main) {
  const t = today();
  const keys = Array.from({ length: 30 }, (_, i) => addDays(t, i - 29));
  const days = keys.map((k) => store.getDay(k));
  const s = rangeStats(days);
  const week = rangeStats(days.slice(-7));
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1].total - a[1].total);
  const journalDays = days.filter((d) => d.notes.trim() || Object.values(d.reflection || {}).some((v) => String(v).trim())).length;
  const prayers = store.prayers().filter((p) => p.date >= keys[0]).length;

  main.innerHTML = `
  <header class="page-head reveal"><div><p class="eyebrow">Last 30 days</p><h1>Progress</h1></div></header>
  <div class="progress-top">
    <section class="card reveal center">${ring(s.pct, 150, "completed")}<p class="muted">${s.done} of ${s.total} objectives</p></section>
    <section class="card reveal"><dl class="kpi-grid">
      <div><dt>This week</dt><dd>${week.done}/${week.total}</dd></div>
      <div><dt>Active days</dt><dd>${s.activeDays}<small>/30</small></dd></div>
      <div><dt>Journal days</dt><dd>${journalDays}</dd></div>
      <div><dt>Prayers recorded</dt><dd>${prayers}</dd></div>
      <div><dt>Saved verses</dt><dd>${store.favorites().length}</dd></div>
      <div><dt>Open right now</dt><dd>${s.remaining}</dd></div>
    </dl></section>
  </div>

  <section class="card reveal">
    <header class="card-head"><h2>${icon("chart")}Daily objectives</h2><span class="muted small">bar height = objectives · gold = completed</span></header>
    <div class="chart" role="list">${days.map((d) => {
      const ds = dayStats(d), max = Math.max(1, ...days.map((x) => dayStats(x).total));
      return `<a role="listitem" href="#/day/${d.date}" class="col${d.date === t ? " is-today" : ""}${hasActivity(d) ? "" : " idle"}"
        aria-label="${esc(fmtShort(d.date))}: ${ds.done} of ${ds.total}" title="${esc(fmtShort(d.date))}: ${ds.done}/${ds.total}">
        <span class="stack" style="height:${(ds.total / max) * 100}%"><span class="fill" style="height:${ds.pct}%"></span></span>
        <span class="lbl">${parse(d.date).getDate()}</span></a>`;
    }).join("")}</div>
  </section>

  ${cats.length ? `<section class="card reveal"><header class="card-head"><h2>${icon("list")}By category</h2></header>
    <ul class="cat-bars">${cats.map(([id, c]) => {
      const cat = catOf(id), pct = Math.round((c.done / c.total) * 100);
      return `<li style="--h:${cat?.hue ?? 0}"><span class="chip cat">${cat ? icon(cat.icon) : ""}${esc(cat?.name || "Uncategorised")}</span>
        <span class="cb-track"><span style="width:${pct}%"></span></span><span class="muted">${c.done}/${c.total}</span></li>`;
    }).join("")}</ul></section>` : ""}

  <p class="fine center reveal">These numbers measure how you've used this notebook — never your worth, and never your relationship with Jesus.</p>`;
  stagger(main);
}
