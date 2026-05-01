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
      const dateEl = document.getElementById('published_date');
      const timeEl = document.getElementById('published_time');
      const dateBrEl = document.getElementById('published_date_br');
      const timeBrEl = document.getElementById('published_time_br');
      const legacyEl = document.getElementById('published_at');
      if (dateEl && timeEl) {
        const parts = splitDateTimeForInputs(data.published_at);
        dateEl.value = parts.date;     // ISO (yyyy-mm-dd)
        timeEl.value = parts.time;     // HH:MM
        if (dateBrEl) dateBrEl.value = isoDateToBr(parts.date);  // dd/mm/yyyy
        if (timeBrEl) timeBrEl.value = parts.time;
      } else if (legacyEl) {
        legacyEl.value = formatDateInput(data.published_at);
      }
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

  // Combina data + hora em ISO. Se vazio, usa agora.
  const dateBrEl = document.getElementById('published_date_br');
  const timeBrEl = document.getElementById('published_time_br');
  const legacyEl = document.getElementById('published_at');

  let publishedAtIso;
  if (dateBrEl) {
    // Lê dos inputs visíveis em BR e converte
    const dateBr = (dateBrEl.value || '').trim();
    const timeBr = (timeBrEl ? timeBrEl.value : '').trim();

    if (!dateBr) {
      publishedAtIso = new Date().toISOString();
    } else {
      const isoDate = brDateToIso(dateBr);
      if (!isoDate) {
        toast('Data inválida. Use o formato dd/mm/aaaa.', 'error');
        btn.disabled = false;
        btn.textContent = editingId ? 'Salvar Alterações' : 'Salvar Publicação';
        return;
      }
      // Valida hora se preenchida
      let timeFinal = '12:00';
      if (timeBr) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeBr)) {
          toast('Hora inválida. Use o formato 24h (ex: 16:00).', 'error');
          btn.disabled = false;
          btn.textContent = editingId ? 'Salvar Alterações' : 'Salvar Publicação';
          return;
        }
        timeFinal = timeBr;
      }
      publishedAtIso = combineDateTimeToIso(isoDate, timeFinal);
    }
  } else if (legacyEl) {
    publishedAtIso = legacyEl.value
      ? new Date(legacyEl.value).toISOString()
      : new Date().toISOString();
  } else {
    publishedAtIso = new Date().toISOString();
  }

  const payload = {
    title,
    slug,
    tag,
    excerpt,
    content:      document.getElementById('content').value.trim(),
    image_url:    document.getElementById('image_url').value.trim() || null,
    published:    isPublished,
    published_at: publishedAtIso,
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

    // Mensagem inteligente: agendado/publicado/rascunho
    let successMsg;
    if (!isPublished) {
      successMsg = editingId ? 'Rascunho atualizado!' : 'Rascunho salvo!';
    } else {
      const isFuture = new Date(publishedAtIso) > new Date();
      if (isFuture) {
        const d = new Date(publishedAtIso);
        const dateStr = d.toLocaleDateString('pt-BR') + ' às ' + d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
        successMsg = '📅 Agendado para ' + dateStr;
      } else {
        successMsg = editingId ? 'Publicação atualizada!' : 'Publicação criada!';
      }
    }
    toast(successMsg, 'success');

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

    // Validação de proporção ANTES de fazer upload
    const validation = await validateImageRatio(file);
    if (validation.status === 'blocked') {
      toast(validation.message, 'error');
      return;
    }
    if (validation.status === 'warning') {
      const proceed = confirm(
        validation.message + '\n\nDeseja enviar mesmo assim? A imagem pode aparecer cortada ou com tamanho diferente das demais.'
      );
      if (!proceed) return;
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
      showImageWarning(validation); // mostra aviso inline se houver
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

// ── Validação de proporção da imagem ───────────────────────
// Proporção ideal: 16/10 (1.6). Aceitável: 16/9 (~1.78) a 4/3 (~1.33).
function validateImageRatio(fileOrUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const ratio = w / h;

      // Alvo e limites
      const TARGET = 16 / 10;        // 1.60
      const MAX_RATIO = 16 / 9;      // 1.78  (mais largo que isso → avisa)
      const MIN_RATIO = 4 / 3;       // 1.33  (mais alto que isso → avisa)
      const HARD_MIN = 1;            // 1:1 → quadrado — a partir daqui bloqueia
      const HARD_MAX = 2.5;          // super panorâmico → bloqueia

      const info = w + '×' + h + 'px (proporção ' + ratio.toFixed(2) + ':1)';

      // Resolução mínima
      if (w < 800 || h < 500) {
        resolve({
          status: 'blocked',
          ratio, w, h,
          message: 'Imagem muito pequena: ' + info + '. Envie uma imagem com pelo menos 800×500px.',
        });
        return;
      }

      // Proporção extrema — bloquear
      if (ratio < HARD_MIN || ratio > HARD_MAX) {
        resolve({
          status: 'blocked',
          ratio, w, h,
          message: 'Proporção incompatível: ' + info + '. Use uma imagem entre 4:3 e 16:9 (ideal: 16:10, ex: 1600×1000px).',
        });
        return;
      }

      // Fora do ideal mas aceitável — avisar
      if (ratio > MAX_RATIO || ratio < MIN_RATIO) {
        resolve({
          status: 'warning',
          ratio, w, h,
          message: 'Atenção: a imagem é ' + info + ', fora da proporção recomendada (16:10). Pode aparecer cortada ou em tamanho diferente das demais publicações.',
        });
        return;
      }

      // Tudo ok
      resolve({
        status: 'ok',
        ratio, w, h,
        message: 'Imagem válida (' + info + ').',
      });
    };
    img.onerror = () => {
      resolve({
        status: 'blocked',
        message: 'Não foi possível ler a imagem. Verifique o arquivo ou a URL.',
      });
    };

    if (fileOrUrl instanceof File) {
      img.src = URL.createObjectURL(fileOrUrl);
    } else {
      img.crossOrigin = 'anonymous';
      img.src = fileOrUrl;
    }
  });
}

