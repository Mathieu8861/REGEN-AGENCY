# REGEN-AGENCY (site agence) - Mémoire

## Infos
- **Client :** Regen Agency (agence — site interne)
- **URL prod :** https://regen-agency.com
- **Type :** Site vitrine + backoffice agence + espace client + backend
- **Dossier :** `Création site Web/REGEN-AGENCY/`
- **Git :** https://github.com/Mathieu8861/REGEN-AGENCY — **Branche :** main
- **Dernier commit :** `fa065dd` (10/06/2026) — "feat(seo): robots.txt + sitemap.xml + memoire projet"
- **Statut git :** ✅ Clean (à jour avec remote — seuls restent untracked : studio.* + image originale, volontaire)
- **Statut :** 🟢 Refonte en cours, up to date avec le remote
- **Prod actuelle :** ⚠️ regen-agency.com tourne encore sur **WordPress** (hébergé IONOS) — migration vers Vercel **reportée** tant que la refonte n'est pas finie (pages/éléments manquants)

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
| `012-crm-unified.sql` | CRM unifié | prospect_id sur clients + champs contrat sur prospects + vue crm_contacts |
| `013-rls-hardening.sql` | RLS sur 13 tables exposées | prospect_*, agency_*, client_services/follow_ups (warnings critical Supabase résolus) |
| `014-client-budgets.sql` | **Module Budget & Planning** | client_budgets (budget mensuel/plateforme) + client_promos + RLS (client = read-only) + import 144 lignes E&CO 2026 |
| `015-promo-fields.sql` | Champs promo enrichis | landing_urls, drive_url, visuals, remise_text, ads_spend_google/meta, revenue_total, top_products |
| `016-promo-storage.sql` | Storage visuels | bucket `promo-visuals` (public, 5 Mo, images) + policies admin-only upload/delete |
| `017-promo-videos.sql` | Vidéos promo | colonne video_urls (JSONB) |
| `018-rls-reenable.sql` | Ré-activation RLS | 6 tables core (clients, client_users, integrations, ad_*) qui avaient été DISABLED pendant le debug d'avril |
| `019-rls-fix-recursion.sql` | **Fix récursion RLS** | Cause racine du bug "données fantômes" : cycle policies clients↔client_users → cassé via user_can_access_client() SECURITY DEFINER + search_path fixé |
| `020-promo-revenue-ads.sql` | CA Ads promo | colonne revenue_ads (séparée de revenue_total) pour le calcul auto des perfs |

