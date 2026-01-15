# Architecture REGEN-AGENCY

## Structure du projet

```
/
├── public/                     # Site vitrine (pages publiques)
│   ├── index.html              # Page d'accueil
│   ├── connexion.html          # Page placeholder espace client
│   ├── css/
│   │   └── style.css           # Styles globaux
│   ├── js/
│   │   └── main.js             # Scripts principaux
│   └── assets/
│       └── images/             # Images et illustrations
│
├── app/                        # [FUTUR] Espace client/admin
│   └── .gitkeep
│
├── shared/                     # [FUTUR] Ressources partagées
│   └── .gitkeep
│
└── ARCHITECTURE.md             # Ce fichier
```

## Stack actuelle

- **Frontend** : HTML5, CSS3, JavaScript Vanilla
- **Fonts** : Google Fonts (Quicksand)
- **Hébergement** : GitHub Pages

## Charte graphique

| Variable | Couleur | Usage |
|----------|---------|-------|
| `--color-primary` | #173C3A | Vert foncé - textes, boutons |
| `--color-secondary` | #2FB963 | Vert vif - accents, badges |
| `--color-accent` | #05C08A | Turquoise - gradients |
| `--color-dark` | #202020 | Textes principaux |

## Conventions

- **CSS** : Méthodologie BEM simplifiée
- **Variables** : Définies dans `:root`
- **Responsive** : Mobile-first, breakpoints à 1024px, 768px, 480px

---

## Extension future : Espace Client

### Stack recommandée

| Composant | Technologie | Raison |
|-----------|-------------|--------|
| Backend/Auth | **Supabase** | Auth, DB, API prêts à l'emploi |
| Hébergement | **Vercel** | Supporte statique + serverless |
| Frontend | **Vanilla JS** ou **React** | Continuité ou montée en compétence |

### Fonctionnalités prévues

**Côté Client :**
- [ ] Authentification (email/password)
- [ ] Dashboard résultats publicitaires
- [ ] Espace documents (contrats, rapports)
- [ ] Tableaux de suivi personnalisés

**Côté Admin :**
- [ ] Vue consolidée de tous les clients
- [ ] Synchronisation Google Ads / Meta Ads
- [ ] Analytics des sites clients

### Comment ajouter l'espace client

1. **Migrer vers Vercel**
   ```bash
   npm i -g vercel
   vercel
   ```

2. **Configurer Supabase**
   - Créer un projet sur supabase.com
   - Configurer l'authentification
   - Créer les tables (clients, documents, metrics)

3. **Développer dans `/app`**
   ```
   /app
   ├── index.html          # Dashboard client
   ├── login.html          # Page de connexion
   ├── documents.html      # Espace documents
   ├── css/
   ├── js/
   └── admin/              # Espace admin
   ```

4. **Intégration APIs Ads** (optionnel)
   - Google Ads API
   - Meta Marketing API
   - Ou import manuel CSV au début

### Migration GitHub Pages → Vercel

1. Connecter le repo GitHub à Vercel
2. Configurer le dossier racine : `public/`
3. Déploiement automatique à chaque push

---

## Commandes utiles

```bash
# Déployer sur GitHub Pages (actuel)
git add . && git commit -m "Description" && git push origin main

# Ouvrir le site en local
# Utiliser Live Server (VS Code) ou python -m http.server
```

---

## Contact

Pour toute question sur l'architecture : consulter ce fichier ou contacter l'équipe de développement.
