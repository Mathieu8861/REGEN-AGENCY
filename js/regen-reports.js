/* ============================================
   REGEN AGENCY - Reports Logic
   ============================================ */

(function () {
    'use strict';

    var selectedFile = null;

    // ── Init ─────────────────────────────────
    document.addEventListener('regen:ready', init);
    document.addEventListener('regen:client-changed', function () {
        loadReports();
    });

    function init() {
        if (!window.REGEN.supabase || !window.REGEN.currentProfile) return;

        setupUploadForm();
        loadReports();
    }

    // ── Upload Form ─────────────────────────
    function setupUploadForm() {
        var zone = document.getElementById('report-upload-zone');
        var input = document.getElementById('report-file-input');
        var form = document.getElementById('report-form');

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
                selectFile(e.dataTransfer.files[0]);
            }
        });

        // File selected
        input.addEventListener('change', function () {
            if (input.files.length > 0) {
                selectFile(input.files[0]);
            }
        });

        // Form submit
        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                await uploadReport();
            });
        }
    }

    function selectFile(file) {
        var allowed = ['.pdf', '.docx', '.xlsx', '.pptx'];
        var ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (allowed.indexOf(ext) === -1) {
            window.REGEN.toast('Format non supporte. Utilisez PDF, DOCX, XLSX ou PPTX.', 'error');
            return;
        }

        selectedFile = file;
        var fileNameEl = document.getElementById('report-file-name');
        if (fileNameEl) {
            fileNameEl.textContent = '📎 ' + file.name + ' (' + formatFileSize(file.size) + ')';
        }
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' o';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko';
        return (bytes / (1024 * 1024)).toFixed(1) + ' Mo';
    }

    // ── Upload Report ───────────────────────
    async function uploadReport() {
        var client = window.REGEN.currentClient;
        if (!client) {
            window.REGEN.toast('Selectionnez un client.', 'error');
            return;
        }

        var title = document.getElementById('report-title').value.trim();
        var type = document.getElementById('report-type').value;
        var periodStart = document.getElementById('report-period-start').value;
        var periodEnd = document.getElementById('report-period-end').value;

        if (!title) {
            window.REGEN.toast('Le titre est requis.', 'error');
            return;
        }

        var submitBtn = document.getElementById('report-submit-btn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Publication en cours...';

        try {
            var fileUrl = null;

            // Upload file to Supabase Storage if selected
            if (selectedFile) {
                var timestamp = Date.now();
                var ext = selectedFile.name.substring(selectedFile.name.lastIndexOf('.'));
                var filePath = client.id + '/' + timestamp + '_' + title.replace(/[^a-zA-Z0-9]/g, '_') + ext;

                var uploadResult = await window.REGEN.supabase.storage
                    .from('reports')
                    .upload(filePath, selectedFile);

                if (uploadResult.error) {
                    // If bucket doesn't exist, create it (might fail if not admin on storage)
                    console.error('Upload error:', uploadResult.error);
                    // Store file URL as null, report still gets created
                    window.REGEN.toast('Avertissement: le fichier n\'a pas pu etre uploade. Verifiez le bucket "reports" dans Supabase Storage.', 'warning');
                } else {
                    fileUrl = filePath;
                }
            }

            // Insert report metadata
            var result = await window.REGEN.supabase
                .from('reports')
                .insert({
                    client_id: client.id,
                    title: title,
                    type: type,
                    period_start: periodStart || null,
                    period_end: periodEnd || null,
                    file_url: fileUrl,
                    created_by: window.REGEN.currentUser.id
                });

            if (result.error) throw result.error;

            window.REGEN.toast('Rapport publie !', 'success');

            // Reset form
            document.getElementById('report-form').reset();
            selectedFile = null;
            var fileNameEl = document.getElementById('report-file-name');
            if (fileNameEl) fileNameEl.textContent = '';

            loadReports();

        } catch (err) {
            console.error('Upload report error:', err);
            window.REGEN.toast('Erreur : ' + (err.message || err), 'error');
        }

        submitBtn.disabled = false;
        submitBtn.textContent = 'Publier le rapport';
    }

    // ── Load Reports ────────────────────────
    async function loadReports() {
        var client = window.REGEN.currentClient;
        var tbody = document.getElementById('reports-table-body');
        if (!tbody) return;

        if (!client) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="rc-empty"><div class="rc-empty__title">Aucun client selectionne</div></div></td></tr>';
            return;
        }

        tbody.innerHTML = '<tr><td colspan="5"><div class="rc-loading"><div class="rc-spinner"></div><span>Chargement...</span></div></td></tr>';

        try {
            var result = await window.REGEN.supabase
                .from('reports')
                .select('*')
                .eq('client_id', client.id)
                .order('created_at', { ascending: false });

            var reports = result.data || [];

            if (reports.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="rc-empty">'
                    + '<div class="rc-empty__icon">&#128196;</div>'
                    + '<div class="rc-empty__title">Aucun rapport</div>'
                    + '<div class="rc-empty__text">Les rapports seront publies ici par votre agence.</div>'
                    + '</div></td></tr>';
                return;
            }

            var html = '';
            reports.forEach(function (report) {
                var typeLabels = { monthly: 'Mensuel', weekly: 'Hebdo', custom: 'Custom' };
                var typeBadgeClass = report.type === 'monthly' ? 'rc-badge--active' : report.type === 'weekly' ? 'rc-badge--pending' : '';

                var period = '-';
                if (report.period_start && report.period_end) {
                    period = window.REGEN.formatDate(report.period_start) + ' - ' + window.REGEN.formatDate(report.period_end);
                } else if (report.period_start) {
                    period = 'Depuis ' + window.REGEN.formatDate(report.period_start);
                }

                html += '<tr>';
                html += '<td>' + window.REGEN.formatRelativeDate(report.created_at) + '</td>';
                html += '<td class="rc-text-bold">' + report.title + '</td>';
                html += '<td><span class="rc-badge ' + typeBadgeClass + '">' + (typeLabels[report.type] || report.type) + '</span></td>';
                html += '<td class="rc-text-sm rc-text-muted">' + period + '</td>';
                html += '<td class="rc-text-right">';
                if (report.file_url) {
                    html += '<button class="rc-btn rc-btn--primary rc-btn--sm" onclick="window._downloadReport(\'' + report.file_url + '\', \'' + report.title.replace(/'/g, "\\'") + '\')">&#128229; Telecharger</button>';
                } else {
                    html += '<span class="rc-text-muted rc-text-sm">Pas de fichier</span>';
                }
                html += '</td>';
                html += '</tr>';
            });

            tbody.innerHTML = html;

        } catch (err) {
            console.error('Load reports error:', err);
            tbody.innerHTML = '<tr><td colspan="5"><div class="rc-empty"><div class="rc-empty__title">Erreur de chargement</div></div></td></tr>';
        }
    }

    // ── Download Report ─────────────────────
    window._downloadReport = async function (filePath, title) {
        try {
            var result = await window.REGEN.supabase.storage
                .from('reports')
                .createSignedUrl(filePath, 3600); // 1 hour

            if (result.error) throw result.error;

            var a = document.createElement('a');
            a.href = result.data.signedUrl;
            a.download = title;
            a.target = '_blank';
            a.click();

        } catch (err) {
            console.error('Download error:', err);
            window.REGEN.toast('Erreur lors du telechargement.', 'error');
        }
    };

})();
