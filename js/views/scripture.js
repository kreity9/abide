// Scripture: today's verse, saved favorites with personal notes, past daily verses, the full collection.
import * as store from "../store.js";
import { today, fmtShort } from "../dates.js";
import { verseHistory } from "../model.js";
import { VERSES, TRANSLATIONS, byRef, verseFor, verseCard, wireVerses, tr } from "../scripture.js";
import { icon } from "../icons.js";
import { esc, $, stagger } from "../ui.js";

let tab = "saved", q = "";

export function render(main, _p, nav) {
  const t = today();
  main.innerHTML = `
  <header class="page-head reveal"><div><p class="eyebrow">God's Word</p><h1>Scripture collection</h1></div></header>
  <div class="reveal">${verseCard(verseFor(t))}</div>
  <div class="toolbar reveal">
    <div class="seg" role="tablist">${[["saved", "Saved"], ["history", "Past daily verses"], ["all", "Browse all"]]
      .map(([k, l]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${tab === k}">${l}</button>`).join("")}</div>
    <label class="search">${icon("search")}<input type="search" placeholder="Search verses, references, your notes" value="${esc(q)}" aria-label="Search Scripture"></label>
  </div>
  <div class="verse-list"></div>
  <p class="fine source">Verse text: ${Object.entries(TRANSLATIONS).map(([k, v]) => `${k.toUpperCase()} — ${v}`).join(", ")} (both public domain), retrieved from bible-api.com.
   Your notes are shown separately from the Bible text.</p>`;

  const match = (v, note = "") => !q || `${v.ref} ${v.text[tr()]} ${v.theme} ${note}`.toLowerCase().includes(q.toLowerCase());

  function draw() {
    const host = $(".verse-list", main);
    if (tab === "saved") {
      const favs = store.favorites().map((f) => ({ f, v: byRef(f.ref) })).filter(({ f, v }) => v && match(v, f.note));
      host.innerHTML = favs.length ? favs.map(({ f, v }) => `
        <article class="card saved-verse">
          ${verseCard(v, { label: `Saved ${fmtShort(f.savedAt.slice(0, 10))}`, big: false, cls: "flat" })}
          <label class="my-note"><span class="eyebrow">${icon("edit")}My note</span>
            <textarea data-note="${esc(f.ref)}" rows="2" placeholder="What does this verse mean to you?">${esc(f.note)}</textarea></label>
        </article>`).join("")
        : `<p class="empty">${q ? "No saved verses match." : `No saved verses yet. Tap the ${icon("star")} on any verse to keep it here.`}</p>`;
    } else if (tab === "history") {
      const h = verseHistory(store.getSetting("firstOpen") || t, t, VERSES).filter(({ verse }) => match(verse));
      host.innerHTML = h.map(({ date, verse }) => verseCard(verse, { label: date === t ? "Today" : fmtShort(date), big: false, cls: "card" })).join("")
        || `<p class="empty">Nothing matches.</p>`;
    } else {
      const all = VERSES.filter((v) => match(v));
      host.innerHTML = all.map((v) => verseCard(v, { label: v.theme, big: false, cls: "card" })).join("") || `<p class="empty">Nothing matches.</p>`;
    }
  }

  main.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (b) { tab = b.dataset.tab; main.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); draw(); }
  });
  main.addEventListener("input", (e) => {
    if (e.target.type === "search") { q = e.target.value; return draw(); }
    const ref = e.target.dataset.note;
    if (ref) {
      const f = store.favorites().find((x) => x.ref === ref);
      store.saveFavorite({ ...f, note: e.target.value });
    }
  });
  wireVerses(main, () => nav.refresh(), () => draw());
  draw();
  stagger(main);
}
