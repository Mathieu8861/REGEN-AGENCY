# Architecture Infrastructure - Regen Agency

**Document technique pour validation**
**Date : Janvier 2025**
**Version : 1.2**

---

> **📋 Document complémentaire** : `CONVENTIONS-DEV-WEB-REGEN.md`
> Pour les conventions de développement (HTML/CSS/JS, structure fichiers, composants)

---

## 1. Vue d'ensemble

L'infrastructure repose sur trois services cloud complémentaires, chaque projet client étant indépendant des autres.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         INFRASTRUCTURE AGENCE                               │
└─────────────────────────────────────────────────────────────────────────────┘

VERCEL (Frontends)              RAILWAY (Backends)           SUPABASE (Databases)
      │                               │                            │
      ├── Site vitrine A              ├── Medusa (boutique A)      ├── DB boutique A
      ├── Site vitrine B              ├── Medusa (boutique B)      ├── DB boutique B
      ├── Site vitrine C              ├── API Regen Dashboard      ├── DB Regen Dashboard
      ├── Boutique A (frontend)       └── ...                      └── ...
      ├── Boutique B (frontend)
      ├── regen-agency.fr
      ├── dashboard.regen-agency.fr
      └── ...

Chaque projet = indépendant
Pas de hiérarchie entre eux
```

---

## 2. Services utilisés

### 2.1 Vercel (Frontends)

| Caractéristique | Détail |
|-----------------|--------|
| **Rôle** | Hébergement des frontends (sites web, interfaces utilisateur) |
| **Technologies supportées** | HTML/CSS/JS, Next.js, React |
| **Déploiement** | Automatique via GitHub (CI/CD intégré) |
| **SSL** | Certificats HTTPS automatiques |
| **CDN** | Distribution mondiale incluse |
| **Coût** | Gratuit (plan Hobby) / ~20€/mois (plan Pro) |
| **URL** | https://vercel.com |

### 2.2 Railway (Backends)

| Caractéristique | Détail |
|-----------------|--------|
| **Rôle** | Hébergement des backends (APIs, Medusa.js) |
| **Technologies supportées** | Node.js, Python, Docker, PostgreSQL |
| **Déploiement** | Automatique via GitHub ou templates 1-click |
| **Scaling** | Automatique selon la charge |
| **Coût** | ~5-20€/mois selon usage |
| **URL** | https://railway.app |

### 2.3 Supabase (Databases)

| Caractéristique | Détail |
|-----------------|--------|
| **Rôle** | Base de données PostgreSQL + Authentification |
| **Type** | PostgreSQL managé |
| **Auth** | Système d'authentification intégré |
| **API** | REST et GraphQL auto-générés |
| **Coût** | Gratuit (500MB) / ~25€/mois (8GB) |
| **URL** | https://supabase.com |

### 2.4 Medusa.js (Application E-commerce)

| Caractéristique | Détail |
|-----------------|--------|
| **Rôle** | Backend e-commerce headless |
| **Type** | Open-source (MIT License) |
| **Hébergement** | Sur Railway |
| **Fonctionnalités** | Gestion produits, commandes, paiements, factures, emails |
| **Admin** | Interface d'administration incluse |
| **Paiements** | Stripe, PayPal intégrés |
| **Coût** | Gratuit (logiciel) + coût hébergement Railway |
| **URL** | https://medusajs.com |

---

## 3. Types de projets

### 3.1 Site vitrine simple

**Cas d'usage** : Site de présentation sans base de données

```
┌──────────────────────────────────────────────────────────────────────────┐
│                      SITE VITRINE CLIENT                                 │
└──────────────────────────────────────────────────────────────────────────┘

   client-exemple.fr
   ─────────────────
   Technologies : HTML / CSS / JavaScript

   Pages :
   • Accueil
   • Services
   • À propos
   • Contact

   Hébergement : Vercel
   Base de données : Aucune
   Backend : Aucun

   Coût mensuel : GRATUIT

