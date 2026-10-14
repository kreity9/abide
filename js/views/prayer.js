// Prayer journal. Status is only ever what you choose: Ongoing or Updated.
import * as store from "../store.js";
import { today, fmtDate, isKey } from "../dates.js";
import { uid } from "../model.js";
import { icon } from "../icons.js";
import { esc, $, modal, toast, stagger } from "../ui.js";
import { byRef, tr } from "../scripture.js";

const CATS = ["", "Family", "Friends", "Health", "Guidance", "Gratitude", "Work & school", "Church", "World", "Personal"];
const STATUS = { ongoing: "Ongoing", updated: "Updated" };
let view = { q: "", status: "all" };

function form(p = {}) {
  return `<div class="form-grid">
    <label class="f wide"><span>Prayer request</span><input id="p-title" value="${esc(p.title || "")}" maxlength="200" autofocus placeholder="What would you like to bring to God?"></label>
    <label class="f"><span>Date</span><input id="p-date" type="date" value="${esc(p.date || today())}"></label>
    <label class="f"><span>Category</span><select id="p-cat">${CATS.map((c) => `<option${c === (p.category || "") ? " selected" : ""} value="${esc(c)}">${c || "None"}</option>`).join("")}</select></label>
    <label class="f wide"><span>Reflection</span><textarea id="p-body" rows="4" placeholder="Optional">${esc(p.body || "")}</textarea></label>
    <label class="f wide"><span>Follow-up notes, answers or updates</span><textarea id="p-follow" rows="3" placeholder="Optional — add what you choose to record">${esc(p.followUp || "")}</textarea></label>
    <label class="f"><span>Status</span><select id="p-status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${(p.status || "ongoing") === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
  </div>`;
}

async function edit(p, rerender) {
  const res = await modal({
    title: p ? "Edit prayer" : "New prayer", wide: true, body: form(p || {}),
    actions: [{ label: "Cancel", cls: "ghost", value: () => null }, {
      label: "Save", value: (m) => {
        const title = $("#p-title", m).value.trim();
        if (!title) { $("#p-title", m).focus(); return false; }
        const date = $("#p-date", m).value;
        return {
          ...(p || { id: uid(), createdAt: new Date().toISOString() }), title,
          date: isKey(date) ? date : today(), category: $("#p-cat", m).value, body: $("#p-body", m).value,
          followUp: $("#p-follow", m).value, status: $("#p-status", m).value,
        };
      },
    }],
  });
  if (res) { await store.savePrayer(res); toast("Prayer saved"); rerender(); }
}

export function render(main) {
  main.innerHTML = `
  <header class="page-head reveal"><div><p class="eyebrow">Private to this device</p><h1>Prayer journal</h1></div>
    <button type="button" class="btn" data-new>${icon("plus")}New prayer</button></header>
  ${(() => { const v = byRef("Philippians 4:6-7"); return v ? `<blockquote class="page-verse reveal">“${esc(v.text[tr()])}”<cite>${esc(v.ref)} · ${tr().toUpperCase()}</cite></blockquote>` : ""; })()}
  <div class="toolbar reveal">
    <label class="search">${icon("search")}<input type="search" placeholder="Search prayers" value="${esc(view.q)}" aria-label="Search prayers"></label>
    <div class="seg" role="tablist">${[["all", "All"], ["ongoing", "Ongoing"], ["updated", "Updated"]]
      .map(([k, l]) => `<button type="button" role="tab" data-st="${k}" aria-selected="${view.status === k}">${l}</button>`).join("")}</div>
  </div>
  <div class="prayer-list"></div>`;

  function draw() {
    const q = view.q.toLowerCase();
    const list = store.prayers().filter((p) => (view.status === "all" || p.status === view.status) &&
      (!q || `${p.title} ${p.body} ${p.followUp} ${p.category}`.toLowerCase().includes(q)));
    $(".prayer-list", main).innerHTML = list.length ? list.map((p) => `
      <article class="card prayer reveal" data-id="${p.id}">
        <header class="card-head"><div><p class="eyebrow">${esc(fmtDate(p.date))}${p.category ? ` · ${esc(p.category)}` : ""}</p><h2>${esc(p.title)}</h2></div>
          <span class="status ${p.status}">${STATUS[p.status] || "Ongoing"}</span></header>
        ${p.body ? `<p class="prayer-body">${esc(p.body)}</p>` : ""}
        ${p.followUp ? `<div class="follow"><p class="eyebrow">Follow-up</p><p>${esc(p.followUp)}</p></div>` : ""}
        <footer class="row-actions"><button type="button" class="btn ghost sm" data-edit>${icon("edit")}Edit</button>
          <button type="button" class="btn ghost sm" data-del>${icon("trash")}Delete</button></footer>
      </article>`).join("")
      : `<p class="empty">${store.prayers().length ? "No prayers match." : "No prayers recorded yet. Add one whenever it's on your heart."}</p>`;
    stagger($(".prayer-list", main));
  }

  main.addEventListener("input", (e) => { if (e.target.type === "search") { view.q = e.target.value; draw(); } });
  main.addEventListener("click", async (e) => {
    if (e.target.closest("[data-new]")) return edit(null, draw);
    const st = e.target.closest("[data-st]");
    if (st) { view.status = st.dataset.st; main.querySelectorAll("[data-st]").forEach((x) => x.setAttribute("aria-selected", String(x === st))); return draw(); }
    const card = e.target.closest(".prayer");
    if (!card) return;
    const p = store.prayers().find((x) => x.id === card.dataset.id);
    if (e.target.closest("[data-edit]")) return edit(p, draw);
    if (e.target.closest("[data-del]")) {
      await store.deletePrayer(p.id);
      draw();
      toast("Prayer deleted", { action: "Undo", onAction: async () => { await store.savePrayer(p); draw(); } });
    }
  });
  draw();
  stagger(main);
}
