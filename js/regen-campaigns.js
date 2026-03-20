/* ============================================
   REGEN AGENCY - Campaigns Logic
   ============================================ */

(function () {
    'use strict';

    var currentPeriod = 30;
    var currentPlatformFilter = 'all';
    var campaignsData = [];

    // ── Init ─────────────────────────────────
    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        loadCampaigns();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupPeriodSelector();
        setupPlatformFilter();
        setupDetailPanel();
        loadCampaigns();
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
                loadCampaigns();
            });
        });
    }

    // ── Platform Filter ─────────────────────
    function setupPlatformFilter() {
        var container = document.getElementById('platform-filter');
        if (!container) return;

        var buttons = container.querySelectorAll('.rc-filter-btn');
        buttons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                buttons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                currentPlatformFilter = btn.getAttribute('data-platform');
                renderCampaigns();
            });
        });
    }

    // ── Detail Panel ────────────────────────
    function setupDetailPanel() {
        var closeBtn = document.getElementById('campaign-detail-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () {
                document.getElementById('campaign-detail').style.display = 'none';
            });
        }
    }

    // ── Load Campaigns Data ─────────────────
    async function loadCampaigns() {
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

        try {
            // Fetch campaign stats from ad_campaigns + ad_daily_metrics
            var campaignResult = await window.REGEN.supabase.rpc('get_campaign_stats', {
                p_client_id: client.id,
                p_date_from: dateFromStr,
                p_date_to: dateToStr
            });

            // Fetch orders with utm_campaign OR gad_campaignid to calculate attributed revenue
            var ordersResult = await window.REGEN.supabase
                .from('orders')
                .select('id, total_ttc, utm_campaign, gad_campaignid, channel, order_date, reference')
                .eq('client_id', client.id)
                .gte('order_date', dateFromStr)
                .lte('order_date', dateToStr)
                .or('utm_campaign.not.is.null,gad_campaignid.not.is.null');

            // Fetch weekly spend data as fallback
            var spendResult = await window.REGEN.supabase
                .from('ad_weekly_spend')
                .select('*')
                .eq('client_id', client.id);

            var campaigns = campaignResult.data || [];
            var orders = ordersResult.data || [];
            var weeklySpend = spendResult.data || [];

            // Build campaign data with attributed revenue
            campaignsData = buildCampaignData(campaigns, orders, weeklySpend);
            updateKPIs(campaignsData);
            renderCampaigns();

        } catch (err) {
            console.error('REGEN Campaigns: Error loading data', err);
            window.REGEN.toast('Erreur lors du chargement des campagnes', 'error');
        }
    }

    // ── Build Campaign Data ─────────────────
    function buildCampaignData(campaigns, orders, weeklySpend) {
        // Group orders by utm_campaign name (lowercase)
        var ordersByName = {};
        // Group orders by gad_campaignid (Google Ads campaign ID)
        var ordersByCampaignId = {};

        orders.forEach(function (order) {
            // Index by utm_campaign name
            var nameKey = (order.utm_campaign || '').toLowerCase();
            if (nameKey) {
                if (!ordersByName[nameKey]) {
                    ordersByName[nameKey] = { revenue: 0, count: 0, orders: [] };
                }
                ordersByName[nameKey].revenue += parseFloat(order.total_ttc || 0);
                ordersByName[nameKey].count += 1;
                ordersByName[nameKey].orders.push(order);
            }

            // Index by gad_campaignid (numeric Google Ads campaign ID)
            var gadId = order.gad_campaignid;
            if (gadId) {
                if (!ordersByCampaignId[gadId]) {
                    ordersByCampaignId[gadId] = { revenue: 0, count: 0, orders: [] };
                }
                // Only add revenue if not already counted via utm_campaign
                if (!nameKey) {
                    ordersByCampaignId[gadId].revenue += parseFloat(order.total_ttc || 0);
                    ordersByCampaignId[gadId].count += 1;
                }
                ordersByCampaignId[gadId].orders.push(order);
            }
        });

        // If we have ad_campaigns data from the API
        if (campaigns && campaigns.length > 0) {
            return campaigns.map(function (c) {
                // Match by name first, then by external_id (gad_campaignid)
                var nameKey = (c.name || '').toLowerCase();
                var byName = ordersByName[nameKey] || { revenue: 0, count: 0, orders: [] };
                var byId = ordersByCampaignId[c.external_id] || { revenue: 0, count: 0, orders: [] };

                // Merge: prefer byName if it has data, otherwise use byId
                var attributed;
                if (byName.count > 0) {
                    attributed = byName;
                } else if (byId.count > 0) {
                    attributed = byId;
                } else {
                    attributed = { revenue: 0, count: 0, orders: [] };
                }
                return {
                    id: c.id,
                    name: c.name,
                    platform: c.platform,
                    status: c.status,
                    spend: parseFloat(c.total_spend || 0),
                    impressions: parseInt(c.total_impressions || 0),
                    clicks: parseInt(c.total_clicks || 0),
                    conversions: parseInt(c.total_conversions || 0),
                    cpc: parseFloat(c.avg_cpc || 0),
                    ctr: parseFloat(c.avg_ctr || 0),
                    attributed_revenue: attributed.revenue,
                    attributed_orders: attributed.count,
                    roas: parseFloat(c.total_spend || 0) > 0 ? attributed.revenue / parseFloat(c.total_spend) : 0,
                    orders_list: attributed.orders
                };
            });
        }

        // Fallback: build pseudo-campaigns from UTM data + gad_campaignid + weekly spend
        var campaignNames = Object.keys(ordersByName);
        var campaignIds = Object.keys(ordersByCampaignId);
        if (campaignNames.length === 0 && campaignIds.length === 0 && weeklySpend.length === 0) return [];

        // Create entries from UTM campaign names
        var result = [];
        var processedIds = {};
        campaignNames.forEach(function (key) {
            if (!key) return;
            var data = ordersByName[key];
            // Detect platform from first order's channel
            var platform = 'other';
            if (data.orders.length > 0) {
                var ch = data.orders[0].channel || 'direct';
                if (ch === 'google_ads' || ch === 'meta_ads' || ch === 'tiktok_ads') {
                    platform = ch;
                }
            }
            // Track which gad_campaignids are covered by name-based entries
            data.orders.forEach(function (o) {
                if (o.gad_campaignid) processedIds[o.gad_campaignid] = true;
            });
            result.push({
                id: key,
                name: key,
                platform: platform,
                status: 'active',
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: data.count,
                cpc: 0,
                ctr: 0,
                attributed_revenue: data.revenue,
                attributed_orders: data.count,
                roas: 0,
                orders_list: data.orders
            });
        });

        // Add entries for gad_campaignid not already covered by utm_campaign names
        campaignIds.forEach(function (gadId) {
            if (processedIds[gadId]) return;
            var data = ordersByCampaignId[gadId];
            result.push({
                id: gadId,
                name: 'Campaign #' + gadId,
                platform: 'google_ads',
                status: 'active',
                spend: 0,
                impressions: 0,
                clicks: 0,
                conversions: data.count,
                cpc: 0,
                ctr: 0,
                attributed_revenue: data.revenue,
                attributed_orders: data.count,
                roas: 0,
                orders_list: data.orders
            });
        });

        return result;
    }

    // ── Update KPI Cards ────────────────────
    function updateKPIs(data) {
        var totalSpend = data.reduce(function (s, c) { return s + c.spend; }, 0);
        var totalRevenue = data.reduce(function (s, c) { return s + c.attributed_revenue; }, 0);
        var totalClicks = data.reduce(function (s, c) { return s + c.clicks; }, 0);
        var globalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        var avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

        animateKPI('camp-kpi-spend', totalSpend, window.REGEN.formatMoney);
        animateKPI('camp-kpi-revenue', totalRevenue, window.REGEN.formatMoney);
        animateKPI('camp-kpi-roas', globalRoas, window.REGEN.formatROAS);
        animateKPI('camp-kpi-cpc', avgCpc, window.REGEN.formatMoney);
    }

    function animateKPI(id, value, formatter) {
        var el = document.getElementById(id);
        if (!el) return;
        window.REGEN.animateCounter(el, value, function (v) {
            return formatter(Math.round(v * 100) / 100);
        });
    }

    // ── Render Campaigns Table ──────────────
    function renderCampaigns() {
        var tbody = document.getElementById('campaigns-table-body');
        if (!tbody) return;

        var filtered = campaignsData;
        if (currentPlatformFilter !== 'all') {
            filtered = campaignsData.filter(function (c) {
                return c.platform === currentPlatformFilter;
            });
        }

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9"><div class="rc-empty">'
                + '<div class="rc-empty__icon">&#9733;</div>'
                + '<div class="rc-empty__title">Aucune campagne</div>'
                + '<div class="rc-empty__text">Importez des donnees de campagnes via les integrations ou l\'import CSV.</div>'
                + '</div></td></tr>';
            return;
        }

        // Sort by spend descending
        filtered.sort(function (a, b) { return b.spend - a.spend || b.attributed_revenue - a.attributed_revenue; });

        var html = '';
        var totals = { spend: 0, revenue: 0, impressions: 0, clicks: 0 };

        filtered.forEach(function (c) {
            var info = window.REGEN.getChannelInfo(c.platform);
            var roas = c.spend > 0 ? c.attributed_revenue / c.spend : 0;
            var cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
            var ctr = c.impressions > 0 ? (c.clicks / c.impressions * 100) : 0;

            totals.spend += c.spend;
            totals.revenue += c.attributed_revenue;
            totals.impressions += c.impressions;
            totals.clicks += c.clicks;

            html += '<tr class="rc-table__row--clickable" data-campaign-id="' + c.id + '">';
            html += '<td class="rc-text-bold">' + (c.name || '-') + '</td>';
            html += '<td><span class="rc-channel-badge rc-channel-badge--' + c.platform + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatMoney(c.spend) + '</td>';
            html += '<td class="rc-text-right rc-text-bold">' + window.REGEN.formatMoney(c.attributed_revenue) + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatROAS(roas) + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatNumber(c.impressions) + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatNumber(c.clicks) + '</td>';
            html += '<td class="rc-text-right">' + window.REGEN.formatMoney(cpc) + '</td>';
            html += '<td class="rc-text-right">' + ctr.toFixed(2) + '%</td>';
            html += '</tr>';
        });

        // Total row
        var totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        var totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
        var totalCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0;

        html += '<tr class="rc-table--total">';
        html += '<td><strong>Total</strong></td>';
        html += '<td></td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totals.spend) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totals.revenue) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatROAS(totalRoas) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatNumber(totals.impressions) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatNumber(totals.clicks) + '</td>';
        html += '<td class="rc-text-right">' + window.REGEN.formatMoney(totalCpc) + '</td>';
        html += '<td class="rc-text-right">' + totalCtr.toFixed(2) + '%</td>';
        html += '</tr>';

        tbody.innerHTML = html;

        // Attach click handlers for detail view
        tbody.querySelectorAll('.rc-table__row--clickable').forEach(function (row) {
            row.addEventListener('click', function () {
                var id = row.getAttribute('data-campaign-id');
                showCampaignDetail(id);
            });
        });
    }

    // ── Show Campaign Detail ────────────────
    function showCampaignDetail(campaignId) {
        var campaign = campaignsData.find(function (c) { return String(c.id) === String(campaignId); });
        if (!campaign) return;

        var panel = document.getElementById('campaign-detail');
        var title = document.getElementById('campaign-detail-title');
        var kpis = document.getElementById('campaign-detail-kpis');
        var ordersTbody = document.getElementById('campaign-detail-orders');

        title.textContent = campaign.name;

        // KPIs
        var roas = campaign.spend > 0 ? campaign.attributed_revenue / campaign.spend : 0;
        kpis.innerHTML = ''
            + '<div class="rc-kpi-card"><div class="rc-kpi-card__header"><span class="rc-kpi-card__label">Depense</span></div><div class="rc-kpi-card__value">' + window.REGEN.formatMoney(campaign.spend) + '</div></div>'
            + '<div class="rc-kpi-card"><div class="rc-kpi-card__header"><span class="rc-kpi-card__label">CA Attribue</span></div><div class="rc-kpi-card__value">' + window.REGEN.formatMoney(campaign.attributed_revenue) + '</div></div>'
            + '<div class="rc-kpi-card"><div class="rc-kpi-card__header"><span class="rc-kpi-card__label">ROAS</span></div><div class="rc-kpi-card__value">' + window.REGEN.formatROAS(roas) + '</div></div>'
            + '<div class="rc-kpi-card"><div class="rc-kpi-card__header"><span class="rc-kpi-card__label">Commandes</span></div><div class="rc-kpi-card__value">' + campaign.attributed_orders + '</div></div>';

        // Attributed orders
        if (campaign.orders_list && campaign.orders_list.length > 0) {
            var html = '';
            campaign.orders_list.forEach(function (order) {
                html += '<tr>';
                html += '<td>' + window.REGEN.formatDate(order.order_date) + '</td>';
                html += '<td><code>' + (order.reference || '-') + '</code></td>';
                html += '<td class="rc-text-right rc-text-bold">' + window.REGEN.formatMoney(order.total_ttc) + '</td>';
                html += '<td class="rc-text-muted rc-text-sm">-</td>';
                html += '</tr>';
            });
            ordersTbody.innerHTML = html;
        } else {
            ordersTbody.innerHTML = '<tr><td colspan="4"><div class="rc-empty"><div class="rc-empty__title">Aucune commande attribuee</div></div></td></tr>';
        }

        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    }

    // ── Empty State ─────────────────────────
    function showEmptyState() {
        var tbody = document.getElementById('campaigns-table-body');
        if (!tbody) return;
        tbody.innerHTML = '<tr><td colspan="9"><div class="rc-empty"><div class="rc-empty__icon">&#9733;</div><div class="rc-empty__title">Aucun client selectionne</div><div class="rc-empty__text">Selectionnez un client dans le menu lateral.</div></div></td></tr>';
    }

})();
