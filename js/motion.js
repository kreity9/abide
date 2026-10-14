// Motion: ambient light, the drawn crown-of-thorns motif, the intro and the
// completion glow. Every effect checks motionLevel() so "off" really means off.

let level = "full"; // full | reduced | off

export function setMotion(pref) {
  const sys = matchMedia("(prefers-reduced-motion: reduce)").matches;
  level = pref === "auto" ? (sys ? "reduced" : "full") : pref;
  document.documentElement.dataset.motion = level;
  ambient.restart();
}

export const motionLevel = () => level;
export const EASE = "cubic-bezier(.22,.8,.24,1)";

/** Seeded random so the thorn crown looks the same on every visit. */
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/**
 * A crown of thorns drawn as interwoven branches around an ellipse, with thorns
 * jutting outward. Returns an SVG string; strokes are drawn in with CSS.
 */
export function thornCrown({ w = 320, h = 120, strands = 5, seed = 7 } = {}) {
  const r = rng(seed);
  const cx = w / 2, cy = h / 2, rx = w * 0.42, ry = h * 0.3;
  const paths = [];
  for (let s = 0; s < strands; s++) {
    const phase = r() * Math.PI * 2, amp = 3 + r() * 5, freq = 3 + Math.floor(r() * 3);
    let d = "";
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * Math.PI * 2;
      const wob = Math.sin(t * freq + phase) * amp;
      const x = cx + (rx + wob) * Math.cos(t), y = cy + (ry + wob * 0.6) * Math.sin(t);
      d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    paths.push(`<path class="strand" style="--d:${s * 0.18}s" d="${d}"/>`);
  }
  const thorns = [];
  for (let i = 0; i < 46; i++) {
    const t = r() * Math.PI * 2;
    const x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
    const ang = t + (r() - 0.5) * 1.4, len = 6 + r() * 11;
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len * 0.8;
    // back thorns sit dimmer to give depth
    const back = Math.sin(t) < 0;
    thorns.push(`<path class="thorn${back ? " back" : ""}" style="--d:${0.9 + r() * 0.6}s" d="M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`);
  }
  return `<svg class="crown" viewBox="0 0 ${w} ${h}" aria-hidden="true">${paths.join("")}${thorns.join("")}</svg>`;
}

/** The radiant cross: a soft glow, a crisp core and long faint rays. */
export function lightCross() {
  return `<div class="light-cross" aria-hidden="true">
    <span class="rays"></span><span class="halo"></span>
    <span class="beam v"></span><span class="beam h"></span>
  </div>`;
}

// ---------------------------------------------------------------- ambient dust in a light shaft
export const ambient = (() => {
  let canvas, ctx, raf = 0, motes = [], w = 0, h = 0, dpr = 1;

  function size() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function seed() {
    const n = Math.round(Math.min(70, (w * h) / 22000));
    motes = Array.from({ length: n }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: 0.4 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.08, vy: -0.03 - Math.random() * 0.12,
      a: 0.15 + Math.random() * 0.5, tw: Math.random() * Math.PI * 2,
    }));
  }

  function frame() {
    ctx.clearRect(0, 0, w, h);
    const light = getComputedStyle(document.documentElement).getPropertyValue("--mote").trim() || "255,248,230";
    for (const m of motes) {
      m.x += m.vx; m.y += m.vy; m.tw += 0.01;
      if (m.y < -4) { m.y = h + 4; m.x = Math.random() * w; }
      if (m.x < -4) m.x = w + 4; else if (m.x > w + 4) m.x = -4;
      // motes are brightest inside the central shaft of light
      const shaft = Math.max(0, 1 - Math.abs(m.x - w / 2) / (w * 0.45));
      ctx.globalAlpha = m.a * (0.35 + 0.65 * shaft) * (0.7 + 0.3 * Math.sin(m.tw));
      ctx.fillStyle = `rgb(${light})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    canvas = canvas || document.getElementById("ambient");
    if (!canvas) return;
    ctx = ctx || canvas.getContext("2d");
    cancelAnimationFrame(raf);
    size(); seed();
    if (level === "full") raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, w, h);
  }

  addEventListener("resize", () => { if (canvas) { size(); seed(); } });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else if (level === "full" && canvas) raf = requestAnimationFrame(frame);
  });
  return { restart: start };
})();

// ---------------------------------------------------------------- intro
export function playIntro(title = "Abide", verse = null) {
  return new Promise((resolve) => {
    if (level === "off") return resolve();
    const el = document.createElement("div");
    el.className = "intro";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Welcome");
    el.innerHTML = `${lightCross()}${thornCrown({ seed: 11 })}
      <h1 class="intro-title">${title}</h1>
      ${verse ? `<p class="intro-verse">“${verse.text}” <span>${verse.ref}</span></p>` : ""}
      <button class="intro-skip" type="button">Enter</button>`;
    document.body.append(el);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.classList.add("out");
      setTimeout(() => { el.remove(); resolve(); }, level === "full" ? 700 : 150);
    };
    el.querySelector(".intro-skip").addEventListener("click", finish);
    el.addEventListener("click", (e) => { if (e.target === el) finish(); });
    addEventListener("keydown", finish, { once: true });
    setTimeout(finish, level === "full" ? 3600 : 1200);
    el.querySelector(".intro-skip").focus({ preventScroll: true });
  });
}

// ---------------------------------------------------------------- feedback
export function burst(anchor, { count = 14, spread = 46 } = {}) {
  if (level !== "full" || !anchor) return;
  const r = anchor.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("span");
    p.className = "spark";
    p.style.left = `${cx}px`; p.style.top = `${cy}px`;
    document.body.append(p);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4, d = spread * (0.5 + Math.random() * 0.6);
    p.animate([
      { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(.2)`, opacity: 0 },
    ], { duration: 700 + Math.random() * 300, easing: EASE }).onfinish = () => p.remove();
  }
}

/** A short golden light sweep over the page when the whole day is complete. */
export function celebrate(message, verse) {
  const el = document.createElement("div");
  el.className = "celebrate";
  el.setAttribute("role", "status");
  el.innerHTML = `<div class="celebrate-card">${lightCross()}
    <p class="celebrate-title">${message}</p>
    ${verse ? `<blockquote>${verse.text}<cite>${verse.ref}</cite></blockquote>` : ""}
    <button type="button" class="btn ghost">Close</button></div>`;
  document.body.append(el);
  const close = () => { el.classList.add("out"); setTimeout(() => el.remove(), 500); };
  el.querySelector("button").addEventListener("click", close);
  el.addEventListener("click", (e) => { if (e.target === el) close(); });
  setTimeout(close, 6000);
  if (level === "full") {
    const card = el.querySelector(".celebrate-card");
    setTimeout(() => burst(card, { count: 28, spread: 180 }), 250);
  }
}

/** Page transitions: View Transitions where available, a short fade otherwise. */
export async function transition(update, dir = 0) {
  document.documentElement.dataset.dir = dir > 0 ? "fwd" : dir < 0 ? "back" : "none";
  if (level !== "off" && document.startViewTransition && !document.hidden) {
    let ran = false;
    const t = document.startViewTransition(() => { ran = true; return update(); });
    t.ready.catch(() => {});            // an aborted animation still applies the update
    try { await t.updateCallbackDone; } catch { if (!ran) await update(); }
    t.finished.catch(() => {});
    return;
  }
  update();
}
