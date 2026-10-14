import * as store from "../store.js";
import { today, monthKey, addMonths, monthGrid, fmtMonth, parse, fmtLong, daysInMonth, fmtDow, weekDays } from "../dates.js";
import { dayStats, hasActivity, rangeStats } from "../model.js";
import { catOf } from "../objectives.js";
import { icon } from "../icons.js";
import { esc, stagger } from "../ui.js";

export function render(main, [mk]) {
  const t = today();
  if (!/^\d{4}-\d{2}$/.test(mk || "")) mk = monthKey(t);
  const startsOn = store.getSetting("weekStartsOn");
  const grid = monthGrid(mk, startsOn);
  const inMonth = Array.from({ length: daysInMonth(mk) }, (_, i) => store.getDay(`${mk}-${String(i + 1).padStart(2, "0")}`));
  const s = rangeStats(inMonth);
  const cats = Object.entries(s.byCategory).sort((a, b) => b[1].total - a[1].total).slice(0, 4);

  main.innerHTML = `
  <header class="page-head reveal">
    <div class="day-nav">
      <a class="icon-btn" href="#/month/${addMonths(mk, -1)}" aria-label="Previous month" data-dir="-1">${icon("left")}</a>
      <div class="day-title"><p class="eyebrow">Monthly calendar</p><h1>${esc(fmtMonth(mk))}</h1></div>
      <a class="icon-btn" href="#/month/${addMonths(mk, 1)}" aria-label="Next month" data-dir="1">${icon("right")}</a>
      ${mk === monthKey(t) ? "" : `<a class="btn ghost sm" href="#/month/${monthKey(t)}">This month</a>`}
    </div>
  </header>

  <div class="month-wrap">
    <section class="card cal reveal" aria-label="${esc(fmtMonth(mk))}">
      <div class="cal-dows" aria-hidden="true">${weekDays(grid[0].key, startsOn).map((k) => `<span>${esc(fmtDow(k))}</span>`).join("")}</div>
      <div class="cal-grid">${grid.map(({ key, inMonth: im }) => {
        const d = store.getDay(key), ds = dayStats(d), act = hasActivity(d);
        const label = `${fmtLong(key)}${ds.total ? `, ${ds.done} of ${ds.total} done` : ""}${d.notes.trim() ? ", has notes" : ""}`;
        return `<a href="#/day/${key}" class="cal-day${im ? "" : " out"}${key === t ? " is-today" : ""}${act ? " active" : ""}${ds.total && ds.remaining === 0 ? " complete" : ""}"
          aria-label="${esc(label)}" style="--p:${ds.pct}">
          <span class="cd-num">${parse(key).getDate()}</span>
          ${ds.total ? `<span class="cd-count">${ds.done}/${ds.total}</span>` : ""}
          <span class="cd-marks">${d.notes.trim() ? `<i class="mk note" title="Notes"></i>` : ""}${Object.values(d.reflection || {}).some((v) => String(v).trim()) ? `<i class="mk refl" title="Reflection"></i>` : ""}</span>
          ${ds.total ? `<span class="cd-fill"></span>` : ""}
        </a>`;
      }).join("")}</div>
      <p class="legend"><span><i class="mk mk-obj"></i>objectives</span><span><i class="mk note"></i>notes</span><span><i class="mk refl"></i>reflection</span></p>
    </section>

    <aside class="card month-sum reveal">
      <h2>${icon("chart")}Month summary</h2>
      <dl class="sum-list">
        <div><dt>Objectives created</dt><dd>${s.total}</dd></div>
        <div><dt>Completed</dt><dd>${s.done}</dd></div>
        <div><dt>Completion rate</dt><dd>${s.total ? `${s.pct}%` : "—"}</dd></div>
        <div><dt>Days with activity</dt><dd>${s.activeDays}</dd></div>
      </dl>
      ${cats.length ? `<h3>Most used categories</h3><ul class="cat-list">${cats.map(([id, c]) => {
        const cat = catOf(id);
        return `<li style="--h:${cat?.hue ?? 0}"><span class="chip cat">${cat ? icon(cat.icon) : ""}${esc(cat?.name || "Uncategorised")}</span><span>${c.done}/${c.total}</span></li>`;
      }).join("")}</ul>` : ""}
      <p class="fine">These numbers describe notebook activity only — not your worth, and not your walk with Jesus.</p>
    </aside>
  </div>`;
  stagger(main);
}
