# REGEN-AGENCY (site agence) - Mémoire

## Infos
- **Client :** Regen Agency (agence — site interne)
- **URL prod :** https://regen-agency.com
- **Type :** Site vitrine + backoffice agence + espace client + backend
- **Dossier :** `Création site Web/REGEN-AGENCY/`
- **Git :** https://github.com/Mathieu8861/REGEN-AGENCY — **Branche :** main
- **Dernier commit :** `beea01d` (17/04/2026) — "feat: ajouter video collaboration dans section Vous & Nous (index)"
- **Statut git :** ✅ Clean (à jour avec remote)
- **Statut :** 🟢 Refonte en cours, up to date avec le remote

## Stack technique
- **Front :** HTML/CSS/JS vanilla (pas de framework), typo Quicksand
- **Backend :** Supabase (Postgres + Edge Functions)
  - **Project ID :** `jrhqqsybebdkoqrnogez`
  - **Org ID :** `mzyaxpvkleflretaacov`
  - **Région :** West EU (Ireland)
  - **Créé :** 03/03/2026
  - **Dashboard :** https://supabase.com/dashboard/project/jrhqqsybebdkoqrnogez
- **Déploiement :** Vercel — https://regen-agency.vercel.app
- **Plugin tracking :** `regentracking/` — plugin PHP Prestashop (composer.json + .php + config.xml)
- **Node deps :** http-server (dev), pdfkit (génération PDF)
- **Thème :** dark green Regen (#173C3A)

## Structure du projet

### Site public (racine)
- `index.html` — Landing
- `services.html` — Services (dropdown dans la nav)
- `ads-sea.html`, `data-tracking-pole.html`, `site-marketing.html` — Pages offre
- `qui-sommes-nous.html`, `partenaire.html`, `proposition.html`
- `blog.html`, `contact.html`, `prospect-form.html`
- `connexion.html`, `mentions-legales.html`
- `robots.txt` + `sitemap.xml` (créés 28/04/2026)
- `css/`, `js/`, `assets/`
- ⚠️ `studio.html` + `css/studio.css` + `js/studio.js` : **bac à sable abandonné 28/04/2026** (POC vitrine créative WebGL/motion). NON LIÉ depuis le site, NON RÉFÉRENCÉ dans le sitemap. À ne pas pousser sur la prod sans refonte. Voir feedback mémoire utilisateur.

### Admin agence (`admin/`)
- `index.html` (dashboard admin)
- `clients.html`, `prospects.html`, `taches.html`, `documents.html`
- `comptabilite.html`, `profil-agence.html`
- `docs/` : ARCHITECTURE-INFRASTRUCTURE-AGENCE.html, CONVENTIONS-DEV-WEB.html, hebergement-email.html

### Espace client (`espace-client/`)
- `overview.html`, `dashboard.html`
- `campaigns.html`, `orders.html`, `reports.html`, `integrations.html`
- `connexion.html`, `admin/`

### Backend Supabase

#### Edge Functions (`supabase/functions/`)
| Function | Déployée ? | Version | Statut | Rôle |
|---|---|---|---|---|
| `sync-google-ads` | ✅ | v14 | ACTIVE (09/04) | Sync API Google Ads → base |
| `sync-meta-ads` | ✅ | v9 | ACTIVE (10/04) | Sync API Meta Ads → base |
| `prospect-ai` | ✅ | v15 | ACTIVE (30/03) | IA qualification prospects |
| `create-client-user` | ✅ | v2 | ACTIVE (13/04) — slug interne : `bright-responder` | Création utilisateur client |
| `sync-prestashop` | ⚠️ **Local uniquement** | — | NON DÉPLOYÉE | Sync API Prestashop — **pas déployée** volontairement : nécessite accès hébergeur des clients pour valider l'intégration |

**Décision :** `sync-prestashop` reste en local tant qu'on n'a pas les accès hébergement client nécessaires pour valider l'intégration.

#### Secrets configurés (10)
- `ANTHROPIC_API_KEY` — pour prospect-ai
- `GOOGLE_ADS_CLIENT_ID` / `GOOGLE_ADS_CLIENT_SECRET` / `GOOGLE_ADS_DEVELOPER_TOKEN` / `GOOGLE_ADS_REFRESH_TOKEN`
- `META_ACCESS_TOKEN`
- `SUPABASE_ANON_KEY` / `SUPABASE_DB_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL`

#### Schéma SQL (`sql/`) — 11 migrations chronologiques
| Fichier | Contenu | Détails |
|---|---|---|
| `001-schema.sql` | **15 tables de base** | agencies, clients, profiles, client_users, integrations, orders, order_items, ad_accounts, ad_campaigns, ad_daily_metrics, ad_weekly_spend, daily_kpis, monthly_kpis, reports, import_logs |
| `002-rls.sql` | **34 policies RLS** | RLS activée sur les 15 tables core |
| `003-triggers.sql` | Triggers | (à détailler) |
| `004-seed.sql` | Données seed initiales | |
| `005-group-name.sql` | Ajout groupe/nom | |
| `006-spend-summary.sql` | Vue agrégée dépenses ads | |
| `007-prospects.sql` | **6 tables prospects** | prospects, prospect_links, prospect_activities, prospect_documents, prospect_forms, prospect_form_responses |
| `008-agencies.sql` | **4 tables agence** | agency_services, agency_documents, agency_members + refonte agencies |
| `009-client-context.sql` | **2 tables** + 2 policies | client_services, client_follow_ups |
| `010-prospect-context.sql` | **2 tables** + 2 policies | prospect_services, prospect_follow_ups |
| `011-next-action.sql` | Next action logic | (à détailler) |

**Total : ~29 tables** (certaines en `CREATE TABLE IF NOT EXISTS` pour idempotence)

⚠️ **Note importante :** les migrations SQL sont appliquées **directement** (pas via le système `supabase migrations` — `supabase migration list --linked` retourne vide). Si tu veux passer au système de migrations standard Supabase, il faudra faire `supabase db pull` pour récupérer l'état actuel.

### Plugin tracking Prestashop (`regentracking/`)
- `regentracking.php` + `classes/`, `config.xml`, `composer.json`, `logo.png`
- Version zippée : `regentracking.zip` à la racine

### Config MCP (`MCP META GOOGLE PRESTA/`)
- `claude_desktop_config.json`, `config.json`, `guide_installation.html`
- Setup MCP pour interagir avec APIs Meta/Google/Prestashop via Claude Desktop

## ⚠️ studio.html — POC abandonné (28/04/2026)

**Statut** : bac à sable, **NE PAS POUSSER EN PROD**.

**Fichiers concernés** :
- `studio.html` (racine)
- `css/studio.css`
- `js/studio.js`

**Contexte** : tentative de page vitrine créative façon Awwwards (Three.js orb, GSAP scroll, Lenis, custom cursor, blobs animés). Mathieu n'a pas validé le rendu — animations jugées pas assez "wow", scroll lourd, et globalement trop loin de ce qui était réaliste pour une session sans designer dédié. Le diagnostic initial (impossible de reproduire un Lusion sans 3D artist + creative director) était le bon, le projet a dérivé.

**État après cleanup (28/04 fin de session)** :
- Liens "Studio · Création web" **retirés** du dropdown Services nav + footer Services des 10 pages publiques
- Référence **retirée** du `sitemap.xml`
- Les 3 fichiers ci-dessus restent à leur emplacement comme archive locale (accessible en preview via URL directe `/studio.html` mais non lié)

**Si on veut relancer un jour** : repartir d'une vraie DA Figma faite par un designer, pas en partant tout droit en code. Et calibrer l'ambition à ce qui est faisable dev solo + IA (= site très stylé mais pas Lusion-tier).

## Historique & Décisions
- **Refonte globale en cours** — passage d'un site simple à une plateforme complète (vitrine + SaaS)
- Intégration Supabase pour gérer clients, prospects, campagnes, comptabilité
- Dev d'un plugin Prestashop propriétaire (`regentracking`) pour tracking e-commerce
- Setup MCP pour automatiser Ads Meta/Google/Prestashop depuis Claude Desktop
- **28/04/2026** : création `robots.txt` + `sitemap.xml` à la racine (bonne pratique SEO Regen). POC `studio.html` (vitrine WebGL/motion) tenté puis **abandonné le même jour** — gardé en bac à sable local, NON LIÉ depuis le site, à ne pas pousser. Voir section "studio.html — POC abandonné" plus haut.

## Prochaines étapes
- Finaliser les pages manquantes / en cours de refonte
- Tester les edge functions Supabase (sync Ads, prospect-ai)
- Déploiement prod

## Notes
- Toujours vérifier `git status` avant de bosser sur ce projet
- Les docs techniques (ARCHITECTURE, CONVENTIONS) sont dupliquées : version .md dans `Création site Web/` + version .html dans `admin/docs/` (celles du site admin)
- `propositions-commerciales.md` (référencé dans CLAUDE.md racine) sera le guide global pour les propositions envoyées via ce site
