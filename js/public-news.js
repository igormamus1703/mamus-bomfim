// ═══════════════════════════════════════════════════════════
// PUBLIC NEWS — Carrega publicações no site público
// ═══════════════════════════════════════════════════════════

// Armazena dados completos das publicações para o modal
window._publicationsData = [];

(async function loadPublications() {
  const container = document.getElementById('news-grid');
  if (!container) return;

  // Verifica se o config foi preenchido
  if (SUPABASE_URL.includes('SEU-PROJETO') || SUPABASE_ANON.includes('sua-anon-key')) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:60px 0;">
        <p style="font-family:var(--sans); color:rgba(224,85,85,0.7); font-size:14px; margin-bottom:8px;">
          ⚠ Supabase não configurado
        </p>
        <p style="font-family:var(--sans); color:var(--text-dim); font-size:12px;">
          Edite o arquivo <strong>js/supabase-config.js</strong> com sua URL e Publishable Key
        </p>
      </div>`;
    console.warn('Supabase config não preenchido. Edite js/supabase-config.js');
    return;
  }

  // Skeleton loading
  container.innerHTML = Array(3).fill('').map(function(_, i) {
    return '<article class="news-card reveal visible" style="transition-delay:' + (i * 150) + 'ms">' +
      '<div class="news-card-img"><div class="img-slot skeleton-pulse" style="aspect-ratio:16/10"></div></div>' +
      '<div class="news-card-body">' +
        '<div class="skeleton-line" style="width:60%;height:12px;margin-bottom:18px"></div>' +
        '<div class="skeleton-line" style="width:100%;height:18px;margin-bottom:8px"></div>' +
        '<div class="skeleton-line" style="width:80%;height:18px;margin-bottom:16px"></div>' +
        '<div class="skeleton-line" style="width:90%;height:12px"></div>' +
      '</div></article>';
  }).join('');

  try {
    // Filtro inteligente: published=true E data já passou
    // (Posts agendados com data futura ficam ocultos até a hora chegar — sem cron necessário)
    var nowIso = new Date().toISOString();
    var result = await db
      .from('publications')
      .select('id, title, slug, tag, excerpt, content, image_url, published_at')
      .eq('published', true)
      .lte('published_at', nowIso)
      .order('published_at', { ascending: false })
      .limit(3);

    if (result.error) throw result.error;

    var data = result.data;

    if (!data || data.length === 0) {
      container.innerHTML =
        '<div style="grid-column: 1/-1; text-align:center; padding:80px 0;">' +
          '<p style="font-family:var(--sans); color:var(--text-dim); font-size:15px;">' +
            'Nenhuma publicação disponível no momento.' +
          '</p></div>';
      return;
    }

    // Salva dados para o modal
    window._publicationsData = data;

    container.innerHTML = data.map(function(pub, i) {
      var imgHtml = pub.image_url
        ? '<img src="' + pub.image_url + '" alt="' + pub.title + '" style="width:100%;height:100%;object-fit:cover;aspect-ratio:16/10;display:block;transition:transform 1s var(--ease-out);">'
        : '<div class="img-slot" style="aspect-ratio:16/10">' +
            '<svg class="img-slot-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>' +
            '<span class="img-slot-label">Imagem — ' + pub.tag + '</span></div>';

      var featuredBadge = (i === 0)
        ? '<span class="news-featured-badge">Mais Recente</span>'
        : '';

      return '<article class="news-card reveal" style="transition-delay:' + (i * 150) + 'ms" data-pub-id="' + pub.id + '">' +
        '<div class="news-card-img">' + featuredBadge + imgHtml + '</div>' +
        '<div class="news-card-body">' +
          '<div class="news-card-meta">' +
            '<span class="news-tag">' + pub.tag + '</span>' +
            '<span class="news-date">' + formatDate(pub.published_at) + '</span>' +
          '</div>' +
          '<h3 class="news-title">' + pub.title + '</h3>' +
          '<p class="news-excerpt">' + pub.excerpt + '</p>' +
          '<span style="font-family:var(--sans);font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin-top:16px;display:inline-block;opacity:0.6;transition:opacity 0.3s;">Ler mais →</span>' +
        '</div></article>';
    }).join('');

    // Scroll reveal
    var newCards = container.querySelectorAll('.reveal');
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    newCards.forEach(function(el) { observer.observe(el); });

    // Click handler — abre modal
    container.querySelectorAll('.news-card[data-pub-id]').forEach(function(card) {
      card.addEventListener('click', function() {
        var pubId = card.getAttribute('data-pub-id');
        var pub = window._publicationsData.find(function(p) { return p.id === pubId; });
        if (pub) openNewsModal(pub);
      });
    });

  } catch (err) {
    console.error('Erro ao carregar publicações:', err);
    container.innerHTML =
      '<div style="grid-column: 1/-1; text-align:center; padding:60px 0;">' +
        '<p style="font-family:var(--sans); color:rgba(224,85,85,0.7); font-size:14px; margin-bottom:8px;">⚠ Erro ao conectar com o banco de dados</p>' +
        '<p style="font-family:var(--sans); color:var(--text-dim); font-size:12px;">Verifique as chaves no arquivo supabase-config.js</p>' +
      '</div>';
  }
})();