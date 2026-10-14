# Abide — a private daily notebook

Objectives you check off, notes, reflection, a prayer journal and Scripture, in a
quiet black-and-light design. Everything stays on this Mac.

## Open it

The server starts on its own at login (launchd agent `com.abide.notebook`), so just
bookmark **http://127.0.0.1:5180**. You can also install it in Chrome: click the
install icon in the address bar, or ⋮ → Cast, save and share → Install page as app.
That gives Abide its own window and Dock icon, and it opens even when the server is
off, because a service worker caches the app.

`start.command` still works as a manual fallback.

Always use that exact address. Browsers keep data per address, so
`localhost:5180` or another port would show an empty notebook.

## On your phone (synced)

Open **https://claude.ai/artifact/FEnNZH1emPnvkLy6XuhFDx** while signed in to
claude.ai. That copy saves to your private space on claude.ai (only you can read
it) and syncs between every device where you open it. On a phone, use Share → Add
to Home Screen to get an icon. To update it, edit the files here and republish
`artifact/index.html` with the same file list.

The Mac copy at 127.0.0.1:5180 is separate and doesn't sync. Use one or the other
as your main notebook.

## Where your data lives (Mac copy)

- In this browser's IndexedDB for `127.0.0.1:5180`. Nothing is uploaded, synced or shared.
- Each edit is also mirrored to localStorage the moment you type, so a sudden reload or close can't lose it.
- One automatic snapshot is kept per day (the last 14), plus one before every restore. You can restore them in **Settings → Your data**.
- **Export backup** downloads a `.json` file of everything. **Restore from file** can merge or replace.
- Clearing site data, a private window, another browser or another computer won't show your notebook unless you restore a backup.

## Shortcuts

| Key | Action |
|---|---|
| `N` | New objective |
| `T` | Today |
| `H` | Home |
| `←` `→` | Previous / next day (on a day page) |
| `Enter` | Add an objective (in the add box); close the editor |
| `Esc` | Close an editor or dialog |
| `↑` `↓` on the ⋮⋮ handle | Reorder |

## Scripture

There are 73 passages in KJV and WEB (both public domain), fetched from bible-api.com
by `scripts/fetch_verses.py` into `js/verses.js`. No verse text was typed by hand.
To add a passage, add it to `REFS` and rerun the script; it only downloads new ones.

## Structure

```
index.html            shell + fonts
css/base.css          tokens, themes, ambient light, layout, motion levels
css/components.css    buttons, cards, checkbox, ring, verse card, cross/crown, intro, modal
css/views.css         page layouts + responsive rules
js/app.js             router, navigation, transitions, shortcuts, reminders
js/store.js           IndexedDB + write-ahead journal, backup/restore, snapshots
js/model.js           pure logic: objectives, stats, carry-over, verse of the day
js/dates.js           local-date helpers (DST- and timezone-safe)
js/motion.js          dust motes, drawn crown of thorns, light cross, intro, celebration
js/objectives.js      the objectives list (add/edit/check/delete+undo/drag/keyboard)
js/views/*.js         home, day, week, month, all, journal, prayer, scripture, progress, settings
scripts/serve.py      local no-cache server (127.0.0.1 only)
tests/model.test.mjs  logic tests
```

Plain HTML, CSS and JavaScript modules: no build step, no npm packages.

## Tests

    node --test tests/model.test.mjs

## Limits

- Single device. There's no sync between computers or a phone.
- Reminders only fire while the notebook is open in a browser tab.
- Google Fonts load from the internet. Offline, it falls back to Georgia and the system font.
