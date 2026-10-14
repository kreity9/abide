// "All objectives": every objective across every day, searchable.
import * as store from "../store.js";
import { today, fmtShort, relativeLabel } from "../dates.js";
import { setDone } from "../model.js";
import { chip } from "../objectives.js";
import { icon } from "../icons.js";
import { esc, $, stagger } from "../ui.js";

let state = { q: "", show: "open" };

export function render(main) {
  const t = today();
  main.innerHTML = `
  <header class="page-head reveal"><div><p class="eyebrow">Across every day</p><h1>All objectives</h1></div></header>
  <div class="toolbar reveal">
    <label class="search">${icon("search")}<input type="search" placeholder="Search objectives and notes" value="${esc(state.q)}" aria-label="Search objectives"></label>
    <div class="seg" role="tablist" aria-label="Show">${[["open", "To do"], ["done", "Done"], ["all", "All"]]
      .map(([k, l]) => `<button type="button" role="tab" aria-selected="${state.show === k}" data-show="${k}">${l}</button>`).join("")}</div>
  </div>
  <div class="all-list reveal"></div>`;

  function draw() {
    const q = state.q.toLowerCase();
    const groups = store.allDays().slice().reverse().map((d) => ({
      d, items: d.objectives.filter((o) => !o.movedTo &&
        (state.show === "all" || (state.show === "done") === o.done) &&
        (!q || `${o.title} ${o.description} ${o.note}`.toLowerCase().includes(q))),
    })).filter((g) => g.items.length);
    $(".all-list", main).innerHTML = groups.length ? groups.map(({ d, items }) => `
      <section class="card group">
        <header class="card-head"><a href="#/day/${d.date}"><h2>${esc(fmtShort(d.date))}</h2></a>
          <span class="muted">${esc(relativeLabel(d.date, t))}</span></header>
        <ul class="obj-list flat">${items.map((o) => `
          <li class="obj${o.done ? " done" : ""}" data-date="${d.date}" data-id="${o.id}">
            <button type="button" class="cb" role="checkbox" aria-checked="${o.done}" aria-label="Mark “${esc(o.title)}” ${o.done ? "not done" : "done"}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4L18.5 7.5"/></svg></button>
            <div class="obj-main"><a class="obj-title" href="#/day/${d.date}">${esc(o.title)}</a><div class="chips">${chip(o)}</div></div>
          </li>`).join("")}</ul>
      </section>`).join("")
      : `<p class="empty">${q ? "No objectives match that search." : state.show === "open" ? "Nothing open. Every planned objective is done." : "No objectives yet."}</p>`;
  }

  main.addEventListener("input", (e) => { if (e.target.type === "search") { state.q = e.target.value; draw(); } });
  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-show]");
    if (b) { state.show = b.dataset.show; main.querySelectorAll("[data-show]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); return draw(); }
    const cb = e.target.closest(".cb");
    if (cb) {
      const li = cb.closest(".obj");
      const d = store.getDay(li.dataset.date);
      const i = d.objectives.findIndex((o) => o.id === li.dataset.id);
      d.objectives[i] = setDone(d.objectives[i], !d.objectives[i].done);
      store.saveDay(d);
      li.classList.toggle("done", d.objectives[i].done);
      cb.setAttribute("aria-checked", String(d.objectives[i].done));
    }
  });
  draw();
  stagger(main);
}
