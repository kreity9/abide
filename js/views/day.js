import * as store from "../store.js";
import { today, isKey, addDays, fmtLong, fmtWeekday, fmtShort, relativeLabel, fmtDate } from "../dates.js";
import { dayStats, REFLECTION_PROMPTS, unfinished, carry } from "../model.js";
import { mountObjectives } from "../objectives.js";
import { VERSES, byRef, verseCard, wireVerses } from "../scripture.js";
import { icon } from "../icons.js";
import { esc, $, $$, ring, setRing, bar, stagger, toast, autosize, modal } from "../ui.js";

export function render(main, [date], nav) {
  const t = today();
  if (!isKey(date)) date = t;
  const d = store.getDay(date);
  const isPast = date < t;
  const verse = byRef(d.verseRef);
  const prompts = store.getSetting("prompts") || REFLECTION_PROMPTS;
  const hasReflection = Object.values(d.reflection || {}).some((v) => String(v).trim());

  main.innerHTML = `
  <header class="page-head day-head reveal">
    <div class="day-nav">
      <a class="icon-btn" href="#/day/${addDays(date, -1)}" aria-label="Previous day" data-dir="-1">${icon("left")}</a>
      <div class="day-title">
        <p class="eyebrow">${esc(relativeLabel(date, t))} · ${esc(fmtWeekday(date))}</p>
        <h1>${esc(fmtDate(date))}</h1>
      </div>
      <a class="icon-btn" href="#/day/${addDays(date, 1)}" aria-label="Next day" data-dir="1">${icon("right")}</a>
      ${date !== t ? `<a class="btn ghost sm" href="#/day/${t}">Today</a>` : ""}
      <label class="btn ghost sm date-jump">${icon("calendar")}<span>Jump</span><input type="date" value="${date}" aria-label="Go to date"></label>
    </div>
    <div class="day-status">${ring(dayStats(d).pct, 72)}<p class="status-text"></p></div>
  </header>

  <section class="intention reveal">
    <label for="intent" class="eyebrow">${icon("sparkle")}Intention for the day</label>
    <input id="intent" class="intent-input" value="${esc(d.intention)}" maxlength="200"
      placeholder="e.g. Be patient, work with my whole heart, call Mom">
  </section>

  <div class="day-grid">
    <div class="day-main">
      <section class="card reveal" aria-labelledby="obj-h">
        <header class="card-head"><h2 id="obj-h">${icon("list")}Objectives</h2><span class="save-state" aria-live="polite"></span></header>
        <div class="objectives-host"></div>
      </section>

      <section class="card notes reveal" aria-labelledby="notes-h">
        <header class="card-head"><h2 id="notes-h">${icon("journal")}Notes</h2><span class="save-state"></span></header>
        <textarea id="notes" class="paper" placeholder="Thoughts, reminders, ideas — anything on your heart today." aria-labelledby="notes-h">${esc(d.notes)}</textarea>
      </section>

      <details class="card reflection reveal"${hasReflection ? " open" : ""}>
        <summary><h2>${icon("heart")}Reflection <span class="opt">optional</span></h2>${icon("down", "chev")}</summary>
        <div class="prompts">${prompts.map((p) => `
          <label class="prompt"><span>${esc(p.text)}</span>
          <textarea data-r="${esc(p.id)}" rows="2">${esc(d.reflection?.[p.id] || "")}</textarea></label>`).join("")}
        </div>
        <p class="fine">Your reflections stay on this device. Nothing is sent anywhere.</p>
      </details>
    </div>

    <aside class="day-side">
      <section class="reveal day-verse">${verse ? verseCard(verse, { label: "Scripture for this day", big: false }) :
        `<div class="card add-verse"><p class="eyebrow">${icon("book")}Scripture for this day</p>
         <p class="muted">Choose a verse to carry with you.</p></div>`}
        <div class="verse-pick"><select aria-label="Scripture for this day"><option value="">${verse ? "Change verse…" : "Choose a verse…"}</option>
        ${VERSES.map((v) => `<option value="${esc(v.ref)}"${v.ref === d.verseRef ? " selected" : ""}>${esc(v.ref)} — ${esc(v.theme)}</option>`).join("")}
        ${verse ? `<option value="__none">Remove verse</option>` : ""}</select></div>
      </section>
      <section class="card summary reveal" aria-labelledby="sum-h"></section>
    </aside>
  </div>`;

  // ---- objectives + live status
  const ringEl = $(".day-status .ring", main);
  mountObjectives($(".objectives-host", main), date, {
    onStats: (s) => {
      setRing(ringEl, s.pct);
      $(".status-text", main).textContent = s.total ? `${s.done} of ${s.total} done` : "No objectives yet";
      renderSummary();
    },
  });

  // ---- text fields autosave
  const patch = (fn) => { const cur = store.getDay(date); fn(cur); store.saveDaySoon(cur); renderSummary(); };
  $("#intent", main).addEventListener("input", (e) => patch((c) => { c.intention = e.target.value; }));
  const notes = $("#notes", main);
  autosize(notes);
  notes.addEventListener("input", () => patch((c) => { c.notes = notes.value; }));
  for (const ta of $$("[data-r]", main)) {
    autosize(ta);
    ta.addEventListener("input", () => patch((c) => { c.reflection = { ...c.reflection, [ta.dataset.r]: ta.value }; }));
  }

  $(".verse-pick select", main).addEventListener("change", async (e) => {
    const cur = store.getDay(date);
    cur.verseRef = e.target.value === "__none" ? "" : e.target.value;
    await store.saveDay(cur);
    nav.refresh();
  });
  $(".date-jump input", main).addEventListener("change", (e) => { if (isKey(e.target.value)) location.hash = `#/day/${e.target.value}`; });
  wireVerses(main, () => nav.refresh());

  // ---- end-of-day summary + manual carry-over
  function renderSummary() {
    const cur = store.getDay(date);
    const s = dayStats(cur);
    const left = unfinished(cur);
    const reflections = Object.values(cur.reflection || {}).filter((v) => String(v).trim()).length;
    const words = (cur.notes.trim().match(/\S+/g) || []).length;
    const el = $(".summary", main);
    el.innerHTML = `
      <header class="card-head"><h2 id="sum-h">${icon("chart")}${isPast ? "How the day went" : "Day at a glance"}</h2></header>
      ${bar(s.pct)}
      <dl class="sum-list">
        <div><dt>Completed</dt><dd>${s.done}</dd></div>
        <div><dt>Remaining</dt><dd>${s.remaining}</dd></div>
        <div><dt>Completion</dt><dd>${s.pct}%</dd></div>
        <div><dt>Notes</dt><dd>${words ? `${words} word${words > 1 ? "s" : ""}` : "—"}</dd></div>
        <div><dt>Reflections</dt><dd>${reflections || "—"}</dd></div>
      </dl>
      ${left.length ? `<div class="carry">
        <p class="muted">${isPast ? "These were left open. That's okay — choose what to carry forward." : "Still open:"}</p>
        <ul>${left.map((o) => `<li><label><input type="checkbox" value="${o.id}" checked> ${esc(o.title)}</label></li>`).join("")}</ul>
        <div class="carry-actions">
          <button type="button" class="btn sm" data-carry="${isPast ? t : addDays(date, 1)}">${icon("forward")}Move to ${isPast ? "today" : "tomorrow"}</button>
          <button type="button" class="btn ghost sm" data-carry-pick>Another day…</button>
        </div>
        <p class="fine">Moving copies the objective to the new day and marks it here as moved. It is never marked complete for you.</p>
      </div>` : s.total ? `<p class="muted done-note">${icon("check")}Everything for this day is complete.</p>` : ""}`;
  }

  async function doCarry(to) {
    const ids = $$(".carry input:checked", main).map((x) => x.value);
    if (!ids.length) return toast("Select at least one objective to move.");
    const res = carry(store.getDay(date), store.getDay(to), ids);
    await store.saveDay(res.from);
    await store.saveDay(res.to);
    toast(`Moved ${res.count} to ${fmtShort(to)}`);
    nav.refresh();
  }

  main.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-carry]");
    if (c) return doCarry(c.dataset.carry);
    if (e.target.closest("[data-carry-pick]")) {
      const to = await modal({
        title: "Move to which day?",
        body: `<label class="f wide"><span>Date</span><input type="date" id="carry-to" value="${addDays(date, 1)}" autofocus></label>`,
        actions: [{ label: "Cancel", cls: "ghost", value: () => null }, { label: "Move", value: (m) => $("#carry-to", m).value || false }],
      });
      if (to && isKey(to) && to !== date) doCarry(to);
    }
  });

  // live save indicator for this page
  const off = nav.onStatus((st) => {
    for (const el of $$(".save-state", main)) {
      el.dataset.s = st;
      el.textContent = st === "saving" ? "Saving…" : st === "saved" ? "Saved" : st === "error" ? "Not saved — check storage" : "";
    }
  });

  stagger(main);
  return { cleanup: off, title: fmtLong(date) };
}
