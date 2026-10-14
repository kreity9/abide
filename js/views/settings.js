import * as store from "../store.js";
import { today } from "../dates.js";
import { uid, DEFAULT_CATEGORIES } from "../model.js";
import { TRANSLATIONS, VERSES } from "../scripture.js";
import { icon } from "../icons.js";
import { esc, $, toast, download, modal, confirm } from "../ui.js";
import { usesSupabase } from "../sync.js";
import { accountEmail, signOut } from "../auth.js";

const ACCENTS = { gold: "Gold", silver: "Silver", olive: "Olive", sky: "Sky" };
const MOTION = { auto: "Follow my system", full: "Full", reduced: "Reduced", off: "Off" };

const radio = (name, opts, cur) => `<div class="seg" role="radiogroup">${Object.entries(opts).map(([k, v]) =>
  `<label><input type="radio" name="${name}" value="${k}"${String(cur) === String(k) ? " checked" : ""}><span>${esc(v)}</span></label>`).join("")}</div>`;
const toggle = (name, on, label) => `<label class="switch"><input type="checkbox" name="${name}"${on ? " checked" : ""}><span class="knob"></span><span>${esc(label)}</span></label>`;

export async function render(main, _p, nav) {
  const s = store.settings();
  const use = await store.usage();
  const snaps = await store.listSnapshots();
  const custom = s.categories.filter((c) => !DEFAULT_CATEGORIES.some((d) => d.id === c.id));
  const inClaude = !!window.claude?.use;
  const notifOK = "Notification" in window && !inClaude;
  const cloud = store.syncing();
  const hosted = usesSupabase();
  const email = hosted ? await accountEmail() : "";

  main.innerHTML = `
  <header class="page-head"><div><p class="eyebrow">Make it yours</p><h1>Settings</h1></div></header>
  <form class="settings" autocomplete="off">
    <section class="card"><h2>${icon("user")}Personal</h2>
      <label class="f"><span>Name for your greeting</span><input name="name" value="${esc(s.name)}" maxlength="40" placeholder="e.g. Davon"></label>
      <div class="f"><span>Week starts on</span>${radio("weekStartsOn", { 0: "Sunday", 1: "Monday" }, s.weekStartsOn)}</div>
    </section>

    <section class="card"><h2>${icon("sun")}Appearance</h2>
      <div class="f"><span>Theme</span>${radio("theme", { dark: "Night", light: "Parchment" }, s.theme)}</div>
      <div class="f"><span>Accent</span>${radio("accent", ACCENTS, s.accent)}</div>
      <div class="f"><span>Home image</span>
        <p class="fine">Use your own image (for example, a favorite piece of Christian art) behind the home greeting. It stays on this device.</p>
        <div class="row"><label class="btn ghost sm">${icon("image")}Choose image<input type="file" accept="image/*" name="bg" hidden></label>
        ${store.background() ? `<button type="button" class="btn ghost sm" data-clear-bg>${icon("x")}Use the drawn cross</button>` : ""}</div></div>
    </section>

    <section class="card"><h2>${icon("sparkle")}Motion</h2>
      <div class="f"><span>Animation</span>${radio("motion", MOTION, s.motion)}</div>
      <p class="fine">"Follow my system" respects your computer's Reduce Motion setting. "Off" removes all decorative animation; everything still works.</p>
      ${toggle("intro", s.intro, "Show the opening light when I open the notebook")}
      ${toggle("celebrate", s.celebrate, "Celebrate when every objective for the day is done")}
    </section>

    <section class="card"><h2>${icon("book")}Scripture</h2>
      <div class="f"><span>Translation</span>${radio("translation", Object.fromEntries(Object.entries(TRANSLATIONS).map(([k, v]) => [k, `${k.toUpperCase()} · ${v}`])), s.translation)}</div>
      ${toggle("showVerse", s.showVerse, "Show the Scripture of the day on Home")}
      <p class="fine">Both translations are public domain. The verse collection (${VERSES.length} passages) was retrieved from bible-api.com and is stored with the app, so it works offline.</p>
    </section>

    <section class="card"><h2>${icon("list")}Categories</h2>
      <ul class="cat-edit">${s.categories.map((c) => `<li style="--h:${c.hue}"><span class="chip cat">${icon(c.icon)}${esc(c.name)}</span>
        ${DEFAULT_CATEGORIES.some((d) => d.id === c.id) ? "" : `<button type="button" class="icon-btn" data-del-cat="${esc(c.id)}" aria-label="Remove ${esc(c.name)}">${icon("x")}</button>`}</li>`).join("")}</ul>
      <div class="row"><input name="newCat" placeholder="New category name" maxlength="30" aria-label="New category name">
        <button type="button" class="btn sm" data-add-cat>${icon("plus")}Add</button></div>
      ${custom.length ? `<p class="fine">Removing a category keeps its objectives; they just lose the label.</p>` : ""}
    </section>

    <section class="card"><h2>${icon("bell")}Reminders</h2>
      ${inClaude ? `<p class="fine">Reminders aren't available on the claude.ai page. They work in the copy on your Mac (127.0.0.1:5180) while it's open.</p>` : notifOK ? `${toggle("reminders", s.reminders, "Remind me when an objective's due time arrives")}
        <p class="fine">Reminders only fire while this notebook is open in a browser tab (it has no server). Your browser will ask permission the first time.</p>`
        : `<p class="fine">This browser doesn't support notifications.</p>`}
    </section>

    <section class="card data"><h2>${icon("download")}Your data</h2>
      ${hosted ? `<p>${email ? `Signed in as <strong>${esc(email)}</strong>. ` : ""}Your objectives, notes, reflections, prayers, saved verses and settings are saved in <strong>your private Abide account</strong> and on this device, and they sync to every device where you sign in. Only you can read them.</p>
      <p class="fine">Your home image stays on this device only. Export a backup now and then anyway.</p>
      ${email ? `<div class="row"><button type="button" class="btn ghost sm" data-signout>Sign out of this device</button></div>` : ""}`
      : cloud ? `<p>Your objectives, notes, reflections, prayers, saved verses and settings are saved in <strong>your private space on claude.ai</strong> and on this device, and they sync to every device where you open this page signed in as you. Nobody else can read them, even if this page is shared.</p>
      <p class="fine">Your home image stays on this device only. Export a backup now and then anyway.</p>`
      : inClaude ? `<p>Sync isn't connected in this view, so changes are kept on this device for now. Sign in to claude.ai and reopen this page to sync.</p>`
      : `<p>Everything — objectives, notes, reflections, prayers and saved verses — is stored <strong>only in this browser on this computer</strong> (IndexedDB). Nothing is uploaded or synced.</p>
      <p class="fine">Clearing this site's data, using a private window, or switching browsers or computers will not show your notebook unless you restore a backup. Export a backup now and then.</p>`}
      ${use ? `<p class="fine">Using ${(use.used / 1024).toFixed(0)} KB · Protected from automatic cleanup: <strong>${use.persisted ? "yes" : "not granted by the browser"}</strong></p>` : ""}
      <p class="fine">Last exported backup: <strong>${s.lastBackup ? esc(new Date(s.lastBackup).toLocaleString()) : "never"}</strong></p>
      <div class="row">
        <button type="button" class="btn" data-export>${icon("download")}Export backup</button>
        <label class="btn ghost">${icon("upload")}Restore from file<input type="file" accept="application/json,.json" name="import" hidden></label>
      </div>
      ${snaps.length || !inClaude ? `<h3>Automatic daily snapshots</h3>
      <p class="fine">A full copy is kept inside the browser once a day (last 14), and before every restore.</p>
      <ul class="snaps">${snaps.map((x) => `<li><span>${esc(x.date.length > 10 ? new Date(x.date).toLocaleString() : x.date)}</span>
        <span class="muted">${x.days} days · ${x.prayers} prayers</span><button type="button" class="btn ghost sm" data-snap="${esc(x.date)}">Restore</button></li>`).join("") || "<li class='muted'>None yet</li>"}</ul>` : ""}
    </section>
  </form>`;

  const form = $(".settings", main);
  form.addEventListener("change", async (e) => {
    const el = e.target;
    if (el.name === "bg") {
      const f = el.files[0];
      if (!f) return;
      if (f.size > 8 * 1024 * 1024) return toast("Please choose an image under 8 MB.");
      await store.setBackground(f);
      toast("Home image updated");
      return nav.refresh();
    }
    if (el.name === "import") return restoreFile(el.files[0]);
    if (el.name === "newCat") return;
    if (el.name === "reminders" && el.checked && Notification.permission !== "granted") {
      const p = await Notification.requestPermission();
      if (p !== "granted") { el.checked = false; return toast("Notifications were not allowed, so reminders stay off."); }
    }
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.name === "weekStartsOn") v = Number(v);
    await store.setSetting(el.name, v);
    if (el.type !== "text") toast("Saved");
  });
  form.addEventListener("input", (e) => { if (e.target.name === "name") store.setSetting("name", e.target.value.trim()); });

  async function restoreFile(file) {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch { return toast("That file isn't valid JSON."); }
    const mode = await modal({
      title: "Restore backup",
      body: `<p>How should <strong>${esc(file.name)}</strong> be restored?</p>
        <p class="fine"><strong>Merge</strong> keeps everything you have and adds the backup; where both have the same day, the newer edit wins.
        <strong>Replace</strong> makes the notebook exactly match the backup. A snapshot of your current notebook is saved first either way.</p>`,
      actions: [{ label: "Cancel", cls: "ghost", value: () => null }, { label: "Replace", cls: "ghost", value: () => "replace" }, { label: "Merge", value: () => "merge" }],
    });
    if (!mode) return;
    try {
      await store.importData(data, mode);
      toast("Backup restored");
      nav.refresh();
    } catch (err) {
      toast(err.message);
    }
  }

  main.addEventListener("click", async (e) => {
    if (e.target.closest("[data-export]")) {
      const ok = await download(`abide-backup-${today()}.json`, JSON.stringify(store.exportData(), null, 1));
      if (ok === null) return toast("Saving files isn't available in this view.");
      if (!ok) return;
      await store.setSetting("lastBackup", new Date().toISOString());
      toast("Backup saved");
      return nav.refresh();
    }
    if (e.target.closest("[data-signout]") && await confirm("Sign out?", "This device's copy is removed. Your notebook stays safe in your account; sign in again to get it back.", "Sign out")) return signOut();
    if (e.target.closest("[data-clear-bg]")) { await store.clearBackground(); return nav.refresh(); }
    if (e.target.closest("[data-add-cat]")) {
      const name = form.newCat.value.trim();
      if (!name) return form.newCat.focus();
      const cats = store.getSetting("categories");
      if (cats.some((c) => c.name.toLowerCase() === name.toLowerCase())) return toast("That category already exists.");
      await store.setSetting("categories", [...cats, { id: `c-${uid().slice(0, 8)}`, name, hue: Math.floor(Math.random() * 360), icon: "dot" }]);
      return nav.refresh();
    }
    const del = e.target.closest("[data-del-cat]");
    if (del) {
      await store.setSetting("categories", store.getSetting("categories").filter((c) => c.id !== del.dataset.delCat));
      return nav.refresh();
    }
    const snap = e.target.closest("[data-snap]");
    if (snap && await confirm("Restore snapshot?", "Your notebook will be replaced with this snapshot. Your current notebook is snapshotted first, so this can be undone.", "Restore")) {
      await store.restoreSnapshot(snap.dataset.snap);
      toast("Snapshot restored");
      nav.refresh();
    }
  });
}
