/**
 * ADMIN SHELL — Sidebar globale + auth check
 * Injecte la sidebar de navigation sur toutes les pages admin.
 * Usage : <script src="admin-shell.js"></script>
 */
(function() {
    var ADMIN_SESSION_KEY = 'regen_admin_auth';
    var isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';

    // Mode CLIENT (session Supabase Auth, sans flag admin) :
    // ne pas injecter la sidebar admin et ne pas rediriger.
    // La page (ex: clients.html) gere son propre check d'auth client.
    if (!isAdmin) {
        // On laisse le flow de la page continuer.
        // Si vraiment aucune session existe, c'est la page elle-meme qui redirigera.
        return;
    }

    // ── Détection page active ──
    var page = (window.location.pathname.split('/').pop() || 'prospects.html').toLowerCase();
    function isActive(key) {
        if (key === 'crm') return page === 'prospects.html' || page === '' || page === 'index.html';
        if (key === 'performance') return page === 'clients.html';
        if (key === 'dashboard') return page === 'dashboard.html';
        if (key === 'documents') return page === 'documents.html';
        if (key === 'comptabilite') return page === 'comptabilite.html';
        if (key === 'taches') return page === 'taches.html';
        if (key === 'profil') return page === 'profil-agence.html';
        return false;
    }

    // ── Styles ──
    var style = document.createElement('style');
    style.id = 'admin-shell-styles';
    style.textContent = [
        '/* Admin shell : sidebar fixe à gauche */',
        'body { padding-left: 240px; min-height: 100vh; }',
        '.admin-shell {',
        '  position: fixed; left: 0; top: 0; bottom: 0; width: 240px;',
        '  background: white; border-right: 1px solid #e5e7eb;',
        '  padding: 22px 14px;',
        '  display: flex; flex-direction: column; gap: 22px;',
        '  font-family: "Quicksand", sans-serif;',
        '  color: #173C3A;',
        '  z-index: 100;',
        '  overflow-y: auto;',
        '}',
        '.admin-shell a { text-decoration: none; }',
        '.admin-shell__logo {',
        '  display: flex; align-items: center; gap: 10px;',
        '  padding: 0 8px 14px 8px;',
        '  border-bottom: 1px solid #e5e7eb;',
        '}',
        '.admin-shell__mark {',
        '  width: 34px; height: 34px; border-radius: 10px;',
        '  background: #173C3A; color: #2FB963;',
        '  display: flex; align-items: center; justify-content: center;',
        '  font-weight: 800; font-size: 1.05rem;',
        '}',
        '.admin-shell__name { font-weight: 700; font-size: 0.94rem; color: #1a2332; }',
        '.admin-shell__name span { color: #2FB963; }',
        '.admin-shell__section-title {',
        '  font-size: 0.64rem; font-weight: 700; text-transform: uppercase;',
        '  letter-spacing: 0.8px; color: #6b7280; padding: 0 8px; margin-bottom: 6px;',
        '}',
        '.admin-shell__nav { display: flex; flex-direction: column; gap: 2px; }',
        '.admin-shell__link {',
        '  display: flex; align-items: center; gap: 10px;',
        '  padding: 10px 12px; border-radius: 10px;',
        '  font-size: 0.85rem; font-weight: 600;',
        '  color: #6b7280; cursor: pointer; transition: all 0.2s;',
        '  border: none; background: transparent; font-family: inherit; text-align: left;',
        '}',
        '.admin-shell__link:hover { background: #f3f4f6; color: #1a2332; }',
        '.admin-shell__link.--active { background: #e8f9ef; color: #173C3A; }',
        '.admin-shell__link.--active svg { color: #2FB963; }',
        '.admin-shell__link svg { width: 18px; height: 18px; color: #6b7280; flex-shrink: 0; }',
        '.admin-shell__logout {',
        '  margin-top: auto;',
        '  padding: 10px 12px; border-radius: 10px;',
        '  font-size: 0.82rem; font-weight: 600;',
        '  color: #ef4444; background: transparent; border: 1.5px solid #fca5a5;',
        '  cursor: pointer; transition: all 0.2s;',
        '  font-family: inherit; text-align: center;',
        '  display: flex; align-items: center; justify-content: center; gap: 7px;',
        '}',
        '.admin-shell__logout:hover { background: #ef4444; color: white; border-color: #ef4444; }',
        '.admin-shell__logout svg { width: 14px; height: 14px; }',
        '@media (max-width: 900px) {',
        '  body { padding-left: 0; }',
        '  .admin-shell { display: none; }',
        '}'
    ].join('\n');
    document.head.appendChild(style);

    // ── HTML ──
    function link(href, key, svgPath, label) {
        var activeClass = isActive(key) ? ' --active' : '';
        return '<a href="' + href + '" class="admin-shell__link' + activeClass + '">' +
            '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">' + svgPath + '</svg>' +
            label +
            '</a>';
    }

    var sidebar = document.createElement('aside');
    sidebar.className = 'admin-shell';
    sidebar.innerHTML =
        '<div class="admin-shell__logo">' +
            '<div class="admin-shell__mark">R</div>' +
            '<div class="admin-shell__name">Regen<span>.</span></div>' +
        '</div>' +

        '<nav>' +
            '<div class="admin-shell__section-title">Navigation</div>' +
            '<div class="admin-shell__nav">' +
                link('prospects.html', 'crm',
                    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
                    'CRM') +
                link('clients.html', 'performance',
                    '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
                    'Performance Ads') +
                link('documents.html', 'documents',
                    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
                    'Ressources') +
                link('comptabilite.html', 'comptabilite',
                    '<path d="M3 3h18v18H3zM3 9h18M9 21V9"/>',
                    'Comptabilité') +
                link('taches.html', 'taches',
                    '<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
                    'Tâches') +
                link('profil-agence.html', 'profil',
                    '<circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 0 20M2 12h20"/>',
                    'Profil agence') +
            '</div>' +
        '</nav>' +

        '<button class="admin-shell__logout" type="button" onclick="(function(){sessionStorage.removeItem(\'regen_admin_auth\'); window.location.href=\'../connexion.html\';})()">' +
            '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>' +
            'Déconnexion' +
        '</button>';

    // Insère la sidebar comme premier enfant du body
    if (document.body) {
        document.body.insertBefore(sidebar, document.body.firstChild);
    } else {
        document.addEventListener('DOMContentLoaded', function() {
            document.body.insertBefore(sidebar, document.body.firstChild);
        });
    }
})();
