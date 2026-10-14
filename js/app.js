// App shell: navigation, routing, page transitions, theme, shortcuts, reminders.
import * as store from "./store.js";
import { today } from "./dates.js";
import { icon } from "./icons.js";
import { $, $$, toast } from "./ui.js";
import { setMotion, playIntro, transition } from "./motion.js";
import { byRef, tr } from "./scripture.js";
import { fmtTime } from "./objectives.js";
import { usesSupabase } from "./sync.js";
import { requireSignIn } from "./auth.js";
import * as home from "./views/home.js";
import * as day from "./views/day.js";
import * as week from "./views/week.js";
import * as month from "./views/month.js";
import * as all from "./views/all.js";
import * as journal from "./views/journal.js";
import * as prayer from "./views/prayer.js";
import * as scripture from "./views/scripture.js";
import * as progress from "./views/progress.js";
import * as settings from "./views/settings.js";

const NAV = [
  { id: "home", label: "Home", icon: "home", href: () => "#/home" },
  { id: "day", label: "Today", icon: "sun", href: () => `#/day/${today()}` },
  { id: "week", label: "Week", icon: "week", href: () => `#/week/${today()}` },
  { id: "month", label: "Calendar", icon: "calendar", href: () => `#/month/${today().slice(0, 7)}` },
  { id: "all", label: "All objectives", icon: "list", href: () => "#/all" },
  { id: "journal", label: "Journal", icon: "journal", href: () => "#/journal" },
  { id: "prayer", label: "Prayer journal", icon: "prayer", href: () => "#/prayer" },
  { id: "scripture", label: "Scripture", icon: "book", href: () => "#/scripture" },
  { id: "progress", label: "Progress", icon: "chart", href: () => "#/progress" },
  { id: "settings", label: "Settings", icon: "settings", href: () => "#/settings" },
];
const MOBILE = ["home", "day", "month", "prayer", "more"];
const VIEWS = { home, day, week, month, all, journal, prayer, scripture, progress, settings };
const TITLES = Object.fromEntries(NAV.map((n) => [n.id, n.label]));

let current = { route: "", params: [], api: null };
// session storage can be blocked (private windows, some embedded views)
const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* fine */ } },
};
const statusListeners = new Set();
let lastStatus = "saved";

const nav = {
  refresh: () => show(true),
  onStatus: (fn) => { statusListeners.add(fn); fn(lastStatus); return () => statusListeners.delete(fn); },
};

function parseHash() {
  const [route, ...params] = (location.hash.replace(/^#\/?/, "") || "home").split("/");
  return { route: VIEWS[route] ? route : "home", params };
}

function shell() {
  document.body.insertAdjacentHTML("afterbegin", `
  <a class="skip" href="#view">Skip to content</a>
  <div class="sky" aria-hidden="true"><div class="rays"></div><div class="glow"></div></div>
  <canvas id="ambient" aria-hidden="true"></canvas>
  <aside class="sidebar" aria-label="Main navigation">
    <a class="brand" href="#/home" aria-label="Abide, home"><span class="brand-mark">${icon("cross")}</span><span>Abide</span></a>
    <nav><ul>${NAV.map((n) => `<li><a href="${n.href()}" data-nav="${n.id}">${icon(n.icon)}<span>${n.label}</span></a></li>`).join("")}</ul></nav>
    <div class="side-foot"><span class="save-dot" aria-live="polite">All changes saved</span><span class="sync-dot" hidden></span><kbd title="Press N to add an objective">N</kbd><span class="fine">new objective</span></div>
  </aside>
  <main id="view" tabindex="-1"></main>
  <nav class="mobile-nav" aria-label="Main navigation">${MOBILE.map((id) => {
    if (id === "more") return `<button type="button" data-more>${icon("menu")}<span>More</span></button>`;
    const n = NAV.find((x) => x.id === id);
    return `<a href="${n.href()}" data-nav="${n.id}">${icon(n.icon)}<span>${n.id === "month" ? "Calendar" : n.id === "prayer" ? "Prayer" : n.label}</span></a>`;
  }).join("")}</nav>
  <div id="toasts" aria-live="polite"></div>`);

  $("[data-more]").addEventListener("click", () => document.body.classList.toggle("menu-open"));
  $(".sidebar").addEventListener("click", (e) => { if (e.target.closest("a")) document.body.classList.remove("menu-open"); });
}

function applyLook() {
  const s = store.settings();
  const root = document.documentElement;
  root.dataset.look = s.theme;   // not data-theme: the claude.ai viewer owns that attribute
  root.dataset.accent = s.accent;
  setMotion(s.motion);
}

async function show(sameRoute = false) {
  store.flush();
  const next = parseHash();
  const view = VIEWS[next.route];
  // direction: day/week/month arrows say which way; otherwise use the nav order
  const order = NAV.map((n) => n.id);
  const dir = next.route === current.route
    ? (next.params[0] || "") > (current.params[0] || "") ? 1 : (next.params[0] || "") < (current.params[0] || "") ? -1 : 0
    : Math.sign(order.indexOf(next.route) - order.indexOf(current.route));
  current.api?.cleanup?.();

  const main = $("#view");
  const paint = async () => {
    // fresh element per render so view listeners never stack up
    const fresh = main.cloneNode(false);
    main.replaceWith(fresh);
    current = { ...next, api: (await view.render(fresh, next.params, nav)) || null };
  };
  await transition(paint, sameRoute ? 0 : dir);

  const isToday = next.route === "day" && (next.params[0] || today()) === today();
  $$("[data-nav]").forEach((a) => {
    const on = a.dataset.nav === (isToday ? "day" : next.route === "day" ? "month" : next.route);
    a.classList.toggle("active", on);
    on ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current");
  });
  // keep "Today" pointing at the real today after midnight
  $$('[data-nav="day"]').forEach((a) => { a.href = `#/day/${today()}`; });
  document.title = `${current.api?.title || TITLES[next.route] || "Abide"} · Abide`;
  if (!sameRoute) { scrollTo({ top: 0, behavior: "instant" }); $("#view").focus({ preventScroll: true }); }
}

function shortcuts() {
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest("input, textarea, select, [contenteditable]")) return;
    if (e.key === "n" || e.key === "N") {
      e.preventDefault();
      const input = $(".quick-add input");
      if (input) input.focus();
      else { location.hash = `#/day/${today()}`; setTimeout(() => $(".quick-add input")?.focus(), 350); }
    } else if (e.key === "t") location.hash = `#/day/${today()}`;
    else if (e.key === "h") location.hash = "#/home";
    else if (current.route === "day" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      $(`.day-nav [data-dir="${e.key === "ArrowLeft" ? -1 : 1}"]`)?.click();
    }
  });
}

