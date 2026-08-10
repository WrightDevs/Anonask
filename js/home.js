/* ============================================================
   AnonAsk — home.js
   Landing page: rotate the question on the share sticker, wire the
   mask marks, and swap the nav CTA if already logged in.
   ============================================================ */

// Fill in the mask marks.
document.getElementById("brand-veil").innerHTML = window.VEIL_SVG;
document.getElementById("sticker-veil").innerHTML = window.VEIL_SVG;

// If a returning owner lands here while logged in, send them to their inbox.
(async function () {
  if (window.SUPABASE_CONFIGURED && window.sb) {
    try {
      const { data } = await sb.auth.getUser();
      if (data && data.user) {
        const nav = document.querySelector(".topbar nav");
        if (nav) {
          nav.innerHTML =
            '<a class="btn btn-gold btn-sm" href="dashboard.html">Go to my inbox →</a>';
        }
      }
    } catch (_) {}
  } else {
    document.documentElement.classList.add("needs-config");
  }
})();

// Whispered questions cycle through the hero.
const QUESTIONS = [
  "Who was your first crush?",
  "What's your biggest goal this year?",
  "What do you admire about me?",
  "What's something you never told me?",
  "If you could ask me anything, what?",
  "What's the one goal you're too scared to say out loud?",
];

const qEl = document.getElementById("whisper-q");
if (qEl && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % QUESTIONS.length;
    qEl.style.animation = "none";
    // force reflow so the animation restarts
    void qEl.offsetWidth;
    qEl.textContent = QUESTIONS[i];
    qEl.classList.add("whisper-in");
    qEl.style.animation = "";
  }, 3200);
}
