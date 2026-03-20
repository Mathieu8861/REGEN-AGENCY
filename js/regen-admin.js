/* ============================================
   REGEN AGENCY - Admin Panel Logic
   ============================================ */

(function () {
    'use strict';

    document.addEventListener('regen:ready', init);

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;
        if (window.REGEN.currentProfile.role !== 'admin' && window.REGEN.currentProfile.role !== 'staff') return;

        setupClientForm();
        loadClients();
        loadUsers();
    }

    // ══════════════════════════════════════════
    // CLIENTS MANAGEMENT
    // ══════════════════════════════════════════

    async function loadClients() {
        var tbody = document.getElementById('clients-table-body');
        if (!tbody) return;

        try {
            var result = await window.REGEN.supabase
                .from('clients')
                .select('*')
                .eq('agency_id', window.REGEN.agencyId)
                .order('name');

            var clients = result.data || [];
            if (clients.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="rc-empty"><div class="rc-empty__title">Aucun client</div><div class="rc-empty__text">Ajoutez votre premier client.</div></div></td></tr>';
                return;
            }

            var html = '';
            clients.forEach(function (client) {
                var platformLabels = {
                    prestashop: 'PrestaShop',
                    shopify: 'Shopify',
                    woocommerce: 'WooCommerce',
                    other: 'Autre'
                };

                html += '<tr>';
                html += '<td class="rc-text-bold">';
                html += '<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:' + (client.color || '#2FB963') + ';margin-right:8px;vertical-align:middle;"></span>';
                html += client.name;
                html += '</td>';
                html += '<td><a href="' + (client.website || '#') + '" target="_blank" class="rc-text-sm" style="color:var(--rc-info);text-decoration:none;">' + (client.website || '-') + '</a></td>';
                html += '<td>' + (platformLabels[client.platform] || client.platform || '-') + '</td>';
                html += '<td>' + (client.is_active ? '<span class="rc-badge rc-badge--active">Actif</span>' : '<span class="rc-badge rc-badge--error">Inactif</span>') + '</td>';
                html += '<td class="rc-text-right">';
                html += '<button class="rc-btn rc-btn--secondary rc-btn--sm" onclick="editClient(\'' + client.id + '\')">Modifier</button> ';
                html += '</td>';
                html += '</tr>';
            });

            tbody.innerHTML = html;

            // Expose client data for editing
            window._adminClients = clients;

        } catch (err) {
            console.error('Load clients error:', err);
        }
    }

    // ── Client Form ──────────────────────────
    function setupClientForm() {
        var addBtn = document.getElementById('add-client-btn');
        var cancelBtn = document.getElementById('client-form-cancel');
        var form = document.getElementById('client-form');
        var formCard = document.getElementById('client-form-card');

        if (addBtn) {
            addBtn.addEventListener('click', function () {
                resetForm();
                document.getElementById('client-form-title').textContent = 'Nouveau client';
                formCard.style.display = 'block';
                formCard.scrollIntoView({ behavior: 'smooth' });
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                formCard.style.display = 'none';
            });
        }

        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                await saveClient();
            });
        }
    }

    function resetForm() {
        document.getElementById('client-id').value = '';
        document.getElementById('client-name').value = '';
        document.getElementById('client-website').value = '';
        document.getElementById('client-platform').value = 'prestashop';
        document.getElementById('client-color').value = '#2FB963';
        document.getElementById('client-notes').value = '';
    }

    // Expose globally for inline onclick
    window.editClient = function (clientId) {
        var clients = window._adminClients || [];
        var client = clients.find(function (c) { return c.id === clientId; });
        if (!client) return;

        document.getElementById('client-id').value = client.id;
        document.getElementById('client-name').value = client.name || '';
        document.getElementById('client-website').value = client.website || '';
        document.getElementById('client-platform').value = client.platform || 'other';
        document.getElementById('client-color').value = client.color || '#2FB963';
        document.getElementById('client-notes').value = client.notes || '';

        document.getElementById('client-form-title').textContent = 'Modifier : ' + client.name;
        var formCard = document.getElementById('client-form-card');
        formCard.style.display = 'block';
        formCard.scrollIntoView({ behavior: 'smooth' });
    };

    async function saveClient() {
        var clientId = document.getElementById('client-id').value;
        var data = {
            name: document.getElementById('client-name').value.trim(),
            website: document.getElementById('client-website').value.trim() || null,
            platform: document.getElementById('client-platform').value,
            color: document.getElementById('client-color').value,
            notes: document.getElementById('client-notes').value.trim() || null,
            agency_id: window.REGEN.agencyId
        };

        if (!data.name) {
            window.REGEN.toast('Le nom du client est requis.', 'error');
            return;
        }

        try {
            var result;
            if (clientId) {
                result = await window.REGEN.supabase
                    .from('clients')
                    .update(data)
                    .eq('id', clientId);
            } else {
                result = await window.REGEN.supabase
                    .from('clients')
                    .insert(data);
            }

            if (result.error) throw result.error;

            window.REGEN.toast(clientId ? 'Client mis a jour !' : 'Client cree !', 'success');
            document.getElementById('client-form-card').style.display = 'none';
            loadClients();

        } catch (err) {
            console.error('Save client error:', err);
            window.REGEN.toast('Erreur : ' + (err.message || err), 'error');
        }
    }

    // ══════════════════════════════════════════
    // USERS MANAGEMENT
    // ══════════════════════════════════════════

    async function loadUsers() {
        var container = document.getElementById('users-list');
        if (!container) return;

        try {
            var result = await window.REGEN.supabase
                .from('profiles')
                .select('*')
                .eq('agency_id', window.REGEN.agencyId)
                .order('created_at');

            var users = result.data || [];
            if (users.length === 0) {
                container.innerHTML = '<p class="rc-text-muted">Aucun utilisateur.</p>';
                return;
            }

            var html = '<div class="rc-table-wrap"><table class="rc-table"><thead><tr>';
            html += '<th>Nom</th><th>Email</th><th>Role</th><th>Cree le</th>';
            html += '</tr></thead><tbody>';

            users.forEach(function (user) {
                var roleLabels = { admin: 'Admin', staff: 'Staff', client: 'Client' };
                html += '<tr>';
                html += '<td class="rc-text-bold">' + (user.full_name || '-') + '</td>';
                html += '<td>' + (user.email || '-') + '</td>';
                html += '<td><span class="rc-badge rc-badge--' + user.role + '">' + (roleLabels[user.role] || user.role) + '</span></td>';
                html += '<td class="rc-text-muted rc-text-sm">' + window.REGEN.formatDate(user.created_at) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Load users error:', err);
        }
    }

})();
