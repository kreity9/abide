import * as store from "../store.js";
import { today, isKey, addDays, weekDays, fmtWeekday, fmtShort, parse, fmtDate } from "../dates.js";
import { dayStats, rangeStats, counted } from "../model.js";
import { icon } from "../icons.js";
import { esc, bar, stagger } from "../ui.js";

export function render(main, [date]) {
  const t = today();
  if (!isKey(date)) date = t;
  const days = weekDays(date, store.getSetting("weekStartsOn"));
  const recs = days.map((k) => store.getDay(k));
  const s = rangeStats(recs);

  main.innerHTML = `
  <header class="page-head reveal">
    <div class="day-nav">
      <a class="icon-btn" href="#/week/${addDays(days[0], -7)}" aria-label="Previous week" data-dir="-1">${icon("left")}</a>
      <div class="day-title"><p class="eyebrow">Weekly planner</p>
        <h1>${esc(fmtShort(days[0]))} – ${esc(fmtDate(days[6]))}</h1></div>
      <a class="icon-btn" href="#/week/${addDays(days[0], 7)}" aria-label="Next week" data-dir="1">${icon("right")}</a>
      ${days.includes(t) ? "" : `<a class="btn ghost sm" href="#/week/${t}">This week</a>`}
    </div>
    <p class="week-total">${s.done} of ${s.total} objectives complete · ${s.pct}%</p>
  </header>

  <ol class="week-grid">${recs.map((d) => {
    const ds = dayStats(d);
    const items = counted(d).slice(0, 5);
    const more = counted(d).length - items.length;
    return `<li class="card week-day reveal${d.date === t ? " is-today" : ""}${d.date < t ? " past" : ""}">
      <a class="wd-head" href="#/day/${d.date}">
        <span class="dow">${esc(fmtWeekday(d.date))}</span><span class="dnum">${parse(d.date).getDate()}</span>
      </a>
      <div class="wd-stats"><span>${ds.done}/${ds.total}</span><span>${ds.total ? `${ds.pct}%` : ""}</span></div>
      ${bar(ds.pct, "thin")}
      ${d.intention ? `<p class="wd-intent">${esc(d.intention)}</p>` : ""}
      <ul class="wd-list">${items.map((o) => `<li class="${o.done ? "done" : ""}">${icon(o.done ? "check" : "dot")}${esc(o.title)}</li>`).join("")}
        ${more > 0 ? `<li class="more">+${more} more</li>` : ""}</ul>
      <a class="link small" href="#/day/${d.date}">${ds.total ? "Open" : "Plan this day"} ${icon("arrowRight")}</a>
    </li>`;
  }).join("")}</ol>`;
  stagger(main);
}