**Total : ~31 tables** (certaines en `CREATE TABLE IF NOT EXISTS` pour idempotence)

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
- **29/04/2026** : fix auth admin — le login admin passe par Supabase Auth (`contact.regenagency@gmail.com`, profile role=admin) avec signOut systématique avant chaque login. Fin du double login et des sessions zombies.
- **10/06/2026 (grosse session)** :
  - **Module Budget & Planning complet** (inspiré du fichier standalone de Jaemeson pour Émile & Co) : onglet dans `admin/clients.html` entre Vue mensuelle et Campagnes. Budget mensuel éditable (auto-save Supabase), vue marque seule / vue groupe E&CO, KPIs + barre de progression dépensé/total, breakdown hebdo, calendrier promos avec modal complet (remise, liens landing/vidéos multiples, wordings, lien Drive, upload visuels Storage, statuts), **calcul auto des perfs** (dépenses Google/Meta depuis ad_daily_metrics, CA Ads + CA total depuis orders, top 3 produits depuis order_items) + ROAS auto. Migrations 014→017 + 020. Client = lecture seule (RLS).
  - **Fix définitif du bug "données fantômes"** : la cause racine était une récursion circulaire des policies RLS clients↔client_users (PostgreSQL "infinite recursion detected" → 500 sur toutes les requêtes). Migrations 018 (ré-enable RLS sur les 6 tables core désactivées pendant le debug d'avril) + 019 (cassage du cycle via user_can_access_client() SECURITY DEFINER). Warning critical Supabase résolu. Testé OK admin + client + syncs.
  - Vercel ajouté dans Comptabilité (factures reçues par email).
  - `robots.txt`, `sitemap.xml` et cette mémoire versionnés.
  - **Décision : migration WordPress → Vercel REPORTÉE.** regen-agency.com tourne encore sur WordPress (IONOS) avec bugs récurrents si pas de maj hebdo. Plan de bascule validé dans son principe : (1) formulaire de contact recréé sur la refonte et branché CRM/Supabase (leads → kanban prospects), (2) parité des pages avec le WordPress, (3) canonical/og:url/sitemap → regen-agency.com, (4) vercel.json redirects 301, (5) bascule DNS chez IONOS (A 76.76.21.21 + CNAME www → cname.vercel-dns.com, zéro downtime), (6) résilier l'hébergement WP (PAS le domaine). En attente : site refonte pas fini (pages/éléments manquants).
- **11/06/2026** : Section "Nos résultats clients" (`site-marketing.html`) — ajout carte **DET** (det-site.vercel.app, badge orange #F26D2C, image `site_DET.jpg`) + **tag "Démo"** (pill glassmorphism, `.marquee-card__demo` en haut à droite du visuel) sur les 4 sites démo : MIRA, CS Agéen, IBCO, DET. Au passage : carte FLO corrigée (lien `flo-gamma.vercel.app` → **www.floapp.fr** + label "RH · Recrutement · No-code" → "SaaS · Propositions B2B · IA", ancien positionnement obsolète). Commit `eda3dc7` poussé → auto-deploy Vercel.
- **03/07/2026 (grosse session compta + perf ads)** :
  - **Refonte `admin/comptabilite.html` data-driven** : tableau `SUBSCRIPTIONS` (19 abonnements/frais fixes, prix HT, cycle) → cartes + tableau récap + KPIs. Total ~855 €/mois · ~10 263 €/an. Prix vérifiés contre les relevés bancaires réels (janv→mai). Ajouts : RYDGE 283,40 (acompte mensuel mission annuelle), Pennylane 29 (offre Basique, confirmé Thibault — PAS 14 comme dans l'avenant), Allianz 77,90, Google One, Elementor, Canva. Reste : « Abonnement non identifié » 19 €/mois (carte 2388, le 10 du mois, mystère depuis +1 an — à bloquer via l'app Swan) ; captures « parcours facture » à déposer dans `assets/images/compta/` (dossier `Image comptabilité/` mal nommé, non suivi git).
  - **Avenant RYDGE→Pennylane analysé et accepté** (RFE obligatoire sept 2026) : 180 € one-shot conformité (sept 2026) + 29 €/mois. Signalé : n° TVA erroné sur leurs factures (FR10... au lieu de FR03985275460). Levier de renégo des honoraires (283 €/mois) à jouer : Pennylane automatise la saisie.
  - **Module Relevés bancaires** (`admin/comptabilite.html`, migrations **021** table `bank_transactions` RLS admin + **022** flag `manual_override`) : import multi-CSV Swan en glisser-déposer, parsing + catégorisation auto par regex `TX_RULES` (~98% sur données réelles, totaux vérifiés au centime vs PDF), dedup chevauchements (`dedup_hash` unique), vues Par mois / Sur l'année / Période, dépenses + revenus, édition manuelle (✎) + boutons attribution rapide salaires, corrections 🔒 protégées de « Recatégoriser » (review adversariale multi-agents : bug pré-022 corrigé — détection migration au chargement + bandeau d'avertissement). Relevés 2025 + 2026 (janv-mai) importés en base.
  - **Attribution salaires par personne — source de vérité** : exports nominatifs Swan (2024→2026), désormais dans **`comptabilite/` À LA RACINE DU PROJET** (`salaire Mathieu.csv`, `salairejaemeson.csv`, `TVA.csv`, `urssaf.csv` + sous-dossiers `2024/ 2025/ 2026/` avec tous les relevés CSV+PDF). **⚠️ Dossier GITIGNORÉ (données bancaires — Vercel servirait les fichiers en public), jamais commiter.** Script re-créable : match `tx_date`+`label`+`amount` via service key `.env.local`, User-Agent `regen-agency-cli/1.0` → 84 lignes attribuées + verrouillées `manual_override=true`. URSSAF splitté par compte : `...5138` = Mathieu (777+644/mois), `...7874` = Jaemeson (681/mois). Autres décisions : « Demande NNN » = régularisation URSSAF ; commissions/apporteur = reversées Océane (sous-traitance) ; PrestaShop = achat pour client ; « FACTURE N° 00000361 » 120 € = avocat Richard (Juridique) ; série `/INV/177x` ≈ Siostra Studio (Cloé) ; « coaching » AVANT la règle prénom (sinon faux Salaire Mathieu).
  - **Pages séparées** : module relevés dans **`admin/releves.html`** (sidebar « Comptabilité ») ; `admin/comptabilite.html` (sidebar « Gestion comptable ») = dépôt documents + abonnements + récap dépenses uniquement (plus de Supabase).
  - **Page `admin/equilibre-associes.html`** (bouton header de la page Comptabilité) : combien la société doit à Mathieu. = Ajustements historiques 2023-24 (Excel de Mathieu figé en dur, -3 698,44 : fonds propres pré-création, 2 salaires manqués période structure étrangère -1500/-1800, avantages 2024) + écart salaires J−M live (banque, tout l'historique : 2024 +300, 2025 +600, 2026 +1000) − avantages Mathieu ≥2025 (mutuelle **Allianz = mutuelle perso Mathieu** ~78/mois, **Alma = PC Mathieu** 4×392,96=1571,85, Caroline Ferrand = accompagnement psy Mathieu, coaching) + avantages Jaemeson ≥2025. Coupure 2025 : les avantages ≤2024 sont dans l'Excel (zéro double compte). Solde attendu ≈ **2 667 € dû à Mathieu** (évolue en live). ✓ Confirmé par Mathieu : les -1500/-1800 = période structure étrangère (zéro recouvrement avec l'écart banque).
  - **Base bancaire complète** : 837 transactions mars 2024 → juin 2026 importées (script `import_all_statements` : parser extrait de la page, upsert `on_conflict=agency_id,dedup_hash`), audit d'intégrité base=fichiers OK au centime sur les 28 mois. Recatégorisation serveur (196 lignes, vocabulaire 2024-2025 : Monday, Slack, Envato, Malt, Lubrano, Ferrand, Haru, Stripe→Revenus…). **99,2% catégorisé — reste 7 lignes débits 2025 à identifier par Mathieu** (Luca Infantino 297,20 · Reste à payer facture 2 · Facturation Juin/Mai · Facture F241025151 · Facture N° 2025-11-12-000071 · F-2025-0088).
  - **`admin/clients.html` vue agence — Actions groupées** (admin) : import groupé multi-CSV commandes (auto-association fichier→client, alias EH=Émile Henry / NW=Nordic Ware / VITA=Vitamix, anti-doublon `import_orders_batch`) + bouton « Tout synchroniser (Google + Meta) » (boucle tous clients × 2 plateformes, log de progression). Dossier source : `CSV commandes clients/`.
  - Commits `67e8324` → `95b1501` poussés (auto-deploy Vercel).

## Prochaines étapes
- **Compta** : identifier/bloquer le mystère 19 €/mois via l'app Swan · identifier les 7 dernières lignes 2025 (voir Historique 03/07) · déposer les captures « parcours facture » dans `assets/images/compta/` · OVH à ~15 €/mois de moyenne ? · vérifier 1ère facture Pennylane (29 € vs 14 €) · à chaque nouveau relevé mensuel : le déposer dans `comptabilite/2026/` + glisser sur la page
- **Finaliser les pages manquantes / éléments incomplets du site public** (bloquant pour la migration)
- **Formulaire de contact branché CRM** (parité avec le formulaire 2 étapes du WordPress, leads → table prospects) — à faire avant la bascule
- **Migration domaine regen-agency.com WordPress → Vercel** (plan en 6 étapes ci-dessus, reporté)
- Soumettre `sitemap.xml` à Google Search Console (+ Bing)
- Réseaux sociaux : page admin placeholder en attente des specs Mathieu
- `/espace-client/*` : trancher — pages stylées par erreur (le vrai espace client = admin/clients.html via RLS), revert ou conserver
- Budget & Planning : exécuter les migrations 014→020 sur tout nouveau projet Supabase (déjà fait sur la prod)
- Tester les edge functions Supabase (sync Ads, prospect-ai)

## Notes
- Toujours vérifier `git status` avant de bosser sur ce projet
- Les docs techniques (ARCHITECTURE, CONVENTIONS) sont dupliquées : version .md dans `Création site Web/` + version .html dans `admin/docs/` (celles du site admin)
- `propositions-commerciales.md` (référencé dans CLAUDE.md racine) sera le guide global pour les propositions envoyées via ce site
