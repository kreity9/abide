import * as store from "../store.js";
import { today, greeting, fmtLong, addDays, weekDays, fmtDow, parse } from "../dates.js";
import { dayStats, encouragement, unfinished, carry } from "../model.js";
import { mountObjectives } from "../objectives.js";
import { verseFor, verseCard, wireVerses } from "../scripture.js";
import { thornCrown, lightCross } from "../motion.js";
import { icon } from "../icons.js";
import { esc, $, ring, setRing, stagger, pulse, toast } from "../ui.js";

export function render(main, _params, nav) {
  const t = today();
  const name = store.getSetting("name");
  const bg = store.background();
  const y = store.getDay(addDays(t, -1));
  const carryable = unfinished(y);
  const s = dayStats(store.getDay(t));

  main.innerHTML = `
  <section class="hero reveal${bg ? " has-bg" : ""}">
    ${bg ? `<div class="hero-bg" style="background-image:url(${URL.createObjectURL(bg)})"></div>` : `<div class="hero-art">${lightCross()}${thornCrown({ seed: 3 })}</div>`}
    <div class="hero-text">
      <p class="eyebrow">${esc(fmtLong(t))}</p>
      <h1>${esc(greeting())}${name ? `, <em>${esc(name)}</em>` : ""}.</h1>
      <p class="lede">${esc(encouragement(t))}</p>
    </div>
  </section>

  ${carryable.length ? `<div class="banner reveal">${icon("forward")}
    <span>${carryable.length} unfinished objective${carryable.length > 1 ? "s" : ""} from yesterday. Bring ${carryable.length > 1 ? "them" : "it"} into today?</span>
    <button type="button" class="btn sm" data-carry>Bring into today</button>
    <a class="btn ghost sm" href="#/day/${addDays(t, -1)}">Review yesterday</a></div>` : ""}

  <div class="home-grid">
    <section class="card today-card reveal" aria-labelledby="today-h">
      <header class="card-head">
        <div><p class="eyebrow">${icon("sun")}Today's objectives</p><h2 id="today-h">What matters most today</h2></div>
        <a class="link" href="#/day/${t}">Open today's page ${icon("arrowRight")}</a>
      </header>
      <div class="today-summary">
        <div class="ring-wrap">${ring(s.pct, 128, "complete")}</div>
        <dl class="kpis">
          <div><dt>Objectives</dt><dd data-k="total">${s.total}</dd></div>
          <div><dt>Completed</dt><dd data-k="done">${s.done}</dd></div>
          <div><dt>Remaining</dt><dd data-k="remaining">${s.remaining}</dd></div>
        </dl>
        <div class="next-up"><p class="eyebrow">Next up</p><p class="next-title"></p></div>
      </div>
      <div class="objectives-host"></div>
    </section>

    <div class="home-side">
      ${store.getSetting("showVerse") ? `<div class="reveal verse-host">${verseCard(verseFor(t))}</div>
        <a class="link small reveal" href="#/scripture">${icon("history")}Past verses &amp; your collection</a>` : ""}
      <section class="card week-strip reveal" aria-label="This week">
        <header class="card-head"><p class="eyebrow">${icon("week")}This week</p><a class="link" href="#/week/${t}">Week view ${icon("arrowRight")}</a></header>
        <ol class="strip">${weekDays(t, store.getSetting("weekStartsOn")).map((k) => {
          const ds = dayStats(store.getDay(k));
          return `<li class="${k === t ? "is-today" : ""}"><a href="#/day/${k}" aria-label="${esc(fmtLong(k))}: ${ds.done} of ${ds.total} done">
            <span class="dow">${esc(fmtDow(k))}</span><span class="dnum">${parse(k).getDate()}</span>
            <span class="mini-bar"><span style="height:${ds.pct}%"></span></span></a></li>`;
        }).join("")}</ol>
      </section>
    </div>
  </div>`;

  const ringEl = $(".today-card .ring", main);
  const objs = mountObjectives($(".objectives-host", main), t, {
    compact: true,
    onStats: (st) => {
      setRing(ringEl, st.pct);
      for (const k of ["total", "done", "remaining"]) {
        const dd = $(`[data-k="${k}"]`, main);
        if (dd && dd.textContent !== String(st[k])) { dd.textContent = st[k]; pulse(dd); }
      }
      const next = store.getDay(t).objectives.find((o) => !o.done && !o.movedTo);
      $(".next-title", main).textContent = next ? next.title : st.total ? "All done — rest well." : "Add your first objective below.";
    },
  });

  $("[data-carry]", main)?.addEventListener("click", async () => {
    const res = carry(store.getDay(addDays(t, -1)), store.getDay(t));
    await store.saveDay(res.from);
    await store.saveDay(res.to);
    toast(`Brought ${res.count} objective${res.count > 1 ? "s" : ""} into today. Yesterday keeps a note of where they went.`);
    nav.refresh();
  });

  wireVerses(main, () => nav.refresh());
  stagger(main);
  return { focusAdd: objs.focusAdd };
}