// ── Exibe aviso inline sobre a imagem ──────────────────────
function showImageWarning(validation) {
  const warn = document.getElementById('image-warning');
  if (!warn) return;
  if (validation.status === 'warning') {
    warn.textContent = '⚠ ' + validation.message;
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
    warn.textContent = '';
  }
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
  let urlValidationTimer;
  document.getElementById('image_url').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (!url) {
      hideImagePreview();
      showImageWarning({ status: 'ok' });
      return;
    }
    showImagePreview(url);
    // Debounce — só valida 600ms após parar de digitar
    clearTimeout(urlValidationTimer);
    urlValidationTimer = setTimeout(async () => {
      const validation = await validateImageRatio(url);
      if (validation.status === 'blocked') {
        showImageWarning({
          status: 'warning',
          message: validation.message,
        });
      } else {
        showImageWarning(validation);
      }
    }, 600);
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

// ── Helpers de data/hora (formato BR, 24h) ─────────────────
// Divide um ISO em { date: 'YYYY-MM-DD', time: 'HH:MM' } no timezone local
function splitDateTimeForInputs(isoStr) {
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    time: pad(d.getHours()) + ':' + pad(d.getMinutes()),
  };
}

// Combina os dois inputs em um ISO. Se date vazio, usa agora.
// Se date presente e time vazio, usa 12:00 como padrão.
function combineDateTimeToIso(dateStr, timeStr) {
  if (!dateStr) return new Date().toISOString();
  const time = timeStr || '12:00';
  // Constrói no timezone local e converte para ISO (UTC)
  const local = new Date(dateStr + 'T' + time + ':00');
  if (isNaN(local.getTime())) return new Date().toISOString();
  return local.toISOString();
}

// ── Conversões BR ↔ ISO ──────────────────────────────────
// "2026-04-15" → "15/04/2026"
function isoDateToBr(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return '';
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

// "15/04/2026" → "2026-04-15" (ou null se inválida)
function brDateToIso(brDate) {
  if (!brDate) return null;
  const m = brDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  if (year < 1900 || year > 2100) return null;
  // Valida data real (não 31/02 etc)
  const test = new Date(year, month - 1, day);
  if (test.getFullYear() !== year || test.getMonth() !== month - 1 || test.getDate() !== day) {
    return null;
  }
  return m[3] + '-' + m[2] + '-' + m[1];
}

// ── Máscaras de input (formato BR + 24h) ─────────────────
function setupDateMasks() {
  const dateBr = document.getElementById('published_date_br');
  const timeBr = document.getElementById('published_time_br');
  if (!dateBr || !timeBr) return;

  // Máscara de data: dd/mm/aaaa
  dateBr.addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = '';
    if (v.length > 0) formatted = v.slice(0, 2);
    if (v.length >= 3) formatted += '/' + v.slice(2, 4);
    if (v.length >= 5) formatted += '/' + v.slice(4, 8);
    e.target.value = formatted;
  });

  // Máscara de hora: HH:MM (24h, máx 23:59)
  timeBr.addEventListener('input', function(e) {
    let v = e.target.value.replace(/\D/g, '').slice(0, 4);
    // Auto-corrige: se primeiro dígito > 2, prepend "0"
    if (v.length === 1 && parseInt(v, 10) > 2) v = '0' + v;
    // Auto-corrige: se HH > 23, limita
    if (v.length >= 2) {
      const hh = parseInt(v.slice(0, 2), 10);
      if (hh > 23) v = '23' + v.slice(2);
    }
    // Auto-corrige: se MM > 59, limita
    if (v.length >= 4) {
      const mm = parseInt(v.slice(2, 4), 10);
      if (mm > 59) v = v.slice(0, 2) + '59';
    }
    let formatted = '';
    if (v.length > 0) formatted = v.slice(0, 2);
    if (v.length >= 3) formatted += ':' + v.slice(2, 4);
    e.target.value = formatted;
  });

  // Validação ao sair do campo (visual feedback)
  dateBr.addEventListener('blur', function(e) {
    const val = e.target.value.trim();
    if (val && !brDateToIso(val)) {
      e.target.style.borderColor = '#e05555';
    } else {
      e.target.style.borderColor = '';
    }
  });
  timeBr.addEventListener('blur', function(e) {
    const val = e.target.value.trim();
    if (val && !/^([01]\d|2[0-3]):[0-5]\d$/.test(val)) {
      e.target.style.borderColor = '#e05555';
    } else {
      e.target.style.borderColor = '';
    }
  });
}

// ── Inicializa ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  initEditor();
  setupDateMasks();
});