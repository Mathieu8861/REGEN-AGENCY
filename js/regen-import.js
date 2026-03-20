/* ============================================
   REGEN AGENCY - CSV Import & Manual Spend Entry
   ============================================ */

(function () {
    'use strict';

    var parsedOrders = [];

    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        loadSpendData();
        loadImportHistory();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupCSVUpload();
        setupSpendForm();
        populateWeekSelector();
        loadSpendData();
        loadImportHistory();
    }

    // ══════════════════════════════════════════
    // CSV IMPORT
    // ══════════════════════════════════════════

    function setupCSVUpload() {
        var zone = document.getElementById('csv-upload-zone');
        var input = document.getElementById('csv-file-input');
        var cancelBtn = document.getElementById('csv-cancel-btn');
        var importBtn = document.getElementById('csv-import-btn');

        if (!zone || !input) return;

        // Click to select
        zone.addEventListener('click', function () { input.click(); });

        // Drag & drop
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();
            zone.classList.add('rc-upload-zone--active');
        });
        zone.addEventListener('dragleave', function () {
            zone.classList.remove('rc-upload-zone--active');
        });
        zone.addEventListener('drop', function (e) {
            e.preventDefault();
            zone.classList.remove('rc-upload-zone--active');
            if (e.dataTransfer.files.length > 0) {
                handleFile(e.dataTransfer.files[0]);
            }
        });

        // File selected
        input.addEventListener('change', function () {
            if (input.files.length > 0) {
                handleFile(input.files[0]);
            }
        });

        // Cancel
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                parsedOrders = [];
                document.getElementById('csv-preview').style.display = 'none';
                document.getElementById('csv-result').style.display = 'none';
                input.value = '';
            });
        }

        // Import
        if (importBtn) {
            importBtn.addEventListener('click', importCSVData);
        }
    }

    function handleFile(file) {
        if (!file.name.endsWith('.csv')) {
            window.REGEN.toast('Seuls les fichiers CSV sont acceptes.', 'error');
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            var content = e.target.result;
            parseCSV(content);
        };
        reader.readAsText(file, 'UTF-8');
    }

    // ── Parse CSV (PrestaShop format) ────────
    // Format: "ID Commande";Reference;"Date de commande";"Total TTC";"Page d'entree";"Produit 1";...
    function parseCSV(content) {
        var lines = content.trim().split('\n');
        if (lines.length < 2) {
            window.REGEN.toast('Le fichier CSV est vide.', 'error');
            return;
        }

        // Skip header
        parsedOrders = [];
        for (var i = 1; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;

            var fields = parseCSVLine(line, ';');
            if (fields.length < 5) continue;

            var externalId = cleanField(fields[0]);
            var reference = cleanField(fields[1]);
            var dateStr = cleanField(fields[2]);
            var totalStr = cleanField(fields[3]);
            var sourceUrl = cleanField(fields[4]);

            // Parse products (columns 5+)
            var products = [];
            for (var j = 5; j < fields.length && j < 10; j++) {
                var prod = cleanField(fields[j]);
                if (prod) products.push(prod);
            }

            // Parse date (DD-MM-YYYY)
            var dateParts = dateStr.split('-');
            var orderDate = null;
            if (dateParts.length === 3) {
                orderDate = dateParts[2] + '-' + dateParts[1] + '-' + dateParts[0]; // YYYY-MM-DD
            }

            // Parse total (handle French format: "15,32 €" or "15,32")
            var total = parseFloat(totalStr.replace(/[^\d,.-]/g, '').replace(',', '.'));

            if (externalId && orderDate && !isNaN(total)) {
                // Detect channel from URL
                var channel = detectChannel(sourceUrl);

                parsedOrders.push({
                    external_id: externalId,
                    reference: reference,
                    order_date: orderDate,
                    total_ttc: total,
                    source_url: sourceUrl,
                    channel: channel,
                    items: products.map(function (p) { return { name: p }; })
                });
            }
        }

        showPreview();
    }

    // Parse a CSV line respecting quoted fields
    function parseCSVLine(line, delimiter) {
        var fields = [];
        var current = '';
        var inQuotes = false;

        for (var i = 0; i < line.length; i++) {
            var ch = line[i];
            if (ch === '"') {
                inQuotes = !inQuotes;
            } else if (ch === delimiter && !inQuotes) {
                fields.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
        fields.push(current);
        return fields;
    }

    function cleanField(value) {
        if (!value) return '';
        return value.replace(/^"|"$/g, '').trim();
    }

    // ── Detect Channel from URL ──────────────
    function detectChannel(url) {
        if (!url) return 'direct';

        url = url.toLowerCase();

        if (url.indexOf('gclid=') !== -1 || (url.indexOf('utm_source=google') !== -1 && url.indexOf('utm_medium=cpc') !== -1)) {
            return 'google_ads';
        }
        if (url.indexOf('fbclid=') !== -1 || url.indexOf('utm_source=facebook') !== -1 || url.indexOf('utm_source=meta') !== -1 || url.indexOf('utm_source=instagram') !== -1) {
            return 'meta_ads';
        }
        if (url.indexOf('ttclid=') !== -1 || url.indexOf('utm_source=tiktok') !== -1) {
            return 'tiktok_ads';
        }
        if (url.indexOf('utm_medium=email') !== -1) {
            return 'email';
        }
        if (url.indexOf('utm_') !== -1) {
            return 'referral';
        }
        return 'direct';
    }

    // ── Show Preview ─────────────────────────
    function showPreview() {
        var preview = document.getElementById('csv-preview');
        var tbody = document.getElementById('csv-preview-body');
        var countEl = document.getElementById('csv-row-count');
        var resultEl = document.getElementById('csv-result');

        if (!preview || !tbody) return;

        resultEl.style.display = 'none';
        countEl.textContent = parsedOrders.length;

        var html = '';
        parsedOrders.forEach(function (order) {
            var info = window.REGEN.getChannelInfo(order.channel);
            var productsList = order.items.map(function (i) { return i.name; }).join(', ');
            if (productsList.length > 80) productsList = productsList.substring(0, 80) + '...';

            html += '<tr>';
            html += '<td>' + order.external_id + '</td>';
            html += '<td><code>' + order.reference + '</code></td>';
            html += '<td>' + window.REGEN.formatDate(order.order_date) + '</td>';
            html += '<td class="rc-text-bold">' + window.REGEN.formatMoney(order.total_ttc) + '</td>';
            html += '<td><span class="rc-channel-badge rc-channel-badge--' + order.channel + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
            html += '<td class="rc-text-sm rc-text-muted">' + (productsList || '-') + '</td>';
            html += '</tr>';
        });

        tbody.innerHTML = html;
        preview.style.display = 'block';
    }

    // ── Import to Supabase ───────────────────
    async function importCSVData() {
        var client = window.REGEN.currentClient;
        if (!client) {
            window.REGEN.toast('Selectionnez un client avant d\'importer.', 'error');
            return;
        }

        if (parsedOrders.length === 0) {
            window.REGEN.toast('Aucune commande a importer.', 'error');
            return;
        }

        var importBtn = document.getElementById('csv-import-btn');
        importBtn.disabled = true;
        importBtn.textContent = 'Import en cours...';

        try {
            var result = await window.REGEN.supabase.rpc('import_orders_batch', {
                p_client_id: client.id,
                p_orders: parsedOrders,
                p_source: 'csv'
            });

            if (result.error) throw result.error;

            var data = result.data;
            var resultEl = document.getElementById('csv-result');
            resultEl.innerHTML = '<div class="rc-card" style="background: rgba(16,185,129,0.05); border-color: rgba(16,185,129,0.2);">'
                + '<p class="rc-text-success rc-text-bold">Import termine !</p>'
                + '<p>' + data.imported + ' commandes importees, ' + data.skipped + ' ignorees (doublons).</p>'
                + (data.errors && data.errors.length > 0
                    ? '<p class="rc-text-danger">' + data.errors.length + ' erreurs.</p>'
                    : '')
                + '</div>';
            resultEl.style.display = 'block';

            window.REGEN.toast(data.imported + ' commandes importees !', 'success');

            // Reset
            parsedOrders = [];
            document.getElementById('csv-preview').style.display = 'none';
            document.getElementById('csv-file-input').value = '';

            loadImportHistory();

        } catch (err) {
            console.error('Import error:', err);
            window.REGEN.toast('Erreur lors de l\'import : ' + (err.message || err), 'error');
        }

        importBtn.disabled = false;
        importBtn.textContent = 'Importer';
    }

    // ══════════════════════════════════════════
    // MANUAL AD SPEND
    // ══════════════════════════════════════════

    function populateWeekSelector() {
        var select = document.getElementById('spend-week');
        if (!select) return;

        var html = '';
        for (var w = 1; w <= 53; w++) {
            var current = getWeekNumber(new Date());
            var selected = w === current ? ' selected' : '';
            html += '<option value="' + w + '"' + selected + '>Semaine ' + w + '</option>';
        }
        select.innerHTML = html;
    }

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function setupSpendForm() {
        var form = document.getElementById('spend-form');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var client = window.REGEN.currentClient;
            if (!client) {
                window.REGEN.toast('Selectionnez un client.', 'error');
                return;
            }

            var platform = document.getElementById('spend-platform').value;
            var week = parseInt(document.getElementById('spend-week').value);
            var year = parseInt(document.getElementById('spend-year').value);
            var spend = parseFloat(document.getElementById('spend-amount').value);
            var revenue = parseFloat(document.getElementById('spend-revenue').value) || 0;
            var ordersCount = parseInt(document.getElementById('spend-orders').value) || 0;

            if (isNaN(spend) || spend <= 0) {
                window.REGEN.toast('Veuillez entrer un montant de depense valide.', 'error');
                return;
            }

            try {
                var result = await window.REGEN.supabase
                    .from('ad_weekly_spend')
                    .upsert({
                        client_id: client.id,
                        platform: platform,
                        year: year,
                        week: week,
                        spend: spend,
                        revenue: revenue,
                        orders_count: ordersCount
                    }, { onConflict: 'client_id,platform,year,week' });

                if (result.error) throw result.error;

                window.REGEN.toast('Depense enregistree !', 'success');
                form.reset();
                populateWeekSelector();
                loadSpendData();

            } catch (err) {
                console.error('Spend save error:', err);
                window.REGEN.toast('Erreur : ' + (err.message || err), 'error');
            }
        });
    }

    // ── Load Existing Spend Data ─────────────
    async function loadSpendData() {
        var container = document.getElementById('spend-table-container');
        var client = window.REGEN.currentClient;
        if (!container || !client) return;

        try {
            var result = await window.REGEN.supabase
                .from('ad_weekly_spend')
                .select('*')
                .eq('client_id', client.id)
                .order('year', { ascending: false })
                .order('week', { ascending: false })
                .limit(20);

            var data = result.data || [];
            if (data.length === 0) {
                container.innerHTML = '<p class="rc-text-muted rc-text-sm">Aucune depense enregistree pour ce client.</p>';
                return;
            }

            var html = '<div class="rc-table-wrap"><table class="rc-table"><thead><tr>';
            html += '<th>Plateforme</th><th>Annee</th><th>Semaine</th>';
            html += '<th class="rc-text-right">Depense</th><th class="rc-text-right">CA</th>';
            html += '<th class="rc-text-right">ROAS</th><th class="rc-text-right">Commandes</th>';
            html += '</tr></thead><tbody>';

            data.forEach(function (row) {
                var info = window.REGEN.getChannelInfo(row.platform);
                var roas = row.spend > 0 ? row.revenue / row.spend : 0;
                html += '<tr>';
                html += '<td><span class="rc-channel-badge rc-channel-badge--' + row.platform + '"><span class="rc-channel-badge__dot"></span>' + info.label + '</span></td>';
                html += '<td>' + row.year + '</td>';
                html += '<td>S' + row.week + '</td>';
                html += '<td class="rc-text-right">' + window.REGEN.formatMoney(row.spend) + '</td>';
                html += '<td class="rc-text-right">' + window.REGEN.formatMoney(row.revenue) + '</td>';
                html += '<td class="rc-text-right">' + window.REGEN.formatROAS(roas) + '</td>';
                html += '<td class="rc-text-right">' + (row.orders_count || 0) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Load spend error:', err);
        }
    }

    // ── Import History ───────────────────────
    async function loadImportHistory() {
        var container = document.getElementById('import-history');
        var client = window.REGEN.currentClient;
        if (!container || !client) return;

        try {
            var result = await window.REGEN.supabase
                .from('import_logs')
                .select('*')
                .eq('client_id', client.id)
                .order('created_at', { ascending: false })
                .limit(10);

            var data = result.data || [];
            if (data.length === 0) {
                container.innerHTML = '<p class="rc-text-muted rc-text-sm">Aucun import effectue.</p>';
                return;
            }

            var html = '<div class="rc-table-wrap"><table class="rc-table"><thead><tr>';
            html += '<th>Date</th><th>Source</th><th>Statut</th>';
            html += '<th class="rc-text-right">Importees</th><th class="rc-text-right">Ignorees</th>';
            html += '</tr></thead><tbody>';

            data.forEach(function (log) {
                var statusBadge = log.status === 'completed'
                    ? '<span class="rc-badge rc-badge--active">Termine</span>'
                    : log.status === 'failed'
                        ? '<span class="rc-badge rc-badge--error">Echoue</span>'
                        : '<span class="rc-badge rc-badge--pending">En cours</span>';

                html += '<tr>';
                html += '<td>' + window.REGEN.formatRelativeDate(log.created_at) + '</td>';
                html += '<td>' + log.source + '</td>';
                html += '<td>' + statusBadge + '</td>';
                html += '<td class="rc-text-right">' + (log.rows_imported || 0) + '</td>';
                html += '<td class="rc-text-right">' + (log.rows_skipped || 0) + '</td>';
                html += '</tr>';
            });

            html += '</tbody></table></div>';
            container.innerHTML = html;

        } catch (err) {
            console.error('Load history error:', err);
        }
    }

})();
