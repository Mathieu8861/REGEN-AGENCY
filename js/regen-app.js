/* ============================================
   REGEN AGENCY - Espace Client Core
   Init Supabase, Auth Guard, Global Helpers
   ============================================ */

(function () {
    'use strict';

    // ── Supabase Config ──────────────────────
    var SUPABASE_URL = 'https://jrhqqsybebdkoqrnogez.supabase.co';
    var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyaHFxc3liZWJka29xcm5vZ2V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDU2NzEsImV4cCI6MjA4ODEyMTY3MX0._BykT5zc-GH6SLwi_jaaukNmmmR_zpcdsuic3E5dFm8';

    // ── Global Namespace ─────────────────────
    var supabaseClient = null;
    if (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    window.REGEN = {
        supabase: supabaseClient,
        currentUser: null,
        currentProfile: null,
        currentClient: null,
        accessibleClients: [],
        isReady: false,
        agencyId: '00000000-0000-0000-0000-000000000001'
    };

    // ── Auth Pages (no guard needed) ─────────
    var AUTH_PAGES = ['connexion.html'];
    var ADMIN_PAGES = ['admin/clients.html', 'admin/users.html', 'admin/import.html'];

    function isAuthPage() {
        var path = window.location.pathname;
        return AUTH_PAGES.some(function (p) { return path.endsWith(p); });
    }

    function isAdminPage() {
        var path = window.location.pathname;
        return ADMIN_PAGES.some(function (p) { return path.endsWith(p); });
    }

    // ── Auth Check ───────────────────────────
    async function checkAuth() {
        if (!window.REGEN.supabase) {
            console.warn('REGEN: Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in regen-app.js');
            if (!isAuthPage()) {
                window.location.href = getBasePath() + 'connexion.html';
            }
            return;
        }

        try {
            var sessionResult = await window.REGEN.supabase.auth.getSession();
            var session = sessionResult.data.session;

            if (!session && !isAuthPage()) {
                window.location.href = getBasePath() + 'connexion.html';
                return;
            }

            if (!session && isAuthPage()) {
                document.dispatchEvent(new Event('regen:ready'));
                return;
            }

            if (session) {
                window.REGEN.currentUser = session.user;

                // Fetch profile
                var profileResult = await window.REGEN.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (profileResult.data) {
                    window.REGEN.currentProfile = profileResult.data;
                }

                // Redirect logged-in users away from login page
                if (isAuthPage()) {
                    var home = (window.REGEN.currentProfile && window.REGEN.currentProfile.role !== 'client')
                        ? 'overview.html' : 'dashboard.html';
                    window.location.href = getBasePath() + home;
                    return;
                }

                // Check admin access
                if (isAdminPage() && window.REGEN.currentProfile && window.REGEN.currentProfile.role === 'client') {
                    window.location.href = getBasePath() + 'dashboard.html';
                    return;
                }

                // Load accessible clients
                await loadClients();

                // Update nav
                updateNav();
            }

            window.REGEN.isReady = true;
            document.dispatchEvent(new Event('regen:ready'));

        } catch (err) {
            console.error('REGEN: Auth error', err);
            if (!isAuthPage()) {
                window.location.href = getBasePath() + 'connexion.html';
            }
        }
    }

    // ── Load Clients ─────────────────────────
    async function loadClients() {
        var result = await window.REGEN.supabase
            .from('clients')
            .select('*')
            .eq('is_active', true)
            .order('name');

        if (result.data) {
            window.REGEN.accessibleClients = result.data;

            // Restore selected client from localStorage
            var savedClientId = localStorage.getItem('regen_selected_client');
            if (savedClientId) {
                var found = result.data.find(function (c) { return c.id === savedClientId; });
                if (found) {
                    window.REGEN.currentClient = found;
                }
            }

            // Default to first client
            if (!window.REGEN.currentClient && result.data.length > 0) {
                window.REGEN.currentClient = result.data[0];
                localStorage.setItem('regen_selected_client', result.data[0].id);
            }
        }
    }

    // ── Update Navigation ────────────────────
    function updateNav() {
        var profile = window.REGEN.currentProfile;
        if (!profile) return;

        // User name
        var userNameEl = document.getElementById('regen-user-name');
        if (userNameEl) {
            userNameEl.textContent = profile.full_name || profile.email || 'Utilisateur';
        }

        // User role badge
        var roleBadgeEl = document.getElementById('regen-user-role');
        if (roleBadgeEl) {
            var roleLabels = { admin: 'Admin', staff: 'Staff', client: 'Client' };
            roleBadgeEl.textContent = roleLabels[profile.role] || profile.role;
            roleBadgeEl.className = 'rc-badge rc-badge--' + profile.role;
        }

        // Show/hide admin links
        var adminLinks = document.querySelectorAll('[data-admin-only]');
        var isStaff = profile.role === 'admin' || profile.role === 'staff';
        adminLinks.forEach(function (el) {
            el.style.display = isStaff ? '' : 'none';
        });

        // Client selector
        buildClientSelector();

        // Active nav link
        var currentPage = window.location.pathname.split('/').pop();
        var navLinks = document.querySelectorAll('.rc-sidebar__link');
        navLinks.forEach(function (link) {
            var href = link.getAttribute('href');
            if (href && href.endsWith(currentPage)) {
                link.classList.add('active');
            }
        });
    }

    // ── Client Selector ──────────────────────
    function buildClientSelector() {
        var container = document.getElementById('regen-client-selector');
        if (!container) return;

        var clients = window.REGEN.accessibleClients;
        if (clients.length === 0) {
            container.innerHTML = '<span class="rc-text-muted">Aucun client</span>';
            return;
        }

        var current = window.REGEN.currentClient;
        var html = '<select class="rc-select rc-select--client" id="regen-client-select">';
        clients.forEach(function (client) {
            var selected = current && current.id === client.id ? ' selected' : '';
            html += '<option value="' + client.id + '"' + selected + '>' + client.name + '</option>';
        });
        html += '</select>';
        container.innerHTML = html;

        document.getElementById('regen-client-select').addEventListener('change', function (e) {
            var clientId = e.target.value;
            var client = clients.find(function (c) { return c.id === clientId; });
            if (client) {
                window.REGEN.currentClient = client;
                localStorage.setItem('regen_selected_client', clientId);
                document.dispatchEvent(new Event('regen:client-changed'));
            }
        });
    }

    // ── Helpers ──────────────────────────────

    function getBasePath() {
        var path = window.location.pathname;
        if (path.includes('/admin/')) return '../';
        if (path.includes('/espace-client/')) return '';
        return 'espace-client/';
    }

    // Format money
    window.REGEN.formatMoney = function (value, currency) {
        currency = currency || 'EUR';
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value || 0);
    };

    // Format number
    window.REGEN.formatNumber = function (value) {
        return new Intl.NumberFormat('fr-FR').format(value || 0);
    };

    // Format percentage
    window.REGEN.formatPercent = function (value, decimals) {
        decimals = decimals !== undefined ? decimals : 2;
        return (value || 0).toFixed(decimals) + '%';
    };

    // Format ROAS
    window.REGEN.formatROAS = function (value) {
        return (value || 0).toFixed(2) + 'x';
    };

    // Format date
    window.REGEN.formatDate = function (dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // Relative date
    window.REGEN.formatRelativeDate = function (dateStr) {
        if (!dateStr) return '-';
        var d = new Date(dateStr);
        var now = new Date();
        var diff = now - d;
        var minutes = Math.floor(diff / 60000);
        var hours = Math.floor(diff / 3600000);
        var days = Math.floor(diff / 86400000);

        if (minutes < 1) return "a l'instant";
        if (minutes < 60) return 'il y a ' + minutes + ' min';
        if (hours < 24) return 'il y a ' + hours + ' h';
        if (days < 7) return 'il y a ' + days + ' j';
        return window.REGEN.formatDate(dateStr);
    };

    // Toast notification
    window.REGEN.toast = function (message, type) {
        type = type || 'info';
        var container = document.getElementById('regen-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'regen-toast-container';
            container.className = 'rc-toast-container';
            document.body.appendChild(container);
        }

        var toast = document.createElement('div');
        toast.className = 'rc-toast rc-toast--' + type;
        var icons = { success: '\u2713', error: '\u2717', warning: '\u26A0', info: '\u2139' };
        toast.innerHTML = '<span class="rc-toast__icon">' + (icons[type] || '') + '</span><span>' + message + '</span>';
        container.appendChild(toast);

        requestAnimationFrame(function () { toast.classList.add('rc-toast--visible'); });

        setTimeout(function () {
            toast.classList.remove('rc-toast--visible');
            toast.classList.add('rc-toast--removing');
            setTimeout(function () { toast.remove(); }, 300);
        }, 4000);
    };

    // Loading state
    window.REGEN.showLoading = function (container) {
        if (typeof container === 'string') container = document.querySelector(container);
        if (!container) return;
        container.innerHTML = '<div class="rc-loading"><div class="rc-spinner"></div><span>Chargement...</span></div>';
    };

    // Animated counter
    window.REGEN.animateCounter = function (element, targetValue, formatter) {
        formatter = formatter || function (v) { return v.toString(); };
        var start = 0;
        var duration = 1200;
        var startTime = null;

        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            var progress = Math.min((timestamp - startTime) / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 4); // easeOutQuart
            var current = start + (targetValue - start) * eased;
            element.textContent = formatter(current);
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    };

    // Logout
    window.REGEN.logout = async function () {
        if (window.REGEN.supabase) {
            await window.REGEN.supabase.auth.signOut();
        }
        localStorage.removeItem('regen_selected_client');
        window.location.href = getBasePath() + 'connexion.html';
    };

    // Channel info
    window.REGEN.getChannelInfo = function (channel) {
        var channels = {
            google_ads: { label: 'Google Ads', color: '#4285F4', icon: 'G' },
            meta_ads: { label: 'Meta Ads', color: '#1877F2', icon: 'M' },
            tiktok_ads: { label: 'TikTok Ads', color: '#000000', icon: 'T' },
            email: { label: 'Email', color: '#f59e0b', icon: '@' },
            organic: { label: 'Organic', color: '#2FB963', icon: 'O' },
            direct: { label: 'Direct', color: '#6b7280', icon: 'D' },
            referral: { label: 'Referral', color: '#8b5cf6', icon: 'R' },
            other: { label: 'Autre', color: '#9ca3af', icon: '?' }
        };
        return channels[channel] || channels.other;
    };

    // ── Sidebar Toggle (mobile) ──────────────
    function initSidebarToggle() {
        var toggle = document.getElementById('regen-sidebar-toggle');
        var sidebar = document.querySelector('.rc-sidebar');
        if (toggle && sidebar) {
            toggle.addEventListener('click', function () {
                sidebar.classList.toggle('rc-sidebar--open');
            });
        }
    }

    // ── Logout Button ────────────────────────
    function initLogout() {
        var btn = document.getElementById('regen-logout-btn');
        if (btn) {
            btn.addEventListener('click', function (e) {
                e.preventDefault();
                window.REGEN.logout();
            });
        }
    }

    // ── Init ─────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        initSidebarToggle();
        initLogout();
        checkAuth();
    });

})();
