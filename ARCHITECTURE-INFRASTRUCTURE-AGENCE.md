# Architecture Infrastructure - Regen Agency

**Document technique pour validation**
**Date : Janvier 2025**

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


ÉTAPE 2 : Versionning
─────────────────────
• Repository : GitHub (1 repo par projet)
• Commande : git push origin main


ÉTAPE 3 : Déploiement automatique
─────────────────────────────────
• GitHub connecté à Vercel et/ou Railway
• Chaque push déclenche un build automatique
• Déploiement en ~30 secondes à 2 minutes


ÉTAPE 4 : Configuration domaine
───────────────────────────────
• Achat domaine : OVH, Ionos, Gandi, etc.
• Configuration DNS :
  - Type A ou CNAME vers Vercel/Railway
  - SSL automatique (Let's Encrypt)
```

### 4.2 Configuration DNS type

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

### 6.1 Par type de projet

| Type de projet | Vercel | Railway | Supabase | Total mensuel |
|----------------|--------|---------|----------|---------------|
| Site vitrine | Gratuit | - | - | **Gratuit** |
| Site vitrine + formulaire | Gratuit | - | Gratuit | **Gratuit** |
| E-commerce custom | Gratuit | ~10€ | Gratuit | **~10€** |
| Dashboard custom | Gratuit | ~10€ | Gratuit | **~10€** |

### 6.2 Coûts additionnels

| Service | Coût |
|---------|------|
| Domaine .fr | ~10€/an |
| Domaine .com | ~12€/an |
| Stripe (paiements) | 1.4% + 0.25€ par transaction |
| Emails transactionnels (Resend) | Gratuit jusqu'à 3000/mois |

### 6.3 Projection pour 10 projets

```
5 sites vitrines                    =    0€/mois
3 sites e-commerce                  =   30€/mois
1 dashboard Regen                   =   10€/mois
1 autre dashboard custom            =   10€/mois
──────────────────────────────────────────────────
TOTAL infrastructure                =  ~50€/mois
+ domaines (~10 x 10€/an)           =  ~100€/an
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

**Document préparé par** : Regen Agency
**Pour validation par** : Ingénieur Systèmes & Réseaux
