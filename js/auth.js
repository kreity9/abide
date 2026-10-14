// Email + password sign-in for the hosted copy (Supabase). A password typed in
// the app works inside an iPhone Home Screen app; an emailed link would sign in
// Safari instead, which keeps separate storage.
import { supabase, currentUser } from "./sync.js";
import { lightCross } from "./motion.js";
import { esc, $ } from "./ui.js";

const MESSAGES = {
  "Invalid login credentials": "That email and password don't match. Check both and try again.",
  "Email not confirmed": "Confirm your email first: open the message from Supabase, tap the link, then sign in here.",
  "User already registered": "That email already has an account. Switch to Sign in.",
};
const friendly = (m) => MESSAGES[m] || m;

/** Resolve once there's a signed-in user. Shows the sign-in screen if needed. */
export async function requireSignIn() {
  const client = await supabase();
  if (!client) return false;                  // offline or not configured: run on this device only
  if (await currentUser()) return true;

  return new Promise((resolve) => {
    let mode = "in";
    const el = document.createElement("div");
    el.className = "signin";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-labelledby", "si-title");
    document.body.append(el);

    const draw = (note = "", err = "") => {
      el.innerHTML = `<form class="signin-card" novalidate>
        ${lightCross()}
        <h1 id="si-title">Abide</h1>
        <p class="signin-lede">${mode === "in" ? "Sign in to open your notebook on any device." : "Create your account. Only you will be able to read your notebook."}</p>
        <label class="f"><span>Email</span><input id="si-email" type="email" autocomplete="email" inputmode="email" required></label>
        <label class="f"><span>Password</span><input id="si-pass" type="password" autocomplete="${mode === "in" ? "current-password" : "new-password"}" minlength="8" required></label>
        ${err ? `<p class="signin-err" role="alert">${esc(err)}</p>` : ""}
        ${note ? `<p class="signin-note" role="status">${esc(note)}</p>` : ""}
        <button class="btn" type="submit">${mode === "in" ? "Sign in" : "Create account"}</button>
        <button class="link-btn" type="button" data-mode>${mode === "in" ? "First time here? Create your account" : "Already have an account? Sign in"}</button>
      </form>`;
      $("#si-email", el).focus();
    };
    draw();

    el.addEventListener("click", (e) => {
      if (!e.target.closest("[data-mode]")) return;
      mode = mode === "in" ? "up" : "in";
      draw();
    });

    el.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = $("#si-email", el).value.trim();
      const password = $("#si-pass", el).value;
      if (!email || !password) return draw("", "Enter your email and password.");
      if (mode === "up" && password.length < 8) return draw("", "Use at least 8 characters for your password.");
      const btn = $("button[type=submit]", el);
      btn.disabled = true;
      btn.textContent = mode === "in" ? "Signing in…" : "Creating…";
      try {
        if (mode === "in") {
          const { error } = await client.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else {
          const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
          if (error) throw error;
          if (!data.session) {
            mode = "in";
            return draw("Account created. Check your email for a confirmation link, tap it, then come back here and sign in.");
          }
        }
        el.classList.add("out");
        setTimeout(() => el.remove(), 400);
        resolve(true);
      } catch (err) {
        draw("", friendly(err.message || String(err)));
        $("#si-email", el).value = email;
      }
    });
  });
}

/** Sign out and remove this device's copy (your notebook stays safe in your account). */
export async function signOut() {
  const client = await supabase();
  await client?.auth.signOut();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* fine */ }
  await new Promise((r) => { const q = indexedDB.deleteDatabase("abide-notebook"); q.onsuccess = q.onerror = q.onblocked = () => r(); });
  location.reload();
}

export async function accountEmail() {
  return (await currentUser())?.email || "";
}
