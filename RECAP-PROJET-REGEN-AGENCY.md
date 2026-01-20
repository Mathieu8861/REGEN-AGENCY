# RECAP PROJET - REGEN AGENCY

## 1. INFORMATIONS PROJET

### Accès GitHub
- **Repository** : https://github.com/Mathieu8861/REGEN-AGENCY
- **Branche principale** : `main`
- **Dossier de travail** : `C:\Users\Mathieu\Desktop\Regen Agency\Création site Web\REGEN-AGENCY`

### Stack technique
- HTML5
- CSS custom (pas de framework)
- JavaScript Vanilla
- Font : **Quicksand** (Google Fonts)

### Palette de couleurs
```css
--color-primary: #173C3A;      /* Vert foncé */
--color-secondary: #2FB963;    /* Vert vif */
--color-accent: #05C08A;       /* Turquoise */
--color-dark: #202020;         /* Textes foncés */
--color-light: #f8faf9;        /* Fond clair */
```

### Dégradé du logo
```css
--gradient-logo: linear-gradient(135deg, #2FB963 0%, #05C08A 50%, #173C3A 100%);
```

---

## 2. STRUCTURE DES FICHIERS

```
REGEN-AGENCY/
├── index.html              # Page d'accueil
├── services.html           # Page services
├── contact.html            # Page contact
├── blog.html               # Page blog
├── qui-sommes-nous.html    # Page à propos
├── google-ads.html         # Service Google Ads
├── meta-ads.html           # Service Meta Ads
├── data-tracking.html      # Service Data Tracking
├── optimisation-ecommerce.html  # Service E-commerce
├── consent-mode-v2.html    # Service Consent Mode
├── formation-sea.html      # Service Formation
├── mentions-legales.html   # Mentions légales
├── connexion.html          # Page connexion (Coming Soon)
├── css/
│   ├── style.css           # CSS principal
│   ├── animations.css      # Animations
│   ├── pages.css           # Styles pages internes
│   ├── services.css        # Styles pages services
│   └── about.css           # Styles page à propos
├── js/
│   └── main.js             # JavaScript principal
└── assets/
    └── images/
        ├── logo-icon.png       # Logo icône (loader, footer)
        ├── logo-full.png       # Logo complet (header)
        ├── hero-illustration.png
        ├── image_service_ads.jpg
        ├── video_header.mp4
        └── video_header_arbre.mp4
```

---

## 3. STRUCTURE HOMEPAGE (index.html)

Ordre des sections de haut en bas :

1. **Page Loader** - Animation de chargement avec logo
2. **Header** - Navigation avec logo, liens, boutons Espace Client / Contact
3. **Hero** - Titre principal, vidéo arbre, stats animées
4. **Services Ads** - "Comment la publicité en ligne peut aider..."
5. **Nos Réalisations** - Portfolio campagnes (fond vert foncé)
6. **Notre Valeur Ajoutée** - "Nos petits plus" (3 cartes)
7. **Nos Domaines d'Expertises** - 6 cartes services (fond vert foncé)
8. **Collaboration** - "Pour une collaboration idéale" (3 étapes)
9. **Témoignages** - Carrousel 7 avis clients (fond vert foncé)
10. **CTA Final** - Bouton contact
11. **Blog** - Derniers articles
12. **Footer** - Liens, contact, réseaux sociaux

---

## 4. FONCTIONNALITES JAVASCRIPT

### Actives
- **Page Loader** : Animation de chargement avec logo
- **Carrousel Témoignages** : Défilement auto (5s), navigation manuelle, swipe mobile, dots
- **Compteurs animés** : Chiffres qui défilent avec dégradé vert, puis blanc
- **Scroll Reveal** : Animation d'apparition au scroll
- **FAQ Accordion** : Ouverture/fermeture des questions
- **Menu Mobile** : Toggle burger menu
- **Smooth Scroll** : Navigation fluide vers les ancres
- **Magnetic Buttons** : Effet magnétique sur boutons (desktop)
- **Ripple Effect** : Effet vague au clic sur boutons
- **Scroll Progress Bar** : Barre de progression en haut de page

