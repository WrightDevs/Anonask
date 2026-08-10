

const SUPABASE_URL = "https://xjsvmckozntbhxfovura.supabase.co";      // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqc3ZtY2tvem50Ymh4Zm92dXJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDAwNDksImV4cCI6MjEwMTg3NjA0OX0.91PbWWqgKDBDorh525uecKaGZD21FGSoCeR_WtIUR-l-ihg0";    // starts with "eyJ..."

const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

let sb = null;
if (SUPABASE_CONFIGURED && window.supabase) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
window.sb = sb;
window.SUPABASE_CONFIGURED = SUPABASE_CONFIGURED;

window.requireConfig = function requireConfig() {
  if (!SUPABASE_CONFIGURED) {
    document.documentElement.classList.add("needs-config");
    return false;
  }
  return true;
};

// Handle rules: lowercase letters, numbers and hyphens, 3–20 chars.
window.HANDLE_RE = /^[a-z0-9-]{3,20}$/;
window.normalizeHandle = function normalizeHandle(raw) {
  return (raw || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 20);
};

window.MESSAGE_MAX = 500;
window.MESSAGE_MIN = 1;
