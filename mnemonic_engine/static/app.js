/*
  Anti-Gravity Mnemonic Engine — Client Application
*/

let currentDocument = null;
let bookProfiles = {};
let selectedBook = 'Networking';

// ═══ Initialization ═══
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupUploadZone();
    
    await checkEngineStatus();
    await loadBooks();
    await loadLibrary();
});

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
    
    const progress = document.getElementById('upload-progress');
    const fill = document.getElementById('progress-fill');
    const text = document.getElementById('progress-text');
    
    progress.classList.remove('hidden');
    fill.style.width = '10%';
    text.textContent = `Uploading ${file.name}...`;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        fill.style.width = '40%';
        text.textContent = 'Extracting and generating mnemonics...';
        
        const res = await fetch(`/api/upload?book=${selectedBook}`, {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) throw new Error(await res.text());
        
        const data = await res.json();
        fill.style.width = '100%';
        text.textContent = 'Complete!';
        
        showToast('PDF processed successfully', 'success');
        setTimeout(() => loadDocument(data.id), 500);
        
    } catch (e) {
        showToast(e.message, 'error');
        progress.classList.add('hidden');
    }
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
    document.getElementById('breadcrumb-title').textContent = doc.title;
    
    document.getElementById('doc-header').innerHTML = `
        <h1>${doc.title}</h1>
        <p class="text-muted" style="margin-bottom: 2rem;">Processed via Anti-Gravity Mnemonic Engine</p>
    `;

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
    
    // Bind document level actions
    document.getElementById('btn-export').onclick = () => exportDocument(doc.id);
    document.getElementById('btn-delete').onclick = () => deleteDocument(doc.id);
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

// ═══ Utilities ═══
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
