// The objectives list: add, edit, check, delete-with-undo, reorder, filter.
// Used by the Home page (today) and every Day page.
import * as store from "./store.js";
import { newObjective, setDone, move, dayStats, PRIORITIES } from "./model.js";
import { fmtShort } from "./dates.js";
import { VERSES } from "./verses.js";
import { icon } from "./icons.js";
import { esc, $, $$, toast } from "./ui.js";
import { burst, celebrate, motionLevel, EASE } from "./motion.js";

const DURATIONS = ["", "15m", "30m", "45m", "1h", "1.5h", "2h", "3h", "4h+"];

export const catOf = (id) => store.getSetting("categories").find((c) => c.id === id);

export function chip(o) {
  const c = catOf(o.category);
  const bits = [];
  if (o.time) bits.push(`<span class="chip">${icon("clock")}${esc(fmtTime(o.time))}</span>`);
  if (o.duration) bits.push(`<span class="chip">${icon("hourglass")}${esc(o.duration)}</span>`);
  if (c) bits.push(`<span class="chip cat" style="--h:${c.hue}">${icon(c.icon)}${esc(c.name)}</span>`);
  if (o.priority) bits.push(`<span class="chip pri ${o.priority}">${icon("flag")}${PRIORITIES[o.priority]}</span>`);
  if (o.carriedFrom) bits.push(`<span class="chip soft">${icon("forward")}from ${esc(fmtShort(o.carriedFrom))}</span>`);
  if (o.note) bits.push(`<span class="chip soft">${icon("note")}note</span>`);
  return bits.join("");
}

export function fmtTime(t) {
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h)) return t;
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function catOptions(sel) {
  return `<option value="">No category</option>` + store.getSetting("categories")
    .map((c) => `<option value="${esc(c.id)}"${c.id === sel ? " selected" : ""}>${esc(c.name)}</option>`).join("");
}

function itemHTML(o, open) {
  if (o.movedTo) {
    return `<li class="obj moved" data-id="${o.id}">
      <span class="grip-space"></span><span class="cb ghost" aria-hidden="true">${icon("forward")}</span>
      <div class="obj-main"><span class="obj-title">${esc(o.title)}</span>
      <div class="chips"><a class="chip soft" href="#/day/${o.movedTo}">moved to ${esc(fmtShort(o.movedTo))}</a></div></div></li>`;
  }
  return `<li class="obj${o.done ? " done" : ""}${open ? " open" : ""}" data-id="${o.id}">
    <button type="button" class="grip" aria-label="Reorder “${esc(o.title)}”. Use arrow keys to move." title="Drag or use ↑ ↓">${icon("grip")}</button>
    <button type="button" class="cb" role="checkbox" aria-checked="${o.done}" aria-label="Mark “${esc(o.title)}” ${o.done ? "not done" : "done"}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4L18.5 7.5"/></svg></button>
    <div class="obj-main">
      <button type="button" class="obj-title" aria-expanded="${!!open}">${esc(o.title)}</button>
      ${o.description ? `<p class="obj-desc">${esc(o.description)}</p>` : ""}
      <div class="chips">${chip(o)}</div>
    </div>
    <div class="obj-actions">
      <button type="button" class="icon-btn" data-act="edit" aria-label="Edit">${icon("edit")}</button>
      <button type="button" class="icon-btn" data-act="delete" aria-label="Delete">${icon("trash")}</button>
    </div>
    ${open ? editorHTML(o) : ""}
  </li>`;
}

function editorHTML(o) {
  return `<div class="obj-edit">
    <label class="f wide"><span>Title</span><input data-f="title" value="${esc(o.title)}" maxlength="300"></label>
    <label class="f wide"><span>Description</span><textarea data-f="description" rows="2" placeholder="Optional">${esc(o.description)}</textarea></label>
    <label class="f"><span>Category</span><select data-f="category">${catOptions(o.category)}</select></label>
    <label class="f"><span>Priority</span><select data-f="priority"><option value="">None</option>${Object.entries(PRIORITIES)
      .map(([k, v]) => `<option value="${k}"${o.priority === k ? " selected" : ""}>${v}</option>`).join("")}</select></label>
    <label class="f"><span>Due time</span><input type="time" data-f="time" value="${esc(o.time)}"></label>
    <label class="f"><span>Estimated</span><select data-f="duration">${DURATIONS.map((d) => `<option value="${d}"${o.duration === d ? " selected" : ""}>${d || "—"}</option>`).join("")}</select></label>
    <label class="f wide"><span>Personal note</span><textarea data-f="note" rows="2" placeholder="Optional">${esc(o.note)}</textarea></label>
    <div class="edit-foot"><button type="button" class="btn ghost sm" data-act="delete">${icon("trash")}Delete</button>
      <button type="button" class="btn sm" data-act="close">Done</button></div>
  </div>`;
}

