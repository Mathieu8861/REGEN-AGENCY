/* ============================================
   REGEN AGENCY - Dashboard Logic
   ============================================ */

(function () {
    'use strict';

    var currentPeriod = 30; // days

    // ── Init ─────────────────────────────────
    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        loadDashboard();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupPeriodSelector();
        loadDashboard();

        // Avatar initials
        var avatarEl = document.getElementById('regen-user-avatar');
        if (avatarEl && window.REGEN.currentProfile.full_name) {
            var initials = window.REGEN.currentProfile.full_name
                .split(' ')
                .map(function (n) { return n[0]; })
                .join('')
                .toUpperCase()
                .substring(0, 2);
            avatarEl.textContent = initials;
        }
    }

    // ── Period Selector ──────────────────────
    function setupPeriodSelector() {
        var selector = document.getElementById('period-selector');
        if (!selector) return;

        var buttons = selector.querySelectorAll('.rc-period-btn');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentPeriod = parseInt(btn.getAttribute('data-period'));
                loadDashboard();
            });
        });
    }

    // ── Load Dashboard Data ──────────────────
    async function loadDashboard() {
        var client = window.REGEN.currentClient;
        if (!client) {
            showEmptyState();
            return;
        }

        var dateTo = new Date();
        var dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - currentPeriod);

        var dateToStr = dateTo.toISOString().split('T')[0];
        var dateFromStr = dateFrom.toISOString().split('T')[0];

        // Previous period for comparison
        var prevTo = new Date(dateFrom);
        prevTo.setDate(prevTo.getDate() - 1);
        var prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - currentPeriod);

        try {
            // Fetch current period orders
            var ordersResult = await window.REGEN.supabase
                .from('orders')
                .select('id, order_date, total_ttc, channel, reference, source_url')
                .eq('client_id', client.id)
                .gte('order_date', dateFromStr)
                .lte('order_date', dateToStr)
                .order('order_date', { ascending: false });

            // Fetch previous period orders for comparison
            var prevResult = await window.REGEN.supabase
                .from('orders')
                .select('id, total_ttc, channel')
                .eq('client_id', client.id)
                .gte('order_date', prevFrom.toISOString().split('T')[0])
                .lte('order_date', prevTo.toISOString().split('T')[0]);

            // Fetch ad spend (weekly manual entries)
            var spendResult = await window.REGEN.supabase
                .from('ad_weekly_spend')
                .select('*')
                .eq('client_id', client.id)
                .order('year', { ascending: false })
                .order('week', { ascending: false });

            // Fetch ad spend from API (ad_daily_metrics via RPC)
            var apiSpendResult = await window.REGEN.supabase.rpc('get_ad_spend_by_platform', {
                p_client_id: client.id,
                p_date_from: dateFromStr,
                p_date_to: dateToStr
            });

            var orders = ordersResult.data || [];
            var prevOrders = prevResult.data || [];
            var weeklySpend = spendResult.data || [];
            var apiSpend = apiSpendResult.data || []; // [{platform, total_spend, total_clicks, total_impressions}]

            // Merge spend: API data takes priority over manual weekly entries
            var mergedSpend = mergeSpendData(weeklySpend, apiSpend);

            updateKPIs(orders, prevOrders, mergedSpend);
            updateChannelTable(orders, mergedSpend);
            updateRecentOrders(orders);

        } catch (err) {
            console.error('REGEN Dashboard: Error loading data', err);
            window.REGEN.toast('Erreur lors du chargement des donnees', 'error');
        }
    }

    // ── Merge Spend Data ──────────────────────
    // API spend (from ad_daily_metrics) takes priority over manual weekly entries
    // Returns object keyed by platform: { google_ads: { spend: X, clicks: Y, impressions: Z }, ... }
    function mergeSpendData(weeklySpend, apiSpend) {
        var byPlatform = {};

        // First, aggregate manual weekly spend by platform
        weeklySpend.forEach(function (w) {
            var p = w.platform;
            if (!byPlatform[p]) byPlatform[p] = { spend: 0, clicks: 0, impressions: 0, source: 'manual' };
            byPlatform[p].spend += parseFloat(w.spend || 0);
        });

        // Override with API data where available (more accurate)
        if (apiSpend && apiSpend.length) {
            apiSpend.forEach(function (a) {
                var p = a.platform;
                byPlatform[p] = {
                    spend: parseFloat(a.total_spend || 0),
                    clicks: parseInt(a.total_clicks || 0),
                    impressions: parseInt(a.total_impressions || 0),
                    source: 'api'
                };
            });
        }

        return byPlatform;
    }

    // ── Update KPI Cards ─────────────────────
    function updateKPIs(orders, prevOrders, mergedSpend) {
        var totalRevenue = orders.reduce(function (sum, o) { return sum + parseFloat(o.total_ttc || 0); }, 0);
        var totalOrders = orders.length;
        var avgBasket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        var prevRevenue = prevOrders.reduce(function (sum, o) { return sum + parseFloat(o.total_ttc || 0); }, 0);
        var prevOrdersCount = prevOrders.length;

        // Calculate total spend from merged data
        var totalSpend = Object.keys(mergedSpend).reduce(function (sum, p) {
            return sum + (mergedSpend[p].spend || 0);
        }, 0);
        var roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

        // Animate KPI values
        animateKPI('kpi-revenue', totalRevenue, window.REGEN.formatMoney);
        animateKPI('kpi-spend', totalSpend, window.REGEN.formatMoney);
        animateKPI('kpi-roas', roas, window.REGEN.formatROAS);
        animateKPI('kpi-orders', totalOrders, window.REGEN.formatNumber);
        animateKPI('kpi-basket', avgBasket, window.REGEN.formatMoney);

        // Conversion placeholder
        var convEl = document.getElementById('kpi-conversion');
        if (convEl) convEl.textContent = '--%';

        // Trends
        setTrend('kpi-revenue-trend', totalRevenue, prevRevenue);
        setTrend('kpi-orders-trend', totalOrders, prevOrdersCount);
    }

    function animateKPI(elementId, value, formatter) {
        var el = document.getElementById(elementId);
        if (!el) return;
        window.REGEN.animateCounter(el, value, function (v) {
            return formatter(Math.round(v * 100) / 100);
        });
    }

    function setTrend(elementId, current, previous) {
        var el = document.getElementById(elementId);
        if (!el) return;

        if (previous === 0) {
            el.textContent = 'Pas de donnees precedentes';
            el.className = 'rc-kpi-card__trend rc-kpi-card__trend--neutral';
            return;
        }

        var change = ((current - previous) / previous) * 100;
        var arrow = change >= 0 ? '\u2191' : '\u2193';
        var sign = change >= 0 ? '+' : '';
        el.textContent = arrow + ' ' + sign + change.toFixed(1) + '% vs periode prec.';
        el.className = 'rc-kpi-card__trend rc-kpi-card__trend--' + (change >= 0 ? 'up' : 'down');
    }

    // ── Channel Breakdown Table ──────────────
    function updateChannelTable(orders, mergedSpend) {
        var tbody = document.getElementById('channel-table-body');
        if (!tbody) return;

        // Group orders by channel
        var channels = {};
        orders.forEach(function (o) {
            var ch = o.channel || 'direct';
            if (!channels[ch]) {
                channels[ch] = { orders: 0, revenue: 0 };
            }
            channels[ch].orders += 1;
            channels[ch].revenue += parseFloat(o.total_ttc || 0);
        });

        // Spend by channel comes from mergedSpend (already keyed by platform)
        var spendByChannel = {};
        Object.keys(mergedSpend).forEach(function (p) {
            spendByChannel[p] = mergedSpend[p].spend || 0;
        });

        var channelKeys = Object.keys(channels).sort(function (a, b) {
            return (channels[b].revenue || 0) - (channels[a].revenue || 0);
        });

        if (channelKeys.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6"><div class="rc-empty"><div class="rc-empty__icon">&#128202;</div><div class="rc-empty__title">Aucune donnee</div><div class="rc-empty__text">Importez des commandes via CSV ou connectez une integration.</div></div></td></tr>';
            return;
        }

        var html = '';
        var totals = { spend: 0, revenue: 0, orders: 0 };

        channelKeys.forEach(function (ch) {
            var info = window.REGEN.getChannelInfo(ch);
            var data = channels[ch];
            var spend = spendByChannel[ch] || 0;
            var roas = spend > 0 ? data.revenue / spend : 0;
            var basket = data.orders > 0 ? data.revenue / data.orders : 0;

            totals.spend += spend;
            totals.revenue += data.revenue;
            totals.orders += data.orders;

            html += '<tr>';
            html += '<td><span class="rc-channel-badge rc-channel-badge--' + ch + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatMoney(spend) + '</td>';
            html += '<td class="rc-text-right rc-text-bold">' + window.REGEN.formatMoney(data.revenue) + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatROAS(roas) + '</td>';
            html += '<td class="rc-text-right">' + data.orders + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatMoney(basket) + '</td>';
            html += '</tr>';
        });

        // Total row
        var totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        var totalBasket = totals.orders > 0 ? totals.revenue / totals.orders : 0;

        html += '<tr class="rc-table--total">';
        html += '<td><strong>Total</strong></td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totals.spend) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totals.revenue) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatROAS(totalRoas) + '</td>';
        html += '<td class="rc-text-right">' + totals.orders + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totalBasket) + '</td>';
        html += '</tr>';

        tbody.innerHTML = html;
    }

    // ── Recent Orders ────────────────────────
    function updateRecentOrders(orders) {
        var tbody = document.getElementById('recent-orders-body');
        if (!tbody) return;

        var recent = orders.slice(0, 10);

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="rc-empty"><div class="rc-empty__title">Aucune commande</div></div></td></tr>';
            return;
        }

        var html = '';
        recent.forEach(function (order) {
            var info = window.REGEN.getChannelInfo(order.channel || 'direct');
            html += '<tr>';
            html += '<td>' + window.REGEN.formatDate(order.order_date) + '</td>';
            html += '<td><code>' + (order.reference || '-') + '</code></td>';
            html += '<td class="rc-text-bold">' + window.REGEN.formatMoney(order.total_ttc) + '</td>';
            html += '<td><span class="rc-channel-badge rc-channel-badge--' + (order.channel || 'direct') + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
            html += '<td class="rc-text-muted rc-text-sm">-</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
    }

    // ── Empty State ──────────────────────────
    function showEmptyState() {
        var content = document.querySelector('.rc-content');
        if (!content) return;
        content.innerHTML = '<div class="rc-empty"><div class="rc-empty__icon">&#128202;</div><div class="rc-empty__title">Aucun client selectionne</div><div class="rc-empty__text">Selectionnez un client dans le menu lateral ou contactez votre administrateur.</div></div>';
    }

})();
