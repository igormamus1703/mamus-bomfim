// ═══════════════════════════════════════════════════════════
// AUTH — Login, logout e sessão
// ═══════════════════════════════════════════════════════════

// ── Login ──────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();

  const email    = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (!email || !password) {
    showLoginError('Preencha todos os campos.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Entrando...';
  errEl.style.display = 'none';

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    window.location.href = '/admin/dashboard.html';
  } catch (err) {
    showLoginError(translateAuthError(err.message));
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

// ── Logout ─────────────────────────────────────────────────
async function handleLogout() {
  await db.auth.signOut();
  window.location.href = '/admin/index.html';
}

// ── Helpers ────────────────────────────────────────────────
function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function translateAuthError(msg) {
  const map = {
    'Invalid login credentials': 'Email ou senha incorretos.',
    'Email not confirmed': 'Confirme seu email antes de fazer login.',
    'Too many requests': 'Muitas tentativas. Aguarde e tente novamente.',
  };
  return map[msg] || 'Erro ao fazer login. Tente novamente.';
}

// ── Carrega dados do usuário no header ─────────────────────
async function loadUserInfo() {
  const el = document.getElementById('user-email');
  if (!el) return;

  const { data: { session } } = await db.auth.getSession();
  if (session?.user) {
    el.textContent = session.user.email;
  }
}