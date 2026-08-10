/* ============================================================
   AnonAsk — auth.js
   Handles registration, login, logout, session guarding and
   the profiles row that carries each user's public handle.
   ============================================================ */

const Auth = {
  // Return the logged-in user or null.
  async currentUser() {
    if (!window.sb) return null;
    const { data } = await sb.auth.getUser();
    return data ? data.user : null;
  },

  // Fetch the profile (handle + display name) for a user id.
  async profileFor(userId) {
    const { data, error } = await sb
      .from("profiles")
      .select("id, username, display_name, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  // Is a handle free? Uses the public read policy on profiles.
  async handleAvailable(handle) {
    const { data, error } = await sb
      .from("profiles")
      .select("id")
      .eq("username", handle)
      .maybeSingle();
    if (error) throw error;
    return !data;
  },

  // Send a page to login unless authenticated; returns {user, profile}.
  async guard(redirect = "login.html") {
    if (!window.requireConfig()) return null;
    const user = await this.currentUser();
    if (!user) {
      location.replace(redirect);
      return null;
    }
    let profile = null;
    try { profile = await this.profileFor(user.id); } catch (_) {}
    return { user, profile };
  },

  // If already logged in, skip a public page (e.g. login) and go to dashboard.
  async redirectIfAuthed(to = "dashboard.html") {
    if (!window.sb) return;
    const user = await this.currentUser();
    if (user) location.replace(to);
  },

  async logout() {
    if (window.sb) await sb.auth.signOut();
    location.replace("index.html");
  },
};
window.Auth = Auth;

/* ------------------------------------------------------------
   REGISTER PAGE
   ------------------------------------------------------------ */
function initRegister() {
  if (!window.requireConfig()) return;
  Auth.redirectIfAuthed();

  const form      = document.getElementById("register-form");
  const emailEl   = document.getElementById("email");
  const passEl    = document.getElementById("password");
  const handleEl  = document.getElementById("handle");
  const nameEl    = document.getElementById("display-name");
  const handleNote= document.getElementById("handle-note");
  const errorEl   = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");
  const linkPrev  = document.getElementById("link-preview");

  let handleOk = false;
  let checkTimer = null;

  // Keep the handle field normalized as the user types + live preview.
  handleEl.addEventListener("input", () => {
    const norm = window.normalizeHandle(handleEl.value);
    if (norm !== handleEl.value) handleEl.value = norm;
    linkPrev.textContent = norm || "your-name";
    handleOk = false;
    setNote("", "");

    if (!norm) return;
    if (!window.HANDLE_RE.test(norm)) {
      setNote("3–20 characters: lowercase letters, numbers, hyphens.", "bad");
      return;
    }
    setNote("Checking availability…", "");
    clearTimeout(checkTimer);
    checkTimer = setTimeout(() => checkHandle(norm), 400);
  });

  async function checkHandle(norm) {
    try {
      const free = await Auth.handleAvailable(norm);
      // Guard against a stale check if the field changed meanwhile.
      if (window.normalizeHandle(handleEl.value) !== norm) return;
      if (free) { handleOk = true;  setNote("“" + norm + "” is available.", "ok"); }
      else      { handleOk = false; setNote("“" + norm + "” is taken. Try another.", "bad"); }
    } catch (e) {
      setNote("Couldn’t check right now — you can still try to register.", "");
    }
  }

  function setNote(msg, kind) {
    handleNote.textContent = msg;
    handleNote.className = "field-note" + (kind ? " " + kind : "");
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.remove("hidden");
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");

    const email  = emailEl.value.trim();
    const pass   = passEl.value;
    const handle = window.normalizeHandle(handleEl.value);
    const name   = nameEl.value.trim() || handle;

    if (!window.HANDLE_RE.test(handle)) return showError("Pick a handle: 3–20 characters, lowercase letters, numbers or hyphens.");
    if (pass.length < 6) return showError("Password must be at least 6 characters.");

    submitBtn.disabled = true;
    submitBtn.textContent = "Creating your room…";

    try {
      // Final availability check right before we commit.
      if (!(await Auth.handleAvailable(handle))) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Create my link";
        return showError("That handle was just taken. Try another.");
      }

      // 1) create the auth user
      const { data: signUp, error: signErr } = await sb.auth.signUp({
        email,
        password: pass,
      });
      if (signErr) throw signErr;

      const user = signUp.user;
      // With email-confirmation OFF, we get a session immediately.
      if (!user) throw new Error("Sign-up did not return a user. Is email confirmation still on?");

      // 2) create the public profile row (id must equal auth uid — enforced by RLS)
      const { error: profErr } = await sb.from("profiles").insert({
        id: user.id,
        username: handle,
        display_name: name,
      });
      if (profErr) {
        // Unique-violation → handle race
        if (profErr.code === "23505") throw new Error("That handle was just taken. Please log in and pick another.");
        throw profErr;
      }

      // 3) ensure we have a session, then go to the dashboard
      if (!signUp.session) {
        await sb.auth.signInWithPassword({ email, password: pass });
      }
      location.replace("dashboard.html");
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create my link";
      showError(prettyAuthError(err));
    }
  });
}

/* ------------------------------------------------------------
   LOGIN PAGE
   ------------------------------------------------------------ */
function initLogin() {
  if (!window.requireConfig()) return;
  Auth.redirectIfAuthed();

  const form      = document.getElementById("login-form");
  const emailEl   = document.getElementById("email");
  const passEl    = document.getElementById("password");
  const errorEl   = document.getElementById("form-error");
  const submitBtn = document.getElementById("submit-btn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    submitBtn.disabled = true;
    submitBtn.textContent = "Unlocking…";

    try {
      const { error } = await sb.auth.signInWithPassword({
        email: emailEl.value.trim(),
        password: passEl.value,
      });
      if (error) throw error;
      location.replace("dashboard.html");
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Log in";
      errorEl.textContent = prettyAuthError(err);
      errorEl.classList.remove("hidden");
    }
  });
}

// Turn Supabase error noise into something a person can read.
function prettyAuthError(err) {
  const m = (err && err.message ? err.message : String(err)).toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered"))
    return "That email already has an account. Try logging in instead.";
  if (m.includes("invalid login")) return "Email or password is incorrect.";
  if (m.includes("email not confirmed")) return "Please confirm your email first, or ask the owner to disable confirmation.";
  if (m.includes("password")) return "Password must be at least 6 characters.";
  if (m.includes("rate")) return "Too many attempts. Wait a moment and try again.";
  return (err && err.message) ? err.message : "Something went wrong. Please try again.";
}
window.initRegister = initRegister;
window.initLogin = initLogin;