/**
 * Mount the list into `root` for `date`. `onStats(stats)` fires after every change.
 * Returns { refresh } for callers that change the day elsewhere.
 */
export function mountObjectives(root, date, { onStats = () => {}, compact = false } = {}) {
  let filter = "all", openId = null, last = dayStats(store.getDay(date));

  root.innerHTML = `
    <form class="quick-add" autocomplete="off">
      <span class="qa-icon">${icon("plus")}</span>
      <input name="title" placeholder="Add an objective, then press Enter" aria-label="New objective" maxlength="300">
      <select name="category" aria-label="Category" class="qa-cat">${catOptions("")}</select>
      <button class="btn" type="submit">Add</button>
    </form>
    ${compact ? "" : `<div class="seg filters" role="tablist" aria-label="Show"></div>`}
    <ul class="obj-list" aria-live="polite"></ul>
    <p class="empty" hidden></p>`;

  const list = $(".obj-list", root), form = $(".quick-add", root), filters = $(".filters", root);

  const day = () => store.getDay(date);

  function commit(d, { soon = false, focusId = null } = {}) {
    soon ? store.saveDaySoon(d) : store.saveDay(d);
    const s = dayStats(d);
    if (s.total > 0 && s.remaining === 0 && last.remaining > 0 && store.getSetting("celebrate") !== false) {
      const v = VERSES.length ? VERSES[Math.floor(Math.random() * VERSES.length)] : null;
      const tr = store.getSetting("translation");
      setTimeout(() => celebrate("Every objective is complete. Well done — rest in His peace.",
        v && { text: esc(v.text[tr]), ref: `${esc(v.ref)} · ${tr.toUpperCase()}` }), 450);
    }
    last = s;
    onStats(s);
    if (focusId) render(focusId);
  }

  function visible(d) {
    const objs = d.objectives;
    if (filter === "open") return objs.filter((o) => !o.done && !o.movedTo);
    if (filter === "done") return objs.filter((o) => o.done);
    return objs;
  }

  function renderFilters(d) {
    if (!filters) return;
    const s = dayStats(d);
    const tabs = [["all", "All", d.objectives.length], ["open", "To do", s.remaining], ["done", "Done", s.done]];
    filters.innerHTML = tabs.map(([k, l, n]) =>
      `<button type="button" role="tab" aria-selected="${filter === k}" data-filter="${k}">${l}<span class="n">${n}</span></button>`).join("");
  }

  function render(focusId) {
    const d = day();
    renderFilters(d);
    const items = visible(d);
    list.innerHTML = items.map((o) => itemHTML(o, o.id === openId)).join("");
    list.classList.toggle("can-sort", filter === "all");
    const empty = $(".empty", root);
    empty.hidden = items.length > 0;
    empty.textContent = d.objectives.length === 0
      ? "Nothing planned yet. What is one thing you want to do today?"
      : filter === "done" ? "Nothing checked off yet — that's okay. Start with one." : "Everything here is done.";
    if (focusId) $(`[data-id="${focusId}"] .cb`, list)?.focus({ preventScroll: true });
    if (openId) $(`[data-id="${openId}"] [data-f="title"]`, list)?.focus({ preventScroll: true });
  }

  // ---- add
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = form.title.value.trim();
    if (!title) return form.title.focus();
    const d = day();
    d.objectives.push(newObjective(title, { category: form.category.value }));
    form.title.value = "";
    commit(d);
    render();
    const li = list.lastElementChild;
    if (li && motionLevel() !== "off") li.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "none" }], { duration: 320, easing: EASE });
    form.title.focus();
  });

  // ---- clicks
  root.addEventListener("click", (e) => {
    const f = e.target.closest("[data-filter]");
    if (f) { filter = f.dataset.filter; openId = null; return render(); }
    const li = e.target.closest(".obj");
    if (!li || li.classList.contains("moved")) return;
    const id = li.dataset.id;
    if (e.target.closest(".cb")) return toggle(id, e.target.closest(".cb"));
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "delete") return remove(id);
    if (act === "close") { openId = null; render(); return $(`[data-id="${id}"] .obj-title`, list)?.focus(); }
    if (act === "edit" || e.target.closest("button.obj-title")) { openId = openId === id ? null : id; render(); }
  });

  function toggle(id, btn) {
    const d = day();
    const i = d.objectives.findIndex((o) => o.id === id);
    if (i < 0) return;
    const now = !d.objectives[i].done;
    d.objectives[i] = setDone(d.objectives[i], now);
    const li = btn.closest(".obj");
    li.classList.toggle("done", now);
    btn.setAttribute("aria-checked", String(now));
    btn.setAttribute("aria-label", `Mark “${d.objectives[i].title}” ${now ? "not done" : "done"}`);
    if (now) burst(btn, { count: 10, spread: 34 });
    commit(d);
    renderFilters(d);
    // in a filtered view the item leaves gently instead of jumping
    if (filter !== "all") {
      if (motionLevel() === "off") render();
      else li.animate([{ opacity: 1 }, { opacity: 0, transform: "translateX(8px)" }], { duration: 260, easing: EASE }).onfinish = () => render();
    }
  }

  function remove(id) {
    const d = day();
    const i = d.objectives.findIndex((o) => o.id === id);
    if (i < 0) return;
    const [gone] = d.objectives.splice(i, 1);
    openId = null;
    commit(d);
    render();
    toast(`Deleted “${gone.title}”`, {
      action: "Undo",
      onAction: () => {
        const d2 = day();
        d2.objectives.splice(Math.min(i, d2.objectives.length), 0, gone);
        commit(d2);
        render(gone.id);
      },
    });
  }

  // ---- inline editing (autosaves)
  root.addEventListener("input", (e) => {
    const field = e.target.dataset.f;
    if (!field) return;
    const id = e.target.closest(".obj")?.dataset.id;
    const d = day();
    const o = d.objectives.find((x) => x.id === id);
    if (!o) return;
    if (field === "title" && !e.target.value.trim()) return; // keep the old title rather than save an empty one
    o[field] = field === "title" ? e.target.value.trim() : e.target.value;
    commit(d, { soon: true });
    const li = e.target.closest(".obj");
    if (field === "title") $(".obj-title", li).textContent = o.title;
    $(".chips", li).innerHTML = chip(o);
  });
  root.addEventListener("change", (e) => { if (e.target.dataset.f) store.flush(); });
  root.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches(".obj-edit input")) { e.preventDefault(); openId = null; render(); }
    if (e.key === "Escape" && openId) { const id = openId; openId = null; render(); $(`[data-id="${id}"] .obj-title`, list)?.focus(); }
    // keyboard reorder from the grip
    if (e.target.matches(".grip") && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      if (filter !== "all") return;
      const id = e.target.closest(".obj").dataset.id;
      const d = day();
      const i = d.objectives.findIndex((o) => o.id === id);
      const j = i + (e.key === "ArrowUp" ? -1 : 1);
      if (j < 0 || j >= d.objectives.length) return;
      d.objectives = move(d.objectives, i, j);
      commit(d);
      render();
      $(`[data-id="${id}"] .grip`, list)?.focus();
    }
  });

  // ---- pointer drag reorder with FLIP so neighbours glide, not jump
  list.addEventListener("pointerdown", (e) => {
    const grip = e.target.closest(".grip");
    if (!grip || filter !== "all" || e.button !== 0) return;
    e.preventDefault();
    const li = grip.closest(".obj");
    const startY = e.clientY, top0 = li.offsetTop;
    li.classList.add("dragging");

    const flip = (fn) => {
      const items = $$(".obj", list).filter((x) => x !== li);
      const before = new Map(items.map((x) => [x, x.getBoundingClientRect().top]));
      fn();
      if (motionLevel() === "off") return;
      for (const x of items) {
        const dy = before.get(x) - x.getBoundingClientRect().top;
        if (dy) x.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 200, easing: EASE });
      }
    };

    const mid = (x) => x.offsetTop + x.offsetHeight / 2;
    const moveFn = (ev) => {
      // where the item's centre would be if it followed the pointer exactly
      const centre = top0 + (ev.clientY - startY) + li.offsetHeight / 2;
      // a fast move can cross several items, so keep swapping until settled
      flip(() => {
        for (let guard = 0; guard < 100; guard++) {
          const prev = li.previousElementSibling, next = li.nextElementSibling;
          if (prev && centre < mid(prev)) list.insertBefore(li, prev);
          else if (next && centre > mid(next)) list.insertBefore(next, li);
          else break;
        }
      });
      // translate = pointer travel minus how far the item already moved in the layout
      li.style.transform = `translateY(${ev.clientY - startY - (li.offsetTop - top0)}px)`;
    };
    // listen on window: moving the item in the DOM drops pointer capture
    const up = () => {
      removeEventListener("pointermove", moveFn);
      removeEventListener("pointerup", up);
      removeEventListener("pointercancel", up);
      li.classList.remove("dragging");
      li.style.transform = "";
      const order = $$(".obj", list).map((x) => x.dataset.id);
      const d = day();
      const byId = new Map(d.objectives.map((o) => [o.id, o]));
      const sorted = order.map((id) => byId.get(id)).filter(Boolean);
      if (sorted.length === d.objectives.length && sorted.some((o, i) => o !== d.objectives[i])) {
        d.objectives = sorted;
        commit(d);
      }
    };
    addEventListener("pointermove", moveFn);
    addEventListener("pointerup", up);
    addEventListener("pointercancel", up);
  });

  render();
  onStats(last);
  return {
    refresh: () => { last = dayStats(day()); render(); onStats(last); },
    focusAdd: () => form.title.focus(),
  };
}