```

**Architecture** :

```
GitHub (code source)
      │
      │ git push (déploiement auto)
      ▼
┌─────────────┐
│   VERCEL    │ ──────► client-exemple.fr
│ (frontend)  │         (HTTPS automatique)
└─────────────┘
```

---

### 3.2 Site e-commerce custom

**Cas d'usage** : Boutique en ligne avec gestion produits, commandes, paiements

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    SITE E-COMMERCE CLIENT                                │
└──────────────────────────────────────────────────────────────────────────┘

   boutique-exemple.fr                 admin.boutique-exemple.fr
   ───────────────────                 ──────────────────────────
   Site public (frontend)              Back-office client
   Technologies : Next.js              (Medusa Admin inclus)

   • Catalogue produits                • Gérer les produits
   • Panier                            • Voir les commandes
   • Checkout + paiement Stripe        • Gérer les clients
   • Espace compte client              • Factures / bons de commande
   • Suivi commandes                   • Stats ventes

   Hébergement : Vercel                Hébergement : Railway
                                       Base de données : Supabase

   Coût mensuel : ~10-15€

```

**Architecture** :

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     VERCEL      │         │    RAILWAY      │         │    SUPABASE     │
│   (Frontend)    │◄──API──►│   (Medusa.js)   │◄───────►│  (PostgreSQL)   │
│                 │         │                 │         │                 │
│ boutique.fr     │         │ admin.boutique  │         │ Produits        │
│                 │         │ API REST        │         │ Commandes       │
│ • Catalogue     │         │ • /products     │         │ Clients         │
│ • Panier        │         │ • /orders       │         │ Factures        │
│ • Checkout      │         │ • /customers    │         │                 │
└─────────────────┘         └────────┬────────┘         └─────────────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │     STRIPE      │
                            │   (Paiements)   │
                            │                 │
                            │ 1.4% + 0.25€    │
                            │ par transaction │
                            └─────────────────┘
```

---

### 3.3 Dashboard avec APIs externes (Regen Agency)

**Cas d'usage** : Espace client pour consultation stats publicitaires en temps réel

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    PROJET : REGEN AGENCY                                 │
│                    (Dashboard clients Ads)                               │
└──────────────────────────────────────────────────────────────────────────┘

   regen-agency.fr                     dashboard.regen-agency.fr
   ───────────────                     ─────────────────────────
   Site vitrine                        Espace client Ads
   (HTML/CSS/JS)                       (Next.js)

   • Présentation agence               • Login client
   • Services                          • Stats Google Ads temps réel
   • Contact                           • Stats Meta Ads temps réel
   • Blog                              • Tableau de bord (CPC, ROAS, etc.)
                                       • Télécharger rapports PDF
                                       • Historique campagnes

   Hébergement : Vercel                Hébergement : Vercel (front)
   Coût : Gratuit                               + Railway (API)
                                                + Supabase (DB)
                                       Coût : ~10-15€/mois

```

**Architecture** :

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│     VERCEL      │         │    RAILWAY      │         │    SUPABASE     │
│   (Frontend)    │◄──API──►│   (Node.js)     │◄───────►│  (PostgreSQL)   │
│                 │         │                 │         │                 │
│ dashboard.      │         │ api.regen-      │         │ Users           │
│ regen-agency.fr │         │ agency.fr       │         │ Rapports        │
│                 │         │                 │         │ Historique      │
│ • Login         │         │ • Auth          │         │                 │
│ • Dashboard     │         │ • /stats/google │         │                 │
│ • Rapports      │         │ • /stats/meta   │         │                 │
└─────────────────┘         │ • /reports      │         └─────────────────┘
                            └────────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                                 ▼
           ┌─────────────────┐              ┌─────────────────┐
           │  GOOGLE ADS API │              │   META ADS API  │
           │                 │              │                 │
           │ • Campagnes     │              │ • Campagnes     │
           │ • CPC, CTR      │              │ • CPC, CTR      │
           │ • Conversions   │              │ • Conversions   │
           │ • ROAS          │              │ • ROAS          │
           └─────────────────┘              └─────────────────┘
