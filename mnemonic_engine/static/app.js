/*
  Anti-Gravity Mnemonic Engine — Client Application
*/

let currentDocument = null;
let bookProfiles = {};
let selectedBook = 'Networking';

// Notification state — tracks when a job finishes so we can alert the user
let _wasProcessing = false;
let _lastCompletedJob = null;

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
    requestNotificationPermission();

    await checkEngineStatus();
    await loadBooks();
    await loadLibrary();

    startGlobalProgressPolling();
});

// ═══ Desktop / Browser Notifications ═══
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function fireCompletionNotification(title, body) {
    // 1. In-app toast (always works)
    showToast(body, 'success');

    // 2. Browser Web Notification (shows as OS system popup)
    if ('Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(title, {
            body,
            icon: '/static/icon.png',
            tag: 'agke-ingest-complete',   // deduplicate repeated firings
            requireInteraction: false,
        });
        // Auto-close after 8 seconds
        setTimeout(() => n.close(), 8000);
    }
}

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

                    // ── Completion notification ──────────────────────────
                    // Fire once when we transition FROM an active job TO idle
                    if (_wasProcessing) {
                        _wasProcessing = false;
                        const jobLabel = _lastCompletedJob || 'Processing';
                        _lastCompletedJob = null;

                        // Refresh library so new chapters appear immediately
                        loadLibrary();

                        fireCompletionNotification(
                            '✅ Memory Vault — Ingest Complete',
                            `${jobLabel} finished. Your library has been updated.`
                        );
                    }
                } else {
                    _wasProcessing = true;
                    // Track the job label for the completion message
                    if (data.status === 'batch') {
                        _lastCompletedJob = `Batch ingest (${data.total_files} chapters)`;
                    } else if (data.filename) {
                        _lastCompletedJob = data.filename;
                    }

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
                    if (text) text.textContent = data.message || 'Processing...';

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

    // Engine Constraints Minimize/Restore logic
    const minimizeEngineBtn = document.getElementById('btn-minimize-engine');
    const restoreEngineBtn = document.getElementById('btn-restore-engine');
    const engineCol = document.getElementById('engine-constraints-col');

    const minimizeMnemonicsBtn = document.getElementById('btn-minimize-mnemonics');
    const restoreMnemonicsBtn = document.getElementById('btn-restore-mnemonics');
    const mnemonicsCol = document.getElementById('mnemonics-editor-col');
    
    const mnemonicsSidebar = document.getElementById('mnemonics-sidebar');

    const updateSidebarState = () => {
        const engineHidden = engineCol && engineCol.style.display === 'none';
        const mnemonicsHidden = mnemonicsCol && mnemonicsCol.style.display === 'none';
        
        if (engineHidden && mnemonicsHidden) {
            if (mnemonicsSidebar) mnemonicsSidebar.style.display = 'none';
        } else {
            if (mnemonicsSidebar) {
                mnemonicsSidebar.style.display = '';
                if (engineHidden || mnemonicsHidden) {
                    mnemonicsSidebar.style.width = '350px';
                } else {
                    mnemonicsSidebar.style.width = 'clamp(320px, 45vw, 700px)';
                }
            }
        }
    };

    if (minimizeEngineBtn && restoreEngineBtn && engineCol) {
        minimizeEngineBtn.addEventListener('click', () => {
            engineCol.style.display = 'none';
            restoreEngineBtn.classList.remove('hidden');
            updateSidebarState();
        });
        restoreEngineBtn.addEventListener('click', () => {
            engineCol.style.display = '';
            restoreEngineBtn.classList.add('hidden');
            updateSidebarState();
        });
    }

    if (minimizeMnemonicsBtn && restoreMnemonicsBtn && mnemonicsCol) {
        minimizeMnemonicsBtn.addEventListener('click', () => {
            mnemonicsCol.style.display = 'none';
            restoreMnemonicsBtn.classList.remove('hidden');
            updateSidebarState();
        });
        restoreMnemonicsBtn.addEventListener('click', () => {
            mnemonicsCol.style.display = '';
            restoreMnemonicsBtn.classList.add('hidden');
            updateSidebarState();
        });
    }
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
        card.dataset.book = name;
        
        // Escape quotes to prevent HTML injection in inputs
        const esc = (str) => (str || '').replace(/"/g, '&quot;');

        card.innerHTML = `
            <div class="profile-card__header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: ${color}; margin: 0;">${name.replace('_', ' ')}</h3>
                <button class="btn btn-secondary btn-sm edit-profile-btn" data-book="${name}">⚙ Edit</button>
            </div>
            
            <div class="profile-card__body profile-view" id="profile-view-${name}">
                <p><strong>Kingdom:</strong> ${esc(profile.kingdom)}</p>
                <p><strong>Aesthetic:</strong> ${esc(profile.aesthetic)}</p>
                <p><strong>Scent:</strong> ${esc(profile.scent_primary)} + ${esc(profile.scent_secondary)}</p>
                <p><strong>MC Profile:</strong> ${esc(profile.mc_profile)}</p>
                <p><strong>Plot:</strong> ${esc(profile.plot)}</p>
            </div>
            
            <div class="profile-card__body profile-edit hidden" id="profile-edit-${name}" style="margin-top: 1rem;">
                <div class="form-group">
                    <label>Kingdom</label>
                    <input type="text" id="edit-kingdom-${name}" value="${esc(profile.kingdom)}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Aesthetic</label>
                    <input type="text" id="edit-aesthetic-${name}" value="${esc(profile.aesthetic)}" class="form-control">
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <div class="form-group" style="flex: 1;">
                        <label>Primary Scent</label>
                        <input type="text" id="edit-scent1-${name}" value="${esc(profile.scent_primary)}" class="form-control">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Secondary Scent</label>
                        <input type="text" id="edit-scent2-${name}" value="${esc(profile.scent_secondary)}" class="form-control">
                    </div>
                </div>
                <div class="form-group">
                    <label>MC Profile</label>
                    <input type="text" id="edit-mc-${name}" value="${esc(profile.mc_profile)}" class="form-control">
                </div>
                <div class="form-group">
                    <label>Plot</label>
                    <input type="text" id="edit-plot-${name}" value="${esc(profile.plot)}" class="form-control">
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1rem;">
                    <button class="btn btn-link btn-sm cancel-profile-btn" data-book="${name}">Cancel</button>
                    <button class="btn btn-primary btn-sm save-profile-btn" data-book="${name}">Save</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    }

    // Attach event listeners for editing
    document.querySelectorAll('.edit-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const book = e.currentTarget.dataset.book;
            document.getElementById(`profile-view-${book}`).classList.add('hidden');
            document.getElementById(`profile-edit-${book}`).classList.remove('hidden');
            e.currentTarget.classList.add('hidden');
        });
    });

    document.querySelectorAll('.cancel-profile-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const book = e.currentTarget.dataset.book;
            document.getElementById(`profile-edit-${book}`).classList.add('hidden');
            document.getElementById(`profile-view-${book}`).classList.remove('hidden');
            document.querySelector(`.edit-profile-btn[data-book="${book}"]`).classList.remove('hidden');
        });
    });

    document.querySelectorAll('.save-profile-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const book = e.currentTarget.dataset.book;
            const payload = {
                kingdom: document.getElementById(`edit-kingdom-${book}`).value,
                aesthetic: document.getElementById(`edit-aesthetic-${book}`).value,
                scent_primary: document.getElementById(`edit-scent1-${book}`).value,
                scent_secondary: document.getElementById(`edit-scent2-${book}`).value,
                mc_profile: document.getElementById(`edit-mc-${book}`).value,
                plot: document.getElementById(`edit-plot-${book}`).value
            };
            
            try {
                btn.disabled = true;
                btn.textContent = 'Saving...';
                
                const res = await fetch(`/api/books/${book}`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(payload)
                });
                
                if (!res.ok) throw new Error('Failed to save profile');
                showToast('Profile updated successfully', 'success');
                
                // Refresh data
                await loadBooks();
            } catch (err) {
                showToast(err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Save';
            }
        });
    });
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

// ═══ Batch Local Ingest (pre-split Sybex chapters) ═══
async function ingestLocalChapters() {
    const btn = document.getElementById('btn-ingest-local');
    if (btn) { btn.disabled = true; btn.textContent = 'Ingesting\u2026'; }

    showToast('Starting batch ingest of all 25 Networking chapters\u2026', 'info');

    try {
        const res = await fetch('/api/ingest-local?book=Networking&start=1&end=25', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) {
            showToast(data.detail || 'Ingest failed', 'error');
        } else {
            const count = data.ingested?.length ?? 0;
            const skipped = data.skipped?.length ?? 0;
            showToast(`Batch ingest complete: ${count} chapters ingested, ${skipped} skipped.`, 'success');
            await loadLibrary();
            switchView('library');
        }
    } catch (e) {
        showToast('Ingest request failed: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '\u26a1 Load All Networking Chapters'; }
    }
}

// ═══ Library & Document ═══
async function loadLibrary() {
    try {
        const res = await fetch('/api/textbooks');
        const data = await res.json();
        
        // Calculate total docs
        let docCount = data.loose.length;
        data.textbooks.forEach(tb => docCount += tb.chapter_count);
        document.getElementById('doc-count').textContent = `${docCount} documents`;

        const grid = document.getElementById('library-grid');
        const empty = document.getElementById('library-empty');
        
        grid.innerHTML = '';
        
        if (docCount === 0) {
            empty.classList.remove('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        
        // 1. Render Grouped Textbooks
        data.textbooks.forEach(tb => {
            const profile = bookProfiles[tb.book] || {};
            const color = profile.color_palette?.[0] || 'var(--color-primary)';
            
            const card = document.createElement('div');
            card.className = 'doc-card textbook-card';
            card.style.borderLeft = `4px solid ${color}`;
            
            card.innerHTML = `
                <div class="doc-card__meta">
                    <span class="doc-card__chapter-badge" style="background: ${color}">${tb.chapter_count} Chapters</span>
                    <span>${tb.total_sections} sections</span>
                </div>
                <div class="doc-card__title" title="${tb.textbook}">${tb.textbook}</div>
                <div class="doc-card__tag" style="color: ${color}">${tb.book.replace('_', ' ')}</div>
                
                <div class="textbook-chapters hidden">
                    <!-- Populated via JS below -->
                </div>
            `;
            
            // Setup expand/collapse logic for chapters
            const chList = card.querySelector('.textbook-chapters');
            card.addEventListener('click', (e) => {
                // If they clicked a chapter directly, don't toggle
                if (e.target.closest('.textbook-chapter-item')) return;
                chList.classList.toggle('hidden');
            });

            // Populate chapters inside the card
            tb.chapters.forEach(ch => {
                const chItem = document.createElement('div');
                chItem.className = 'textbook-chapter-item';
                chItem.innerHTML = `
                    <span class="ch-num">Ch. ${String(ch.chapter_number).padStart(2, '0')}</span>
                    <span class="ch-title" title="${ch.chapter_title}">${ch.chapter_title}</span>
                    <span class="ch-sections">${ch.section_count} sec</span>
                `;
                chItem.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent card toggle
                    loadDocument(ch.id);
                });
                chList.appendChild(chItem);
            });
            
            grid.appendChild(card);
        });

        // 2. Render Loose Documents
        data.loose.forEach(doc => {
            const profile = bookProfiles[doc.book] || {};
            const color = profile.color_palette?.[0] || 'var(--border)';
            
            const date = new Date(doc.uploaded_at).toLocaleDateString();
            const card = document.createElement('div');
            card.className = 'doc-card';
            card.style.borderLeft = `4px solid ${color}`;
            
            card.innerHTML = `
                <div class="doc-card__meta">
                    ${doc.chapter_number ? `<span class="doc-card__chapter-badge">Ch. ${String(doc.chapter_number).padStart(2,'0')}</span>` : `<span>${date}</span>`}
                    <span>${doc.section_count} sections</span>
                </div>
                <div class="doc-card__title" title="${doc.chapter_title || doc.filename}">${doc.chapter_title || doc.filename}</div>
                <div class="doc-card__tag" style="color: ${color}">${doc.book.replace('_', ' ')}</div>
            `;
            
            card.addEventListener('click', () => loadDocument(doc.id));
            grid.appendChild(card);
        });
    } catch (e) {
        showToast('Failed to load library', 'error');
    }
}

// ═══ Upload / Progress ═══
function setupUploadZone() {
    const zone = document.getElementById('upload-zone');
    const input = document.getElementById('file-input');
    
    zone.onclick = () => input.click();
    
    zone.ondragover = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--color-primary)';
        zone.style.background = 'var(--bg-hover)';
    };
    
    zone.ondragleave = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border-color)';
        zone.style.background = 'var(--bg-card)';
    };
    
    zone.ondrop = (e) => {
        e.preventDefault();
        zone.style.borderColor = 'var(--border-color)';
        zone.style.background = 'var(--bg-card)';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };
    
    input.onchange = (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
        input.value = '';
    };
}

async function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('Only PDF files are supported.', 'error');
        return;
    }
    
    await openSlicerWorkspace(file);
}

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function sendDesktopNotification(title, options) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, options);
    }
}

async function pollProgress() {
    try {
        const res = await fetch('/api/progress');
        const data = await res.json();
        const container = document.getElementById('progress-container');
        
        if (data.status === 'idle') {
            container.style.display = 'none';
            if (_wasProcessing) {
                // We just transitioned from processing to idle
                _wasProcessing = false;
                if (_lastCompletedJob) {
                    sendDesktopNotification("Anti-Gravity Engine", {
                        body: `Finished processing: ${_lastCompletedJob}`,
                        icon: "/static/favicon.ico"
                    });
                    _lastCompletedJob = null;
                }
                loadLibrary(); // refresh library to show new doc
            }
        } else {
            container.style.display = 'block';
            _wasProcessing = true;
            _lastCompletedJob = data.filename;
            
            document.getElementById('progress-text').textContent = data.message || 'Processing...';
            const bar = document.getElementById('progress-bar-fill');
            
            if (data.status === 'extracting') {
                const pct = (data.current_page / data.total_pages) * 100;
                bar.style.width = `${pct}%`;
                bar.style.background = '#4ecca3';
            } else if (data.status === 'generating') {
                const pct = (data.current_section / data.total_sections) * 100;
                bar.style.width = `${pct}%`;
                bar.style.background = '#ffd166';
            } else if (data.status === 'batch') {
                const pct = (data.current_file / data.total_files) * 100;
                bar.style.width = `${pct}%`;
                bar.style.background = '#06d6a0';
            }
        }
    } catch (e) {
        // ignore errors to prevent spam
    }
    setTimeout(pollProgress, 1000);
}

// ═══ Document View ═══
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
    // Use canonical chapter title when available, fall back to filename
    const displayTitle = doc.chapter_number
        ? `Chapter ${String(doc.chapter_number).padStart(2,'0')} \u2014 ${doc.chapter_title}`
        : (doc.title || doc.filename || 'Untitled');
    document.getElementById('breadcrumb-title').textContent = displayTitle;
    
    document.getElementById('doc-header').innerHTML = `
        <h1 id="doc-title-display" title="Click to load chapter mnemonics" style="cursor: pointer;">${displayTitle}</h1>
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; width: 100%;">
            <input type="text" id="doc-title-input" class="hidden" value="${displayTitle}" style="flex-grow: 1; font-size: 2.5rem; border-radius: 4px; padding: 0.5rem; margin-bottom: 0.25rem; font-family: inherit; font-weight: 400; color: #ffffff; background: var(--bg-hover); border: 1px solid var(--border-color);">
            <button class="btn btn-link hidden" id="btn-open-editor-title" title="Open Mnemonics Editor" style="font-size: 1.5rem; color: var(--color-primary); background: transparent; border: 1px solid var(--color-primary); border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer;">➕</button>
        </div>
        
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

    // Bind title click for chapter mnemonics
    const titleDisplay = document.getElementById('doc-title-display');
    const titleInput = document.getElementById('doc-title-input');
    
    const triggerChapterSidebar = () => {
        if (document.body.classList.contains('editing-mode')) {
            updateEngineSidebar(-1);
            loadMnemonicsToSidebar(-1);
        }
    };

    if (titleDisplay) {
        titleDisplay.addEventListener('click', triggerChapterSidebar);
    }
    if (titleInput) {
        titleInput.addEventListener('click', triggerChapterSidebar);
        titleInput.addEventListener('focusin', triggerChapterSidebar);
    }

    const btnOpenEditorTitle = document.getElementById('btn-open-editor-title');
    if (btnOpenEditorTitle) {
        btnOpenEditorTitle.addEventListener('click', (e) => {
            e.stopPropagation();
            const mnemonicsCol = document.getElementById('mnemonics-editor-col');
            const restoreMnemonicsBtn = document.getElementById('btn-restore-mnemonics');
            if (mnemonicsCol && restoreMnemonicsBtn && mnemonicsCol.style.display === 'none') {
                restoreMnemonicsBtn.click();
            }
            updateEngineSidebar(-1);
            loadMnemonicsToSidebar(-1);
        });
    }

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
        
        const isEditing = document.body.classList.contains('editing-mode');
        // Escape quotes to prevent HTML injection in inputs
        const esc = (str) => (str || '').replace(/"/g, '&quot;');

        div.innerHTML = `
            <div class="bs-list-item__header" style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="${isEditing ? 'hidden' : ''}">
                    <div class="bs-list-item__title" id="section-title-view-${index}">${section.title}</div>
                </div>
            </div>
            
            <!-- Source Text Editing Form -->
            <div class="bs-list-item__source-edit ${isEditing ? '' : 'hidden'}" id="section-source-edit-${index}" style="padding: 1rem; background: var(--bg-hover); border-bottom: 1px solid var(--border-color);">
                <div class="form-group" style="display: flex; align-items: flex-end; gap: 1rem; margin-bottom: 1rem;">
                    <div style="flex-grow: 1;">
                        <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Section Title</label>
                        <input type="text" class="form-control" id="edit-section-title-${index}" value="${esc(section.title)}" style="width: 100%;">
                    </div>
                    <button class="btn btn-link btn-open-editor-section" data-index="${index}" title="Open Mnemonics Editor" style="font-size: 1.2rem; color: var(--color-primary); background: transparent; border: 1px solid var(--color-primary); border-radius: 50%; width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; cursor: pointer; margin-bottom: 2px;">➕</button>
                </div>
                <div class="form-group">
                    <label style="display: block; font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Source Content</label>
                    <textarea class="form-control" id="edit-section-content-${index}" style="min-height: 200px; resize: vertical; width: 100%;">${esc(section.content)}</textarea>
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
                    <button class="btn btn-secondary btn-sm btn-delete-section" id="btn-del-sec-${index}" data-index="${index}" style="margin-right: auto; border: 1px solid var(--border-color); color: #ff6b6b; background: transparent;">🗑️ Delete Section</button>
                    <button class="btn btn-secondary btn-sm btn-split-section" data-index="${index}" style="border: 1px solid var(--border-color); background: transparent; color: #ffd166;">✂️ Split Bullets</button>
                    <button class="btn btn-secondary btn-sm btn-add-section" data-index="${index}" style="border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary);">➕ Insert Section Below</button>
                    <button class="btn btn-primary btn-sm btn-save-source" data-index="${index}">Save Source</button>
                </div>
            </div>

            <div class="bs-list-item__body">
                <div class="bs-list-item__content ${isEditing ? 'hidden' : ''}" id="section-content-view-${index}">${section.content}</div>
            </div>
        `;

        div.querySelector('.btn-save-source').onclick = () => saveSectionSource(index);
        div.querySelector('.btn-delete-section').onclick = () => deleteSection(index);
        div.querySelector('.btn-add-section').onclick = () => createSection(index);
        div.querySelector('.btn-split-section').onclick = () => splitSection(index);
        
        // Sidebar update on focus/click
        div.addEventListener('focusin', () => { updateEngineSidebar(index); loadMnemonicsToSidebar(index); });
        div.addEventListener('click', () => { updateEngineSidebar(index); loadMnemonicsToSidebar(index); });

        const btnOpenEditorSection = div.querySelector('.btn-open-editor-section');
        if (btnOpenEditorSection) {
            btnOpenEditorSection.addEventListener('click', (e) => {
                e.stopPropagation();
                const mnemonicsCol = document.getElementById('mnemonics-editor-col');
                const restoreMnemonicsBtn = document.getElementById('btn-restore-mnemonics');
                if (mnemonicsCol && restoreMnemonicsBtn && mnemonicsCol.style.display === 'none') {
                    restoreMnemonicsBtn.click();
                }
                updateEngineSidebar(index);
                loadMnemonicsToSidebar(index);
            });
        }

        sectionsList.appendChild(div);
    });

    // Add global 'Add Section to End' button
    const isEditing = document.body.classList.contains('editing-mode');
    const addGlobalDiv = document.createElement('div');
    addGlobalDiv.className = `global-add-section-container ${isEditing ? '' : 'hidden'}`;
    addGlobalDiv.style.textAlign = 'center';
    addGlobalDiv.style.marginTop = '2rem';
    addGlobalDiv.innerHTML = `<button class="btn btn-secondary btn-sm" id="btn-add-section-global" style="padding: 0.75rem 2rem; font-size: 1rem; border: 1px dashed var(--border-color); background: transparent; color: var(--text-secondary);">➕ Add New Section to End</button>`;
    
    addGlobalDiv.querySelector('#btn-add-section-global').onclick = () => createSection(-1);
    sectionsList.appendChild(addGlobalDiv);
    
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
function generateAcronymFromTitle(idx) {
    if (!currentDocument) return;
    
    let title = "";
    if (activeSectionIndex === -1) {
        title = currentDocument.chapter_title || currentDocument.title || currentDocument.filename || "";
    } else {
        title = currentDocument.sections[activeSectionIndex]?.title || "";
    }

    // Ignore numeric prefixes like "1.2 " at the beginning
    const cleanedTitle = title.replace(/^[\d\.]+\s*/, '');
    
    // Extract first letter of each capitalized word to ignore minor words like 'and', 'the'
    const words = cleanedTitle.split(/[\s-]+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
    const acronym = words
        .map(w => w.match(/[a-zA-Z]/)?.[0])
        .filter(char => char && char === char.toUpperCase())
        .join('');
    
    const acronymField = document.getElementById('sidebar-acronym');
    if (acronymField) {
        acronymField.value = acronym;
        // Add a small highlight effect to show it was updated
        acronymField.style.transition = 'background-color 0.3s';
        acronymField.style.backgroundColor = 'rgba(78, 204, 163, 0.2)';
        setTimeout(() => acronymField.style.backgroundColor = '', 500);
    }
}

function updateEngineSidebar(idx) {
    if (!currentDocument || !document.body.classList.contains('editing-mode')) return;
    
    activeSectionIndex = idx;
    
    let title = "";
    let terms = "Unknown";
    
    if (idx === -1) {
        title = currentDocument.chapter_title || currentDocument.title || currentDocument.filename || "Unknown";
        terms = title;
    } else {
        const section = currentDocument.sections[idx];
        if (!section) return;
        title = section.title;
        if (section.key_terms && section.key_terms.length > 0) {
            terms = section.key_terms.join(", ");
        } else {
            terms = section.title;
        }
    }

    const profile = bookProfiles[currentDocument.book] || {};
    const kingdom = profile.kingdom || 'Amphibians';
    const aesthetic = profile.aesthetic || 'decaying';
    const scent1 = profile.scent_primary || 'Ambrosia';
    const scent2 = profile.scent_secondary || 'Ammonia';
    
    const html = `
        <div style="margin-bottom: 1.5rem;">
            <p style="margin: 0.25rem 0;"><strong>Kingdom Base:</strong> <span class="prompt-highlight-constraint">${kingdom}</span></p>
            <p style="margin: 0.25rem 0;"><strong>Aesthetic Modifier:</strong> <span class="prompt-highlight-constraint">${aesthetic}</span></p>
            <p style="margin: 0.25rem 0;"><strong>Primary Scent:</strong> <span class="prompt-highlight-constraint">${scent1}</span></p>
            <p style="margin: 0.25rem 0;"><strong>Secondary Scent:</strong> <span class="prompt-highlight-constraint">${scent2}</span></p>
        </div>
        
        <div style="margin-bottom: 0.5rem; color: #7a7a7a; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">Engine Prompt Logic</div>
        <div class="prompt-box">
Select a <span class="prompt-highlight-constraint">${kingdom}</span> visual template.
Format it using the action: "<span class="prompt-highlight-constraint">${aesthetic}</span>".

Apply to context:
"the <span class="prompt-highlight-content">${title.toLowerCase()}</span> architecture".

Primary term(s) to encode:
"<span class="prompt-highlight-title">${terms}</span>"

<span style="color:#5c6370;"># Scent Anchors</span>
Blend scent description for <span class="prompt-highlight-constraint">${scent1}</span>
with the lingering trace of <span class="prompt-highlight-constraint">${scent2}</span>.
        </div>
    `;
    
    const display = document.getElementById('engine-prompt-display');
    if (display) {
        display.innerHTML = html;
        // Small flash to indicate update
        display.style.opacity = '0.5';
        setTimeout(() => display.style.opacity = '1', 150);
    }
}

function loadMnemonicsToSidebar(idx) {
    if (!currentDocument || !document.body.classList.contains('editing-mode')) return;
    
    let mnemonics = {};
    let sectionTitle = '';

    if (idx === -1) {
        mnemonics = currentDocument.mnemonics || {};
        sectionTitle = currentDocument.chapter_title || currentDocument.title || currentDocument.filename || '';
    } else if (idx !== -1 && currentDocument.sections[idx]) {
        mnemonics = currentDocument.sections[idx].mnemonics || {};
        sectionTitle = currentDocument.sections[idx].title || '';
    }

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            el.value = val || '';
            el.style.transition = 'background-color 0.3s';
            el.style.backgroundColor = 'rgba(78, 204, 163, 0.1)';
            setTimeout(() => el.style.backgroundColor = '', 300);
        }
    };

    // Auto-derive acronym from section/chapter title:
    // Strip any leading numeric section prefix (e.g. "1.2 "), then take the
    // uppercased first letter of every alphabetic word.
    // Falls back to the raw title if the title is empty.
    const cleanedTitle = sectionTitle.replace(/^[\d\.]+\s*/, '');
    const words = cleanedTitle.split(/[\s\-—]+/).filter(w => w.length > 0 && /[a-zA-Z]/.test(w));
    const acronym = words
        .map(w => w.match(/[a-zA-Z]/)?.[0]?.toUpperCase())
        .filter(Boolean)
        .join('');

    // Acronym Anchor: always show the derived acronym letters (or raw title as fallback)
    setVal('sidebar-acronym', acronym || sectionTitle);
    // Visual Anchor, Scent Profile, Logic Link: load from saved mnemonic values
    setVal('sidebar-visual', mnemonics.visual_anchor);
    setVal('sidebar-scent', mnemonics.scent_anchor);
    setVal('sidebar-logic', mnemonics.logic_link);
}

