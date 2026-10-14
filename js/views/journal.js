// Journal: every day that has notes, an intention or reflections, newest first.
import * as store from "../store.js";
import { today, fmtLong } from "../dates.js";
import { REFLECTION_PROMPTS } from "../model.js";
import { icon } from "../icons.js";
import { esc, $, stagger } from "../ui.js";

let q = "";

export function render(main) {
  const prompts = store.getSetting("prompts") || REFLECTION_PROMPTS;
  const label = (id) => prompts.find((p) => p.id === id)?.text || id;

  main.innerHTML = `
  <header class="page-head reveal"><div><p class="eyebrow">Your writing</p><h1>Journal</h1></div>
    <a class="btn" href="#/day/${today()}">${icon("edit")}Write today</a></header>
  <div class="toolbar reveal"><label class="search">${icon("search")}<input type="search" placeholder="Search your notes and reflections" value="${esc(q)}" aria-label="Search journal"></label></div>
  <div class="journal-list"></div>`;

  function draw() {
    const needle = q.toLowerCase();
    const entries = store.allDays().slice().reverse().filter((d) => {
      const text = `${d.intention} ${d.notes} ${Object.values(d.reflection || {}).join(" ")}`;
      return text.trim() && (!needle || text.toLowerCase().includes(needle));
    });
    $(".journal-list", main).innerHTML = entries.length ? entries.map((d) => {
      const refl = Object.entries(d.reflection || {}).filter(([, v]) => String(v).trim());
      return `<article class="card entry reveal">
        <header class="card-head"><a href="#/day/${d.date}"><h2>${esc(fmtLong(d.date))}</h2></a>
          <a class="link small" href="#/day/${d.date}">Open ${icon("arrowRight")}</a></header>
        ${d.intention ? `<p class="entry-intent">${icon("sparkle")}${esc(d.intention)}</p>` : ""}
        ${d.notes.trim() ? `<div class="entry-notes">${esc(d.notes)}</div>` : ""}
        ${refl.length ? `<dl class="entry-refl">${refl.map(([k, v]) => `<dt>${esc(label(k))}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
      </article>`;
    }).join("") : `<p class="empty">${q ? "Nothing matches that search." : "Your journal is empty. Open today's page and write a few lines."}</p>`;
    stagger($(".journal-list", main));
  }
  main.addEventListener("input", (e) => { if (e.target.type === "search") { q = e.target.value; draw(); } });
  draw();
  stagger(main);
}
