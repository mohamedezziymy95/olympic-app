/* ============================================================
   EQUIPE OLYMPIADE — Lycée Al Wifaq Qualifiant
   Main Application Script (app.js)
   ============================================================ */

(function () {
    'use strict';

    /* ===================== CONFIGURATION ===================== */
    const CONFIG = {
        baseURL: './', // Relative base for GitHub Pages
        resourcesPath: 'data/resources.json',
        storageKeys: {
            downloaded: 'olympiade_downloaded_files',
            knownFiles: 'olympiade_known_files',
            theme: 'olympiade_theme',
            pwaDismissed: 'olympiade_pwa_dismissed',
        },
        splashDuration: 2200,
        toastDuration: 2500,
        latestDocsCount: 5,
        categories: ['resumes', 'exercices', 'tests', 'documents'],
    };

    /* ===================== STATE ===================== */
    const state = {
        resources: null,
        allFiles: [],
        downloadedFiles: [],
        knownFiles: [],
        newFiles: [],
        deferredPrompt: null,
        isSearchOpen: false,
    };

    /* ===================== DOM CACHE ===================== */
    const DOM = {};

    function cacheDOMElements() {
        // Splash
        DOM.splash = document.getElementById('splash-screen');

        // Header
        DOM.header = document.getElementById('header');
        DOM.themeToggle = document.getElementById('theme-toggle');
        DOM.themeIcon = document.getElementById('theme-icon');
        DOM.notificationBell = document.getElementById('notification-bell');
        DOM.notificationBadge = document.getElementById('notification-badge');

        // Search
        DOM.searchInput = document.getElementById('search-input');
        DOM.searchClear = document.getElementById('search-clear');
        DOM.searchResults = document.getElementById('search-results');
        DOM.searchResultsList = document.getElementById('search-results-list');
        DOM.searchNoResults = document.getElementById('search-no-results');
        DOM.searchResultsClose = document.getElementById('search-results-close');

        // Stats
        DOM.statTotal = document.getElementById('stat-total');
        DOM.statDownloaded = document.getElementById('stat-downloaded');
        DOM.statNew = document.getElementById('stat-new');

        // Category counts & badges
        DOM.countResumes = document.getElementById('count-resumes');
        DOM.countExercices = document.getElementById('count-exercices');
        DOM.countTests = document.getElementById('count-tests');
        DOM.countDocuments = document.getElementById('count-documents');
        DOM.badgeResumes = document.getElementById('badge-resumes');
        DOM.badgeExercices = document.getElementById('badge-exercices');
        DOM.badgeTests = document.getElementById('badge-tests');
        DOM.badgeDocuments = document.getElementById('badge-documents');

        // Latest documents
        DOM.latestDocuments = document.getElementById('latest-documents');
        DOM.noDocuments = document.getElementById('no-documents');

        // Download toast
        DOM.downloadToast = document.getElementById('download-toast');
        DOM.downloadToastTitle = document.getElementById('download-toast-title');
        DOM.downloadProgress = document.getElementById('download-progress');
        DOM.downloadToastCheck = document.getElementById('download-toast-check');

        // Notification popup
        DOM.notificationPopup = document.getElementById('notification-popup');
        DOM.notificationPopupMessage = document.getElementById('notification-popup-message');
        DOM.notificationPopupList = document.getElementById('notification-popup-list');
        DOM.notificationPopupClose = document.getElementById('notification-popup-close');

        // PWA install
        DOM.pwaInstallBanner = document.getElementById('pwa-install-banner');
        DOM.pwaInstallBtn = document.getElementById('pwa-install-btn');
        DOM.pwaInstallDismiss = document.getElementById('pwa-install-dismiss');

        // Main content
        DOM.mainContent = document.getElementById('main-content');
    }

    /* ===================== LOCAL STORAGE HELPERS ===================== */
    const Storage = {
        get(key) {
            try {
                const val = localStorage.getItem(key);
                return val ? JSON.parse(val) : null;
            } catch (e) {
                console.warn('[Storage] Error reading:', key, e);
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch (e) {
                console.warn('[Storage] Error writing:', key, e);
            }
        },

        addToArray(key, item) {
            const arr = this.get(key) || [];
            if (!arr.includes(item)) {
                arr.push(item);
                this.set(key, arr);
            }
            return arr;
        },
    };

    /* ===================== THEME MANAGEMENT ===================== */
    const Theme = {
        init() {
            const saved = Storage.get(CONFIG.storageKeys.theme);
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = saved || (prefersDark ? 'dark' : 'light');
            this.apply(theme);
        },

        apply(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            Storage.set(CONFIG.storageKeys.theme, theme);
            this.updateIcon(theme);
            this.updateMetaTheme(theme);
        },

        toggle() {
            const current = document.documentElement.getAttribute('data-theme');
            const next = current === 'dark' ? 'light' : 'dark';
            this.apply(next);
        },

        updateIcon(theme) {
            if (!DOM.themeIcon) return;
            DOM.themeIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        },

        updateMetaTheme(theme) {
            const meta = document.querySelector('meta[name="theme-color"]');
            if (meta) {
                meta.setAttribute('content', theme === 'dark' ? '#111827' : '#1a73e8');
            }
        },
    };

    /* ===================== SPLASH SCREEN ===================== */
    function dismissSplash() {
        if (!DOM.splash) return;
        setTimeout(() => {
            DOM.splash.classList.add('fade-out');
            setTimeout(() => {
                DOM.splash.remove();
            }, 600);
        }, CONFIG.splashDuration);
    }

    /* ===================== HEADER SCROLL EFFECT ===================== */
    function initScrollEffect() {
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (!DOM.header) return;
                    if (window.scrollY > 10) {
                        DOM.header.classList.add('scrolled');
                    } else {
                        DOM.header.classList.remove('scrolled');
                    }
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    /* ===================== FETCH RESOURCES ===================== */
    async function fetchResources() {
        try {
            const cacheBuster = `?v=${Date.now()}`;
            const response = await fetch(CONFIG.baseURL + CONFIG.resourcesPath + cacheBuster);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            state.resources = data;

            // Flatten all files into a single array with category info
            state.allFiles = [];
            CONFIG.categories.forEach((cat) => {
                if (data[cat] && Array.isArray(data[cat])) {
                    data[cat].forEach((file) => {
                        state.allFiles.push({
                            ...file,
                            category: cat,
                            id: generateFileId(file),
                        });
                    });
                }
            });

            // Load localStorage data
            state.downloadedFiles = Storage.get(CONFIG.storageKeys.downloaded) || [];
            state.knownFiles = Storage.get(CONFIG.storageKeys.knownFiles) || [];

            // Detect new files
            detectNewFiles();

            // Render everything
            renderDashboard();

            return data;
        } catch (error) {
            console.error('[App] Failed to fetch resources:', error);
            renderError();
            return null;
        }
    }

    /* ===================== FILE ID GENERATION ===================== */
    function generateFileId(file) {
        // Create a unique ID based on file path (most reliable)
        return (file.file || file.title || '').trim().toLowerCase().replace(/\s+/g, '_');
    }

    /* ===================== NEW FILE DETECTION ===================== */
    function detectNewFiles() {
        const allFileIds = state.allFiles.map((f) => f.id);

        if (state.knownFiles.length === 0) {
            // First visit — mark all as known, none as new
            Storage.set(CONFIG.storageKeys.knownFiles, allFileIds);
            state.knownFiles = allFileIds;
            state.newFiles = [];
        } else {
            // Find files that exist in resources but not in knownFiles
            state.newFiles = state.allFiles.filter(
                (f) => !state.knownFiles.includes(f.id)
            );

            // Update known files list
            Storage.set(CONFIG.storageKeys.knownFiles, allFileIds);
            state.knownFiles = allFileIds;
        }
    }

    /* ===================== RENDER DASHBOARD ===================== */
    function renderDashboard() {
        renderStats();
        renderCategoryCounts();
        renderCategoryBadges();
        renderLatestDocuments();
        updateNotificationBell();
    }

    /* ===================== RENDER STATS ===================== */
    function renderStats() {
        const total = state.allFiles.length;
        const downloaded = state.downloadedFiles.length;
        const newCount = state.newFiles.length;

        animateCounter(DOM.statTotal, total);
        animateCounter(DOM.statDownloaded, downloaded);
        animateCounter(DOM.statNew, newCount);
    }

    function animateCounter(element, target) {
        if (!element) return;
        const duration = 600;
        const start = parseInt(element.textContent) || 0;
        const increment = (target - start) / (duration / 16);
        let current = start;

        function step() {
            current += increment;
            if ((increment > 0 && current >= target) || (increment < 0 && current <= target) || increment === 0) {
                element.textContent = target;
                return;
            }
            element.textContent = Math.round(current);
            requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }

    /* ===================== RENDER CATEGORY COUNTS ===================== */
    function renderCategoryCounts() {
        if (!state.resources) return;

        const countMap = {
            resumes: DOM.countResumes,
            exercices: DOM.countExercices,
            tests: DOM.countTests,
            documents: DOM.countDocuments,
        };

        CONFIG.categories.forEach((cat) => {
            const el = countMap[cat];
            if (el && state.resources[cat]) {
                animateCounter(el, state.resources[cat].length);
            }
        });
    }

    /* ===================== RENDER CATEGORY BADGES ===================== */
    function renderCategoryBadges() {
        const badgeMap = {
            resumes: DOM.badgeResumes,
            exercices: DOM.badgeExercices,
            tests: DOM.badgeTests,
            documents: DOM.badgeDocuments,
        };

        CONFIG.categories.forEach((cat) => {
            const badge = badgeMap[cat];
            if (!badge) return;

            const newInCategory = state.newFiles.filter((f) => f.category === cat).length;

            if (newInCategory > 0) {
                badge.textContent = newInCategory;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });
    }

    /* ===================== RENDER LATEST DOCUMENTS ===================== */
    function renderLatestDocuments() {
        if (!DOM.latestDocuments) return;

        // Sort all files by date (newest first)
        const sorted = [...state.allFiles].sort((a, b) => {
            const dateA = new Date(a.date || '2000-01-01');
            const dateB = new Date(b.date || '2000-01-01');
            return dateB - dateA;
        });

        const latest = sorted.slice(0, CONFIG.latestDocsCount);

        if (latest.length === 0) {
            DOM.latestDocuments.classList.add('hidden');
            DOM.noDocuments.classList.remove('hidden');
            return;
        }

        DOM.noDocuments.classList.add('hidden');
        DOM.latestDocuments.innerHTML = '';

        latest.forEach((file) => {
            const card = createDocumentCard(file, true);
            DOM.latestDocuments.appendChild(card);
        });
    }

    /* ===================== CREATE DOCUMENT CARD ===================== */
    function createDocumentCard(file, showCategory) {
        const isDownloaded = state.downloadedFiles.includes(file.id);
        const isNew = state.newFiles.some((f) => f.id === file.id);
        const fileType = getFileType(file.file);
        const iconClass = getFileIconClass(fileType);

        const card = document.createElement('div');
        card.className = 'document-card' + (isNew && !isDownloaded ? ' is-new' : '');
        card.setAttribute('data-file-id', file.id);

        card.innerHTML = `
            <div class="document-icon ${fileType}">
                <i class="${iconClass}"></i>
            </div>
            <div class="document-info">
                <div class="document-title">${escapeHTML(file.title)}</div>
                <div class="document-meta">
                    <span class="document-type">${fileType.toUpperCase()}</span>
                    ${file.date ? `<span class="document-date"><i class="far fa-calendar-alt"></i> ${formatDate(file.date)}</span>` : ''}
                    ${showCategory ? `<span class="document-category-tag ${file.category}">${getCategoryLabel(file.category)}</span>` : ''}
                </div>
            </div>
            <div class="document-actions">
                ${isNew && !isDownloaded ? '<span class="new-badge"><i class="fas fa-star"></i> Nouveau</span>' : ''}
                <button class="btn-download ${isDownloaded ? 'btn-downloaded' : ''}" 
                        data-file-path="${escapeHTML(file.file)}" 
                        data-file-id="${file.id}"
                        data-file-title="${escapeHTML(file.title)}"
                        ${isDownloaded ? 'title="Déjà téléchargé"' : 'title="Télécharger"'}>
                    <i class="fas ${isDownloaded ? 'fa-check' : 'fa-download'}"></i>
                    ${isDownloaded ? '' : ''}
                </button>
            </div>
        `;

        // Attach download event
        const downloadBtn = card.querySelector('.btn-download');
        if (downloadBtn && !isDownloaded) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDownload(file, downloadBtn, card);
            });
        }

        return card;
    }

    /* ===================== FILE TYPE HELPERS ===================== */
    function getFileType(filePath) {
        if (!filePath) return 'default';
        const ext = filePath.split('.').pop().toLowerCase();
        if (['pdf'].includes(ext)) return 'pdf';
        if (['doc', 'docx', 'odt'].includes(ext)) return 'doc';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'img';
        return 'default';
    }

    function getFileIconClass(type) {
        const icons = {
            pdf: 'fas fa-file-pdf',
            doc: 'fas fa-file-word',
            img: 'fas fa-file-image',
            default: 'fas fa-file-alt',
        };
        return icons[type] || icons.default;
    }

    function getCategoryLabel(cat) {
        const labels = {
            resumes: 'Résumé',
            exercices: 'Exercice',
            tests: 'Test',
            documents: 'Document',
        };
        return labels[cat] || cat;
    }

    /* ===================== DATE FORMATTING ===================== */
    function formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    }

    /* ===================== HTML ESCAPE ===================== */
    function escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /* ===================== DOWNLOAD HANDLER ===================== */
    async function handleDownload(file, btnElement, cardElement) {
        const filePath = CONFIG.baseURL + file.file;
        const fileId = file.id;
        const fileName = file.file.split('/').pop();

        // Show toast
        showDownloadToast(file.title);

        try {
            // Simulate progress for UX (actual fetch doesn't provide granular progress on small files)
            animateDownloadProgress(0);

            const response = await fetch(filePath);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            // Try to read with progress
            const reader = response.body ? response.body.getReader() : null;
            const contentLength = response.headers.get('Content-Length');

            let receivedLength = 0;
            let chunks = [];

            if (reader && contentLength) {
                const total = parseInt(contentLength, 10);

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                    receivedLength += value.length;
                    const percent = Math.min(Math.round((receivedLength / total) * 100), 100);
                    animateDownloadProgress(percent);
                }
            } else {
                // Fallback: simulate progress
                simulateProgress();
                const blob = await response.blob();
                chunks = null;
                triggerBlobDownload(blob, fileName);
                completeDownload(fileId, btnElement, cardElement);
                return;
            }

            // Combine chunks into blob
            const blob = new Blob(chunks);
            triggerBlobDownload(blob, fileName);
            completeDownload(fileId, btnElement, cardElement);
        } catch (error) {
            console.error('[Download] Error:', error);
            // Fallback: direct link download
            fallbackDownload(filePath, fileName);
            completeDownload(fileId, btnElement, cardElement);
        }
    }

    function triggerBlobDownload(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            URL.revokeObjectURL(url);
            a.remove();
        }, 1000);
    }

    function fallbackDownload(filePath, fileName) {
        const a = document.createElement('a');
        a.href = filePath;
        a.download = fileName;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function completeDownload(fileId, btnElement, cardElement) {
        // Mark as downloaded in localStorage
        state.downloadedFiles = Storage.addToArray(CONFIG.storageKeys.downloaded, fileId);

        // Remove from new files
        state.newFiles = state.newFiles.filter((f) => f.id !== fileId);

        // Update button UI
        if (btnElement) {
            btnElement.classList.add('btn-downloaded');
            btnElement.innerHTML = '<i class="fas fa-check"></i>';
            btnElement.removeAttribute('title');
            btnElement.setAttribute('title', 'Déjà téléchargé');
            // Remove click listeners by cloning
            const newBtn = btnElement.cloneNode(true);
            btnElement.parentNode.replaceChild(newBtn, btnElement);
        }

        // Remove NEW badge and highlight from card
        if (cardElement) {
            cardElement.classList.remove('is-new');
            const badge = cardElement.querySelector('.new-badge');
            if (badge) {
                badge.style.transition = 'opacity 0.3s ease';
                badge.style.opacity = '0';
                setTimeout(() => badge.remove(), 300);
            }
        }

        // Update stats
        renderStats();
        renderCategoryBadges();
        updateNotificationBell();

        // Complete toast animation
        animateDownloadProgress(100);
        showDownloadComplete();
    }

    /* ===================== DOWNLOAD TOAST ===================== */
    function showDownloadToast(title) {
        if (!DOM.downloadToast) return;

        DOM.downloadToastTitle.textContent = title;
        DOM.downloadProgress.style.width = '0%';
        DOM.downloadToastCheck.classList.add('hidden');
        DOM.downloadToast.querySelector('.download-toast-icon i').className = 'fas fa-circle-notch fa-spin';
        DOM.downloadToast.classList.remove('hidden');
    }

    function animateDownloadProgress(percent) {
        if (!DOM.downloadProgress) return;
        DOM.downloadProgress.style.width = percent + '%';
    }

    function simulateProgress() {
        let progress = 0;
        const interval = setInterval(() => {
            progress += Math.random() * 25 + 10;
            if (progress >= 90) {
                progress = 90;
                clearInterval(interval);
            }
            animateDownloadProgress(Math.round(progress));
        }, 150);
    }

    function showDownloadComplete() {
        if (!DOM.downloadToast) return;

        setTimeout(() => {
            DOM.downloadToast.querySelector('.download-toast-icon i').className = 'fas fa-check-circle';
            DOM.downloadToast.querySelector('.download-toast-icon').style.color = 'var(--accent-green)';
            DOM.downloadToastTitle.textContent = 'Téléchargement terminé !';
            DOM.downloadToastCheck.classList.remove('hidden');

            setTimeout(() => {
                DOM.downloadToast.classList.add('hidden');
                // Reset icon styles
                const icon = DOM.downloadToast.querySelector('.download-toast-icon');
                if (icon) icon.style.color = '';
            }, CONFIG.toastDuration);
        }, 400);
    }

    /* ===================== NOTIFICATION BELL ===================== */
    function updateNotificationBell() {
        if (!DOM.notificationBadge) return;

        const newCount = state.newFiles.length;

        if (newCount > 0) {
            DOM.notificationBadge.textContent = newCount;
            DOM.notificationBadge.classList.remove('hidden');
        } else {
            DOM.notificationBadge.classList.add('hidden');
        }
    }

    /* ===================== NOTIFICATION POPUP ===================== */
    function showNotificationPopup() {
        if (state.newFiles.length === 0) return;
        if (!DOM.notificationPopup) return;

        const count = state.newFiles.length;
        DOM.notificationPopupMessage.textContent = `${count} nouveau${count > 1 ? 'x' : ''} fichier${count > 1 ? 's' : ''} ajouté${count > 1 ? 's' : ''}`;

        // Populate list
        DOM.notificationPopupList.innerHTML = '';
        state.newFiles.slice(0, 8).forEach((file) => {
            const item = document.createElement('div');
            item.className = 'notification-popup-list-item';
            item.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span>${escapeHTML(file.title)}</span>
            `;
            DOM.notificationPopupList.appendChild(item);
        });

        if (state.newFiles.length > 8) {
            const more = document.createElement('div');
            more.className = 'notification-popup-list-item';
            more.innerHTML = `<i class="fas fa-ellipsis-h"></i><span>Et ${state.newFiles.length - 8} autres...</span>`;
            DOM.notificationPopupList.appendChild(more);
        }

        DOM.notificationPopup.classList.remove('hidden');
    }

    function closeNotificationPopup() {
        if (DOM.notificationPopup) {
            DOM.notificationPopup.classList.add('hidden');
        }
    }

    /* ===================== SEARCH SYSTEM ===================== */
    const Search = {
        init() {
            if (!DOM.searchInput) return;

            let debounceTimer;

            DOM.searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                const query = DOM.searchInput.value.trim();

                // Show/hide clear button
                if (query.length > 0) {
                    DOM.searchClear.classList.remove('hidden');
                } else {
                    DOM.searchClear.classList.add('hidden');
                    this.close();
                    return;
                }

                debounceTimer = setTimeout(() => {
                    this.performSearch(query);
                }, 250);
            });

            DOM.searchInput.addEventListener('focus', () => {
                const query = DOM.searchInput.value.trim();
                if (query.length > 0) {
                    this.performSearch(query);
                }
            });

            DOM.searchClear.addEventListener('click', () => {
                DOM.searchInput.value = '';
                DOM.searchClear.classList.add('hidden');
                this.close();
                DOM.searchInput.focus();
            });

            DOM.searchResultsClose.addEventListener('click', () => {
                this.close();
            });
        },

        performSearch(query) {
            const normalizedQuery = this.normalizeText(query);

            const results = state.allFiles.filter((file) => {
                const title = this.normalizeText(file.title || '');
                const category = this.normalizeText(getCategoryLabel(file.category));
                const fileType = this.normalizeText(getFileType(file.file));
                return (
                    title.includes(normalizedQuery) ||
                    category.includes(normalizedQuery) ||
                    fileType.includes(normalizedQuery)
                );
            });

            this.renderResults(results, query);
        },

        normalizeText(text) {
            return text
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .trim();
        },

        renderResults(results, query) {
            DOM.searchResultsList.innerHTML = '';

            if (results.length === 0) {
                DOM.searchNoResults.classList.remove('hidden');
                DOM.searchResultsList.classList.add('hidden');
            } else {
                DOM.searchNoResults.classList.add('hidden');
                DOM.searchResultsList.classList.remove('hidden');

                results.forEach((file) => {
                    const card = createDocumentCard(file, true);
                    DOM.searchResultsList.appendChild(card);
                });
            }

            DOM.searchResults.classList.remove('hidden');
            state.isSearchOpen = true;
        },

        close() {
            if (DOM.searchResults) {
                DOM.searchResults.classList.add('hidden');
            }
            state.isSearchOpen = false;
        },
    };

    /* ===================== PWA INSTALL ===================== */
    const PWA = {
        init() {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                state.deferredPrompt = e;

                const dismissed = Storage.get(CONFIG.storageKeys.pwaDismissed);
                if (!dismissed) {
                    setTimeout(() => this.showBanner(), 3000);
                }
            });

            if (DOM.pwaInstallBtn) {
                DOM.pwaInstallBtn.addEventListener('click', () => this.install());
            }

            if (DOM.pwaInstallDismiss) {
                DOM.pwaInstallDismiss.addEventListener('click', () => this.dismiss());
            }

            // Detect if already installed
            window.addEventListener('appinstalled', () => {
                console.log('[PWA] App installed');
                this.hideBanner();
                state.deferredPrompt = null;
            });
        },

        showBanner() {
            if (DOM.pwaInstallBanner && state.deferredPrompt) {
                DOM.pwaInstallBanner.classList.remove('hidden');
            }
        },

        hideBanner() {
            if (DOM.pwaInstallBanner) {
                DOM.pwaInstallBanner.classList.add('hidden');
            }
        },

        async install() {
            if (!state.deferredPrompt) return;

            state.deferredPrompt.prompt();
            const result = await state.deferredPrompt.userChoice;
            console.log('[PWA] User choice:', result.outcome);

            state.deferredPrompt = null;
            this.hideBanner();
        },

        dismiss() {
            this.hideBanner();
            Storage.set(CONFIG.storageKeys.pwaDismissed, true);
        },
    };

    /* ===================== RENDER ERROR ===================== */
    function renderError() {
        if (!DOM.latestDocuments) return;
        DOM.latestDocuments.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Impossible de charger les ressources.<br>Vérifiez votre connexion internet.</p>
                <button class="btn btn-primary btn-sm" onclick="location.reload()" style="margin-top: 16px;">
                    <i class="fas fa-redo"></i> Réessayer
                </button>
            </div>
        `;
    }

    /* ===================== EVENT LISTENERS ===================== */
    function bindEvents() {
        // Theme toggle
        if (DOM.themeToggle) {
            DOM.themeToggle.addEventListener('click', () => Theme.toggle());
        }

        // Notification bell — show popup
        if (DOM.notificationBell) {
            DOM.notificationBell.addEventListener('click', () => {
                if (state.newFiles.length > 0) {
                    showNotificationPopup();
                }
            });
        }

        // Notification popup close
        if (DOM.notificationPopupClose) {
            DOM.notificationPopupClose.addEventListener('click', closeNotificationPopup);
        }

        // Close popup on overlay click
        if (DOM.notificationPopup) {
            DOM.notificationPopup.addEventListener('click', (e) => {
                if (e.target === DOM.notificationPopup) {
                    closeNotificationPopup();
                }
            });
        }

        // Keyboard: Escape to close search / popup
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (state.isSearchOpen) Search.close();
                closeNotificationPopup();
            }
        });
    }

    /* ===================== CATEGORY PAGE HELPERS ===================== */
    // These functions are used by individual category pages
    // They are exposed globally for pages/resumes.html etc.

    window.OlympApp = {
        CONFIG,
        state,
        Storage,

        async loadCategoryPage(categoryKey) {
            try {
                const cacheBuster = `?v=${Date.now()}`;
                const response = await fetch(CONFIG.baseURL + CONFIG.resourcesPath + cacheBuster);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                state.resources = data;

                // Build allFiles
                state.allFiles = [];
                CONFIG.categories.forEach((cat) => {
                    if (data[cat] && Array.isArray(data[cat])) {
                        data[cat].forEach((file) => {
                            state.allFiles.push({
                                ...file,
                                category: cat,
                                id: generateFileId(file),
                            });
                        });
                    }
                });

                state.downloadedFiles = Storage.get(CONFIG.storageKeys.downloaded) || [];
                state.knownFiles = Storage.get(CONFIG.storageKeys.knownFiles) || [];
                detectNewFiles();

                // Get files for this category
                const categoryFiles = state.allFiles.filter((f) => f.category === categoryKey);

                return categoryFiles;
            } catch (error) {
                console.error('[App] Error loading category:', error);
                return [];
            }
        },

        createDocumentCard(file, showCategory) {
            return createDocumentCard(file, showCategory || false);
        },

        handleDownload,
        getCategoryLabel,
        formatDate,
        getFileType,
        getFileIconClass,
        escapeHTML,
        generateFileId,
        animateCounter,

        initTheme() {
            Theme.init();
        },

        bindThemeToggle(btnId, iconId) {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.addEventListener('click', () => Theme.toggle());
            }
        },

        updateNotificationBell,

        showDownloadToast,
        animateDownloadProgress,
        showDownloadComplete,
        simulateProgress,
    };

    /* ===================== INITIALIZATION ===================== */
    async function init() {
        // Cache DOM
        cacheDOMElements();

        // Theme
        Theme.init();

        // Splash
        dismissSplash();

        // Scroll
        initScrollEffect();

        // Bind events
        bindEvents();

        // Search
        Search.init();

        // PWA
        PWA.init();

        // Fetch and render
        await fetchResources();

        // Show notification popup if there are new files (with delay for UX)
        if (state.newFiles.length > 0) {
            setTimeout(() => {
                showNotificationPopup();
            }, CONFIG.splashDuration + 500);
        }
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();