async function saveMnemonics() {
    if (!currentDocument || activeSectionIndex < -1) {
        return;
    }
    const idx = activeSectionIndex;
    
    const mnemonics = {
        acronym: document.getElementById('sidebar-acronym').value,
        visual_anchor: document.getElementById('sidebar-visual').value,
        scent_anchor: document.getElementById('sidebar-scent').value,
        logic_link: document.getElementById('sidebar-logic').value,
        kingdom: idx === -1 ? (currentDocument.mnemonics?.kingdom || 'Amphibians') : (currentDocument.sections[idx].mnemonics?.kingdom || 'Amphibians')
    };
    
    const btn = document.getElementById('btn-sidebar-save');
    const ogText = btn.innerHTML;
    btn.innerHTML = 'Saving...';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections/${idx}/mnemonics`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(mnemonics)
        });
        if (!res.ok) throw new Error('Save failed');
        
        if (idx === -1) {
            currentDocument.mnemonics = mnemonics;
        } else {
            currentDocument.sections[idx].mnemonics = mnemonics;
            currentDocument.sections[idx].user_edited = true;
            renderDocument(); // refresh to show dot
        }
        
        const msg = document.getElementById('mnemonics-status-msg');
        msg.style.display = 'block';
        msg.textContent = 'Saved!';
        setTimeout(() => msg.style.display = 'none', 3000);
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = ogText;
        btn.disabled = false;
    }
}

async function regenerateMnemonics() {
    if (!currentDocument || activeSectionIndex < -1) {
        return;
    }
    const idx = activeSectionIndex;
    
    const btn = document.getElementById('btn-sidebar-regen');
    const ogHtml = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/regenerate/${idx}?field=visual`, { method: 'POST' });
        if (!res.ok) throw new Error('Regeneration failed');
        const data = await res.json();
        
        if (idx === -1) {
            currentDocument.mnemonics.visual_anchor = data.mnemonics.visual_anchor;
        } else {
            currentDocument.sections[idx].mnemonics.visual_anchor = data.mnemonics.visual_anchor;
            // No need to set user_edited = false since we are only updating one field
            // and keeping their edits for others.
            renderDocument();
        }
        
        // Update the visual field directly
        const visualField = document.getElementById('sidebar-visual');
        if (visualField) {
            visualField.value = data.mnemonics.visual_anchor;
            visualField.style.transition = 'background-color 0.3s';
            visualField.style.backgroundColor = 'rgba(78, 204, 163, 0.2)';
            setTimeout(() => visualField.style.backgroundColor = '', 500);
        }
        
        showToast('Regenerated visual anchor', 'success');
    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.innerHTML = ogHtml;
        btn.disabled = false;
    }
}

