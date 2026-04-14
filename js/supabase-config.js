// ═══════════════════════════════════════════════════════════
// SUPABASE CONFIG — Preencha com seus dados do projeto
// Dashboard: https://supabase.com/dashboard → Settings → API
// ═══════════════════════════════════════════════════════════

const SUPABASE_URL  = 'https://pfkysmpmoxpzncdifawd.supabase.co';
const SUPABASE_ANON = 'sb_publishable_kS3Lc9mI8fDwGLhSn_ihlw_L7IGjXL8';

// Inicializa o client — variável "db" para não conflitar com o CDN global "supabase"
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Helpers ──────────────────────────────────────────────

/**
 * Gera slug a partir de um título
 * "Meu Artigo Legal!" → "meu-artigo-legal"
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);
}

/**
 * Formata data para exibição: "15 Mar 2026"
 */
function formatDate(dateStr) {
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2,'0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Formata data para input datetime-local
 */
function formatDateInput(dateStr) {
  const d = new Date(dateStr);
  return d.toISOString().slice(0, 16);
}

/**
 * Verifica se o usuário está autenticado, redireciona se não
 */
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    window.location.href = '/admin/index.html';
    return null;
  }
  return session;
}