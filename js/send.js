/* ============================================================
   AnonAsk — send.js
   Public page. Anyone (no account) can drop an anonymous note.
   The message is stored against the recipient only — the sender
   is never recorded.
   ============================================================ */

(function () {
  const el = (id) => document.getElementById(id);
  ["load-veil", "nf-veil", "rec-veil", "compose-veil"].forEach((id) => {
    const n = el(id); if (n) n.innerHTML = window.VEIL_SVG;
  });

  const loadingEl = el("loading");
  const notfoundEl = el("notfound");
  const composeEl = el("compose-view");
  const sentEl = el("sent-view");

  let recipient = null;

  // Client-side rate limit — a deterrent, not a hard guarantee.
  const COOLDOWN_MS = 20 * 1000;   // one note / 20s
  const HOURLY_CAP  = 15;          // per handle, per browser

  init();

  async function init() {
    if (!window.requireConfig()) {
      // Without keys we can't resolve a handle; show the setup banner + notfound.
      loadingEl.classList.add("hidden");
      notfoundEl.classList.remove("hidden");
      return;
    }

    const params = new URLSearchParams(location.search);
    const handle = window.normalizeHandle(params.get("u") || "");

    if (!handle) return showNotFound();

    try {
      const { data, error } = await sb
        .from("profiles")
        .select("id, username, display_name")
        .eq("username", handle)
        .maybeSingle();
      if (error) throw error;
      if (!data) return showNotFound();
      recipient = data;
      showCompose();
    } catch (e) {
      showNotFound();
    }
  }

  function showNotFound() {
    loadingEl.classList.add("hidden");
    notfoundEl.classList.remove("hidden");
  }

  function showCompose() {
    loadingEl.classList.add("hidden");
    composeEl.classList.remove("hidden");

    const name = recipient.display_name || recipient.username;
    el("rec-name").textContent = name;
    el("rec-handle").textContent = "@" + recipient.username;
    document.title = "Send " + name + " an anonymous message";

    const msg = el("message");
    const counter = el("counter");
    const btn = el("send-btn");

    msg.addEventListener("input", () => {
      const n = msg.value.length;
      counter.textContent = n + " / " + window.MESSAGE_MAX;
      counter.classList.toggle("warn", n > window.MESSAGE_MAX - 40);
    });
    msg.focus();

    el("send-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = msg.value.trim();
      if (content.length < window.MESSAGE_MIN) {
        window.toast("Write something first ✎", "err");
        return;
      }

      const gate = rateGate(recipient.username);
      if (!gate.ok) { window.toast(gate.reason, "err"); return; }

      btn.disabled = true;
      btn.textContent = "Sending…";
      try {
        const { error } = await sb.from("messages").insert({
          recipient_id: recipient.id,
          content: content,
        });
        if (error) throw error;
        recordSend(recipient.username);
        showSent(name);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Send anonymously";
        window.toast("Couldn't send. " + (err.message || "Try again."), "err");
      }
    });

    el("send-another").addEventListener("click", () => {
      sentEl.classList.add("hidden");
      composeEl.classList.remove("hidden");
      msg.value = "";
      counter.textContent = "0 / " + window.MESSAGE_MAX;
      counter.classList.remove("warn");
      el("send-btn").disabled = false;
      el("send-btn").textContent = "Send anonymously";
      msg.focus();
    });
  }

  function showSent(name) {
    composeEl.classList.add("hidden");
    sentEl.classList.remove("hidden");
    el("sent-name").textContent = name + "'s";
  }

  /* ---- rate limiting (localStorage, per handle, per browser) ---- */
  function sendKey(handle) { return "anonask_sent_" + handle; }

  function recentSends(handle) {
    try {
      const raw = JSON.parse(localStorage.getItem(sendKey(handle)) || "[]");
      const cutoff = Date.now() - 60 * 60 * 1000;
      return raw.filter((t) => t > cutoff);
    } catch (_) { return []; }
  }

  function rateGate(handle) {
    const sends = recentSends(handle);
    const last = sends[sends.length - 1];
    if (last && Date.now() - last < COOLDOWN_MS) {
      const secs = Math.ceil((COOLDOWN_MS - (Date.now() - last)) / 1000);
      return { ok: false, reason: "Give it " + secs + "s before the next note." };
    }
    if (sends.length >= HOURLY_CAP) {
      return { ok: false, reason: "That's a lot of notes — take a short break." };
    }
    return { ok: true };
  }

  function recordSend(handle) {
    const sends = recentSends(handle);
    sends.push(Date.now());
    try { localStorage.setItem(sendKey(handle), JSON.stringify(sends)); } catch (_) {}
  }
})();
