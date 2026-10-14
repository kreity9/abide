// Verse lookup and the shared Scripture card.
import { VERSES, TRANSLATIONS } from "./verses.js";
import { verseIndex } from "./model.js";
import * as store from "./store.js";
import { icon } from "./icons.js";
import { esc, toast } from "./ui.js";

export { VERSES, TRANSLATIONS };

export const byRef = (ref) => VERSES.find((v) => v.ref === ref);
export const verseFor = (date) => VERSES[verseIndex(date, VERSES.length)];
export const tr = () => store.getSetting("translation");

export function verseCard(v, { label = "Scripture of the day", big = true, cls = "" } = {}) {
  if (!v) return "";
  const t = tr(), fav = store.isFavorite(v.ref);
  return `<figure class="verse-card ${big ? "big" : ""} ${cls}" data-ref="${esc(v.ref)}">
    <figcaption class="eyebrow">${icon("book")}${esc(label)}</figcaption>
    <blockquote>${esc(v.text[t])}</blockquote>
    <footer>
      <cite>${esc(v.ref)}<span class="tr" title="${esc(TRANSLATIONS[t])}">${t.toUpperCase()}</span></cite>
      <div class="verse-actions">
        <button type="button" class="icon-btn fav${fav ? " on" : ""}" data-fav="${esc(v.ref)}" aria-pressed="${fav}"
          aria-label="${fav ? "Remove from" : "Save to"} favorites">${icon("star")}</button>
        <button type="button" class="seg-mini" data-tr aria-label="Switch translation">${Object.keys(TRANSLATIONS)
          .map((k) => `<span class="${k === t ? "on" : ""}">${k.toUpperCase()}</span>`).join("")}</button>
      </div>
    </footer>
  </figure>`;
}

/** Wire favorite + translation buttons inside `root`; `rerender` redraws the caller. */
export function wireVerses(root, rerender, onFav = () => {}) {
  root.addEventListener("click", async (e) => {
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      const ref = fav.dataset.fav;
      if (store.isFavorite(ref)) {
        const old = store.favorites().find((f) => f.ref === ref);
        await store.deleteFavorite(ref);
        toast("Removed from favorites", { action: "Undo", onAction: async () => { await store.saveFavorite(old); rerender(); } });
      } else {
        await store.saveFavorite({ ref });
        toast(`Saved ${ref} to your Scripture collection`);
      }
      for (const b of root.querySelectorAll(`[data-fav="${CSS.escape(ref)}"]`)) {
        b.classList.toggle("on", store.isFavorite(ref));
        b.setAttribute("aria-pressed", String(store.isFavorite(ref)));
      }
      onFav(ref);
      return;
    }
    if (e.target.closest("[data-tr]")) {
      const keys = Object.keys(TRANSLATIONS);
      await store.setSetting("translation", keys[(keys.indexOf(tr()) + 1) % keys.length]);
      rerender();
    }
  });
}
