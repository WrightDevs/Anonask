/* ============================================================
   AnonAsk — shared UI helpers
   ============================================================ */

// The masquerade veil: our recurring mark for an anonymous sender.
window.VEIL_SVG =
  '<svg viewBox="0 0 48 26" aria-hidden="true">' +
  '<path fill="currentColor" fill-rule="evenodd" d="' +
  'M4 8 C14 2 34 2 44 8 C45 16 40 22 30 22 C26 22 25 18 24 18 C23 18 22 22 18 22 C8 22 3 16 4 8 Z ' +
  'M12 12 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z ' +
  'M28 12 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z"/></svg>';

window.veilTile = function veilTile(size) {
  const cls = size === "lg" ? "veil lg" : "veil";
  return '<span class="' + cls + '">' + window.VEIL_SVG + "</span>";
};

// Escape untrusted text before putting it in innerHTML.
window.esc = function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

// Human-friendly relative time, e.g. "2 minutes ago".
window.timeAgo = function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const secs = Math.max(1, Math.round((Date.now() - then) / 1000));
  const units = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [name, size] of units) {
    const v = Math.floor(secs / size);
    if (v >= 1) return v + " " + name + (v > 1 ? "s" : "") + " ago";
  }
  return "just now";
};

// Toast notifications.
window.toast = function toast(msg, type) {
  let host = document.querySelector(".toast-host");
  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast" + (type === "err" ? " err" : "");
  el.setAttribute("role", "status");
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s, transform .3s";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 320);
  }, 2600);
};

// The public link for a given handle, based on where the app is hosted.
window.linkFor = function linkFor(handle) {
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  return base + "send.html?u=" + encodeURIComponent(handle);
};
