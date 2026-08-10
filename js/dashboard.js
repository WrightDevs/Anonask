/* ============================================================
   AnonAsk — dashboard.js
   The private inbox: load notes, keep them live, and let the
   owner read / delete / report. Sender identity never exists here.
   ============================================================ */

(function () {
  // veils
  ["brand-veil", "load-veil", "claim-veil", "empty-veil"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = window.VEIL_SVG;
  });

  const el = (id) => document.getElementById(id);
  const loadingEl = el("loading");
  const claimEl   = el("claim");
  const dashEl    = el("dash");
  const inboxEl   = el("inbox");
  const emptyEl   = el("empty");

  let me = null;        // { user, profile }
  let messages = [];    // active notes, newest first
  let filter = "all";

  el("logout-btn").addEventListener("click", () => Auth.logout());

  init();

  async function init() {
    const session = await Auth.guard();      // redirects to login if needed
    if (!session) return;                    // (config missing or not logged in)
    me = session;

    if (!me.profile) {
      loadingEl.classList.add("hidden");
      showClaim();
      return;
    }

    loadingEl.classList.add("hidden");
    dashEl.classList.remove("hidden");
    paintIdentity();
    wireShare();
    wireFilters();
    await loadMessages();
    subscribeRealtime();
  }

  /* ---------- identity + share ---------- */
  function paintIdentity() {
    el("hello-name").textContent = me.profile.display_name || me.profile.username;
    const link = window.linkFor(me.profile.username);
    el("link-box").innerHTML =
      window.esc(link).replace(
        "u=" + window.esc(me.profile.username),
        'u=<span class="u">' + window.esc(me.profile.username) + "</span>"
      );
    el("link-box").dataset.link = link;
  }

  function wireShare() {
    const link = el("link-box").dataset.link;
    el("copy-btn").addEventListener("click", () => copyLink(link));
    el("empty-copy").addEventListener("click", () => copyLink(link));
    el("share-btn").addEventListener("click", async () => {
      const shareData = {
        title: "Send me an anonymous message",
        text: "Send me an anonymous message 👀",
        url: link,
      };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (_) {}
      } else {
        copyLink(link);
      }
    });
  }

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link);
      window.toast("Link copied — go share it ✦");
    } catch (_) {
      // Fallback for older browsers / file:// context
      const t = document.createElement("textarea");
      t.value = link; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); window.toast("Link copied ✦"); }
      catch (e) { window.toast("Copy failed — select and copy manually", "err"); }
      t.remove();
    }
  }

  /* ---------- filters ---------- */
  function wireFilters() {
    el("filter-all").addEventListener("click", () => setFilter("all"));
    el("filter-unread").addEventListener("click", () => setFilter("unread"));
    el("refresh-btn").addEventListener("click", () => loadMessages());
  }
  function setFilter(f) {
    filter = f;
    el("filter-all").setAttribute("aria-pressed", String(f === "all"));
    el("filter-unread").setAttribute("aria-pressed", String(f === "unread"));
    render();
  }

  /* ---------- data ---------- */
  async function loadMessages() {
    inboxEl.setAttribute("aria-busy", "true");
    if (!messages.length) showSkeletons();
    try {
      const { data, error } = await sb
        .from("messages")
        .select("id, content, created_at, is_read, status")
        .eq("recipient_id", me.user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      messages = data || [];
      render();
    } catch (e) {
      window.toast("Couldn't load your notes. " + (e.message || ""), "err");
      inboxEl.innerHTML = "";
    } finally {
      inboxEl.removeAttribute("aria-busy");
    }
  }

  function subscribeRealtime() {
    try {
      sb.channel("inbox-" + me.user.id)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages",
            filter: "recipient_id=eq." + me.user.id },
          (payload) => {
            const m = payload.new;
            if (m.status === "active" && !messages.some((x) => x.id === m.id)) {
              messages.unshift(m);
              render();
              window.toast("A new note just arrived ✦");
            }
          }
        )
        .subscribe();
    } catch (_) {
      // Realtime not enabled — the refresh button still works.
    }
  }

  /* ---------- rendering ---------- */
  function unreadCount() { return messages.filter((m) => !m.is_read).length; }

  function render() {
    el("unread-count").textContent = String(unreadCount());

    const list = filter === "unread" ? messages.filter((m) => !m.is_read) : messages;

    if (!messages.length) {
      inboxEl.innerHTML = "";
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    if (!list.length) {
      inboxEl.innerHTML =
        '<div class="state" style="grid-column:1/-1"><h3>All caught up</h3><p>No unread notes right now.</p></div>';
      return;
    }

    inboxEl.innerHTML = list.map(noteCard).join("");
    list.forEach((m) => wireCard(m.id));
  }

  function noteCard(m) {
    return (
      '<article class="note msg' + (m.is_read ? "" : " is-unread") + '" data-id="' + m.id + '">' +
        '<div class="note-head">' +
          window.veilTile() +
          '<span class="note-from">Anonymous<small>sender hidden</small></span>' +
          '<span class="note-time">' + window.esc(window.timeAgo(m.created_at)) + "</span>" +
        "</div>" +
        '<p class="note-body">' + window.esc(m.content) + "</p>" +
        '<div class="msg-actions">' +
          (m.is_read ? "" : '<button class="btn" data-act="read">Mark read</button>') +
          '<span class="spacer"></span>' +
          '<button class="btn" data-act="report">Report</button>' +
          '<button class="btn danger" data-act="delete">Delete</button>' +
        "</div>" +
      "</article>"
    );
  }

  function wireCard(id) {
    const card = inboxEl.querySelector('[data-id="' + id + '"]');
    if (!card) return;
    card.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "read")   markRead(id);
        if (act === "delete") removeNote(id, "deleted");
        if (act === "report") removeNote(id, "reported");
      });
    });
    // Clicking the note body also marks it read.
    card.querySelector(".note-body").addEventListener("click", () => {
      const m = messages.find((x) => x.id === id);
      if (m && !m.is_read) markRead(id);
    });
  }

  /* ---------- actions ---------- */
  async function markRead(id) {
    const m = messages.find((x) => x.id === id);
    if (!m || m.is_read) return;
    m.is_read = true;               // optimistic
    render();
    const { error } = await sb.from("messages").update({ is_read: true }).eq("id", id);
    if (error) { m.is_read = false; render(); window.toast("Couldn't mark as read", "err"); }
  }

  async function removeNote(id, status) {
    const verb = status === "reported" ? "Report" : "Delete";
    const prompt = status === "reported"
      ? "Report this note and remove it from your inbox?"
      : "Delete this note for good?";
    if (!confirm(prompt)) return;

    const idx = messages.findIndex((x) => x.id === id);
    const backup = messages[idx];
    messages.splice(idx, 1);        // optimistic
    render();

    const { error } = await sb.from("messages").update({ status }).eq("id", id);
    if (error) {
      messages.splice(idx, 0, backup);
      render();
      window.toast(verb + " failed. " + (error.message || ""), "err");
    } else {
      window.toast(status === "reported" ? "Note reported and hidden" : "Note deleted");
    }
  }

  function showSkeletons() {
    inboxEl.innerHTML = '<div class="skeleton"></div>'.repeat(3);
  }

  /* ---------- claim-handle fallback ---------- */
  function showClaim() {
    claimEl.classList.remove("hidden");
    const input = el("claim-handle");
    const note  = el("claim-note");
    const btn   = el("claim-btn");

    input.addEventListener("input", () => {
      const norm = window.normalizeHandle(input.value);
      if (norm !== input.value) input.value = norm;
    });

    el("claim-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const handle = window.normalizeHandle(input.value);
      if (!window.HANDLE_RE.test(handle)) {
        note.textContent = "3–20 chars: lowercase letters, numbers, hyphens.";
        note.className = "field-note bad";
        return;
      }
      btn.disabled = true; btn.textContent = "Claiming…";
      try {
        if (!(await Auth.handleAvailable(handle))) {
          note.textContent = "“" + handle + "” is taken. Try another.";
          note.className = "field-note bad";
          btn.disabled = false; btn.textContent = "Claim handle";
          return;
        }
        const { error } = await sb.from("profiles").insert({
          id: me.user.id,
          username: handle,
          display_name: handle,
        });
        if (error) throw error;
        location.reload();
      } catch (err) {
        note.textContent = err.message || "Couldn't claim that handle.";
        note.className = "field-note bad";
        btn.disabled = false; btn.textContent = "Claim handle";
      }
    });
  }
})();
