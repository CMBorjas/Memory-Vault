/*
  Anti-Gravity Mnemonic Engine — Client Application
*/

let currentDocument = null;
let bookProfiles = {};
let selectedBook = 'Networking';

// Slicer Workspace State
let currentPdfFile = null;
let currentPdfDoc = null;
let slicerChapters = []; // array of { id, name, from, to }
let slicerActiveTab = 'toc';
let slicerThumbnailScale = 1.0;


// ═══ Initialization ═══
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupUploadZone();
    
    await checkEngineStatus();
    await loadBooks();
    await loadLibrary();
    
    startGlobalProgressPolling();
});

// ═══ Global Progress Polling ═══
function startGlobalProgressPolling() {
    setInterval(async () => {
        try {
            const r = await fetch('/api/progress');
            if (r.ok) {
                const data = await r.json();
                const gp = document.getElementById('global-progress');
                const fill = document.getElementById('global-progress-fill');
                const text = document.getElementById('global-progress-text');
                
                if (data.status === 'idle') {
                    if (gp) gp.style.display = 'none';
                } else {
                    if (gp) gp.style.display = 'flex';
                    let pct = 0;
                    if (data.status === 'extracting') {
                        pct = Math.floor((data.current_page / data.total_pages) * 100);
                    } else if (data.status === 'generating') {
                        pct = Math.floor((data.current_section / data.total_sections) * 100);
                    } else if (data.status === 'batch') {
                        pct = Math.floor((data.current_file / data.total_files) * 100);
                    }
                    if (fill) fill.style.width = pct + '%';
                    if (text) text.textContent = data.message || `Processing...`;
                    
                    // Also sync local upload UI if visible
                    const localFill = document.getElementById('progress-fill');
                    const localText = document.getElementById('progress-text');
                    const localProgress = document.getElementById('upload-progress');
                    if (localProgress && !localProgress.classList.contains('hidden')) {
                        if (localFill) localFill.style.width = pct + '%';
                        if (localText) localText.textContent = data.message;
                    }
                }
            }
        } catch (e) {}
    }, 1000);
}

// ═══ State & API ═══
async function checkEngineStatus() {
    try {
        const res = await fetch('/api/health');
        if (res.ok) {
            document.querySelector('.status-dot').classList.add('connected');
            document.querySelector('.status-text').textContent = 'Engine Online';
        }
    } catch (e) {
        document.querySelector('.status-text').textContent = 'Engine Offline';
        showToast('Cannot connect to engine', 'error');
    }
}

async function loadBooks() {
    try {
        const res = await fetch('/api/books');
        bookProfiles = await res.json();
        renderBookSelector();
        renderProfilesGrid();
    } catch (e) {
        console.error("Failed to load books:", e);
    }
}

// ═══ Navigation ═══
function setupNavigation() {
    document.querySelectorAll('.bs-nav__link').forEach(link => {
        link.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });
    
    document.getElementById('back-to-library').addEventListener('click', () => {
        switchView('library');
    });
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('view--active'));
    document.querySelectorAll('.bs-nav__link').forEach(l => l.classList.remove('bs-nav__link--active'));
    
    document.getElementById(`view-${viewId}`).classList.add('view--active');
    
    const navLink = document.getElementById(`nav-${viewId}`);
    if (navLink) navLink.classList.add('bs-nav__link--active');
    
    if (viewId === 'library') loadLibrary();

    const docSidebar = document.getElementById('doc-sidebar-left');
    if (docSidebar) {
        if (viewId === 'document') {
            docSidebar.classList.remove('hidden');
        } else {
            docSidebar.classList.add('hidden');
            document.body.classList.remove('editing-mode');
            const actionBar = document.getElementById('edit-action-bar');
            if (actionBar) actionBar.classList.add('hidden');
        }
    }
}