async function saveSectionSource(idx) {
    if (!currentDocument) return;
    
    const titleVal = document.getElementById(`edit-section-title-${idx}`).value;
    const contentVal = document.getElementById(`edit-section-content-${idx}`).value;
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections/${idx}/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: titleVal, content: contentVal })
        });
        if (!res.ok) throw new Error('Failed to update source text');
        
        showToast('Source text updated', 'success');
        await loadDocument(currentDocument.id); // Reload the whole doc to reflect changes
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function deleteSection(idx) {
    if (!currentDocument) return;
    
    const btn = document.getElementById(`btn-del-sec-${idx}`);
    if (btn && !btn.classList.contains('confirming-delete')) {
        btn.classList.add('confirming-delete');
        btn.innerHTML = '⚠️ Click to Confirm Delete';
        btn.style.color = '#fff';
        btn.style.background = '#ff4757';
        btn.style.borderColor = '#ff4757';
        
        // Reset after 3 seconds
        setTimeout(() => {
            if (btn) {
                btn.classList.remove('confirming-delete');
                btn.innerHTML = '🗑️ Delete Section';
                btn.style.color = '#ff6b6b';
                btn.style.background = 'transparent';
                btn.style.borderColor = 'var(--border-color)';
            }
        }, 3000);
        return;
    }
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections/${idx}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete section');
        
        showToast('Section deleted successfully', 'success');
        await loadDocument(currentDocument.id); // Reload the whole doc
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function createSection(afterIdx) {
    if (!currentDocument) return;
    
    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ insert_after_idx: afterIdx })
        });
        if (!res.ok) throw new Error('Failed to create section');
        
        showToast('Section created successfully', 'success');
        await loadDocument(currentDocument.id); // Reload the whole doc
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function splitSection(idx) {
    if (!currentDocument) return;
    
    // First save any current modifications to the source
    try {
        const title = document.getElementById(`edit-section-title-${idx}`).value;
        const content = document.getElementById(`edit-section-content-${idx}`).value;
        await fetch(`/api/documents/${currentDocument.id}/sections/${idx}/content`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content })
        });
    } catch (e) {
        console.error("Failed to save source before splitting", e);
    }

    try {
        const res = await fetch(`/api/documents/${currentDocument.id}/sections/${idx}/split`, {
            method: 'POST'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to split section');
        
        showToast(data.message, 'success');
        await loadDocument(currentDocument.id); // Reload the whole doc
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
    const sourceEditBlocks = document.querySelectorAll('.bs-list-item__source-edit');
    const contentViewBlocks = document.querySelectorAll('.bs-list-item__content');
    const headerTitleBlocks = document.querySelectorAll('.bs-list-item__header > div');
    const btn = document.getElementById('btn-edit-toggle');
    
    // Check current state based on body class
    const turnOn = !document.body.classList.contains('editing-mode');
    
    sourceEditBlocks.forEach(block => {
        if (turnOn) block.classList.remove('hidden');
        else block.classList.add('hidden');
    });
    
    contentViewBlocks.forEach(block => {
        if (turnOn) block.classList.add('hidden');
        else block.classList.remove('hidden');
    });

    headerTitleBlocks.forEach(block => {
        if (turnOn) block.classList.add('hidden');
        else block.classList.remove('hidden');
    });

    const body = document.body;
    const actionBar = document.getElementById('edit-action-bar');
    const titleDisplay = document.getElementById('doc-title-display');
    const titleInput = document.getElementById('doc-title-input');
    const btnOpenEditorTitle = document.getElementById('btn-open-editor-title');
    const wysiwygToolbar = document.getElementById('wysiwyg-toolbar');
    const engineSidebar = document.getElementById('engine-sidebar');
    const mnemonicsSidebar = document.getElementById('mnemonics-sidebar');
    
    if (turnOn) {
        body.classList.add('editing-mode');
        if (actionBar) actionBar.classList.remove('hidden');
        if (btn) btn.innerHTML = '<span class="icon">✏️</span> Close Editor';
        if (titleDisplay) titleDisplay.classList.add('hidden');
        if (titleInput) titleInput.classList.remove('hidden');
        if (btnOpenEditorTitle) btnOpenEditorTitle.classList.remove('hidden');
        if (wysiwygToolbar) wysiwygToolbar.classList.remove('hidden');
        if (engineSidebar) engineSidebar.classList.remove('hidden');
        if (mnemonicsSidebar) mnemonicsSidebar.classList.remove('hidden');
        
        // Auto-select first section if available
        if (currentDocument && currentDocument.sections && currentDocument.sections.length > 0) {
            updateEngineSidebar(0);
            loadMnemonicsToSidebar(0);
        }
    } else {
        body.classList.remove('editing-mode');
        if (actionBar) actionBar.classList.add('hidden');
        if (btn) btn.innerHTML = '<span class="icon">✏️</span> Edit';
        if (titleDisplay) titleDisplay.classList.remove('hidden');
        if (wysiwygToolbar) wysiwygToolbar.classList.add('hidden');
        if (engineSidebar) engineSidebar.classList.add('hidden');
        if (mnemonicsSidebar) mnemonicsSidebar.classList.add('hidden');
        if (btnOpenEditorTitle) btnOpenEditorTitle.classList.add('hidden');
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

// ═══ Sidebar Bindings ═══
document.getElementById('btn-sidebar-save')?.addEventListener('click', saveMnemonics);
document.getElementById('btn-sidebar-regen')?.addEventListener('click', regenerateMnemonics);
document.getElementById('btn-sidebar-generate-acronym')?.addEventListener('click', generateAcronymFromTitle);