/** In-tab reminders: honest about only working while the notebook is open. */
function reminders() {
  const fired = new Set(JSON.parse(session.get("abide-fired") || "[]"));
  setInterval(() => {
    if (!store.getSetting("reminders") || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    for (const o of store.getDay(today()).objectives) {
      const k = `${today()}:${o.id}`;
      if (o.time && !o.done && !o.movedTo && o.time <= hhmm && !fired.has(k)) {
        fired.add(k);
        session.set("abide-fired", JSON.stringify([...fired]));
        new Notification("Abide · objective due", { body: `${o.title} — ${fmtTime(o.time)}`, tag: k });
      }
    }
  }, 30000);
}

/** claude.ai only: sync with the private cloud copy and redraw when another device changes something. */
async function connectCloud() {
  const label = { syncing: "Syncing…", synced: "Synced across your devices", error: "Sync paused — changes are kept here", local: "" };
  store.on("sync", (st) => {
    const el = $(".sync-dot");
    el.hidden = !label[st];
    el.dataset.s = st;
    el.textContent = label[st] || "";
  });
  let pendingRedraw = false;
  const typing = () => !!document.activeElement?.closest?.("input, textarea, select, [contenteditable], .modal");
  const redraw = () => {
    if (typing()) { pendingRedraw = true; return; }
    pendingRedraw = false;
    applyLook();
    show(true);
  };
  let t;
  store.on("remote", () => { clearTimeout(t); t = setTimeout(redraw, 350); });
  document.addEventListener("focusout", () => setTimeout(() => { if (pendingRedraw) redraw(); }, 50));
  await store.connectSync();
}

function watchDayChange() {
  let d = today();
  setInterval(() => {
    if (today() !== d) {
      d = today();
      if (current.route === "home") show(true);
      toast("A new day has begun. His mercies are new every morning.");
    }
  }, 60000);
}

async function boot() {
  shell();
  // offline app shell + "Install app" support (only on http(s), never file://)
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* optional */ });
  }
  try {
    await store.init();
  } catch (err) {
    $("#view").innerHTML = `<div class="card fatal"><h1>Your notebook couldn't open its storage</h1>
      <p>${String(err.message || err)}</p><p class="fine">Private browsing windows and some browser settings block local storage. Nothing has been deleted.</p></div>`;
    return;
  }
  applyLook();
  store.on("settings", applyLook);
  store.on("status", (s) => {
    lastStatus = s;
    statusListeners.forEach((fn) => fn(s));
    const dot = $(".save-dot");
    dot.dataset.s = s;
    dot.textContent = s === "saving" ? "Saving…" : s === "error" ? "Not saved!" : "All changes saved";
  });
  store.on("error", (err) => toast(`Could not save: ${err.message || err}. Export a backup from Settings.`, { ms: 10000 }));
  addEventListener("hashchange", () => show());
  addEventListener("pagehide", store.flush);
  document.addEventListener("visibilitychange", () => { if (document.hidden) store.flush(); });
  shortcuts();
  reminders();
  watchDayChange();
  // hosted copy: sign in first so the right notebook loads (offline falls through to this device's copy)
  if (usesSupabase()) await requireSignIn();
  await show(true);
  connectCloud();
  if (store.getSetting("intro") && !session.get("abide-intro")) {
    session.set("abide-intro", "1");
    const v = byRef("John 15:4");
    await playIntro("Abide", v && { text: v.text[tr()].split(/(?<=\.)\s/)[0].replace(/\.$/, ""), ref: `John 15:4 · ${tr().toUpperCase()}` });
  }
}

boot();
