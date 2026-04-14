// ═══════════════════════════════════════════════════════════
// EDITOR — Criar e editar publicações
// ═══════════════════════════════════════════════════════════

let editingId  = null;
let isPublished = false;

// ── Inicialização ──────────────────────────────────────────
async function initEditor() {
  try {
    const session = await requireAuth();
    if (!session) return;

    loadUserInfo();
    setupToggle();
    setupSlugGeneration();
    setupImagePreview();

    // Se tem ?id= na URL, carrega publicação existente
    const params = new URLSearchParams(window.location.search);
    let id = params.get('id');

    // Fallback: se URL não trouxe o ID, tenta sessionStorage
    if (!id) {
      id = sessionStorage.getItem('editPublicationId');
      console.log('[Editor] URL sem id, fallback sessionStorage:', id);
    }

    // Limpa sessionStorage após uso
    sessionStorage.removeItem('editPublicationId');

    console.log('[Editor] Init — full URL:', window.location.href);
    console.log('[Editor] Init — search:', window.location.search);
    console.log('[Editor] Init — id final:', id);

    if (id) {
      editingId = id;
      document.getElementById('editor-heading').innerHTML = 'Editar <em>Publicação</em>';
      document.getElementById('save-btn').textContent = 'Salvar Alterações';

      // Mostra loading no formulário
      document.getElementById('save-btn').disabled = true;
      document.getElementById('save-btn').innerHTML = '<span class="spinner"></span> Carregando...';

      await loadPublication(id);

      document.getElementById('save-btn').disabled = false;
      document.getElementById('save-btn').textContent = 'Salvar Alterações';
    }
  } catch (err) {
    console.error('[Editor] Init error:', err);
    toast('Erro ao inicializar o editor.', 'error');
  }
}

// ── Carregar publicação para edição ────────────────────────
async function loadPublication(id) {
  console.log('[Editor] Loading publication:', id);

  try {
    const { data, error } = await db
      .from('publications')
      .select('*')
      .eq('id', id)
      .single();

    console.log('[Editor] Query result — data:', data, 'error:', error);

    if (error) {
      console.error('[Editor] Supabase error:', error);
      if (error.code === 'PGRST116') {
        toast('Publicação não encontrada. Verifique se existe no banco.', 'error');
      } else {
        toast('Erro ao carregar: ' + error.message, 'error');
      }
      return;
    }

    if (!data) {
      toast('Publicação não encontrada.', 'error');
      return;
    }

    // Popula o formulário
    document.getElementById('title').value        = data.title || '';
    document.getElementById('slug').value         = data.slug || '';
    document.getElementById('tag').value          = data.tag || '';
    document.getElementById('excerpt').value      = data.excerpt || '';
    document.getElementById('content').value      = data.content || '';
    document.getElementById('image_url').value    = data.image_url || '';

    if (data.published_at) {
      document.getElementById('published_at').value = formatDateInput(data.published_at);
    }

    isPublished = data.published || false;
    updateToggleUI();

    if (data.image_url) {
      showImagePreview(data.image_url);
    }

    console.log('[Editor] Loaded:', data.title);
    toast('Publicação carregada.', 'success');

  } catch (err) {
    console.error('[Editor] Catch error:', err);
    toast('Erro inesperado ao carregar publicação.', 'error');
  }
}