```

---

## 4. Workflow de déploiement

### 4.1 Processus standard (tous projets)

```
ÉTAPE 1 : Développement local
─────────────────────────────
• IDE : VS Code
• Code source : HTML/CSS/JS ou Next.js
• Test local : localhost:3000
• Conventions : voir CONVENTIONS-DEV-WEB-REGEN.md


ÉTAPE 2 : Versionning GitHub
────────────────────────────
• Repository : GitHub (1 repo par projet)
• Nommage : client-nom-projet (ex: ay-champagne-site)
• Commande : git push origin main


ÉTAPE 3 : Déploiement automatique Vercel
────────────────────────────────────────
• GitHub connecté à Vercel et/ou Railway
• Chaque push sur main déclenche un build automatique
• Déploiement en ~30 secondes à 2 minutes
• Preview URL générée pour chaque commit


ÉTAPE 4 : Configuration domaine
───────────────────────────────
• Achat domaine : OVH, Ionos, Gandi, etc.
• Configuration DNS :
  - Type A ou CNAME vers Vercel/Railway
  - SSL automatique (Let's Encrypt)
```

### 4.2 Convention de commits

```
Format : type: description courte

Types disponibles :
• feat     → nouvelle fonctionnalité
• fix      → correction de bug
• style    → changements CSS/visuels
• refactor → restructuration du code
• docs     → documentation
• chore    → maintenance

Exemples :
• feat: ajout page contact avec formulaire
• fix: correction menu mobile Safari
• style: ajustement responsive sponsors
```

### 4.3 Commandes Git courantes

```powershell
# Initialisation nouveau projet
git init
git add .
git commit -m "feat: initial commit - structure projet"
git branch -M main
git remote add origin https://github.com/regen-agency/[client-projet].git
git push -u origin main

# Mise à jour quotidienne
git add .
git commit -m "type: description"
git push origin main
# → Vercel déploie automatiquement
```

### 4.4 Nom de domaine vs Hébergement

> **⚠️ ATTENTION : Ce sont deux services DIFFÉRENTS !**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NOM DE DOMAINE ≠ HÉBERGEMENT                              │
└─────────────────────────────────────────────────────────────────────────────┘

NOM DE DOMAINE (OVH, Ionos, Gandi...)         HÉBERGEMENT (Vercel, Railway)
─────────────────────────────────────         ────────────────────────────────
• C'est l'ADRESSE du site                     • C'est là où le site EST STOCKÉ
• Ex: mon-client.fr                           • Serveurs qui servent les pages
• Coût: ~10€/an                               • Coût: GRATUIT (Vercel)

         │                                              │
         └──────────── Configuration DNS ──────────────┘
                    (pointer le domaine vers Vercel)
```

**En résumé :**
- On achète le domaine chez OVH (~10€/an) = juste le nom
- On héberge gratuitement sur Vercel = les fichiers du site
- On configure le DNS pour relier les deux

### 4.5 Configuration DNS (chez le registrar)

```
Pour un site vitrine (Vercel uniquement) :
──────────────────────────────────────────
exemple.fr          A       76.76.19.19
www.exemple.fr      CNAME   cname.vercel-dns.com


Pour un e-commerce (Vercel + Railway) :
───────────────────────────────────────
boutique.fr         A       76.76.19.19
www.boutique.fr     CNAME   cname.vercel-dns.com
admin.boutique.fr   CNAME   [url-railway-projet].up.railway.app
```

---

## 5. Sécurité

| Aspect | Implémentation |
|--------|----------------|
| **HTTPS** | Certificats SSL automatiques (Let's Encrypt) sur Vercel et Railway |
| **Authentification** | Supabase Auth (JWT) ou Auth0 |
| **Données sensibles** | Variables d'environnement (jamais dans le code) |
| **Paiements** | Stripe (PCI DSS compliant) - aucune donnée carte stockée |
| **Backups DB** | Supabase : backups automatiques quotidiens |
| **DDoS** | Protection CDN Vercel incluse |

---

## 6. Estimation des coûts

### 6.1 Coût TOTAL par type de projet (domaine + hébergement)

| Type de projet | Domaine | Hébergement | Total ANNUEL |
|----------------|---------|-------------|--------------|
| Site vitrine | ~10€/an | Vercel = **Gratuit** | **~10€/an** |
| Site + formulaire | ~10€/an | Vercel = **Gratuit** | **~10€/an** |
| E-commerce Medusa | ~10€/an | Railway = ~10€/mois | **~130€/an** |
| Dashboard custom | ~10€/an | Railway = ~10€/mois | **~130€/an** |

> **💡 Rappel** : Le domaine (~10€/an chez OVH/Ionos) est le SEUL coût pour un site vitrine !
> L'hébergement sur Vercel est 100% gratuit.

### 6.2 Détail des services

| Service | Rôle | Coût |
|---------|------|------|
| **Domaine** (.fr/.com) | Adresse du site | ~10-12€/an |
| **Vercel** | Hébergement frontend | **Gratuit** |
| **Railway** | Hébergement backend (si besoin) | ~10€/mois |
| **Supabase** | Base de données (si besoin) | Gratuit (500MB) |
| **Stripe** | Paiements (si e-commerce) | 1.4% + 0.25€/transaction |
| **Resend** | Emails transactionnels | Gratuit (3000/mois) |

### 6.3 Projection pour 10 projets clients

```
5 sites vitrines     = 5 x 10€/an domaine + 0€ hébergement =   50€/an
3 sites e-commerce   = 3 x 10€/an domaine + 30€/mois       =  390€/an
2 dashboards         = 2 x 10€/an domaine + 20€/mois       =  260€/an
────────────────────────────────────────────────────────────────────────
TOTAL                                                      = ~700€/an
                                                           = ~58€/mois
```

---

## 7. Avantages de cette architecture

| Avantage | Détail |
|----------|--------|
| **Scalabilité** | Chaque service scale indépendamment selon la charge |
| **Isolation** | Un projet en panne n'affecte pas les autres |
| **Coût optimisé** | Paiement à l'usage, gratuit pour petits volumes |
| **Déploiement rapide** | Push Git = mise en ligne automatique |
| **Maintenance réduite** | Services managés, pas de serveur à administrer |
| **Sécurité** | SSL automatique, backups, protection DDoS |
| **Flexibilité** | Frontend 100% custom, pas de contrainte de template |

---

## 8. Liens utiles

| Service | URL |
|---------|-----|
| Vercel | https://vercel.com |
| Railway | https://railway.app |
| Railway template Medusa | https://railway.app/template/medusa |
| Supabase | https://supabase.com |
| Medusa.js documentation | https://docs.medusajs.com |
| Stripe | https://stripe.com |
| Google Ads API | https://developers.google.com/google-ads/api |
| Meta Marketing API | https://developers.facebook.com/docs/marketing-apis |

---

## 9. Questions pour validation

1. L'architecture proposée répond-elle aux besoins identifiés ?
2. Y a-t-il des contraintes de sécurité supplémentaires à considérer ?
3. Des préférences sur les régions d'hébergement (EU obligatoire ?) ?
4. Besoin d'un environnement de staging/préproduction ?
5. Politique de backup spécifique requise ?

---

## 10. Documents liés

| Document | Description | Localisation |
|----------|-------------|--------------|
| **CONVENTIONS-DEV-WEB-REGEN.md** | Conventions de développement (HTML/CSS/JS, composants, responsive) | Dossier racine "Création site Web" |
| **TEMPLATE_NOUVEAU_PROJET.pdf** | Brief client à remplir pour chaque nouveau projet | Dossier projet client |

---

**Document préparé par** : Regen Agency
**Pour validation par** : Ingénieur Systèmes & Réseaux
**Version** : 1.2 - Janvier 2025
