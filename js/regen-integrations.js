/* ============================================
   REGEN AGENCY - Integrations Logic
   ============================================ */

(function () {
    'use strict';

    // Platform definitions
    var PLATFORMS = {
        ecommerce: [
            {
                id: 'prestashop',
                name: 'PrestaShop',
                icon: '&#128722;',
                color: '#DF0067',
                fields: [
                    { key: 'store_url', label: 'URL de la boutique', type: 'url', placeholder: 'https://www.example.com' },
                    { key: 'api_key', label: 'Cle API Webservice', type: 'password', placeholder: 'Cle API PrestaShop' }
                ]
            },
            {
                id: 'shopify',
                name: 'Shopify',
                icon: '&#127968;',
                color: '#96BF48',
                fields: [
                    { key: 'store_url', label: 'URL de la boutique', type: 'url', placeholder: 'https://store.myshopify.com' },
                    { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'API Key Shopify' },
                    { key: 'api_secret', label: 'API Secret', type: 'password', placeholder: 'API Secret' },
                    { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Admin API Access Token' }
                ]
            },
            {
                id: 'woocommerce',
                name: 'WooCommerce',
                icon: '&#128230;',
                color: '#96588A',
                fields: [
                    { key: 'store_url', label: 'URL du site WordPress', type: 'url', placeholder: 'https://www.example.com' },
                    { key: 'consumer_key', label: 'Consumer Key', type: 'password', placeholder: 'ck_xxx' },
                    { key: 'consumer_secret', label: 'Consumer Secret', type: 'password', placeholder: 'cs_xxx' }
                ]
            }
        ],
        ads: [
            {
                id: 'google_ads',
                name: 'Google Ads',
                icon: 'G',
                color: '#4285F4',
                fields: [
                    { key: 'access_type', label: 'Type d\'acces', type: 'select', options: ['mcc', 'direct'] },
                    { key: 'customer_id', label: 'Customer ID', type: 'text', placeholder: '123-456-7890' },
                    { key: 'mcc_id', label: 'MCC ID (si MCC)', type: 'text', placeholder: '111-222-3333' }
                ]
            },
            {
                id: 'meta_ads',
                name: 'Meta Ads',
                icon: 'M',
                color: '#1877F2',
                fields: [
                    { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', placeholder: 'act_123456789' },
                    { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Token long-lived' }
                ]
            },
            {
                id: 'tiktok_ads',
                name: 'TikTok Ads',
                icon: 'T',
                color: '#000000',
                fields: [
                    { key: 'advertiser_id', label: 'Advertiser ID', type: 'text', placeholder: '12345678' },
                    { key: 'access_token', label: 'Access Token', type: 'password', placeholder: 'Token TikTok Business' }
                ]
            }
        ]
    };

    var existingIntegrations = {};

    // ── Init ─────────────────────────────────
    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        loadIntegrations();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupConfigPanel();
        loadIntegrations();
    }

    // ── Config Panel ────────────────────────
    function setupConfigPanel() {
        var closeBtn = document.getElementById('integration-config-close');
        var form = document.getElementById('integration-config-form');
        var testBtn = document.getElementById('integration-test-btn');
        var syncBtn = document.getElementById('integration-sync-btn');

        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                document.getElementById('integration-config').style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                await saveIntegration();
            });
        }

        if (testBtn) {
            testBtn.addEventListener('click', testConnection);
        }

        if (syncBtn) {
            syncBtn.addEventListener('click', syncNow);
        }
    }

    // ── Load Integrations ───────────────────
    async function loadIntegrations() {
        var client = window.REGEN.currentClient;
        if (!client) {
            renderEmptyState('ecommerce-integrations');
            renderEmptyState('ads-integrations');
            return;
        }

        try {
            var result = await window.REGEN.supabase
                .from('integrations')
                .select('*')
                .eq('client_id', client.id);

            var integrations = result.data || [];

            // Index by platform
            existingIntegrations = {};
            integrations.forEach(function (i) {
                existingIntegrations[i.platform] = i;
            });

            renderPlatformCards('ecommerce-integrations', PLATFORMS.ecommerce);
            renderPlatformCards('ads-integrations', PLATFORMS.ads);

        } catch (err) {
            console.error('Load integrations error:', err);
        }
    }

    // ── Render Platform Cards ───────────────
    function renderPlatformCards(containerId, platforms) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var html = '<div class="rc-grid-3">';

        platforms.forEach(function (platform) {
            var integration = existingIntegrations[platform.id];
            var status = integration ? integration.status : 'disconnected';
            var lastSync = integration ? integration.last_sync : null;

            var statusLabel, statusClass;
            switch (status) {
                case 'active':
                    statusLabel = 'Connecte';
                    statusClass = 'rc-badge--active';
                    break;
                case 'error':
                    statusLabel = 'Erreur';
                    statusClass = 'rc-badge--error';
                    break;
                case 'pending':
                    statusLabel = 'En attente';
                    statusClass = 'rc-badge--pending';
                    break;
                default:
                    statusLabel = 'Deconnecte';
                    statusClass = '';
            }

            html += '<div class="rc-integration-card" data-platform="' + platform.id + '">';
            html += '<div class="rc-integration-card__header">';
            html += '<div class="rc-integration-card__icon" style="background:' + platform.color + ';color:#fff;">' + platform.icon + '</div>';
            html += '<div>';
            html += '<div class="rc-integration-card__name">' + platform.name + '</div>';
            html += '<span class="rc-badge ' + statusClass + '">' + statusLabel + '</span>';
            html += '</div>';
            html += '</div>';

            if (lastSync) {
                html += '<div class="rc-text-sm rc-text-muted" style="margin: 8px 0;">Derniere sync : ' + window.REGEN.formatRelativeDate(lastSync) + '</div>';
            }

            html += '<button class="rc-btn rc-btn--secondary rc-btn--sm" style="width:100%; margin-top: 12px;" onclick="window._configureIntegration(\'' + platform.id + '\')">';
            html += integration ? 'Configurer' : 'Connecter';
            html += '</button>';
            html += '</div>';
        });

        html += '</div>';
        container.innerHTML = html;
    }

    function renderEmptyState(containerId) {
        var container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '<div class="rc-empty"><div class="rc-empty__title">Selectionnez un client</div></div>';
    }

    // ── Configure Integration ───────────────
    window._configureIntegration = function (platformId) {
        var platform = findPlatform(platformId);
        if (!platform) return;

        var panel = document.getElementById('integration-config');
        var title = document.getElementById('integration-config-title');
        var platformInput = document.getElementById('integration-config-platform');
        var fieldsContainer = document.getElementById('integration-config-fields');

        title.textContent = 'Configuration : ' + platform.name;
        platformInput.value = platformId;

        // Get existing credentials
        var existing = existingIntegrations[platformId];
        var credentials = (existing && existing.credentials) ? existing.credentials : {};

        // Build form fields
        var html = '';
        platform.fields.forEach(function (field) {
            html += '<div class="rc-form-group" style="margin-bottom: 12px;">';
            html += '<label class="rc-form-label">' + field.label + '</label>';

            if (field.type === 'select') {
                html += '<select class="rc-select" name="cred_' + field.key + '">';
                field.options.forEach(function (opt) {
                    var selected = credentials[field.key] === opt ? ' selected' : '';
                    html += '<option value="' + opt + '"' + selected + '>' + opt.charAt(0).toUpperCase() + opt.slice(1) + '</option>';
                });
                html += '</select>';
            } else {
                html += '<input class="rc-input" type="' + field.type + '" name="cred_' + field.key + '"';
                html += ' placeholder="' + (field.placeholder || '') + '"';
                html += ' value="' + (credentials[field.key] || '') + '">';
            }

            html += '</div>';
        });

        fieldsContainer.innerHTML = html;
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    };

    // ── Save Integration ────────────────────
    async function saveIntegration() {
        var client = window.REGEN.currentClient;
        if (!client) {
            window.REGEN.toast('Selectionnez un client.', 'error');
            return;
        }

        var platformId = document.getElementById('integration-config-platform').value;
        var platform = findPlatform(platformId);
        if (!platform) return;

        // Gather credentials
        var credentials = {};
        platform.fields.forEach(function (field) {
            var input = document.querySelector('[name="cred_' + field.key + '"]');
            if (input) credentials[field.key] = input.value;
        });

        try {
            var existing = existingIntegrations[platformId];

            if (existing) {
                // Update
                var result = await window.REGEN.supabase
                    .from('integrations')
                    .update({
                        credentials: credentials,
                        status: 'pending',
                        config: { updated_at: new Date().toISOString() }
                    })
                    .eq('id', existing.id);

                if (result.error) throw result.error;
            } else {
                // Insert
                var result = await window.REGEN.supabase
                    .from('integrations')
                    .insert({
                        client_id: client.id,
                        platform: platformId,
                        credentials: credentials,
                        status: 'pending',
                        config: { created_at: new Date().toISOString() }
                    });

                if (result.error) throw result.error;
            }

            window.REGEN.toast('Integration sauvegardee !', 'success');
            document.getElementById('integration-config').style.display = 'none';
            loadIntegrations();

        } catch (err) {
            console.error('Save integration error:', err);
            window.REGEN.toast('Erreur : ' + (err.message || err), 'error');
        }
    }

    // ── Test Connection ────────────────────
    async function testConnection() {
        var platformId = document.getElementById('integration-config-platform').value;

        if (!platformId) {
            window.REGEN.toast('Selectionnez une plateforme.', 'error');
            return;
        }

        var testBtn = document.getElementById('integration-test-btn');
        testBtn.disabled = true;
        testBtn.textContent = 'Test en cours...';

        try {
            if (platformId === 'prestashop') {
                // Test PrestaShop API connection
                var storeUrl = document.querySelector('[name="cred_store_url"]');
                var apiKey = document.querySelector('[name="cred_api_key"]');

                if (!storeUrl || !storeUrl.value || !apiKey || !apiKey.value) {
                    window.REGEN.toast('Renseignez l\'URL et la cle API.', 'error');
                    return;
                }

                // Try to call the PrestaShop API root
                // Note: this may fail due to CORS. In that case, we test via Edge Function
                try {
                    var response = await fetch(storeUrl.value.replace(/\/$/, '') + '/api/?output_format=JSON', {
                        headers: {
                            'Authorization': 'Basic ' + btoa(apiKey.value + ':')
                        },
                        mode: 'cors'
                    });

                    if (response.ok) {
                        window.REGEN.toast('Connexion PrestaShop reussie !', 'success');
                    } else if (response.status === 401) {
                        window.REGEN.toast('Cle API invalide (erreur 401).', 'error');
                    } else {
                        window.REGEN.toast('Erreur PrestaShop: HTTP ' + response.status, 'error');
                    }
                } catch (corsErr) {
                    // CORS error is expected - the API probably works but doesn't allow browser requests
                    window.REGEN.toast('URL configuree. Le test complet sera fait lors du premier sync (CORS bloque le test navigateur).', 'warning');
                }

            } else if (platformId === 'google_ads') {
                // Google Ads can only be tested server-side
                window.REGEN.toast('Google Ads sera teste lors du premier sync automatique. Assurez-vous que les credentials sont correctes.', 'info');

            } else if (platformId === 'meta_ads') {
                // Meta Ads test
                var accessToken = document.querySelector('[name="cred_access_token"]');
                if (!accessToken || !accessToken.value) {
                    window.REGEN.toast('Renseignez l\'access token.', 'error');
                    return;
                }

                try {
                    var response = await fetch('https://graph.facebook.com/v19.0/me?access_token=' + accessToken.value);
                    if (response.ok) {
                        window.REGEN.toast('Connexion Meta reussie !', 'success');
                    } else {
                        window.REGEN.toast('Token Meta invalide.', 'error');
                    }
                } catch (err) {
                    window.REGEN.toast('Erreur de connexion Meta.', 'error');
                }

            } else {
                window.REGEN.toast('Test non disponible pour cette plateforme.', 'info');
            }
        } catch (err) {
            console.error('Test connection error:', err);
            window.REGEN.toast('Erreur : ' + (err.message || err), 'error');
        }

        testBtn.disabled = false;
        testBtn.textContent = 'Tester la connexion';
    }

    // ── Sync Now ────────────────────────────
    async function syncNow() {
        var client = window.REGEN.currentClient;
        if (!client) {
            window.REGEN.toast('Selectionnez un client.', 'error');
            return;
        }

        var platformId = document.getElementById('integration-config-platform').value;
        if (!platformId) {
            window.REGEN.toast('Aucune plateforme selectionnee.', 'error');
            return;
        }

        var syncBtn = document.getElementById('integration-sync-btn');
        syncBtn.disabled = true;
        syncBtn.textContent = 'Synchronisation...';

        window.REGEN.toast('Synchronisation en cours... Cela peut prendre quelques secondes.', 'info');

        try {
            var functionName = '';
            if (platformId === 'prestashop') {
                functionName = 'sync-prestashop';
            } else if (platformId === 'google_ads') {
                functionName = 'sync-google-ads';
            } else {
                window.REGEN.toast('Sync automatique pas encore disponible pour ' + platformId + '.', 'info');
                syncBtn.disabled = false;
                syncBtn.textContent = 'Sync maintenant';
                return;
            }

            var result = await window.REGEN.supabase.functions.invoke(functionName, {
                body: { client_id: client.id, trigger: 'manual' }
            });

            if (result.error) {
                throw result.error;
            }

            var data = result.data;

            if (data.error) {
                window.REGEN.toast('Erreur sync : ' + data.error, 'error');
            } else if (data.total_imported !== undefined) {
                window.REGEN.toast(data.total_imported + ' commandes importees !', 'success');
            } else if (data.total_campaigns !== undefined) {
                window.REGEN.toast(data.total_campaigns + ' campagnes, ' + data.total_metrics + ' metriques synchronisees !', 'success');
            } else {
                window.REGEN.toast('Synchronisation terminee.', 'success');
            }

            // Reload integrations to show updated last_sync
            loadIntegrations();

        } catch (err) {
            console.error('Sync error:', err);
            window.REGEN.toast('Erreur de synchronisation : ' + (err.message || err), 'error');
        }

        syncBtn.disabled = false;
        syncBtn.textContent = 'Sync maintenant';
    }

    // ── Helpers ──────────────────────────────
    function findPlatform(id) {
        var all = PLATFORMS.ecommerce.concat(PLATFORMS.ads);
        return all.find(function (p) { return p.id === id; });
    }

})();
