const KEY = 'medseg_zoo_v2';
    let models = [];
    let curFilter = 'all';
    let curDetailId = null;
    let editingId = null;
    let formImgs = [];
    let showNumbers = false;

    const BUILTIN_CATEGORIES = ['U-Net变体', 'CNN/FCN', 'Transformer', 'Attention', 'Foundation Model', 'Hybrid'];
    const CAT_COLOR_PRESETS = [
        { class: 'cat-unet', text: '#7ab8fc', bg: 'rgba(79,156,249,0.22)', cardBg: 'rgba(79,156,249,0.08)', colorHex: '#4f9cf9' },
        { class: 'cat-cnn', text: '#6ee7b7', bg: 'rgba(62,207,142,0.22)', cardBg: 'rgba(62,207,142,0.08)', colorHex: '#3ecf8e' },
        { class: 'cat-transformer', text: '#a78bfa', bg: 'rgba(124,92,252,0.22)', cardBg: 'rgba(167,139,250,0.08)', colorHex: '#a78bfa' },
        { class: 'cat-attention', text: '#fcd34d', bg: 'rgba(245,158,11,0.22)', cardBg: 'rgba(252,211,77,0.08)', colorHex: '#fcd34d' },
        { class: 'cat-foundation', text: '#fca5a5', bg: 'rgba(239,68,68,0.22)', cardBg: 'rgba(252,165,165,0.08)', colorHex: '#fca5a5' },
        { class: 'cat-hybrid', text: '#f9a8d4', bg: 'rgba(236,72,153,0.22)', cardBg: 'rgba(249,168,212,0.08)', colorHex: '#f9a8d4' },
        { class: 'cat-custom-1', text: '#93c5fd', bg: 'rgba(59,130,246,0.22)', cardBg: 'rgba(59,130,246,0.08)', colorHex: '#3b82f6' },
        { class: 'cat-custom-2', text: '#86efac', bg: 'rgba(34,197,94,0.22)', cardBg: 'rgba(34,197,94,0.08)', colorHex: '#22c55e' },
        { class: 'cat-custom-3', text: '#fde68a', bg: 'rgba(234,179,8,0.22)', cardBg: 'rgba(234,179,8,0.08)', colorHex: '#eab308' },
        { class: 'cat-custom-4', text: '#c4b5fd', bg: 'rgba(139,92,246,0.22)', cardBg: 'rgba(139,92,246,0.08)', colorHex: '#8b5cf6' },
        { class: 'cat-custom-5', text: '#fdba74', bg: 'rgba(249,115,22,0.22)', cardBg: 'rgba(249,115,22,0.08)', colorHex: '#f97316' },
        { class: 'cat-custom-6', text: '#67e8f9', bg: 'rgba(6,182,212,0.22)', cardBg: 'rgba(6,182,212,0.08)', colorHex: '#06b6d4' },
    ];

    function getCatPreset(cat) {
        const idx = BUILTIN_CATEGORIES.indexOf(cat);
        if (idx >= 0 && idx < 6) return CAT_COLOR_PRESETS[idx];
        let hash = 0;
        for (let i = 0; i < cat.length; i++) hash = ((hash << 5) - hash) + cat.charCodeAt(i);
        return CAT_COLOR_PRESETS[6 + (Math.abs(hash) % 6)];
    }
    function getCatClass(cat) { return getCatPreset(cat).class; }
    function getCatBadgeStyle(cat) { const p = getCatPreset(cat); return `background:${p.bg};color:${p.text}`; }

    function getAllCategories() {
        const cats = new Set(BUILTIN_CATEGORIES);
        models.forEach(m => { if (m.category) cats.add(m.category); });
        return [...cats].sort((a, b) => {
            const ai = BUILTIN_CATEGORIES.indexOf(a), bi = BUILTIN_CATEGORIES.indexOf(b);
            if (ai >= 0 && bi >= 0) return ai - bi;
            if (ai >= 0) return -1; if (bi >= 0) return 1;
            return a.localeCompare(b);
        });
    }

    function updateDatalist() {
        const dl = document.getElementById('catList');
        dl.innerHTML = getAllCategories().map(c => `<option value="${c}">`).join('');
    }

    function updateFilterButtons() {
        const group = document.getElementById('filterGroup');
        const cats = getAllCategories();
        if (curFilter !== 'all' && !cats.includes(curFilter)) curFilter = 'all';
        let html = `<button class="fb${curFilter==='all'?' active':''}" onclick="setFilter('all',this)">全部</button>`;
        cats.forEach(cat => {
            html += `<button class="fb${curFilter===cat?' active':''}" onclick="setFilter('${cat.replace(/'/g,"\\'")}',this)">${cat}</button>`;
        });
        group.innerHTML = html;
    }

    /* ── STORAGE ── */
    const REMOTE_URL = 'https://raw.githubusercontent.com/pu-meng/architecture-diagram/main/data.json';

    async function loadData() {
        const local = localStorage.getItem(KEY);
        if (local) { try { models = JSON.parse(local); } catch(e) { models = []; } }
        updateFilterButtons(); render();
        const syncEl = document.getElementById('syncStatus');
        try {
            const res = await fetch(REMOTE_URL + '?t=' + Date.now());
            if (res.ok) {
                const remote = await res.json();
                if (Array.isArray(remote) && remote.length > 0) {
                    const localTime = models[0]?._updated || 0;
                    const remoteTime = remote[0]?._updated || 1;
                    if (remoteTime >= localTime || models.length === 0) {
                        models = remote; localStorage.setItem(KEY, JSON.stringify(models));
                        updateFilterButtons(); render();
                        syncEl.textContent = '☁️ 云端已同步'; syncEl.style.color = 'var(--accent3)'; return;
                    }
                }
                syncEl.textContent = '💾 本地版本'; syncEl.style.color = 'var(--text3)';
            } else { syncEl.textContent = '⚠️ 无云端数据'; syncEl.style.color = 'var(--accent4)'; }
        } catch(e) { syncEl.textContent = '📡 离线模式'; syncEl.style.color = 'var(--text3)'; }
    }

    function saveData() {
        const now = Date.now();
        if (models.length > 0) models[0]._updated = now;
        localStorage.setItem(KEY, JSON.stringify(models));
    }

    /* ── RENDER ── */
    function render() {
        const q = document.getElementById('searchInput').value.toLowerCase();
        const grid = document.getElementById('grid');
        grid.innerHTML = '';
        document.getElementById('totalCount').textContent = models.length;
        updateFilterButtons();
        const list = models.filter(m => {
            const mc = curFilter === 'all' || m.category === curFilter;
            const mq = !q || [m.name, m.paper, m.dataset, ...(m.tags||[])].join(' ').toLowerCase().includes(q);
            return mc && mq;
        });
        if (list.length === 0 && models.length > 0) {
            grid.innerHTML = '<div class="empty">没有找到匹配的模型</div>';
            appendAddCard(grid); return;
        }
        getSortedList(list).forEach((m, idx) => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => openDetailPage(m.id);
            const imgs = m.images || [];
            const firstImg = imgs[0];
            const preset = getCatPreset(m.category || '');
            const col = preset.colorHex, cardBg = preset.cardBg;
            const cc = preset.class;
            const initials = m.name.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase() || '?';
            const badgeStyle = getCatBadgeStyle(m.category || '');
            const imgHtml = firstImg
                ? `<img src="${firstImg.data}" alt="${m.name}">`
                : `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;height:100%;background:${cardBg}">
                    <div style="width:56px;height:56px;border-radius:14px;background:${cardBg};border:1.5px solid ${col}44;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:${col};letter-spacing:-1px">${initials}</div>
                    <div style="font-size:12px;color:${col};opacity:.8">${m.category||''}</div>
                  </div>`;
            const countBadge = imgs.length > 1 ? `<div class="img-count-badge">📷 ${imgs.length}</div>` : '';
            const numBadge = showNumbers ? `<div class="num-badge">${idx+1}</div>` : '';
            const tags = (m.tags||[]).slice(0,3).map(t => `<span class="tag">${t}</span>`).join('');
            const innoPreview = m.inno_arch || m.inno_loss || '';
            card.innerHTML = `
                <div class="card-img-wrap">
                    ${imgHtml}
                    <span class="cat-badge ${cc}" style="${badgeStyle}">${m.category||''}</span>
                    ${countBadge}${numBadge}
                </div>
                <div class="card-body">
                    <div class="card-title">${m.name}</div>
                    ${m.paper?`<div class="card-paper">${m.paper}</div>`:''}
                    ${innoPreview?`<div class="card-inno">${innoPreview}</div>`:''}
                    ${tags?`<div class="card-tags">${tags}</div>`:''}
                    <div class="card-meta">
                        ${m.year?`<span class="chip chip-year">${m.year}</span>`:''}
                        ${m.venue?`<span class="chip">${m.venue}</span>`:''}
                        ${m.dataset?`<span class="chip">${m.dataset}</span>`:''}
                        ${m.dice?`<span class="chip chip-dice">Dice ${m.dice}%</span>`:''}
                    </div>
                </div>`;
            grid.appendChild(card);
        });
        appendAddCard(grid);
    }

    function appendAddCard(grid) {
        const ac = document.createElement('div');
        ac.className = 'add-card'; ac.onclick = openAdd;
        ac.innerHTML = '<div class="add-card-icon">+</div><span>添加模型</span>';
        grid.appendChild(ac);
    }

    function setFilter(cat, btn) { curFilter = cat; updateFilterButtons(); render(); }

    /* ── ADD / EDIT MODAL ── */
    function openAdd(id) {
        editingId = id || null;
        document.getElementById('modalTitle').textContent = id ? '✏️ 编辑模型' : '➕ 添加新模型';
        formImgs = [];
        updateDatalist();
        document.getElementById('autofillInput').value = '';
        document.getElementById('autofillStatus').style.display = 'none';
        if (id) {
            const m = models.find(x => x.id === id);
            if (!m) return;
            formImgs = (m.images||[]).map(i => ({...i}));
            document.getElementById('f-name').value = m.name || '';
            document.getElementById('f-cat').value = m.category || 'U-Net变体';
            document.getElementById('f-paper').value = m.paper || '';
            document.getElementById('f-year').value = m.year || '';
            document.getElementById('f-venue').value = m.venue || '';
            document.getElementById('f-link').value = m.link || '';
            document.getElementById('f-dataset').value = m.dataset || '';
            document.getElementById('f-dice').value = m.dice || '';
            document.getElementById('f-tags').value = (m.tags||[]).join(', ');
            document.getElementById('f-inno-input').value = m.inno_input || '';
            document.getElementById('f-inno-arch').value = m.inno_arch || '';
            document.getElementById('f-inno-loss').value = m.inno_loss || '';
            document.getElementById('f-inno-other').value = m.inno_other || '';
            document.getElementById('f-formula').value = m.formula || '';
            document.getElementById('f-notes').value = m.notes || '';
        } else {
            ['f-name','f-paper','f-year','f-venue','f-link','f-dataset','f-dice','f-tags',
             'f-inno-input','f-inno-arch','f-inno-loss','f-inno-other','f-formula','f-notes']
            .forEach(id => document.getElementById(id).value = '');
            document.getElementById('f-cat').value = 'U-Net变体';
        }
        renderImgGrid();
        document.getElementById('formulaPreview').innerHTML = '<span style="color:var(--text3);font-size:12px">公式预览将显示在此处</span>';
        document.getElementById('addModal').classList.add('open');
        if (id) setTimeout(previewFormula, 300);
    }

    function closeAdd() { document.getElementById('addModal').classList.remove('open'); }

    function renderImgGrid() {
        const g = document.getElementById('imgGrid');
        g.innerHTML = '';
        formImgs.forEach((img, i) => {
            const d = document.createElement('div');
            d.className = 'img-thumb';
            d.innerHTML = `<img src="${img.data}" alt="图${i+1}"><button class="del-img" onclick="removeImg(${i},event)">×</button>`;
            g.appendChild(d);
            const capRow = document.createElement('div');
            capRow.className = 'img-caption-row';
            const inp = document.createElement('input');
            inp.value = img.caption || '';
            inp.placeholder = `图${i+1}说明`;
            inp.style.cssText = 'flex:1;background:var(--bg3);border:1px solid var(--border);border-radius:7px;padding:6px 10px;color:var(--text);font-size:12px;outline:none;font-family:inherit';
            inp.oninput = e => { formImgs[i].caption = e.target.value; };
            capRow.appendChild(inp);
            g.appendChild(capRow);
        });
        if (formImgs.length < 6) {
            const slot = document.createElement('div');
            slot.className = 'add-img-slot';
            slot.innerHTML = `<input type="file" accept="image/*" multiple onchange="addImgs(event)"><div style="font-size:22px;opacity:.5">+</div><span>点击上传 或 Ctrl+V 粘贴</span>`;
            g.appendChild(slot);
        }
    }

    function addImgs(e) {
        const files = [...e.target.files];
        files.slice(0, 6 - formImgs.length).forEach(file => {
            const r = new FileReader();
            r.onload = ev => { formImgs.push({ data: ev.target.result, caption: '' }); renderImgGrid(); };
            r.readAsDataURL(file);
        });
        e.target.value = '';
    }

    function removeImg(i, e) { e.stopPropagation(); formImgs.splice(i, 1); renderImgGrid(); }

    let fTimer;
    function previewFormula() {
        clearTimeout(fTimer);
        fTimer = setTimeout(() => {
            const val = document.getElementById('f-formula').value.trim();
            const prev = document.getElementById('formulaPreview');
            if (!val) { prev.innerHTML = '<span style="color:var(--text3);font-size:12px">公式预览将显示在此处</span>'; return; }
            prev.innerHTML = `\\(${val}\\)`;
            if (window.MathJax) MathJax.typesetPromise([prev]).catch(() => {});
        }, 500);
    }

    function saveModel() {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { showToast('请填写模型名称', 'err'); return; }
        const catVal = document.getElementById('f-cat').value.trim();
        if (!catVal) { showToast('请选择或输入类别', 'err'); return; }
        const tagsRaw = document.getElementById('f-tags').value.trim();
        const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [];
        const obj = {
            id: editingId || Date.now().toString(),
            name, category: catVal,
            paper: document.getElementById('f-paper').value.trim(),
            year: document.getElementById('f-year').value.trim(),
            venue: document.getElementById('f-venue').value.trim(),
            link: document.getElementById('f-link').value.trim(),
            dataset: document.getElementById('f-dataset').value.trim(),
            dice: document.getElementById('f-dice').value.trim(),
            tags,
            inno_input: document.getElementById('f-inno-input').value.trim(),
            inno_arch: document.getElementById('f-inno-arch').value.trim(),
            inno_loss: document.getElementById('f-inno-loss').value.trim(),
            inno_other: document.getElementById('f-inno-other').value.trim(),
            formula: document.getElementById('f-formula').value.trim(),
            notes: document.getElementById('f-notes').value.trim(),
            images: [...formImgs]
        };
        if (editingId) { const idx = models.findIndex(m => m.id === editingId); if (idx >= 0) models[idx] = obj; }
        else models.unshift(obj);
        saveData(); updateFilterButtons(); render(); closeAdd();
        showToast(editingId ? '✅ 已更新' : '✅ 模型已添加', 'ok');
    }

    /* ── AUTOFILL FROM LINK ── */
    async function doAutofill() {
        const raw = document.getElementById('autofillInput').value.trim();
        if (!raw) { setAutofillStatus('请先粘贴链接或ID', 'err'); return; }
        const btn = document.getElementById('autofillBtn');
        btn.disabled = true; btn.textContent = '⏳ 查询中…';
        setAutofillStatus('正在查询论文信息…', 'info');

        try {
            // 解析输入类型
            let arxivId = null, doi = null, s2Id = null;

            const axMatch = raw.match(/arxiv\.org\/(?:abs|pdf|html)\/([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)/i)
                || raw.match(/^([0-9]{4}\.[0-9]{4,5}(?:v\d+)?)$/);
            if (axMatch) arxivId = axMatch[1].replace(/v\d+$/, '');

            const doiMatch = raw.match(/(?:doi\.org\/)(10\.[0-9]{4,}\/\S+)/i)
                || (!arxivId && raw.match(/^(10\.[0-9]{4,}\/\S+)/i));
            if (doiMatch) doi = doiMatch[1];

            const s2Match = raw.match(/semanticscholar\.org\/paper\/[^/]*\/([a-f0-9]{40})/i);
            if (s2Match) s2Id = s2Match[1];

            if (!arxivId && !doi && !s2Id) {
                setAutofillStatus('❌ 无法识别格式，请粘贴 arXiv 链接、arXiv ID、DOI 或 Semantic Scholar 链接', 'err');
                return;
            }

            let filled = false;

            // ── 第一步：Semantic Scholar API（支持CORS，推荐）──
            try {
                const paperId = s2Id || (doi ? 'DOI:' + doi : 'ARXIV:' + arxivId);
                const s2url = 'https://api.semanticscholar.org/graph/v1/paper/'
                    + encodeURIComponent(paperId)
                    + '?fields=title,year,venue,publicationVenue,externalIds,openAccessPdf,url';
                const res = await fetch(s2url);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.title) {
                        document.getElementById('f-paper').value = data.title;
                        if (data.year) document.getElementById('f-year').value = String(data.year);
                        const venue = (data.publicationVenue && data.publicationVenue.name) || data.venue || '';
                        if (venue) document.getElementById('f-venue').value = venue;
                        const doiVal = data.externalIds && data.externalIds.DOI;
                        const arxivVal = data.externalIds && data.externalIds.ArXiv;
                        const pdfUrl = data.openAccessPdf && data.openAccessPdf.url;
                        document.getElementById('f-link').value =
                            doiVal ? 'https://doi.org/' + doiVal
                            : arxivVal ? 'https://arxiv.org/abs/' + arxivVal
                            : pdfUrl || data.url || raw;
                        filled = true;
                        setAutofillStatus('✅ 已填充：' + data.title.slice(0,55) + (data.title.length>55?'…':''), 'ok');
                    }
                }
            } catch(e) { console.warn('S2 API err:', e); }

            // ── 第二步：CrossRef API fallback（仅DOI，支持CORS）──
            if (!filled && doi) {
                try {
                    const res = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi));
                    if (res.ok) {
                        const data = await res.json();
                        const msg = data && data.message;
                        if (msg && msg.title && msg.title[0]) {
                            document.getElementById('f-paper').value = msg.title[0];
                            const year = msg.published && msg.published['date-parts'] && msg.published['date-parts'][0] && msg.published['date-parts'][0][0];
                            if (year) document.getElementById('f-year').value = String(year);
                            const journal = (msg['container-title'] && msg['container-title'][0]) || (msg['short-container-title'] && msg['short-container-title'][0]) || '';
                            if (journal) document.getElementById('f-venue').value = journal;
                            document.getElementById('f-link').value = 'https://doi.org/' + doi;
                            filled = true;
                            setAutofillStatus('✅ 已从 CrossRef 填充：' + msg.title[0].slice(0,55) + (msg.title[0].length>55?'…':''), 'ok');
                        }
                    }
                } catch(e) { console.warn('CrossRef err:', e); }
            }

            if (!filled) setAutofillStatus('❌ 查询失败，可能是网络问题或该论文未被收录，请手动填写', 'err');

        } catch(e) {
            setAutofillStatus('❌ 错误：' + e.message, 'err');
        } finally {
            btn.disabled = false; btn.textContent = '✦ 填充';
        }
    }

    function setAutofillStatus(msg, type) {
        const el = document.getElementById('autofillStatus');
        el.style.display = 'block';
        el.textContent = msg;
        el.style.background = type==='ok' ? 'rgba(62,207,142,.12)' : type==='err' ? 'rgba(239,68,68,.12)' : 'rgba(79,156,249,.12)';
        el.style.color = type==='ok' ? 'var(--accent3)' : type==='err' ? 'var(--red)' : 'var(--accent)';
        el.style.border = type==='ok' ? '1px solid rgba(62,207,142,.25)' : type==='err' ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(79,156,249,.25)';
        if (type==='ok') setTimeout(() => { el.style.display='none'; }, 6000);
    }

    /* ── DETAIL PAGE ── */
    let dpGalleryIdx = 0, dpImgs = [];

    function openDetailPage(id) {
        const m = models.find(x => x.id === id);
        if (!m) return;
        curDetailId = id; dpImgs = m.images || []; dpGalleryIdx = 0;
        document.getElementById('dpTitle').textContent = m.name;
        document.getElementById('dpEditBtn').onclick = () => { closeDetailPage(); openAdd(id); };
        document.getElementById('dpDelBtn').onclick = () => {
            if (!confirm('确认删除？')) return;
            models = models.filter(x => x.id !== id);
            saveData(); updateFilterButtons(); render(); closeDetailPage();
            showToast('已删除', 'ok');
        };
        const preset = getCatPreset(m.category || '');
        const col = preset.colorHex;
        const left = document.getElementById('dpLeft');
        left.innerHTML = '';
        const galleryDiv = document.createElement('div');
        const mainDiv = document.createElement('div');
        mainDiv.className = 'dp-gallery-main'; mainDiv.id = 'dpGalleryMain';
        if (dpImgs.length) {
            const img = document.createElement('img');
            img.src = dpImgs[0].data; img.alt = m.name;
            mainDiv.appendChild(img);
            mainDiv.onclick = () => openLightbox(dpImgs, dpGalleryIdx);
        } else {
            mainDiv.style.flexDirection = 'column'; mainDiv.style.gap = '10px';
            mainDiv.innerHTML = `<div style="width:56px;height:56px;border-radius:14px;background:${col}22;border:1.5px solid ${col}44;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:${col}">${m.name.replace(/[^A-Za-z0-9]/g,'').slice(0,3).toUpperCase()||'?'}</div><div style="font-size:14px;color:${col}">${m.category||''}</div>`;
        }
        galleryDiv.appendChild(mainDiv);
        if (dpImgs.length > 1) {
            const thumbsDiv = document.createElement('div');
            thumbsDiv.className = 'dp-thumbs';
            dpImgs.forEach((im, i) => {
                const t = document.createElement('div');
                t.className = 'dp-thumb' + (i===0?' active':'');
                t.innerHTML = `<img src="${im.data}">`;
                t.onclick = () => {
                    dpGalleryIdx = i;
                    const mi = document.querySelector('#dpGalleryMain img');
                    if (mi) mi.src = im.data;
                    document.querySelectorAll('.dp-thumb').forEach((th,j) => th.classList.toggle('active', j===i));
                };
                thumbsDiv.appendChild(t);
            });
            galleryDiv.appendChild(thumbsDiv);
        }
        left.appendChild(galleryDiv);
        const metaDiv = document.createElement('div');
        metaDiv.className = 'dp-section';
        metaDiv.innerHTML = `<h3>基本信息</h3>
            <div class="dp-meta-grid">
                <div class="dp-meta-item"><label>类别</label><p style="color:${col};font-weight:600">${m.category||'—'}</p></div>
                <div class="dp-meta-item"><label>年份</label><p>${m.year||'—'}</p></div>
                <div class="dp-meta-item"><label>期刊/会议</label><p>${m.venue||'—'}</p></div>
                <div class="dp-meta-item"><label>数据集</label><p>${m.dataset||'—'}</p></div>
                <div class="dp-meta-item"><label>最佳 Dice</label><p style="color:var(--accent3);font-weight:600">${m.dice?m.dice+'%':'—'}</p></div>
            </div>`;
        if (m.paper) {
            const p = document.createElement('div');
            p.style.marginTop = '10px';
            p.innerHTML = m.link
                ? `<a href="${m.link}" target="_blank" style="color:var(--accent);font-size:14px;text-decoration:none;font-weight:500">📄 ${m.paper}</a>`
                : `<span style="font-size:14px;color:var(--text)">📄 ${m.paper}</span>`;
            metaDiv.appendChild(p);
        }
        left.appendChild(metaDiv);
        if ((m.tags||[]).length) {
            const tagsDiv = document.createElement('div');
            tagsDiv.innerHTML = (m.tags||[]).map(t => `<span class="tag" style="font-size:12px;padding:4px 10px;margin-right:5px">${t}</span>`).join('');
            left.appendChild(tagsDiv);
        }
        const right = document.getElementById('dpRight');
        right.innerHTML = '';
        const innoRows = [['输入/预处理',m.inno_input],['网络结构',m.inno_arch],['损失函数',m.inno_loss],['训练策略',m.inno_other]].filter(r=>r[1]);
        if (innoRows.length) {
            const innoDiv = document.createElement('div');
            innoDiv.className = 'dp-section';
            innoDiv.innerHTML = '<h3>💡 创新点</h3>';
            innoRows.forEach(r => {
                const item = document.createElement('div');
                item.className = 'dp-inno-item';
                item.innerHTML = `<label>${r[0]}</label><p>${r[1]}</p>`;
                innoDiv.appendChild(item);
            });
            right.appendChild(innoDiv);
        }
        if (m.formula) {
            const fDiv = document.createElement('div');
            fDiv.className = 'dp-section';
            fDiv.innerHTML = '<h3>📐 关键公式</h3>';
            const fBox = document.createElement('div');
            fBox.className = 'dp-formula-box';
            fBox.innerHTML = `\\(${m.formula}\\)`;
            fDiv.appendChild(fBox);
            right.appendChild(fDiv);
            if (window.MathJax) setTimeout(() => MathJax.typesetPromise([fBox]).catch(()=>{}), 100);
        }
        if (m.notes) {
            const nDiv = document.createElement('div');
            nDiv.className = 'dp-section';
            nDiv.innerHTML = '<h3>📝 备注</h3>';
            const nBox = document.createElement('div');
            nBox.className = 'dp-notes-box'; nBox.textContent = m.notes;
            nDiv.appendChild(nBox);
            right.appendChild(nDiv);
        }
        document.getElementById('detailPage').classList.add('open');
        document.getElementById('detailPage').scrollTop = 0;
    }

    function closeDetailPage() { document.getElementById('detailPage').classList.remove('open'); }

    ['addModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => { if (e.target===document.getElementById(id)) closeAdd(); });
    });

    /* ── TOAST ── */
    function showToast(msg, type) {
        const t = document.getElementById('toast');
        t.textContent = msg;
        t.className = 'toast show' + (type==='ok'?' ok':'');
        setTimeout(() => t.className = 'toast', 2400);
    }

    /* ── GITHUB SYNC ── */
    function openGhSync() {
        const saved = localStorage.getItem('gh_token') || '';
        document.getElementById('ghToken').value = saved;
        document.getElementById('ghSaveToken').checked = !!saved;
        document.getElementById('ghStatus').style.display = 'none';
        document.getElementById('ghPushBtn').disabled = false;
        document.getElementById('ghPushBtn').textContent = '🚀 立即推送';
        document.getElementById('ghModal').classList.add('open');
    }
    function closeGhSync() { document.getElementById('ghModal').classList.remove('open'); }

    async function pushToGithub() {
        const token = document.getElementById('ghToken').value.trim();
        const repo = document.getElementById('ghRepo').value.trim();
        const path = document.getElementById('ghPath').value.trim();
        const btn = document.getElementById('ghPushBtn');
        if (!token) { setGhStatus('请填写 GitHub Token', 'err'); return; }
        if (document.getElementById('ghSaveToken').checked) localStorage.setItem('gh_token', token);
        else localStorage.removeItem('gh_token');
        btn.disabled = true; btn.textContent = '推送中…';
        setGhStatus('⏳ 正在获取文件信息…', 'info');
        const now = Date.now();
        const exportable = models.map((m,i) => ({...m, images:m.images||[], _updated:i===0?now:(m._updated||now)}));
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportable, null, 2))));
        try {
            const apiBase = `https://api.github.com/repos/${repo}/contents/${path}`;
            const headers = {'Authorization':`token ${token}`,'Accept':'application/vnd.github.v3+json','Content-Type':'application/json'};
            let sha = '';
            const getRes = await fetch(apiBase, {headers});
            if (getRes.ok) { const info = await getRes.json(); sha = info.sha; }
            else if (getRes.status !== 404) throw new Error('获取文件失败: ' + getRes.status);
            setGhStatus('⏳ 正在推送数据…', 'info');
            const body = {message:'Update data.json via MedSeg Zoo', content, ...(sha?{sha}:{})};
            const putRes = await fetch(apiBase, {method:'PUT', headers, body:JSON.stringify(body)});
            if (putRes.ok) {
                setGhStatus('✅ 推送成功！别人刷新网站即可看到最新内容', 'ok');
                btn.textContent = '✅ 已推送';
                document.getElementById('syncStatus').textContent = '☁️ 云端已同步';
                document.getElementById('syncStatus').style.color = 'var(--accent3)';
            } else {
                const err = await putRes.json();
                throw new Error(err.message || putRes.status);
            }
        } catch(e) {
            setGhStatus('❌ 推送失败：' + e.message, 'err');
            btn.disabled = false; btn.textContent = '🚀 重试';
        }
    }

    function setGhStatus(msg, type) {
        const el = document.getElementById('ghStatus');
        el.style.display = 'block'; el.textContent = msg;
        el.style.background = type==='ok' ? 'rgba(62,207,142,.12)' : type==='err' ? 'rgba(239,68,68,.12)' : 'rgba(79,156,249,.12)';
        el.style.color = type==='ok' ? 'var(--accent3)' : type==='err' ? 'var(--red)' : 'var(--accent)';
        el.style.border = type==='ok' ? '1px solid rgba(62,207,142,.25)' : type==='err' ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(79,156,249,.25)';
    }
    document.getElementById('ghModal').addEventListener('click', e => { if (e.target===document.getElementById('ghModal')) closeGhSync(); });

    /* ── THEME ── */
    function toggleTheme() {
        const isLight = document.body.classList.toggle('light');
        document.getElementById('themeBtn').textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('theme', isLight ? 'light' : 'dark');
    }
    (() => { if (localStorage.getItem('theme')==='light') { document.body.classList.add('light'); document.getElementById('themeBtn').textContent='☀️'; } })();

    /* ── LIGHTBOX ── */
    let lbImgs=[], lbIdx=0, lbScale=1, lbFullMode=false, lbHideTimer=null;

    function openLightbox(imgs, idx) {
        lbImgs = imgs; lbIdx = idx;
        const img = document.getElementById('lbImg');
        img.src = imgs[idx].data;
        document.getElementById('lbCaption').textContent = (imgs[idx].caption||'') + ` (${idx+1}/${imgs.length})`;
        document.getElementById('lightbox').classList.add('open');
        lbFullMode = false; showLbBars(); lbRenderThumbs();
        img.onload = () => { lbFit(); img.onload = null; };
        if (img.complete && img.naturalWidth) lbFit();
    }

    function closeLightbox() {
        document.getElementById('lightbox').classList.remove('open');
        lbFullMode = false; clearTimeout(lbHideTimer); showLbBars();
    }

    function toggleLbFull() {
        lbFullMode = !lbFullMode;
        document.getElementById('lbFullBtn').textContent = lbFullMode ? '⊠ 退出' : '⛶ 全屏';
        const lb = document.getElementById('lightbox');
        if (lbFullMode) { lb.requestFullscreen && lb.requestFullscreen(); hideLbBarsDelayed(); }
        else { document.exitFullscreen && document.exitFullscreen(); showLbBars(); }
    }
    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) { lbFullMode = false; document.getElementById('lbFullBtn').textContent = '⛶ 全屏'; showLbBars(); }
    });

    function showLbBars() { clearTimeout(lbHideTimer); document.getElementById('lbHeader').classList.remove('hidden'); document.getElementById('lbZoomBar').classList.remove('hidden'); }
    function hideLbBarsDelayed() {
        clearTimeout(lbHideTimer);
        lbHideTimer = setTimeout(() => {
            if (lbFullMode) { document.getElementById('lbHeader').classList.add('hidden'); document.getElementById('lbZoomBar').classList.add('hidden'); }
        }, 2500);
    }
    document.getElementById('lbBody').addEventListener('mousemove', () => { if (lbFullMode) { showLbBars(); hideLbBarsDelayed(); } });

    function lbRenderThumbs() {
        const strip = document.getElementById('lbThumbStrip');
        strip.innerHTML = '';
        if (lbImgs.length <= 1) { strip.style.display = 'none'; return; }
        strip.style.display = 'flex';
        lbImgs.forEach((im, i) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center';
            const t = document.createElement('div');
            t.className = 'lb-thumb' + (i===lbIdx?' active':'');
            t.innerHTML = `<img src="${im.data}" alt="图${i+1}">`;
            t.onclick = () => { lbIdx = i; lbUpdateImg(); lbUpdateThumbActive(); };
            wrap.appendChild(t);
            if (im.caption) { const c = document.createElement('div'); c.className = 'lb-thumb-caption'; c.textContent = im.caption; wrap.appendChild(c); }
            strip.appendChild(wrap);
        });
    }

    function lbUpdateThumbActive() {
        document.querySelectorAll('.lb-thumb').forEach((t,i) => t.classList.toggle('active', i===lbIdx));
        const strip = document.getElementById('lbThumbStrip');
        const active = strip.querySelectorAll('.lb-thumb')[lbIdx];
        if (active) active.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'});
    }

    function lbPrev(e) { if(e) e.stopPropagation(); lbIdx = (lbIdx-1+lbImgs.length)%lbImgs.length; lbUpdateImg(); }
    function lbNext(e) { if(e) e.stopPropagation(); lbIdx = (lbIdx+1)%lbImgs.length; lbUpdateImg(); }

    function lbUpdateImg() {
        const img = document.getElementById('lbImg');
        img.src = lbImgs[lbIdx].data;
        document.getElementById('lbCaption').textContent = (lbImgs[lbIdx].caption||'') + ` (${lbIdx+1}/${lbImgs.length})`;
        document.getElementById('lbBody').scrollTop = 0; lbUpdateThumbActive();
        img.onload = () => { lbFit(); img.onload = null; };
        if (img.complete && img.naturalWidth) lbFit();
    }

    function lbApplyScale() {
        const img = document.getElementById('lbImg');
        if (!img.naturalWidth) return;
        img.style.width = Math.round(img.naturalWidth * lbScale) + 'px';
        img.style.height = 'auto';
        document.getElementById('lbZoomLabel').textContent = Math.round(lbScale*100) + '%';
    }

    function lbFit() {
        const body = document.getElementById('lbBody');
        const img = document.getElementById('lbImg');
        if (!img.naturalWidth) return;
        lbScale = Math.min((body.clientWidth-32)/img.naturalWidth, 1);
        lbApplyScale(); body.scrollTop = 0; body.scrollLeft = 0;
    }

    function lbActual() { lbScale = 1; lbApplyScale(); }
    function lbZoom(delta) { lbScale = Math.max(0.05, Math.min(10, lbScale+delta)); lbApplyScale(); }

    document.getElementById('lbBody').addEventListener('wheel', e => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const body = document.getElementById('lbBody');
            const rx = body.scrollLeft / (body.scrollWidth-body.clientWidth||1);
            const ry = body.scrollTop / (body.scrollHeight-body.clientHeight||1);
            lbScale = Math.max(0.05, Math.min(10, lbScale + (e.deltaY>0?-0.08:0.08)));
            lbApplyScale();
            requestAnimationFrame(() => { body.scrollLeft = rx*(body.scrollWidth-body.clientWidth); body.scrollTop = ry*(body.scrollHeight-body.clientHeight); });
        }
    }, {passive:false});

    document.getElementById('lbBody').addEventListener('dblclick', e => {
        if (lbScale < 1.5) { lbScale = Math.min(lbScale*2, 3); lbApplyScale(); } else lbFit();
    });

    document.addEventListener('keydown', e => {
        if (!document.getElementById('lightbox').classList.contains('open')) return;
        if (e.key==='ArrowLeft') lbPrev();
        if (e.key==='ArrowRight') lbNext();
        if (e.key==='Escape') closeLightbox();
        if ((e.ctrlKey||e.metaKey) && (e.key==='='||e.key==='+')) { e.preventDefault(); lbZoom(0.15); }
        if ((e.ctrlKey||e.metaKey) && e.key==='-') { e.preventDefault(); lbZoom(-0.15); }
        if ((e.ctrlKey||e.metaKey) && e.key==='0') { e.preventDefault(); lbFit(); }
        if (e.key==='f'||e.key==='F') toggleLbFull();
    });

    function toggleNumbers() { showNumbers = !showNumbers; document.getElementById('numToggleBtn').classList.toggle('active', showNumbers); render(); }

    function getSortedList(list) {
        const s = document.getElementById('sortSel').value, arr = [...list];
        if (s==='oldest') return arr.reverse();
        if (s==='year_desc') return arr.sort((a,b) => parseInt(b.year||0)-parseInt(a.year||0));
        if (s==='year_asc') return arr.sort((a,b) => parseInt(a.year||0)-parseInt(b.year||0));
        if (s==='dice_desc') return arr.sort((a,b) => parseFloat(b.dice||0)-parseFloat(a.dice||0));
        if (s==='name_asc') return arr.sort((a,b) => a.name.localeCompare(b.name));
        return arr;
    }

    document.addEventListener('paste', e => {
        if (!document.getElementById('addModal').classList.contains('open')) return;
        if (formImgs.length >= 6) return;
        const imgItems = [...e.clipboardData.items].filter(i => i.type.startsWith('image/'));
        if (!imgItems.length) return;
        e.preventDefault();
        imgItems.forEach(item => {
            if (formImgs.length >= 6) return;
            const r = new FileReader();
            r.onload = ev => { formImgs.push({data:ev.target.result, caption:''}); renderImgGrid(); showToast('✅ 截图已粘贴', 'ok'); };
            r.readAsDataURL(item.getAsFile());
        });
    });

    function openImport() { document.getElementById('importJson').value=''; document.getElementById('importError').style.display='none'; document.getElementById('importModal').classList.add('open'); }
    function closeImport() { document.getElementById('importModal').classList.remove('open'); }

    function doImport() {
        const raw = document.getElementById('importJson').value.trim();
        const errEl = document.getElementById('importError');
        if (!raw) { errEl.textContent='请粘贴JSON内容'; errEl.style.display='block'; return; }
        let parsed;
        try { parsed = JSON.parse(raw); } catch(e) { errEl.textContent='JSON格式错误：'+e.message; errEl.style.display='block'; return; }
        const items = Array.isArray(parsed) ? parsed : [parsed];
        let count = 0;
        items.forEach(item => {
            if (!item.name) return;
            const existing = models.findIndex(m => m.name===item.name);
            const obj = {
                id: item.id||Date.now().toString()+Math.random().toString(36).slice(2),
                name:item.name||'', category:item.category||'U-Net变体', paper:item.paper||'',
                year:String(item.year||''), venue:item.venue||'', link:item.link||'',
                dataset:item.dataset||'', dice:String(item.dice||''),
                tags:Array.isArray(item.tags)?item.tags:(item.tags?item.tags.split(',').map(t=>t.trim()):[]),
                inno_input:item.inno_input||'', inno_arch:item.inno_arch||'',
                inno_loss:item.inno_loss||'', inno_other:item.inno_other||'',
                formula:item.formula||'', notes:item.notes||'', images:item.images||[]
            };
            if (existing>=0) models[existing]=obj; else models.unshift(obj);
            count++;
        });
        saveData(); updateFilterButtons(); render(); closeImport();
        showToast(`✅ 成功导入 ${count} 个模型`, 'ok');
    }

    function exportData() {
        const now = Date.now();
        const exportable = models.map((m,i) => ({...m, images:m.images||[], _updated:i===0?now:(m._updated||now)}));
        const blob = new Blob([JSON.stringify(exportable, null, 2)], {type:'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = 'data.json'; a.click();
        setTimeout(() => showToast('📤 已导出 data.json，请上传到GitHub仓库根目录', 'ok'), 300);
    }

    document.getElementById('importModal').addEventListener('click', e => { if (e.target===document.getElementById('importModal')) closeImport(); });

    function openDetail(id) { openDetailPage(id); }
    function closeDetail() { closeDetailPage(); }

    loadData();