### Désactivées (causaient des artefacts visuels)
- **initHealingGlow()** : Effet de glow sur les cartes au hover
- **initTiltEffect()** : Effet 3D tilt sur les cartes

---

## 5. TEMOIGNAGES CLIENTS

7 témoignages dans le carrousel :

1. **Emma** - Directrice chez Abra'cadabrod
2. **Mathis** - CEO chez THE BRAND LAB
3. **Philippe** - Dirigeant chez SCATAIR
4. **Chloé** - Responsable Marketing chez Emile & Co
5. **Guillaume** - Coach Sportif chez SupperSept
6. **Simon** - Associé chez OCCMP
7. **Ilyas Elhams** - Architecte & Enseignant à l'ENSA de Paris-Est

---

## 6. PAGES HTML - STATUT

| Page | Fichier | Statut |
|------|---------|--------|
| Accueil | index.html | ✅ Complète |
| Services | services.html | ✅ Complète |
| Contact | contact.html | ✅ Complète |
| Blog | blog.html | ✅ Complète |
| Qui sommes-nous | qui-sommes-nous.html | ✅ Complète |
| Google Ads | google-ads.html | ✅ Complète |
| Meta Ads | meta-ads.html | ✅ Complète |
| Data Tracking | data-tracking.html | ✅ Complète |
| Optimisation E-commerce | optimisation-ecommerce.html | ✅ Complète |
| Consent Mode V2 | consent-mode-v2.html | ✅ Complète |
| Formation SEA | formation-sea.html | ✅ Complète |
| Mentions légales | mentions-legales.html | ✅ Complète |
| Connexion | connexion.html | 🚧 Coming Soon |

---

## 7. ASSETS A CREER

Images manquantes (placeholders actuellement) :
- `favicon.png` - Favicon du site
- `blog-placeholder.jpg` - Image par défaut articles blog
- `realisation-placeholder.jpg` - Images section réalisations
- Logos entreprises pour avatars témoignages

---

## 8. WORKFLOW DE TRAVAIL

### Méthode simple

1. **Ouvrir le projet** dans l'explorateur :
   ```
   C:\Users\Mathieu\Desktop\Regen Agency\Création site Web\REGEN-AGENCY
   ```

2. **Visualiser le site** dans le navigateur :
   ```
   file:///C:/Users/Mathieu/Desktop/Regen%20Agency/Création%20site%20Web/REGEN-AGENCY/index.html
   ```

3. **Rafraîchir** avec `Ctrl+Shift+R` pour vider le cache

4. **Sauvegarder sur GitHub** :
   ```powershell
   cd "C:\Users\Mathieu\Desktop\Regen Agency\Création site Web\REGEN-AGENCY"
   git add -A
   git commit -m "Description des changements"
   git push origin main
   ```

---

## 9. NOTES TECHNIQUES

### Compteurs avec dégradé pendant animation
```css
.stat__number.counting {
    background: var(--gradient-logo);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}

.stat__number.counted {
    -webkit-text-fill-color: var(--color-white);
}
```

### Boutons sans artefacts
```css
.btn--secondary {
    border: none;
    box-shadow: inset 0 0 0 2px var(--color-secondary);
}
```

### Avatars toujours ronds
```css
.testimonial-card__avatar {
    width: 48px;
    height: 48px;
    min-width: 48px;
    min-height: 48px;
    flex-shrink: 0;
    border-radius: 50%;
    overflow: hidden;
}
```

---

## 10. PROCHAINES ETAPES SUGGÉRÉES

- [ ] Créer les images pour la section "Nos réalisations"
- [ ] Ajouter les logos entreprises dans les avatars témoignages
- [ ] Créer le favicon
- [ ] Vérifier le responsive sur mobile
- [ ] Déployer en ligne (GitHub Pages, Netlify, ou Vercel)