// ── Salvar (criar ou atualizar) ────────────────────────────
async function handleSave(e) {
  e.preventDefault();

  const title   = document.getElementById('title').value.trim();
  const slug    = document.getElementById('slug').value.trim();
  const tag     = document.getElementById('tag').value;
  const excerpt = document.getElementById('excerpt').value.trim();

  if (!title || !slug || !tag || !excerpt) {
    toast('Preencha todos os campos obrigatórios.', 'error');
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Salvando...';

  const payload = {
    title,
    slug,
    tag,
    excerpt,
    content:      document.getElementById('content').value.trim(),
    image_url:    document.getElementById('image_url').value.trim() || null,
    published:    isPublished,
    published_at: document.getElementById('published_at').value
                    ? new Date(document.getElementById('published_at').value).toISOString()
                    : new Date().toISOString(),
  };

  console.log('[Editor] Saving —', editingId ? 'UPDATE' : 'INSERT', payload);

  try {
    let result;

    if (editingId) {
      result = await db
        .from('publications')
        .update(payload)
        .eq('id', editingId)
        .select()
        .single();
    } else {
      result = await db
        .from('publications')
        .insert(payload)
        .select()
        .single();
    }

    console.log('[Editor] Save result:', result);

    if (result.error) {
      if (result.error.code === '23505') {
        toast('Já existe uma publicação com este slug. Altere o slug.', 'error');
        btn.disabled = false;
        btn.textContent = editingId ? 'Salvar Alterações' : 'Salvar Publicação';
        return;
      }
      throw result.error;
    }

    toast(editingId ? 'Publicação atualizada!' : 'Publicação criada!', 'success');

    setTimeout(() => {
      window.location.href = '/admin/dashboard.html';
    }, 1200);

  } catch (err) {
    console.error('[Editor] Save error:', err);
    toast('Erro ao salvar. Tente novamente.', 'error');
    btn.disabled = false;
    btn.textContent = editingId ? 'Salvar Alterações' : 'Salvar Publicação';
  }
}

// ── Upload de imagem para Supabase Storage ─────────────────
async function handleImageUpload() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limite: 5MB (Supabase free permite até 50MB, mas para web 5MB é ideal)
    const MAX_SIZE_MB = 5;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast('Imagem muito grande. Máximo: ' + MAX_SIZE_MB + 'MB.', 'error');
      return;
    }

    const uploadBtn = document.getElementById('upload-btn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const ext = file.name.split('.').pop().toLowerCase();
      const fileName = Date.now() + '-' + Math.random().toString(36).slice(2,8) + '.' + ext;
      const filePath = 'publications/' + fileName;

      console.log('[Editor] Uploading:', filePath, '(' + (file.size / 1024 / 1024).toFixed(2) + 'MB)');

      const { data, error } = await db.storage
        .from('publication-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = db.storage
        .from('publication-images')
        .getPublicUrl(filePath);

      const url = urlData.publicUrl;
      document.getElementById('image_url').value = url;
      showImagePreview(url);
      toast('Imagem enviada!', 'success');
      console.log('[Editor] Upload OK:', url);

    } catch (err) {
      console.error('[Editor] Upload error:', err);
      toast('Erro no upload: ' + (err.message || 'Tente colar a URL manualmente.'), 'error');
    }

    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload';
  };

  input.click();
}

// ── Toggle publicado/rascunho ──────────────────────────────
function setupToggle() {
  document.getElementById('toggle-published').addEventListener('click', () => {
    isPublished = !isPublished;
    updateToggleUI();
  });
}

function updateToggleUI() {
  const track = document.querySelector('.toggle-track');
  const label = document.querySelector('.toggle-label');
  track.classList.toggle('active', isPublished);
  label.textContent = isPublished ? 'Publicado' : 'Rascunho';
}

// ── Auto-gerar slug a partir do título ─────────────────────
function setupSlugGeneration() {
  const titleInput = document.getElementById('title');
  const slugInput  = document.getElementById('slug');

  titleInput.addEventListener('input', () => {
    if (!editingId || !slugInput.value) {
      slugInput.value = generateSlug(titleInput.value);
    }
  });
}

// ── Preview de imagem ──────────────────────────────────────
function setupImagePreview() {
  document.getElementById('image_url').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    url ? showImagePreview(url) : hideImagePreview();
  });
}

function showImagePreview(url) {
  const preview = document.getElementById('image-preview');
  preview.innerHTML = '<img src="' + url + '" alt="Preview" style="width:100%;height:160px;object-fit:cover;border-radius:6px;border:1px solid var(--gold-line);" onerror="this.style.display=\'none\'">';
  preview.style.display = 'block';
}

function hideImagePreview() {
  const preview = document.getElementById('image-preview');
  preview.innerHTML = '';
  preview.style.display = 'none';
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type) {
  type = type || 'success';
  var container = document.getElementById('toast-container');
  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(function() {
    el.classList.add('hide');
    setTimeout(function() { el.remove(); }, 300);
  }, 3500);
}

// ── Inicializa ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initEditor);