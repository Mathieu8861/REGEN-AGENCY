(function() {
    'use strict';

    // === CONSTANTES ===
    const SCROLL_THRESHOLD = 100;
    const MOBILE_BREAKPOINT = 768;

    // === SÉLECTEURS ===
    const header = document.getElementById('header');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    // === FONCTIONS UTILITAIRES ===
    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    // === PAGE LOADER ===
    function initLoader() {
        const loader = document.querySelector('.page-loader');
        if (!loader) return;

        window.addEventListener('load', () => {
            setTimeout(() => {
                loader.classList.add('loaded');
                document.body.classList.remove('loading');

                // Trigger hero animations after loader
                setTimeout(() => {
                    document.querySelectorAll('.hero__text > *, .hero-page > .container > *, .hero-service > .container > *').forEach((el, i) => {
                        el.style.animationDelay = `${i * 0.1}s`;
                        el.classList.add('animate-in');
                    });
                }, 100);
            }, 500);
        });
    }

    // === REGEN PARTICLES (Energy regeneration effect) ===
    function initRegenParticles() {
        // Look for the illustration specifically in the hero section
        const hero = document.querySelector('.hero');
        const illustration = hero ? hero.querySelector('.hero__illustration') : null;
        const heroFallback = document.querySelector('.hero-service, .hero-page');

        if (!illustration && !hero && !heroFallback) return;

        // Create particles container attached to illustration or hero
        const particlesContainer = document.createElement('div');
        particlesContainer.className = 'regen-particles';

        if (illustration) {
            // Particles come from the plant pot in the hero
            particlesContainer.classList.add('regen-particles--plant');
            illustration.appendChild(particlesContainer);
        } else if (hero) {
            hero.appendChild(particlesContainer);
        } else if (heroFallback) {
            heroFallback.appendChild(particlesContainer);
        }

        // Create floating particles that rise like healing energy
        function createParticle() {
            const particle = document.createElement('div');
            particle.className = 'regen-particle';

            // Position concentrated around the pot (narrower spread - 40% width around center)
            const centerOffset = (Math.random() - 0.5) * 40; // -20% to +20% from center
            particle.style.left = (50 + centerOffset) + '%';
            particle.style.animationDuration = (3 + Math.random() * 2) + 's';
            particle.style.animationDelay = Math.random() * 0.3 + 's';

            // Random size - smaller particles
            const size = 3 + Math.random() * 6;
            particle.style.width = size + 'px';
            particle.style.height = size + 'px';

            particlesContainer.appendChild(particle);

            // Remove after animation
            setTimeout(() => particle.remove(), 5500);
        }

        // Create initial particles
        for (let i = 0; i < 12; i++) {
            setTimeout(createParticle, i * 150);
        }

        // Continuously create particles
        setInterval(createParticle, 300);
    }

    // === HEALING GLOW ON CARDS ===
    // Désactivé car cause des artefacts visuels sur les bordures
    function initHealingGlow() {
        // Effet désactivé
        return;
    }

    // === REGEN PULSE ON CTA BUTTONS ===
    function initRegenPulse() {
        const ctaButtons = document.querySelectorAll('.btn--primary');

        ctaButtons.forEach(btn => {
            // Add pulse ring
            const pulseRing = document.createElement('span');
            pulseRing.className = 'regen-pulse';
            btn.appendChild(pulseRing);
        });
    }

    // === ENERGY BAR EFFECT ON STATS ===
    function initEnergyBars() {
        const stats = document.querySelectorAll('.stat, .stat-card');

        stats.forEach(stat => {
            const energyBar = document.createElement('div');
            energyBar.className = 'energy-bar';
            stat.appendChild(energyBar);
        });
    }

    // === MENU MOBILE ===
    function toggleMenu() {
        navToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    }

    function closeMenu() {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
        document.body.classList.remove('menu-open');
    }

    // === HEADER SCROLL EFFECT ===
    function handleScroll() {
        if (!header) return;

        if (window.scrollY > SCROLL_THRESHOLD) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }

    // === SMOOTH SCROLL ===
    function handleSmoothScroll(e) {
        const href = e.currentTarget.getAttribute('href');

        if (href && href.startsWith('#')) {
            const target = document.querySelector(href);

            if (target) {
                e.preventDefault();
                closeMenu();

                const headerHeight = header ? header.offsetHeight : 0;
                const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    }

    // === SCROLL REVEAL ANIMATIONS ===
    function initScrollReveal() {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');

                    // Stagger children if it's a grid
                    const children = entry.target.querySelectorAll('.reveal-child');
                    children.forEach((child, index) => {
                        child.style.transitionDelay = `${index * 0.1}s`;
                        child.classList.add('revealed');
                    });

                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Elements to reveal
        const revealElements = document.querySelectorAll(`
            .value-card,
            .expertise-card,
            .testimonial-card,
            .collab-item,
            .service-card,
            .feature-card,
            .advantage-card,
            .stat-card,
            .team-card,
            .value-card-about,
            .benefit-card,
            .process-step,
            .module-card,
            .faq-item,
            .section__header,
            .services__content,
            .collab__content,
            .mission,
            .cta-box,
            .two-columns,
            .contact-form,
            .contact-info
        `);

        revealElements.forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
    }

    // === COUNTER ANIMATION ===
    function initCounters() {
        const counters = document.querySelectorAll('.stat__number, .stat-card__number');

        const observerOptions = {
            threshold: 0.5
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        counters.forEach(counter => observer.observe(counter));
    }

    function animateCounter(element) {
        const text = element.textContent;
        const match = text.match(/([+-]?)(\d+)([KkMm%x]?)/);

        if (!match) return;

        const prefix = match[1] || '';
        const target = parseInt(match[2], 10);
        const suffix = match[3] || '';

        let current = 0;
        const duration = 2000;
        const steps = 60;
        const increment = target / steps;
        const stepTime = duration / steps;

        element.classList.add('counting');

        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
                element.classList.remove('counting');
                element.classList.add('counted');
            }

            // Format number
            let displayValue = Math.floor(current);
            if (suffix.toLowerCase() === 'k' && target >= 100) {
                displayValue = Math.floor(current);
            }

            element.innerHTML = `${prefix}${displayValue}<span class="stat__unit">${suffix}</span>`;
        }, stepTime);
    }

    // === PARALLAX EFFECT ===
    function initParallax() {
        const parallaxElements = document.querySelectorAll('[data-parallax]');
        if (!parallaxElements.length) return;

        let ticking = false;

        function updateParallax() {
            const scrollY = window.scrollY;

            parallaxElements.forEach(el => {
                const speed = parseFloat(el.dataset.parallax) || 0.5;
                const rect = el.getBoundingClientRect();
                const elementTop = rect.top + scrollY;
                const elementCenter = elementTop + rect.height / 2;
                const viewportCenter = scrollY + window.innerHeight / 2;
                const distance = viewportCenter - elementCenter;

                el.style.transform = `translateY(${distance * speed * 0.1}px)`;
            });

            ticking = false;
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateParallax);
                ticking = true;
            }
        }, { passive: true });
    }

    // === MAGNETIC BUTTONS ===
    function initMagneticButtons() {
        if (isMobile()) return;

        const buttons = document.querySelectorAll('.btn--primary, .btn--white');

        buttons.forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;

                btn.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.transform = '';
            });
        });
    }

    // === FAQ ACCORDION ===
    function initFaqAccordion() {
        const faqItems = document.querySelectorAll('.faq-item');

        faqItems.forEach(item => {
            item.addEventListener('toggle', (e) => {
                if (item.open) {
                    // Close others
                    faqItems.forEach(other => {
                        if (other !== item && other.open) {
                            other.open = false;
                        }
                    });
                }
            });
        });
    }

    // === TESTIMONIALS CAROUSEL ===
    function initTestimonialsCarousel() {
        const carousel = document.querySelector('.testimonials-carousel');
        if (!carousel) return;

        const track = carousel.querySelector('.testimonials-carousel__track');
        const cards = track.querySelectorAll('.testimonial-card');
        const prevBtn = carousel.querySelector('.testimonials-carousel__btn--prev');
        const nextBtn = carousel.querySelector('.testimonials-carousel__btn--next');
        const dotsContainer = carousel.querySelector('.testimonials-carousel__dots');

        let currentIndex = 0;
        let autoPlayInterval;
        const autoPlayDelay = 5000; // 5 secondes

        // Calculer le nombre de slides visibles selon la taille d'écran
        function getVisibleSlides() {
            if (window.innerWidth <= 768) return 1;
            if (window.innerWidth <= 1024) return 2;
            return 3;
        }

        // Calculer le nombre total de positions
        function getTotalPositions() {
            const visibleSlides = getVisibleSlides();
            return Math.max(1, cards.length - visibleSlides + 1);
        }

        // Créer les dots
        function createDots() {
            dotsContainer.innerHTML = '';
            const totalPositions = getTotalPositions();

            for (let i = 0; i < totalPositions; i++) {
                const dot = document.createElement('button');
                dot.className = 'testimonials-carousel__dot';
                dot.setAttribute('aria-label', `Aller au témoignage ${i + 1}`);
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => goToSlide(i));
                dotsContainer.appendChild(dot);
            }
        }

        // Mettre à jour les dots
        function updateDots() {
            const dots = dotsContainer.querySelectorAll('.testimonials-carousel__dot');
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        // Aller à un slide spécifique
        function goToSlide(index) {
            const totalPositions = getTotalPositions();
            currentIndex = Math.max(0, Math.min(index, totalPositions - 1));

            const visibleSlides = getVisibleSlides();
            const gap = parseFloat(getComputedStyle(track).gap) || 24;
            const cardWidth = cards[0].offsetWidth;
            const offset = currentIndex * (cardWidth + gap);

            track.style.transform = `translateX(-${offset}px)`;
            updateDots();
        }

        // Slide suivant
        function nextSlide() {
            const totalPositions = getTotalPositions();
            if (currentIndex < totalPositions - 1) {
                goToSlide(currentIndex + 1);
            } else {
                goToSlide(0); // Retour au début
            }
        }

        // Slide précédent
        function prevSlide() {
            const totalPositions = getTotalPositions();
            if (currentIndex > 0) {
                goToSlide(currentIndex - 1);
            } else {
                goToSlide(totalPositions - 1); // Aller à la fin
            }
        }

        // Démarrer l'autoplay
        function startAutoPlay() {
            stopAutoPlay();
            autoPlayInterval = setInterval(nextSlide, autoPlayDelay);
        }

        // Arrêter l'autoplay
        function stopAutoPlay() {
            if (autoPlayInterval) {
                clearInterval(autoPlayInterval);
            }
        }

        // Event listeners
        prevBtn.addEventListener('click', () => {
            prevSlide();
            startAutoPlay(); // Reset autoplay après interaction
        });

        nextBtn.addEventListener('click', () => {
            nextSlide();
            startAutoPlay(); // Reset autoplay après interaction
        });

        // Pause autoplay au survol
        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);

        // Support tactile
        let touchStartX = 0;
        let touchEndX = 0;

        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
            startAutoPlay();
        }, { passive: true });

        function handleSwipe() {
            const swipeThreshold = 50;
            const diff = touchStartX - touchEndX;

            if (diff > swipeThreshold) {
                nextSlide();
            } else if (diff < -swipeThreshold) {
                prevSlide();
            }
        }

        // Recalculer au redimensionnement
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                createDots();
                goToSlide(Math.min(currentIndex, getTotalPositions() - 1));
            }, 250);
        });

        // Initialisation
        createDots();
        startAutoPlay();
    }

    // === TILT EFFECT ON CARDS ===
    // Désactivé car cause des artefacts visuels sur les bordures
    function initTiltEffect() {
        // Effet désactivé
        return;
    }

    // === TEXT TYPING EFFECT ===
    function initTypingEffect() {
        const typingElements = document.querySelectorAll('[data-typing]');

        typingElements.forEach(el => {
            const text = el.textContent;
            el.textContent = '';
            el.style.opacity = '1';

            let i = 0;
            const speed = parseInt(el.dataset.typingSpeed) || 50;

            function type() {
                if (i < text.length) {
                    el.textContent += text.charAt(i);
                    i++;
                    setTimeout(type, speed);
                }
            }

            // Start when visible
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    type();
                    observer.disconnect();
                }
            });

            observer.observe(el);
        });
    }

    // === SMOOTH SCROLL PROGRESS ===
    function initScrollProgress() {
        const progressBar = document.querySelector('.scroll-progress');
        if (!progressBar) return;

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = (scrollTop / docHeight) * 100;

            progressBar.style.width = `${progress}%`;
        }, { passive: true });
    }

    // === DARK MODE ===
    function initDarkMode() {
        const toggle = document.querySelector('.theme-toggle');
        if (!toggle) return;

        // Check for saved preference or system preference
        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark-mode');
            toggle.classList.add('active');
        }

        toggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            toggle.classList.toggle('active');

            const isDark = document.documentElement.classList.contains('dark-mode');
            localStorage.setItem('theme', isDark ? 'dark' : 'light');
        });
    }

    // === SMOOTH ANCHOR HIGHLIGHTING ===
    function initActiveNavOnScroll() {
        const sections = document.querySelectorAll('section[id]');

        window.addEventListener('scroll', () => {
            let current = '';

            sections.forEach(section => {
                const sectionTop = section.offsetTop - 150;
                const sectionHeight = section.offsetHeight;

                if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
                    current = section.getAttribute('id');
                }
            });

            navLinks.forEach(link => {
                link.classList.remove('nav__link--active');
                const href = link.getAttribute('href');
                if (href && href.includes(current)) {
                    link.classList.add('nav__link--active');
                }
            });
        }, { passive: true });
    }

    // === RIPPLE EFFECT ON BUTTONS ===
    function initRippleEffect() {
        const buttons = document.querySelectorAll('.btn');

        buttons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                const rect = this.getBoundingClientRect();
                const ripple = document.createElement('span');
                ripple.className = 'ripple';
                ripple.style.left = `${e.clientX - rect.left}px`;
                ripple.style.top = `${e.clientY - rect.top}px`;

                this.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        });
    }

    // === FLOATING ELEMENTS ANIMATION ===
    function initFloatingAnimation() {
        const floatingElements = document.querySelectorAll('.platform-icon, .hero__platforms');

        floatingElements.forEach((el, index) => {
            el.style.animationDelay = `${index * 0.5}s`;
        });
    }

    // === FORM VALIDATION EFFECTS ===
    function initFormEffects() {
        const formGroups = document.querySelectorAll('.form-group');

        formGroups.forEach(group => {
            const input = group.querySelector('input, textarea, select');
            if (!input) return;

            input.addEventListener('focus', () => {
                group.classList.add('focused');
            });

            input.addEventListener('blur', () => {
                group.classList.remove('focused');
                if (input.value) {
                    group.classList.add('filled');
                } else {
                    group.classList.remove('filled');
                }
            });

            // Initial check
            if (input.value) {
                group.classList.add('filled');
            }
        });
    }

    // === EVENT LISTENERS ===
    if (navToggle) {
        navToggle.addEventListener('click', toggleMenu);
    }

    // Close menu on link click
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            closeMenu();
            handleSmoothScroll(e);
        });
    });

    // All links with hash
    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', handleSmoothScroll);
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
        if (navMenu && navMenu.classList.contains('active')) {
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                closeMenu();
            }
        }
    });

    // Close menu with Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) {
            closeMenu();
        }
    });

    // Scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', () => {
        handleScroll();
        if (!isMobile()) {
            closeMenu();
        }
    });

    // === INITIALIZATION ===
    function init() {
        initLoader();
        // initRegenParticles(); // Disabled
        initHealingGlow();
        initRegenPulse();
        initEnergyBars();
        initScrollReveal();
        initCounters();
        initParallax();
        initMagneticButtons();
        initFaqAccordion();
        initTestimonialsCarousel();
        initTiltEffect();
        initScrollProgress();
        initDarkMode();
        initActiveNavOnScroll();
        initRippleEffect();
        initFloatingAnimation();
        initFormEffects();
        handleScroll();

        console.log('🌱 Regen Agency - Regeneration complete!');
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