// ═══ Upload & Book Selection ═══
function renderBookSelector() {
    const grid = document.getElementById('book-grid');
    grid.innerHTML = '';
    
    for (const [name, profile] of Object.entries(bookProfiles)) {
        const color = profile.color_palette?.[0] || 'var(--accent-primary)';
        const card = document.createElement('div');
        card.className = `book-card ${name === selectedBook ? 'selected' : ''}`;
        card.style.setProperty('--card-color', color);
        
        card.innerHTML = `
            <div class="book-card__header">
                <div class="book-card__title" style="color: ${color}">${name.replace('_', ' ')}</div>
            </div>
            <div class="book-card__body">
                <div class="book-card__kingdom">${profile.kingdom}</div>
            </div>
        `;
        
        card.addEventListener('click', () => {
            document.querySelectorAll('.book-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedBook = name;
        });
        
        grid.appendChild(card);
    }
}

function renderProfilesGrid() {
    const grid = document.getElementById('profiles-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    for (const [name, profile] of Object.entries(bookProfiles)) {
        const color = profile.color_palette?.[0] || 'var(--accent-primary)';
        const card = document.createElement('div');
        card.className = 'profile-card';
        card.style.setProperty('--card-color', color);
        
        card.innerHTML = `
            <div class="profile-card__header">
                <h3 style="color: ${color}">${name.replace('_', ' ')}</h3>
            </div>
            <div class="profile-card__body">
                <p><strong>Kingdom:</strong> ${profile.kingdom}</p>
                <p><strong>Aesthetic:</strong> ${profile.aesthetic}</p>
                <p><strong>Scent:</strong> ${profile.scent_primary} + ${profile.scent_secondary}</p>
            </div>
        `;
        grid.appendChild(card);
    }
}

function setupUploadZone() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    
    zone.addEventListener('click', (e) => {
        if (!e.target.closest('.book-card')) input.click();
    });
    
    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    
    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });
    
    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        if (e.dataTransfer.files.length) handleUpload(e.dataTransfer.files[0]);
    });
    
    input.addEventListener('change', () => {
        if (input.files.length) handleUpload(input.files[0]);
    });
}

async function handleUpload(file) {
    if (file.type !== 'application/pdf') {
        return showToast('Only PDF files are allowed', 'error');
    }
    
    // Intercept upload to open the browser-side slicer workspace
    openSlicerWorkspace(file);
}

