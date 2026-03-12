/* ============================================================
   EQUIPE OLYMPIADE — Lycée Al Wifaq Qualifiant
   Browser Notifications System (notifications.js)
   ============================================================ */

(function () {
    'use strict';

    /* ===================== CONFIGURATION ===================== */
    const NOTIF_CONFIG = {
        storageKeys: {
            permission: 'olympiade_notif_permission',
            lastCheck: 'olympiade_notif_last_check',
            notifiedFiles: 'olympiade_notified_files',
        },
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-72.png',
        tag: 'olympiade-new-resource',
        vibrate: [100, 50, 100],
        autoCloseDelay: 6000,
        permissionDelay: 4000, // Delay before asking permission (ms)
    };

    /* ===================== STATE ===================== */
    const notifState = {
        permissionGranted: false,
        supported: false,
        notifiedFiles: [],
    };

    /* ===================== STORAGE HELPERS ===================== */
    function storageGet(key) {
        try {
            const val = localStorage.getItem(key);
            return val ? JSON.parse(val) : null;
        } catch (e) {
            return null;
        }
    }

    function storageSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('[Notifications] Storage error:', e);
        }
    }

    /* ===================== SUPPORT CHECK ===================== */
    function isNotificationSupported() {
        return (
            'Notification' in window &&
            'serviceWorker' in navigator &&
            typeof Notification !== 'undefined'
        );
    }

    /* ===================== PERMISSION MANAGEMENT ===================== */

    /**
     * Get current notification permission state
     */
    function getPermissionState() {
        if (!isNotificationSupported()) return 'unsupported';
        return Notification.permission; // 'default', 'granted', 'denied'
    }

    /**
     * Request notification permission from the user
     * Called after a short delay on first visit
     */
    async function requestPermission() {
        if (!isNotificationSupported()) {
            console.log('[Notifications] Not supported in this browser');
            return false;
        }

        const currentPermission = Notification.permission;

        // Already granted
        if (currentPermission === 'granted') {
            notifState.permissionGranted = true;
            storageSet(NOTIF_CONFIG.storageKeys.permission, 'granted');
            console.log('[Notifications] Permission already granted');
            return true;
        }

        // Already denied — don't bother asking again
        if (currentPermission === 'denied') {
            notifState.permissionGranted = false;
            storageSet(NOTIF_CONFIG.storageKeys.permission, 'denied');
            console.log('[Notifications] Permission denied by user');
            return false;
        }

        // Permission is 'default' — ask the user
        try {
            const result = await Notification.requestPermission();
            notifState.permissionGranted = result === 'granted';
            storageSet(NOTIF_CONFIG.storageKeys.permission, result);
            console.log('[Notifications] Permission result:', result);

            if (result === 'granted') {
                // Send a welcome notification
                sendWelcomeNotification();
            }

            return result === 'granted';
        } catch (error) {
            console.warn('[Notifications] Permission request error:', error);

            // Fallback for older browsers using callback
            try {
                Notification.requestPermission(function (result) {
                    notifState.permissionGranted = result === 'granted';
                    storageSet(NOTIF_CONFIG.storageKeys.permission, result);
                });
            } catch (e) {
                console.warn('[Notifications] Fallback failed:', e);
            }

            return false;
        }
    }

    /* ===================== SEND NOTIFICATIONS ===================== */

    /**
     * Send a browser notification
     * @param {string} title - Notification title
     * @param {object} options - Notification options
     */
    function sendNotification(title, options = {}) {
        if (!notifState.permissionGranted) {
            console.log('[Notifications] Permission not granted, skipping');
            return null;
        }

        const defaultOptions = {
            icon: NOTIF_CONFIG.icon,
            badge: NOTIF_CONFIG.badge,
            vibrate: NOTIF_CONFIG.vibrate,
            tag: NOTIF_CONFIG.tag,
            renotify: true,
            silent: false,
            requireInteraction: false,
            dir: 'ltr',
            lang: 'fr',
        };

        const mergedOptions = { ...defaultOptions, ...options };

        try {
            // Try Service Worker notification first (works better on mobile)
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.ready.then((registration) => {
                    registration.showNotification(title, mergedOptions).catch((err) => {
                        console.warn('[Notifications] SW notification error, falling back:', err);
                        createFallbackNotification(title, mergedOptions);
                    });
                });
            } else {
                // Fallback to standard Notification API
                createFallbackNotification(title, mergedOptions);
            }
        } catch (error) {
            console.warn('[Notifications] Error sending:', error);
            createFallbackNotification(title, mergedOptions);
        }
    }

    /**
     * Fallback using the standard Notification constructor
     */
    function createFallbackNotification(title, options) {
        try {
            const notification = new Notification(title, options);

            // Auto close after delay
            setTimeout(() => {
                notification.close();
            }, NOTIF_CONFIG.autoCloseDelay);

            // Handle click — focus the app
            notification.onclick = function (event) {
                event.preventDefault();
                window.focus();
                notification.close();
            };

            notification.onerror = function (err) {
                console.warn('[Notifications] Display error:', err);
            };

            return notification;
        } catch (error) {
            console.warn('[Notifications] Fallback notification error:', error);
            return null;
        }
    }

    /* ===================== WELCOME NOTIFICATION ===================== */
    function sendWelcomeNotification() {
        sendNotification('🎓 Equipe Olympiade', {
            body: 'Bienvenue ! Vous recevrez des notifications lorsque de nouvelles ressources seront ajoutées.',
            tag: 'olympiade-welcome',
            renotify: false,
        });
    }

    /* ===================== NEW RESOURCE NOTIFICATIONS ===================== */

    /**
     * Check for new files and send browser notifications
     * Called by app.js after resources are loaded
     */
    function notifyNewResources(newFiles) {
        if (!newFiles || newFiles.length === 0) return;
        if (!notifState.permissionGranted) return;

        // Get previously notified files
        notifState.notifiedFiles = storageGet(NOTIF_CONFIG.storageKeys.notifiedFiles) || [];

        // Filter files we haven't notified about yet
        const unnotified = newFiles.filter(
            (file) => !notifState.notifiedFiles.includes(file.id)
        );

        if (unnotified.length === 0) return;

        // Send notification(s)
        if (unnotified.length === 1) {
            // Single file — detailed notification
            const file = unnotified[0];
            const categoryLabel = getCategoryLabelSafe(file.category);

            sendNotification('📄 Nouvelle ressource ajoutée', {
                body: `${file.title}\n📂 ${categoryLabel}`,
                tag: 'olympiade-new-' + file.id,
                data: { fileId: file.id, category: file.category },
            });
        } else if (unnotified.length <= 3) {
            // 2-3 files — list them
            const titles = unnotified.map((f) => `• ${f.title}`).join('\n');

            sendNotification(`📚 ${unnotified.length} nouvelles ressources`, {
                body: titles,
                tag: 'olympiade-new-batch',
                data: { count: unnotified.length },
            });
        } else {
            // 4+ files — summary notification
            const firstTwo = unnotified.slice(0, 2).map((f) => f.title).join(', ');

            sendNotification(`📚 ${unnotified.length} nouvelles ressources`, {
                body: `${firstTwo} et ${unnotified.length - 2} autre${unnotified.length - 2 > 1 ? 's' : ''}...`,
                tag: 'olympiade-new-batch',
                data: { count: unnotified.length },
            });
        }

        // Mark all as notified
        const allNotifiedIds = [
            ...notifState.notifiedFiles,
            ...unnotified.map((f) => f.id),
        ];
        storageSet(NOTIF_CONFIG.storageKeys.notifiedFiles, allNotifiedIds);
        notifState.notifiedFiles = allNotifiedIds;
    }

    /**
     * Send a single-resource notification (can be called directly)
     */
    function notifySingleResource(title, category) {
        const categoryLabel = getCategoryLabelSafe(category);
        sendNotification('📄 Nouvelle ressource ajoutée', {
            body: `${title}\n📂 ${categoryLabel}`,
            tag: 'olympiade-single-' + Date.now(),
        });
    }

    /* ===================== IN-APP NOTIFICATION BELL SYSTEM ===================== */

    /**
     * Create and manage the in-app notification dropdown
     * This supplements the popup already in index.html
     */
    const NotificationBell = {
        /**
         * Shake the bell icon to attract attention
         */
        shakeBell() {
            const bell = document.getElementById('notification-bell');
            if (!bell) return;

            bell.classList.add('bell-shake');
            setTimeout(() => {
                bell.classList.remove('bell-shake');
            }, 1000);
        },

        /**
         * Pulse the badge to attract attention
         */
        pulseBadge() {
            const badge = document.getElementById('notification-badge');
            if (!badge || badge.classList.contains('hidden')) return;

            badge.style.animation = 'none';
            // Force reflow
            void badge.offsetWidth;
            badge.style.animation = 'badge-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
        },

        /**
         * Start periodic attention animation
         */
        startAttentionLoop() {
            const self = this;
            setInterval(() => {
                // Only shake if there are new files
                const badge = document.getElementById('notification-badge');
                if (badge && !badge.classList.contains('hidden')) {
                    self.shakeBell();
                    setTimeout(() => self.pulseBadge(), 500);
                }
            }, 15000); // Every 15 seconds
        },
    };

    /* ===================== VISIBILITY CHANGE DETECTION ===================== */

    /**
     * When the user returns to the app tab, re-check for new resources
     */
    function initVisibilityCheck() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                console.log('[Notifications] Tab became visible, checking for updates...');
                recheckResources();
            }
        });
    }

    /**
     * Re-fetch resources and notify if new ones found
     */
    async function recheckResources() {
        try {
            // Access the global OlympApp if available
            if (!window.OlympApp) return;

            const cacheBuster = `?v=${Date.now()}`;
            const basePath = window.OlympApp.CONFIG.baseURL || './';
            const response = await fetch(basePath + 'data/resources.json' + cacheBuster);

            if (!response.ok) return;

            const data = await response.json();
            const categories = window.OlympApp.CONFIG.categories || ['resumes', 'exercices', 'tests', 'documents'];

            // Build current file list
            const currentFiles = [];
            categories.forEach((cat) => {
                if (data[cat] && Array.isArray(data[cat])) {
                    data[cat].forEach((file) => {
                        currentFiles.push({
                            ...file,
                            category: cat,
                            id: window.OlympApp.generateFileId(file),
                        });
                    });
                }
            });

            // Compare with known files
            const knownFiles = storageGet('olympiade_known_files') || [];
            const newOnes = currentFiles.filter((f) => !knownFiles.includes(f.id));

            if (newOnes.length > 0) {
                console.log(`[Notifications] Found ${newOnes.length} new files on recheck`);
                notifyNewResources(newOnes);

                // Update known files
                const allIds = currentFiles.map((f) => f.id);
                storageSet('olympiade_known_files', allIds);

                // Update state if OlympApp is available
                if (window.OlympApp.state) {
                    window.OlympApp.state.newFiles = newOnes;
                    if (typeof window.OlympApp.updateNotificationBell === 'function') {
                        window.OlympApp.updateNotificationBell();
                    }
                }

                // Shake bell
                NotificationBell.shakeBell();
            }
        } catch (error) {
            console.warn('[Notifications] Recheck error:', error);
        }
    }

    /* ===================== PERIODIC CHECK ===================== */

    /**
     * Set up a periodic check for new resources
     * Checks every 5 minutes while the app is open
     */
    function initPeriodicCheck() {
        const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

        setInterval(() => {
            if (document.visibilityState === 'visible') {
                console.log('[Notifications] Periodic check...');
                recheckResources();
            }
        }, CHECK_INTERVAL);
    }

    /* ===================== HELPER ===================== */
    function getCategoryLabelSafe(cat) {
        const labels = {
            resumes: 'Résumés de cours',
            exercices: 'Exercices',
            tests: 'Tests et contrôles',
            documents: 'Documents supplémentaires',
        };
        return labels[cat] || cat || 'Ressources';
    }

    /* ===================== INJECT BELL SHAKE CSS ===================== */
    function injectBellShakeCSS() {
        if (document.getElementById('notif-bell-styles')) return;

        const style = document.createElement('style');
        style.id = 'notif-bell-styles';
        style.textContent = `
            @keyframes bell-ring {
                0%   { transform: rotate(0deg); }
                10%  { transform: rotate(14deg); }
                20%  { transform: rotate(-12deg); }
                30%  { transform: rotate(10deg); }
                40%  { transform: rotate(-8deg); }
                50%  { transform: rotate(6deg); }
                60%  { transform: rotate(-4deg); }
                70%  { transform: rotate(2deg); }
                80%  { transform: rotate(-1deg); }
                100% { transform: rotate(0deg); }
            }

            .bell-shake i {
                animation: bell-ring 0.8s ease-in-out;
                transform-origin: top center;
                display: inline-block;
            }

            #notification-bell {
                transition: all 0.25s ease;
            }

            #notification-bell:active {
                transform: scale(0.88);
            }

            /* Glow effect when new notifications exist */
            #notification-bell.has-new::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 34px;
                height: 34px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.15);
                animation: bell-glow-pulse 2s ease-in-out infinite;
                pointer-events: none;
            }

            @keyframes bell-glow-pulse {
                0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.5; }
                50%      { transform: translate(-50%, -50%) scale(1.4); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Update bell visual state based on new file count
     */
    function updateBellState() {
        const bell = document.getElementById('notification-bell');
        const badge = document.getElementById('notification-badge');
        if (!bell) return;

        if (badge && !badge.classList.contains('hidden')) {
            bell.classList.add('has-new');
        } else {
            bell.classList.remove('has-new');
        }
    }

    /* ===================== GLOBAL API ===================== */
    window.OlympNotifications = {
        /**
         * Request notification permission
         */
        requestPermission,

        /**
         * Send a custom notification
         */
        send: sendNotification,

        /**
         * Notify about new resources
         */
        notifyNewResources,

        /**
         * Notify about a single resource
         */
        notifySingle: notifySingleResource,

        /**
         * Check permission state
         */
        getPermission: getPermissionState,

        /**
         * Check if notifications are supported
         */
        isSupported: isNotificationSupported,

        /**
         * Bell icon utilities
         */
        bell: NotificationBell,

        /**
         * Manually recheck for new files
         */
        recheck: recheckResources,

        /**
         * Update bell visual state
         */
        updateBellState,
    };

    /* ===================== INITIALIZATION ===================== */
    function init() {
        console.log('[Notifications] Initializing...');

        // Inject bell animation CSS
        injectBellShakeCSS();

        // Check support
        notifState.supported = isNotificationSupported();

        if (!notifState.supported) {
            console.log('[Notifications] Browser notifications not supported');
            return;
        }

        // Check current permission
        const currentPerm = Notification.permission;
        notifState.permissionGranted = currentPerm === 'granted';

        if (currentPerm === 'granted') {
            console.log('[Notifications] Permission already granted');
            onPermissionReady();
        } else if (currentPerm === 'default') {
            // Ask permission after a delay for better UX
            // (browsers may block if asked immediately)
            setTimeout(() => {
                requestPermission().then((granted) => {
                    if (granted) {
                        onPermissionReady();
                    }
                });
            }, NOTIF_CONFIG.permissionDelay);
        } else {
            console.log('[Notifications] Permission denied');
        }
    }

    /**
     * Called when notification permission is confirmed granted
     */
    function onPermissionReady() {
        // Wait for OlympApp to finish loading data
        waitForAppData().then(() => {
            // Notify new resources via browser notification
            if (window.OlympApp && window.OlympApp.state) {
                const newFiles = window.OlympApp.state.newFiles;
                if (newFiles && newFiles.length > 0) {
                    notifyNewResources(newFiles);
                }
            }

            // Update bell state
            updateBellState();

            // Start attention loop
            NotificationBell.startAttentionLoop();

            // Set up visibility recheck
            initVisibilityCheck();

            // Set up periodic check
            initPeriodicCheck();
        });
    }

    /**
     * Wait until OlympApp has loaded resource data
     */
    function waitForAppData() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait

            function check() {
                attempts++;

                if (
                    window.OlympApp &&
                    window.OlympApp.state &&
                    window.OlympApp.state.allFiles &&
                    window.OlympApp.state.allFiles.length > 0
                ) {
                    resolve();
                    return;
                }

                // Also resolve if resources were loaded but empty
                if (
                    window.OlympApp &&
                    window.OlympApp.state &&
                    window.OlympApp.state.resources !== null
                ) {
                    resolve();
                    return;
                }

                if (attempts >= maxAttempts) {
                    console.warn('[Notifications] Timeout waiting for app data');
                    resolve();
                    return;
                }

                setTimeout(check, 100);
            }

            check();
        });
    }

    /* ===================== START ===================== */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();