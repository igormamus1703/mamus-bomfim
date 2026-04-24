// ═══════════════════════════════════════════════════════════
// DASHBOARD — Lista, busca, filtra e deleta publicações
// ═══════════════════════════════════════════════════════════

let allPublications = [];

// ── Inicialização ──────────────────────────────────────────
async function initDashboard() {
  const session = await requireAuth();
  if (!session) return;

  loadUserInfo();
  await loadPublications();
  setupSearch();
  setupFilter();
}

// ── Carregar publicações ───────────────────────────────────
async function loadPublications() {
  const tbody = document.getElementById('pub-tbody');
  tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;"><span class="spinner"></span></td></tr>`;

  try {
    const { data, error } = await db
      .from('publications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    allPublications = data || [];
    renderTable(allPublications);
    updateStats(allPublications);
  } catch (err) {
    console.error(err);
    toast('Erro ao carregar publicações.', 'error');
  }
}

// ── Renderizar tabela ──────────────────────────────────────
function renderTable(pubs) {
  const tbody = document.getElementById('pub-tbody');

  if (pubs.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" class="table-empty">
        Nenhuma publicação encontrada.
      </td></tr>`;
    return;
  }

  tbody.innerHTML = pubs.map(pub => `
    <tr data-id="${pub.id}">
      <td class="td-title">${pub.title}</td>
      <td><span class="td-tag" data-tag="${pub.tag}">${pub.tag}</span></td>
      <td>${formatDateTime(pub.published_at)}</td>
      <td>
        <span class="td-status">
          <span class="td-status-dot ${pub.published ? 'published' : 'draft'}"></span>
          ${pub.published ? 'Publicado' : 'Rascunho'}
        </span>
      </td>
      <td>
        <div class="td-actions">
          <button onclick="editPublication('${pub.id}')">Editar</button>
          <button class="delete" onclick="confirmDelete('${pub.id}', '${pub.title.replace(/'/g, "\\'")}')">Excluir</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── Atualizar estatísticas ─────────────────────────────────
function updateStats(pubs) {
  document.getElementById('stat-total').textContent    = pubs.length;
  document.getElementById('stat-published').textContent = pubs.filter(p => p.published).length;
  document.getElementById('stat-draft').textContent     = pubs.filter(p => !p.published).length;
}

// ── Busca ──────────────────────────────────────────────────
function setupSearch() {
  const input = document.getElementById('search-input');
  input.addEventListener('input', debounce(() => filterAndRender(), 250));
}

// ── Filtro por tag ─────────────────────────────────────────
function setupFilter() {
  const select = document.getElementById('filter-tag');
  select.addEventListener('change', () => filterAndRender());
}

function filterAndRender() {
  const query = document.getElementById('search-input').value.toLowerCase();
  const tag   = document.getElementById('filter-tag').value;

  let filtered = allPublications;

  if (query) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.excerpt.toLowerCase().includes(query)
    );
  }

  if (tag) {
    filtered = filtered.filter(p => p.tag === tag);
  }

  renderTable(filtered);
}

// ── Editar ─────────────────────────────────────────────────
function editPublication(id) {
  console.log('[Dashboard] Edit clicked — id:', id);
  // Salva ID no sessionStorage como fallback
  sessionStorage.setItem('editPublicationId', id);
  window.location.href = '/admin/editor.html?id=' + encodeURIComponent(id);
}

// ── Excluir com confirmação ────────────────────────────────
let deleteTargetId = null;

function confirmDelete(id, title) {
  deleteTargetId = id;
  document.getElementById('dialog-title').textContent = title;
  document.getElementById('confirm-dialog').classList.add('open');
}

function closeDialog() {
  document.getElementById('confirm-dialog').classList.remove('open');
  deleteTargetId = null;
}

async function executeDelete() {
  if (!deleteTargetId) return;

  try {
    const { error } = await db
      .from('publications')
      .delete()
      .eq('id', deleteTargetId);

    if (error) throw error;

    toast('Publicação excluída com sucesso.', 'success');
    closeDialog();
    await loadPublications();
  } catch (err) {
    console.error(err);
    toast('Erro ao excluir publicação.', 'error');
  }
}

// ── Toast notifications ────────────────────────────────────
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

// ── Debounce ───────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// ── Inicializa ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initDashboard);