// ═══ Library & Document ═══
async function loadLibrary() {
    try {
        const res = await fetch('/api/documents');
        const docs = await res.json();
        
        document.getElementById('doc-count').textContent = `${docs.length} documents`;
        const grid = document.getElementById('library-grid');
        const empty = document.getElementById('library-empty');
        
        grid.innerHTML = '';
        
        if (docs.length === 0) {
            empty.classList.remove('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        
        docs.forEach(doc => {
            const profile = bookProfiles[doc.book] || {};
            const color = profile.color_palette?.[0] || 'var(--border)';
            
            const date = new Date(doc.uploaded_at).toLocaleDateString();
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.style.borderLeft = `4px solid ${color}`;
            
            card.innerHTML = `
                <div class="doc-card__meta">
                    <span>${date}</span>
                    <span>${doc.section_count} sections</span>
                </div>
                <div class="doc-card__title" title="${doc.filename}">${doc.filename}</div>
                <div class="doc-card__tag" style="color: ${color}">${doc.book.replace('_', ' ')}</div>
            `;
            
            card.addEventListener('click', () => loadDocument(doc.id));
            grid.appendChild(card);
        });
        
    } catch (e) {
        showToast('Failed to load library', 'error');
    }
}

async function loadDocument(id) {
    try {
        const res = await fetch(`/api/documents/${id}`);
        if (!res.ok) throw new Error('Document not found');
        
        currentDocument = await res.json();
        renderDocument();
        switchView('document');
        
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function renderDocument() {
    if (!currentDocument) return;
    
    const doc = currentDocument;
    const profile = bookProfiles[doc.book] || {};
    const displayTitle = doc.filename || doc.title || 'Untitled';
    document.getElementById('breadcrumb-title').textContent = displayTitle;
    
    document.getElementById('doc-header').innerHTML = `
        <h1 id="doc-title-display">${displayTitle}</h1>
        <input type="text" id="doc-title-input" class="hidden" value="${displayTitle}" style="font-size: 2.5rem; width: 100%; border-radius: 4px; padding: 0.5rem; margin-bottom: 0.25rem; font-family: inherit; font-weight: 400; color: #ffffff; background: var(--bg-hover); border: 1px solid var(--border-color);">
        
        <div id="wysiwyg-toolbar" class="hidden formatting-toolbar">
            <div class="toolbar-group">
                <button class="toolbar-btn" title="Undo">↩</button>
                <button class="toolbar-btn" title="Redo">↪</button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <select class="toolbar-select">
                    <option>Paragraph</option>
                    <option>Heading 1</option>
                    <option>Heading 2</option>
                    <option>Heading 3</option>
                </select>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <button class="toolbar-btn" style="font-weight: bold;" title="Bold">B</button>
                <button class="toolbar-btn" style="font-style: italic;" title="Italic">I</button>
                <button class="toolbar-btn" style="text-decoration: underline;" title="Underline">U</button>
                <button class="toolbar-btn" title="Text Color">A<span style="font-size: 0.6em; margin-left: 2px;">▼</span></button>
                <button class="toolbar-btn" title="Background Color">🖌<span style="font-size: 0.6em; margin-left: 2px;">▼</span></button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <button class="toolbar-btn" title="Align Left">≣</button>
                <button class="toolbar-btn" title="Align Center">≡</button>
                <button class="toolbar-btn" title="Align Right">≣</button>
                <button class="toolbar-btn" title="Justify">▤</button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <button class="toolbar-btn" title="Bullet List">•</button>
                <button class="toolbar-btn" title="Numbered List">1.</button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <button class="toolbar-btn" title="Link">🔗</button>
                <button class="toolbar-btn" title="Table">▦</button>
                <button class="toolbar-btn" title="Image">🖼</button>
            </div>
            <div class="toolbar-divider"></div>
            <div class="toolbar-group">
                <button class="toolbar-btn" title="Code Block">&lt;/&gt;</button>
                <button class="toolbar-btn" title="Help">?</button>
                <button class="toolbar-btn" title="Fullscreen">⛶</button>
            </div>
        </div>

        <p class="text-muted" style="margin-bottom: 2rem;">Processed via Anti-Gravity Mnemonic Engine</p>
    `;

    // ─── Details Sidebar ───
    const detailList = document.getElementById('detail-list');
    const revision = doc.revision || 1;
    const createdAt = doc.uploaded_at ? timeAgo(doc.uploaded_at) : 'Unknown';
    const updatedAt = doc.updated_at ? timeAgo(doc.updated_at) : createdAt;
    const createdBy = doc.created_by || 'Local User';

    detailList.innerHTML = `
        <li>
            <span class="detail-icon">🕓</span>
            <span class="detail-text">Revision <strong>#${revision}</strong></span>
        </li>
        <li>
            <span class="detail-icon">★</span>
            <span class="detail-text">Created <strong>${createdAt}</strong> by ${createdBy}</span>
        </li>
        <li>
            <span class="detail-icon">✏️</span>
            <span class="detail-text">Updated <strong>${updatedAt}</strong> by ${createdBy}</span>
        </li>
        <li>
            <span class="detail-icon">👁</span>
            <span class="detail-text">Watching new pages and updates</span>
        </li>
    `;

    // ─── Favourite state ───
    const favBtn = document.getElementById('btn-favourite');
    const favIcon = document.getElementById('fav-icon');
    const favText = document.getElementById('fav-text');
    if (doc.favourite) {
        favBtn.classList.add('fav-active');
        favIcon.textContent = '★';
        favText.textContent = 'Favourited';
    } else {
        favBtn.classList.remove('fav-active');
        favIcon.textContent = '☆';
        favText.textContent = 'Favourite';
    }

    // ─── Sections ───
    const sectionsList = document.getElementById('sections-list');
    sectionsList.innerHTML = '';

    doc.sections.forEach((section, index) => {
        const div = document.createElement('div');
        div.className = 'bs-list-item';
        div.style.borderLeftColor = doc.profile ? doc.profile.color_palette[0] : 'var(--color-primary)';
        
        // Truncate content for summary
        const summary = section.content.substring(0, 150) + '...';

        div.innerHTML = `
            <div class="bs-list-item__header">
                <div class="bs-list-item__title">${section.title}</div>
                <div class="bs-list-item__summary">${summary}</div>
            </div>
            <div class="bs-list-item__body">
                <div class="bs-list-item__content">${section.content}</div>
                <div class="bs-list-item__mnemonics">
                    <div class="mnemonic-field">
                        <label class="mnemonic-field__label">Acronym Anchor</label>
                        <textarea class="mnemonic-field__input" data-field="acronym" data-index="${index}">${section.mnemonics?.acronym || ''}</textarea>
                    </div>
                    <div class="mnemonic-field">
                        <label class="mnemonic-field__label">Visual Anchor</label>
                        <textarea class="mnemonic-field__input" data-field="visual" data-index="${index}">${section.mnemonics?.visual || ''}</textarea>
                    </div>
                    <div class="mnemonic-field">
                        <label class="mnemonic-field__label">Scent Profile</label>
                        <textarea class="mnemonic-field__input" data-field="scent" data-index="${index}">${section.mnemonics?.scent || ''}</textarea>
                    </div>
                    <div class="mnemonic-field">
                        <label class="mnemonic-field__label">Logic Link</label>
                        <textarea class="mnemonic-field__input" data-field="logic" data-index="${index}">${section.mnemonics?.logic || ''}</textarea>
                    </div>
                    <div class="section-actions">
                        <button class="btn btn-primary btn-save-section" data-index="${index}">Save Mnemonics</button>
                        <button class="btn btn-link btn-regen-section" data-index="${index}">Regenerate</button>
                    </div>
                </div>
            </div>
        `;
        sectionsList.appendChild(div);
    });
    
    // ─── Bind all sidebar actions ───
    document.getElementById('btn-export').onclick = () => exportDocument(doc.id);
    document.getElementById('btn-delete').onclick = () => deleteDocument(doc.id);
    document.getElementById('btn-copy').onclick = () => copyDocument(doc.id);
    document.getElementById('btn-move').onclick = () => openMoveModal(doc);
    document.getElementById('btn-revisions').onclick = () => openRevisionsModal(doc.id);
    document.getElementById('btn-favourite').onclick = () => toggleFavourite(doc.id);
    document.getElementById('btn-edit-toggle').onclick = () => toggleEditMode();

    document.getElementById('btn-edit-back').onclick = () => toggleEditMode();
    document.getElementById('btn-edit-close').onclick = () => toggleEditMode();

    // Modal close buttons
    document.getElementById('close-revisions').onclick = () => document.getElementById('modal-revisions').classList.add('hidden');
    document.getElementById('close-move').onclick = () => document.getElementById('modal-move').classList.add('hidden');
}

// ═══ Actions ═══
async function saveMnemonics(idx) {
    if (!currentDocument) return;
    
    const card = document.querySelectorAll('.section-card')[idx];
    const mnemonics = {
        acronym: card.querySelector('.m-acronym').value,
        visual_anchor: card.querySelector('.m-visual').value,
        scent_anchor: card.querySelector('.m-scent').value,
        logic_link: card.querySelector('.m-logic').value,
        kingdom: currentDocument.sections[idx].mnemonics.kingdom
    };
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections/${idx}/mnemonics`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mnemonics)
        });
        if (!res.ok) throw new Error('Save failed');
        
        currentDocument.sections[idx].mnemonics = mnemonics;
        currentDocument.sections[idx].user_edited = true;
        renderDocument(); // refresh to show dot
        showToast('Saved successfully', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function regenerateMnemonics(idx) {
    if (!currentDocument) return;
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/regenerate/${idx}`, { method: 'POST' });
        if (!res.ok) throw new Error('Regeneration failed');
        const data = await res.json();
        
        currentDocument.sections[idx].mnemonics = data.mnemonics;
        currentDocument.sections[idx].user_edited = false;
        renderDocument();
        showToast('Regenerated new mnemonics', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function saveDocumentTitle(newTitle) {
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/title`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        if (!res.ok) throw new Error('Failed to update title');
        
        currentDocument.filename = newTitle;
        currentDocument.title = newTitle;
        renderDocument(); 
        showToast('Title updated', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function exportDocument(id) {
    const btn = document.getElementById('btn-export');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Exporting...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/documents/${id}/export`, { method: 'POST' });
        if (!res.ok) throw new Error('Export failed');
        const data = await res.json();
        showToast(data.message, 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

async function deleteDocument(id) {
    if (!confirm("Delete this document and all extracted sections?")) return;
    try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('Document deleted', 'success');
        switchView('library');
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function copyDocument(id) {
    try {
        const res = await fetch(`/api/documents/${id}/copy`, { method: 'POST' });
        if (!res.ok) throw new Error('Copy failed');
        const data = await res.json();
        showToast(`Copied as "${data.filename}"`, 'success');
        // Navigate to the new copy
        await loadDocument(data.new_id);
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function toggleFavourite(id) {
    try {
        const res = await fetch(`/api/documents/${id}/favourite`, { method: 'PUT' });
        if (!res.ok) throw new Error('Toggle failed');
        const data = await res.json();
        currentDocument.favourite = data.favourite;
        // Update UI immediately
        const favBtn = document.getElementById('btn-favourite');
        const favIcon = document.getElementById('fav-icon');
        const favText = document.getElementById('fav-text');
        if (data.favourite) {
            favBtn.classList.add('fav-active');
            favIcon.textContent = '★';
            favText.textContent = 'Favourited';
            showToast('Added to favourites', 'success');
        } else {
            favBtn.classList.remove('fav-active');
            favIcon.textContent = '☆';
            favText.textContent = 'Favourite';
            showToast('Removed from favourites', 'info');
        }
    } catch (e) {
        showToast(e.message, 'error');
    }
}

function toggleEditMode() {
    const mnemonicsBlocks = document.querySelectorAll('.bs-list-item__mnemonics');
    const btn = document.getElementById('btn-edit-toggle');
    
    const isCurrentlyHidden = mnemonicsBlocks[0]?.style.display === 'none' || mnemonicsBlocks[0]?.style.display === '';
    const turnOn = isCurrentlyHidden;

    mnemonicsBlocks.forEach(block => {
        block.style.display = turnOn ? 'block' : 'none';
    });

    const body = document.body;
    const actionBar = document.getElementById('edit-action-bar');
    const titleDisplay = document.getElementById('doc-title-display');
    const titleInput = document.getElementById('doc-title-input');
    const wysiwygToolbar = document.getElementById('wysiwyg-toolbar');
    
    if (turnOn) {
        body.classList.add('editing-mode');
        if (actionBar) actionBar.classList.remove('hidden');
        if (btn) btn.innerHTML = '<span class="icon">✏️</span> Close Editor';
        if (titleDisplay) titleDisplay.classList.add('hidden');
        if (titleInput) titleInput.classList.remove('hidden');
        if (wysiwygToolbar) wysiwygToolbar.classList.remove('hidden');
    } else {
        body.classList.remove('editing-mode');
        if (actionBar) actionBar.classList.add('hidden');
        if (btn) btn.innerHTML = '<span class="icon">✏️</span> Edit';
        if (titleDisplay) titleDisplay.classList.remove('hidden');
        if (wysiwygToolbar) wysiwygToolbar.classList.add('hidden');
        if (titleInput) {
            titleInput.classList.add('hidden');
            const newTitle = titleInput.value.trim();
            const oldTitle = currentDocument.filename || currentDocument.title;
            if (newTitle && newTitle !== oldTitle) {
                saveDocumentTitle(newTitle);
            }
        }
    }
}

// ═══ Revisions Modal ═══
async function openRevisionsModal(docId) {
    const modal = document.getElementById('modal-revisions');
    const body = document.getElementById('revisions-body');
    body.innerHTML = '<p class="text-muted">Loading...</p>';
    modal.classList.remove('hidden');

    try {
        const res = await fetch(`/api/documents/${docId}/revisions`);
        if (!res.ok) throw new Error('Failed to load revisions');
        const data = await res.json();

        if (!data.revisions || data.revisions.length === 0) {
            body.innerHTML = '<p class="text-muted">No revision history available.</p>';
            return;
        }

        // Render timeline (newest first)
        const revs = [...data.revisions].reverse();
        let html = '<ul class="revision-timeline">';
        revs.forEach(rev => {
            const time = rev.timestamp ? timeAgo(rev.timestamp) : '';
            html += `
                <li class="revision-item">
                    <div class="revision-dot"></div>
                    <div class="revision-content">
                        <div class="rev-number">Revision #${rev.revision}</div>
                        <div class="rev-summary">${rev.summary || 'No description'}</div>
                        <div class="rev-time">${time}</div>
                    </div>
                </li>
            `;
        });
        html += '</ul>';
        body.innerHTML = html;
    } catch (e) {
        body.innerHTML = `<p class="text-muted">${e.message}</p>`;
    }
}

// ═══ Move Modal ═══
function openMoveModal(doc) {
    const modal = document.getElementById('modal-move');
    const grid = document.getElementById('move-book-grid');
    grid.innerHTML = '';

    for (const [name, profile] of Object.entries(bookProfiles)) {
        const btn = document.createElement('button');
        btn.className = `move-book-btn ${name === doc.book ? 'current' : ''}`;
        btn.innerHTML = `
            <span class="book-label">${name.replace('_', ' ')}</span>
            <span class="book-kingdom">${profile.kingdom || ''}</span>
        `;

        if (name !== doc.book) {
            btn.addEventListener('click', async () => {
                await moveDocument(doc.id, name);
                modal.classList.add('hidden');
            });
        }

        grid.appendChild(btn);
    }

    modal.classList.remove('hidden');
}

async function moveDocument(id, book) {
    try {
        const res = await fetch(`/api/documents/${id}/move?book=${book}`, { method: 'PUT' });
        if (!res.ok) throw new Error('Move failed');
        const data = await res.json();
        showToast(`Moved to ${data.new_book}`, 'success');
        await loadDocument(id);  // Reload to reflect changes
    } catch (e) {
        showToast(e.message, 'error');
    }
}

// ═══ Utilities ═══
function timeAgo(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ═══ Slicer Workspace Logic ═══

async function openSlicerWorkspace(file) {
    currentPdfFile = file;
    
    // Hide standard upload area controls
    document.getElementById('upload-zone').classList.add('hidden');
    document.querySelector('.book-selector').classList.add('hidden');
    
    // Show workspace
    const workspace = document.getElementById('slicer-workspace');
    workspace.classList.remove('hidden');
    
    // Initialize status elements
    const grid = document.getElementById('slicer-thumbnail-grid');
    grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">Reading PDF structure...</p>';
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF using pdf.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        currentPdfDoc = await loadingTask.promise;
        
        showToast('PDF loaded successfully', 'success');
        
        // Bind Scale Slider
        const scaleInput = document.getElementById('slicer-scale');
        scaleInput.oninput = (e) => {
            slicerThumbnailScale = parseFloat(e.target.value);
            renderSlicerThumbnails(currentPdfDoc);
        };
        
        // Render visual pages grid
        await renderSlicerThumbnails(currentPdfDoc);
        
        // Ingest TOC bookmarks outline
        const outline = await currentPdfDoc.getOutline();
        const tocListContainer = document.getElementById('toc-list');
        
        if (outline && outline.length > 0) {
            tocListContainer.innerHTML = '<p class="text-muted text-sm">Resolving page offsets...</p>';
            const flattened = flattenOutline(outline);
            const resolvedMarkers = [];
            
            for (const item of flattened) {
                const pageNum = await resolveOutlineItem(currentPdfDoc, item);
                if (pageNum !== null) {
                    resolvedMarkers.push({ title: item.title, page: pageNum });
                }
            }
            
            if (resolvedMarkers.length > 0) {
                // Render checkboxes
                tocListContainer.innerHTML = '';
                resolvedMarkers.forEach((marker, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'toc-item';
                    itemDiv.innerHTML = `
                        <input type="checkbox" id="toc-check-${index}" checked data-title="${marker.title}" data-page="${marker.page}">
                        <span class="toc-title" title="${marker.title}">${marker.title}</span>
                        <span class="toc-range-label">Page ${marker.page}</span>
                    `;
                    // Bind change listener
                    itemDiv.querySelector('input').addEventListener('change', updateSlicerRanges);
                    tocListContainer.appendChild(itemDiv);
                });
                
                // Set default chapters from TOC
                slicerActiveTab = 'toc';
                updateSlicerRanges();
            } else {
                tocListContainer.innerHTML = '<p class="text-muted text-sm" style="padding: 0.5rem;">No valid page bookmarks found in outline.</p>';
                switchSlicerTab('manual');
            }
        } else {
            tocListContainer.innerHTML = '<p class="text-muted text-sm" style="padding: 0.5rem;">No bookmarks detected in this PDF.</p>';
            switchSlicerTab('manual');
        }
        
        // Bind UI Controls
        document.getElementById('btn-cancel-slicer').onclick = closeSlicerWorkspace;
        document.getElementById('btn-execute-slicer').onclick = executeSlicer;
        
        // Tab switching
        document.querySelectorAll('.slicer-tab').forEach(tab => {
            tab.onclick = (e) => {
                switchSlicerTab(e.target.dataset.tab);
            };
        });
        
        // Ingest action buttons
        document.getElementById('btn-toc-select-all').onclick = () => {
            document.querySelectorAll('#toc-list input[type="checkbox"]').forEach(cb => cb.checked = true);
            updateSlicerRanges();
        };
        
        document.getElementById('btn-apply-manual').onclick = () => {
            const val = document.getElementById('manual-ranges-input').value;
            slicerChapters = parseManualRanges(val, currentPdfDoc.numPages);
            renderProposedChapters();
        };
        
        document.getElementById('btn-apply-fixed').onclick = () => {
            const pages = parseInt(document.getElementById('fixed-pages-input').value) || 5;
            slicerChapters = generateFixedRanges(pages, currentPdfDoc.numPages);
            renderProposedChapters();
        };
        
    } catch (e) {
        console.error("Failed to load PDF:", e);
        showToast(`Failed to parse PDF: ${e.message}`, 'error');
        closeSlicerWorkspace();
    }
}

function closeSlicerWorkspace() {
    currentPdfFile = null;
    currentPdfDoc = null;
    slicerChapters = [];
    
    // Restore layout
    document.getElementById('slicer-workspace').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');
    document.querySelector('.book-selector').classList.remove('hidden');
    
    // Reset file inputs
    document.getElementById('file-input').value = '';
    const progress = document.getElementById('upload-progress');
    if (progress) progress.classList.add('hidden');
}

async function renderSlicerThumbnails(pdf) {
    const grid = document.getElementById('slicer-thumbnail-grid');
    grid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">Rendering page thumbnails...</p>';
    
    const numPages = pdf.numPages;
    const fragment = document.createDocumentFragment();
    
    const renderPage = async (pageNumber) => {
        const page = await pdf.getPage(pageNumber);
        // Responsive scaling
        const viewport = page.getViewport({ scale: 0.3 * slicerThumbnailScale });
        
        const card = document.createElement('div');
        card.className = 'thumbnail-card';
        card.dataset.page = pageNumber;
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        
        const badge = document.createElement('div');
        badge.className = 'page-badge';
        badge.textContent = `Page ${pageNumber}`;
        
        card.appendChild(canvas);
        card.appendChild(badge);
        
        card.onclick = () => {
            toggleSlicerThumbnailSelection(pageNumber, card);
        };
        
        return card;
    };
    
    // Draw all
    grid.innerHTML = '';
    for (let p = 1; p <= numPages; p++) {
        try {
            const card = await renderPage(p);
            fragment.appendChild(card);
        } catch (err) {
            console.error("Page render error:", p, err);
        }
    }
    grid.appendChild(fragment);
    
    // Restore selections
    highlightThumbnailSelections();
}

function toggleSlicerThumbnailSelection(pageNumber, cardElement) {
    if (slicerActiveTab !== 'manual') {
        // Thumbnail clicking acts as visual zoom in tabs other than manual range selecting
        // Or we can let them add ranges manually by clicking
        showToast(`Visual page selection is configured in the 'Manual Ranges' tab.`, 'info');
        return;
    }
    
    const input = document.getElementById('manual-ranges-input');
    const curVal = input.value.trim();
    
    // Add page number to manual range input
    if (curVal) {
        input.value = curVal + `, ${pageNumber}`;
    } else {
        input.value = `${pageNumber}`;
    }
    
    // Apply changes automatically
    slicerChapters = parseManualRanges(input.value, currentPdfDoc.numPages);
    renderProposedChapters();
    highlightThumbnailSelections();
}

function highlightThumbnailSelections() {
    document.querySelectorAll('.thumbnail-card').forEach(card => {
        const pageNum = parseInt(card.dataset.page);
        const isSelected = slicerChapters.some(c => pageNum >= c.from && pageNum <= c.to);
        
        if (isSelected) {
            card.classList.add('selected');
            if (!card.querySelector('.thumbnail-checkmark')) {
                const check = document.createElement('div');
                check.className = 'thumbnail-checkmark';
                check.textContent = '✓';
                card.appendChild(check);
            }
        } else {
            card.classList.remove('selected');
            const check = card.querySelector('.thumbnail-checkmark');
            if (check) check.remove();
        }
    });
}

function switchSlicerTab(tabName) {
    slicerActiveTab = tabName;
    
    // Update headers
    document.querySelectorAll('.slicer-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Update panes
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `pane-${tabName}`);
    });
    
    updateSlicerRanges();
}

function updateSlicerRanges() {
    if (!currentPdfDoc) return;
    
    if (slicerActiveTab === 'toc') {
        const checkedItems = [];
        document.querySelectorAll('#toc-list input[type="checkbox"]:checked').forEach(cb => {
            checkedItems.push({
                title: cb.dataset.title,
                page: parseInt(cb.dataset.page)
            });
        });
        
        slicerChapters = computeRangesFromMarkers(checkedItems, currentPdfDoc.numPages);
    } else if (slicerActiveTab === 'manual') {
        const val = document.getElementById('manual-ranges-input').value;
        slicerChapters = parseManualRanges(val, currentPdfDoc.numPages);
    } else if (slicerActiveTab === 'fixed') {
        const pages = parseInt(document.getElementById('fixed-pages-input').value) || 5;
        slicerChapters = generateFixedRanges(pages, currentPdfDoc.numPages);
    }
    
    renderProposedChapters();
    highlightThumbnailSelections();
}

function renderProposedChapters() {
    const container = document.getElementById('proposed-chapters-list');
    container.innerHTML = '';
    
    if (slicerChapters.length === 0) {
        container.innerHTML = '<p class="text-muted text-sm" style="padding: 0.5rem; text-align: center;">No chapters configured yet.</p>';
        return;
    }
    
    slicerChapters.forEach((chapter, index) => {
        const item = document.createElement('div');
        item.className = 'proposed-chapter-item';
        item.innerHTML = `
            <input type="text" value="${chapter.name}" data-id="${chapter.id}" style="width: 60%;">
            <span class="range-badge">Pages ${chapter.from} - ${chapter.to}</span>
            <button class="btn-remove-proposed" data-id="${chapter.id}">✕</button>
        `;
        
        // Name update listener
        item.querySelector('input').addEventListener('input', (e) => {
            const chId = e.target.dataset.id;
            slicerChapters = slicerChapters.map(c => c.id === chId ? { ...c, name: e.target.value } : c);
        });
        
        // Remove listener
        item.querySelector('.btn-remove-proposed').onclick = () => {
            slicerChapters = slicerChapters.filter(c => c.id !== chapter.id);
            renderProposedChapters();
            highlightThumbnailSelections();
        };
        
        container.appendChild(item);
    });
}

// Helper structures for slicer mapping
function flattenOutline(outline) {
    const list = [];
    function recurse(items) {
        if (!items) return;
        for (const item of items) {
            list.push(item);
            recurse(item.items);
        }
    }
    recurse(outline);
    return list;
}

async function resolveOutlineItem(pdf, item) {
    let dest = item.dest;
    if (!dest) return null;
    if (typeof dest === 'string') {
        dest = await pdf.getDestination(dest);
    }
    if (Array.isArray(dest) && dest.length > 0) {
        const pageRef = dest[0];
        try {
            const pageIndex = await pdf.getPageIndex(pageRef);
            return pageIndex + 1;
        } catch (err) {
            console.error("Outline marker page resolution error:", err);
            return null;
        }
    }
    return null;
}

function computeRangesFromMarkers(markers, totalPages) {
    const valid = markers.filter(m => m.page !== null && m.page >= 1 && m.page <= totalPages);
    if (valid.length === 0) return [];
    
    valid.sort((a, b) => a.page - b.page);
    
    // Deduplicate same pages
    const unique = [];
    const seen = new Set();
    for (const item of valid) {
        if (!seen.has(item.page)) {
            seen.add(item.page);
            unique.push(item);
        }
    }
    
    const ranges = [];
    for (let i = 0; i < unique.length; i++) {
        const current = unique[i];
        const next = unique[i + 1];
        
        const from = current.page;
        const to = next ? next.page - 1 : totalPages;
        
        if (from <= to) {
            ranges.push({
                id: 'toc-' + i + '-' + Date.now(),
                name: current.title.replace(/[^\w\s-]/g, '').trim() || `Chapter_${i+1}`,
                from: from,
                to: to
            });
        }
    }
    return ranges;
}

function parseManualRanges(str, totalPages) {
    const parts = str.split(',');
    const ranges = [];
    let counter = 1;
    for (const part of parts) {
        const trim = part.trim();
        if (!trim) continue;
        const bounds = trim.split('-');
        if (bounds.length === 1) {
            const pg = parseInt(bounds[0]);
            if (!isNaN(pg) && pg >= 1 && pg <= totalPages) {
                ranges.push({
                    id: 'manual-' + counter++ + '-' + Date.now(),
                    name: `Chapter_${pg}`,
                    from: pg,
                    to: pg
                });
            }
        } else if (bounds.length === 2) {
            const from = parseInt(bounds[0]);
            const to = parseInt(bounds[1]);
            if (!isNaN(from) && !isNaN(to) && from >= 1 && to <= totalPages && from <= to) {
                ranges.push({
                    id: 'manual-' + counter++ + '-' + Date.now(),
                    name: `Chapter_${from}_to_${to}`,
                    from: from,
                    to: to
                });
            }
        }
    }
    return ranges;
}

function generateFixedRanges(pagesPerSplit, totalPages) {
    const ranges = [];
    let from = 1;
    let counter = 1;
    while (from <= totalPages) {
        const to = Math.min(from + pagesPerSplit - 1, totalPages);
        ranges.push({
            id: 'fixed-' + counter + '-' + Date.now(),
            name: `Chapter_Part_${counter}`,
            from: from,
            to: to
        });
        from = to + 1;
        counter++;
    }
    return ranges;
}

async function executeSlicer() {
    if (slicerChapters.length === 0) {
        return showToast('Please configure at least one chapter range.', 'error');
    }
    
    const btn = document.getElementById('btn-execute-slicer');
    const originalText = btn.textContent;
    btn.textContent = 'Preparing splits...';
    btn.disabled = true;
    
    try {
        const arrayBuffer = await currentPdfFile.arrayBuffer();
        const originalBytes = new Uint8Array(arrayBuffer);
        
        // Load original document into pdf-lib
        const srcDoc = await PDFLib.PDFDocument.load(originalBytes);
        
        showToast(`Splitting into ${slicerChapters.length} chapters...`, 'info');
        
        // Loop through and slice
        for (let i = 0; i < slicerChapters.length; i++) {
            const chapter = slicerChapters[i];
            btn.textContent = `Processing Chapter ${i + 1}/${slicerChapters.length}...`;
            
            const newPdf = await PDFLib.PDFDocument.create();
            const start = chapter.from - 1; // Convert to 0-indexed index
            const end = chapter.to - 1;
            
            const pageIndices = Array.from({ length: end - start + 1 }, (_, index) => start + index);
            const copiedPages = await newPdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach(p => newPdf.addPage(p));
            
            const pdfBytes = await newPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            // Upload to backend sequentially
            btn.textContent = `Uploading Chapter ${i + 1}/${slicerChapters.length}...`;
            const formData = new FormData();
            formData.append('file', blob, `${chapter.name}.pdf`);
            
            const res = await fetch(`/api/upload?book=${selectedBook}`, {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) {
                throw new Error(`Failed to upload ${chapter.name}: ${await res.text()}`);
            }
            
            showToast(`Uploaded ${chapter.name}`, 'success');
        }
        
        showToast('All chapters successfully split and imported!', 'success');
        
        // Restore screen & reload catalog library
        closeSlicerWorkspace();
        await loadLibrary();
        switchView('library');
        
    } catch (err) {
        console.error("Slicer extraction failed:", err);
        showToast(`Slicing or upload failed: ${err.message}`, 'error');
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

