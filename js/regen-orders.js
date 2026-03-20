/* ============================================
   REGEN AGENCY - Orders Logic
   ============================================ */

(function () {
    'use strict';

    var PAGE_SIZE = 50;
    var currentPage = 0;
    var allOrders = [];
    var filteredOrders = [];

    // ── Init ─────────────────────────────────
    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        currentPage = 0;
        loadOrders();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupFilters();
        setupExport();
        setupDetailPanel();
        setDefaultDates();
        loadOrders();
    }

    // ── Default Dates ───────────────────────
    function setDefaultDates() {
        var toEl = document.getElementById('orders-filter-to');
        var fromEl = document.getElementById('orders-filter-from');
        if (toEl) toEl.value = new Date().toISOString().split('T')[0];
        if (fromEl) {
            var d = new Date();
            d.setDate(d.getDate() - 90);
            fromEl.value = d.toISOString().split('T')[0];
        }
    }

    // ── Filters ─────────────────────────────
    function setupFilters() {
        var channelEl = document.getElementById('orders-filter-channel');
        var fromEl = document.getElementById('orders-filter-from');
        var toEl = document.getElementById('orders-filter-to');
        var searchEl = document.getElementById('orders-filter-search');

        if (channelEl) channelEl.addEventListener('change', applyFilters);
        if (fromEl) fromEl.addEventListener('change', function () { currentPage = 0; loadOrders(); });
        if (toEl) toEl.addEventListener('change', function () { currentPage = 0; loadOrders(); });
        if (searchEl) {
            var debounceTimer;
            searchEl.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(function () { applyFilters(); }, 300);
            });
        }
    }

    // ── Export CSV ──────────────────────────
    function setupExport() {
        var btn = document.getElementById('orders-export-btn');
        if (!btn) return;

        btn.addEventListener('click', function () {
            if (filteredOrders.length === 0) {
                window.REGEN.toast('Aucune commande a exporter.', 'error');
                return;
            }

            var csv = 'Date;Reference;Total TTC;Canal;Campagne;Source URL\n';
            filteredOrders.forEach(function (order) {
                csv += [
                    order.order_date,
                    '"' + (order.reference || '') + '"',
                    order.total_ttc,
                    order.channel || 'direct',
                    '"' + (order.utm_campaign || '') + '"',
                    '"' + (order.source_url || '') + '"'
                ].join(';') + '\n';
            });

            var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            var clientName = window.REGEN.currentClient ? window.REGEN.currentClient.name : 'export';
            a.download = 'commandes_' + clientName + '_' + new Date().toISOString().split('T')[0] + '.csv';
            a.click();
            URL.revokeObjectURL(url);

            window.REGEN.toast('Export CSV telecharge !', 'success');
        });
    }

    // ── Detail Panel ────────────────────────
    function setupDetailPanel() {
        var closeBtn = document.getElementById('order-detail-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                document.getElementById('order-detail').style.display = 'none';
            });
        }
    }

    // ── Load Orders ─────────────────────────
    async function loadOrders() {
        var client = window.REGEN.currentClient;
        if (!client) {
            showEmptyState();
            return;
        }

        var fromEl = document.getElementById('orders-filter-from');
        var toEl = document.getElementById('orders-filter-to');
        var dateFrom = fromEl ? fromEl.value : null;
        var dateTo = toEl ? toEl.value : null;

        try {
            var query = window.REGEN.supabase
                .from('orders')
                .select('id, order_date, total_ttc, channel, reference, source_url, utm_source, utm_medium, utm_campaign, utm_content, gclid, fbclid, ttclid, external_id')
                .eq('client_id', client.id)
                .order('order_date', { ascending: false });

            if (dateFrom) query = query.gte('order_date', dateFrom);
            if (dateTo) query = query.lte('order_date', dateTo);

            var result = await query;
            allOrders = result.data || [];
            applyFilters();

        } catch (err) {
            console.error('REGEN Orders: Error loading data', err);
            window.REGEN.toast('Erreur lors du chargement des commandes', 'error');
        }
    }

    // ── Apply Filters ───────────────────────
    function applyFilters() {
        var channelFilter = document.getElementById('orders-filter-channel');
        var searchFilter = document.getElementById('orders-filter-search');

        var channel = channelFilter ? channelFilter.value : '';
        var search = searchFilter ? searchFilter.value.toLowerCase().trim() : '';

        filteredOrders = allOrders.filter(function (order) {
            if (channel && order.channel !== channel) return false;
            if (search) {
                var matchRef = (order.reference || '').toLowerCase().indexOf(search) !== -1;
                var matchCampaign = (order.utm_campaign || '').toLowerCase().indexOf(search) !== -1;
                var matchId = (order.external_id || '').toLowerCase().indexOf(search) !== -1;
                if (!matchRef && !matchCampaign && !matchId) return false;
            }
            return true;
        });

        currentPage = 0;
        updateKPIs();
        renderOrders();
        renderPagination();
    }

    // ── Update KPIs ─────────────────────────
    function updateKPIs() {
        var totalOrders = filteredOrders.length;
        var totalRevenue = filteredOrders.reduce(function (s, o) { return s + parseFloat(o.total_ttc || 0); }, 0);
        var avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        animateKPI('orders-kpi-count', totalOrders, window.REGEN.formatNumber);
        animateKPI('orders-kpi-revenue', totalRevenue, window.REGEN.formatMoney);
        animateKPI('orders-kpi-basket', avgBasket, window.REGEN.formatMoney);
    }

    function animateKPI(id, value, formatter) {
        var el = document.getElementById(id);
        if (!el) return;
        window.REGEN.animateCounter(el, value, function (v) {
            return formatter(Math.round(v * 100) / 100);
        });
    }

    // ── Render Orders Table ─────────────────
    function renderOrders() {
        var tbody = document.getElementById('orders-table-body');
        if (!tbody) return;

        var start = currentPage * PAGE_SIZE;
        var pageOrders = filteredOrders.slice(start, start + PAGE_SIZE);

        if (filteredOrders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7"><div class="rc-empty">'
                + '<div class="rc-empty__icon">&#128722;</div>'
                + '<div class="rc-empty__title">Aucune commande</div>'
                + '<div class="rc-empty__text">Importez des commandes via CSV ou connectez une integration.</div>'
                + '</div></td></tr>';
            return;
        }

        var html = '';
        pageOrders.forEach(function (order) {
            var info = window.REGEN.getChannelInfo(order.channel || 'direct');
            var campaign = order.utm_campaign || '-';
            if (campaign.length > 30) campaign = campaign.substring(0, 30) + '...';

            html += '<tr>';
            html += '<td>' + window.REGEN.formatDate(order.order_date) + '</td>';
            html += '<td><code>' + (order.reference || '-') + '</code></td>';
            html += '<td class="rc-text-right rc-text-bold">' + window.REGEN.formatMoney(order.total_ttc) + '</td>';
            html += '<td><span class="rc-channel-badge rc-channel-badge--' + (order.channel || 'direct') + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
            html += '<td class="rc-text-sm rc-text-muted">' + campaign + '</td>';
            html += '<td class="rc-text-sm rc-text-muted">-</td>';
            html += '<td class="rc-text-right"><button class="rc-btn rc-btn--secondary rc-btn--sm" onclick="showOrderDetail(\'' + order.id + '\')">Detail</button></td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
    }

    // ── Pagination ──────────────────────────
    function renderPagination() {
        var container = document.getElementById('orders-pagination');
        if (!container) return;

        var totalPages = Math.ceil(filteredOrders.length / PAGE_SIZE);
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        var html = '<div class="rc-flex rc-gap-8" style="justify-content:center; align-items:center;">';

        // Previous
        html += '<button class="rc-btn rc-btn--secondary rc-btn--sm" ' + (currentPage === 0 ? 'disabled' : '') + ' onclick="window._ordersChangePage(' + (currentPage - 1) + ')">&laquo; Prec.</button>';

        // Page info
        html += '<span class="rc-text-sm rc-text-muted">Page ' + (currentPage + 1) + ' / ' + totalPages + ' (' + filteredOrders.length + ' commandes)</span>';

        // Next
        html += '<button class="rc-btn rc-btn--secondary rc-btn--sm" ' + (currentPage >= totalPages - 1 ? 'disabled' : '') + ' onclick="window._ordersChangePage(' + (currentPage + 1) + ')">Suiv. &raquo;</button>';

        html += '</div>';
        container.innerHTML = html;
    }

    // Expose for pagination buttons
    window._ordersChangePage = function (page) {
        currentPage = page;
        renderOrders();
        renderPagination();
        document.querySelector('.rc-content').scrollTo(0, 0);
    };

    // ── Show Order Detail ───────────────────
    window.showOrderDetail = async function (orderId) {
        var order = allOrders.find(function (o) { return o.id === orderId; });
        if (!order) return;

        var panel = document.getElementById('order-detail');
        var title = document.getElementById('order-detail-title');
        var content = document.getElementById('order-detail-content');

        title.textContent = 'Commande ' + (order.reference || order.external_id || orderId);

        // Fetch order items
        var itemsResult = await window.REGEN.supabase
            .from('order_items')
            .select('*')
            .eq('order_id', orderId);

        var items = itemsResult.data || [];
        var info = window.REGEN.getChannelInfo(order.channel || 'direct');

        var html = '<div class="rc-grid-2" style="margin-bottom: 20px;">';

        // Left: Order info
        html += '<div>';
        html += '<h3 class="rc-text-bold rc-mb-16">Informations</h3>';
        html += '<table class="rc-table">';
        html += '<tr><td class="rc-text-muted">Date</td><td class="rc-text-bold">' + window.REGEN.formatDate(order.order_date) + '</td></tr>';
        html += '<tr><td class="rc-text-muted">Reference</td><td><code>' + (order.reference || '-') + '</code></td></tr>';
        html += '<tr><td class="rc-text-muted">Total TTC</td><td class="rc-text-bold">' + window.REGEN.formatMoney(order.total_ttc) + '</td></tr>';
        html += '<tr><td class="rc-text-muted">Canal</td><td><span class="rc-channel-badge rc-channel-badge--' + (order.channel || 'direct') + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td></tr>';
        html += '</table>';
        html += '</div>';

        // Right: UTM data
        html += '<div>';
        html += '<h3 class="rc-text-bold rc-mb-16">Attribution UTM</h3>';
        html += '<table class="rc-table">';
        html += '<tr><td class="rc-text-muted">utm_source</td><td>' + (order.utm_source || '-') + '</td></tr>';
        html += '<tr><td class="rc-text-muted">utm_medium</td><td>' + (order.utm_medium || '-') + '</td></tr>';
        html += '<tr><td class="rc-text-muted">utm_campaign</td><td>' + (order.utm_campaign || '-') + '</td></tr>';
        html += '<tr><td class="rc-text-muted">utm_content</td><td>' + (order.utm_content || '-') + '</td></tr>';
        html += '<tr><td class="rc-text-muted">gclid</td><td class="rc-text-sm">' + (order.gclid ? order.gclid.substring(0, 20) + '...' : '-') + '</td></tr>';
        html += '<tr><td class="rc-text-muted">fbclid</td><td class="rc-text-sm">' + (order.fbclid ? order.fbclid.substring(0, 20) + '...' : '-') + '</td></tr>';
        html += '</table>';
        html += '</div>';
        html += '</div>';

        // Source URL
        if (order.source_url) {
            html += '<div style="margin-bottom: 16px;">';
            html += '<h3 class="rc-text-bold rc-mb-16">URL Source</h3>';
            html += '<div style="background: var(--rc-gray-50); padding: 12px; border-radius: 8px; word-break: break-all;">';
            html += '<code class="rc-text-sm">' + order.source_url + '</code>';
            html += '</div></div>';
        }

        // Products
        if (items.length > 0) {
            html += '<h3 class="rc-text-bold rc-mb-16">Produits</h3>';
            html += '<div class="rc-table-wrap"><table class="rc-table"><thead><tr><th>Produit</th><th class="rc-text-right">Quantite</th><th class="rc-text-right">Prix unitaire</th></tr></thead><tbody>';
            items.forEach(function (item) {
                html += '<tr>';
                html += '<td>' + (item.product_name || '-') + '</td>';
                html += '<td class="rc-text-right">' + (item.quantity || 1) + '</td>';
                html += '<td class="rc-text-right">' + (item.unit_price ? window.REGEN.formatMoney(item.unit_price) : '-') + '</td>';
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        content.innerHTML = html;
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    };

    // ── Empty State ─────────────────────────
    function showEmptyState() {
        var tbody = document.getElementById('orders-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="7"><div class="rc-empty"><div class="rc-empty__icon">&#128722;</div><div class="rc-empty__title">Aucun client selectionne</div></div></td></tr>';
    }

})();
