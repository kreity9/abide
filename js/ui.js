// Small UI building blocks shared by every view.
import { icon } from "./icons.js";
import { motionLevel, EASE } from "./motion.js";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Progress ring. pct 0-100. */
export function ring(pct, size = 120, label = "") {
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return `<div class="ring" style="--size:${size}px" role="img" aria-label="${pct}% complete">
    <svg viewBox="0 0 ${size} ${size}">
      <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}"/>
      <circle class="ring-fill" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-dasharray="${c.toFixed(2)}"
        stroke-dashoffset="${(c * (1 - pct / 100)).toFixed(2)}" style="--c:${c.toFixed(2)}"/>
    </svg>
    <div class="ring-label"><strong>${pct}%</strong>${label ? `<span>${label}</span>` : ""}</div>
  </div>`;
}

/** Update an existing ring in place so it animates instead of re-rendering. */
export function setRing(el, pct) {
  if (!el) return;
  const fill = $(".ring-fill", el);
  const c = parseFloat(fill.style.getPropertyValue("--c"));
  fill.setAttribute("stroke-dashoffset", (c * (1 - pct / 100)).toFixed(2));
  $(".ring-label strong", el).textContent = `${pct}%`;
  el.setAttribute("aria-label", `${pct}% complete`);
}

export function bar(pct, cls = "") {
  return `<div class="bar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>`;
}

// ---------------------------------------------------------------- toasts (with undo)
export function toast(message, { action, onAction, ms = 5000 } = {}) {
  const host = $("#toasts");
  const el = document.createElement("div");
  el.className = "toast";
  el.setAttribute("role", "status");
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button type="button" class="toast-act">${icon("undo")}${esc(action)}</button>` : ""}`;
  host.append(el);
  let gone = false;
  const close = () => {
    if (gone) return;
    gone = true;
    el.classList.add("out");
    setTimeout(() => el.remove(), 250);
  };
  if (action) $(".toast-act", el).addEventListener("click", () => { onAction?.(); close(); });
  setTimeout(close, ms);
  return close;
}

// ---------------------------------------------------------------- modal
export function modal({ title, body, actions = [], onOpen, wide = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    const el = document.createElement("div");
    el.className = "modal-wrap";
    el.innerHTML = `<div class="modal${wide ? " wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="m-title">
      <header><h2 id="m-title">${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close">${icon("x")}</button></header>
      <div class="modal-body">${body}</div>
      ${actions.length ? `<footer>${actions.map((a, i) => `<button type="button" class="btn ${a.cls || ""}" data-i="${i}">${esc(a.label)}</button>`).join("")}</footer>` : ""}
    </div>`;
    document.body.append(el);
    const close = (val) => {
      el.classList.add("out");
      removeEventListener("keydown", key);
      setTimeout(() => { el.remove(); prev?.focus?.(); }, 200);
      resolve(val);
    };
    const key = (e) => {
      if (e.key === "Escape") close(null);
      if (e.key === "Tab") trap(e, el);
    };
    addEventListener("keydown", key);
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest("[data-close]")) close(null);
      const b = e.target.closest("[data-i]");
      if (b) {
        const a = actions[+b.dataset.i];
        const val = a.value ? a.value(el) : a.label;
        if (val !== false) close(val);
      }
    });
    onOpen?.(el, close);
    ($("[autofocus]", el) || $("footer .btn:last-child", el) || $("[data-close]", el)).focus();
  });
}

function trap(e, root) {
  const f = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", root).filter((x) => !x.disabled);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export const confirm = (title, text, yes = "Delete") =>
  modal({ title, body: `<p>${esc(text)}</p>`, actions: [{ label: "Cancel", cls: "ghost", value: () => null }, { label: yes, cls: "danger", value: () => true }] });

// ---------------------------------------------------------------- staggered entrance
export function stagger(root, sel = ".reveal") {
  if (motionLevel() !== "full") return;
  $$(sel, root).forEach((el, i) => {
    el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }],
      { duration: 520, delay: 40 + i * 55, easing: EASE, fill: "backwards" });
  });
}

/** Soft pulse on an element after it changes (e.g. a number). */
export function pulse(el) {
  if (!el || motionLevel() === "off") return;
  el.animate([{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }], { duration: 380, easing: EASE });
}

/** Offer a file. Inside claude.ai the viewer's own save prompt is used (plain links are blocked there). */
export async function download(name, text, type = "application/json") {
  if (window.claude?.use) {
    const dl = await window.claude.use("downloads");
    if (dl) {
      try { await dl.save({ filename: name, data: text }); return true; } catch (err) { return err?.code !== "declined" ? null : false; }
    }
    return null;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

/** Auto-grow a textarea to its content. */
export function autosize(ta) {
  const fit = () => { ta.style.height = "auto"; ta.style.height = `${ta.scrollHeight + 2}px`; };
  ta.addEventListener("input", fit);
  requestAnimationFrame(fit);
}
