/**
 * =====================================================
 * REGEN AGENCY — main.js
 * =====================================================
 *
 * ARCHITECTURE SIMPLIFIÉE :
 *
 * 1. SCROLL REVEAL (animations au scroll)
 *    → Ajouter class="reveal" sur tout élément HTML à animer.
 *    → L'IntersectionObserver le détecte, ajoute "revealed" quand visible.
 *    → Pour stagger des enfants : ajouter class="reveal-child" sur chaque enfant.
 *    → C'est TOUT. Pas de liste de sélecteurs à maintenir.
 *
 * 2. COUNTERS (animation de chiffres)
 *    → Les éléments .stat__number et .stat-card__number s'animent auto.
 *
 * 3. CAROUSELS
 *    → Témoignages : .testimonials-carousel (autoplay + swipe)
 *    → Réalisations : .realisations-showcase (drag + boutons)
 *
 * 4. NAVIGATION
 *    → Menu mobile toggle
 *    → Header scroll effect (class "scrolled")
 *    → Smooth scroll sur ancres #
 *    → Pole sub-nav active state
 *
 * 5. EFFETS VISUELS
 *    → Parallax : data-parallax="0.5" sur un élément
 *    → Magnetic buttons : hover magnétique sur .btn--primary/.btn--white
 *    → Ripple : effet ripple sur .btn au clic
 *    → Floating : animation delay sur .platform-icon
 *
 * 6. FORMULAIRES
 *    → Focus/blur effects sur .form-group
 *
 * =====================================================
 */

(function() {
    'use strict';

    // === CONSTANTES ===
    const SCROLL_THRESHOLD = 100;
    const MOBILE_BREAKPOINT = 768;

    // === SÉLECTEURS GLOBAUX ===
    const header = document.getElementById('header');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav__link');

    // === UTILITAIRES ===
    function isMobile() {
        return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    // =============================================
    // 1. PAGE LOADER
    // =============================================
    function initLoader() {
        const loader = document.querySelector('.page-loader');
        if (!loader) return;

        window.addEventListener('load', () => {
            setTimeout(() => {
                loader.classList.add('loaded');
                document.body.classList.remove('loading');

                setTimeout(() => {
                    document.querySelectorAll('.hero__text > *, .hero-page > .container > *, .hero-service > .container > *').forEach((el, i) => {
                        el.style.animationDelay = `${i * 0.1}s`;
                        el.classList.add('animate-in');
                    });
                }, 100);
            }, 500);
        });
    }

    // =============================================
    // 2. SCROLL REVEAL — SYSTÈME UNIVERSEL
    // =============================================
    // COMMENT UTILISER :
    //   <div class="reveal">...</div>           → anime cet élément
    //   <div class="reveal">
    //     <div class="reveal-child">...</div>    → stagger automatique (0.1s par enfant)
    //     <div class="reveal-child">...</div>
    //   </div>
    //
    // CSS requis (dans style.css) :
    //   .reveal { opacity: 0; transform: translateY(30px); transition: ... }
    //   .revealed { opacity: 1; transform: translateY(0); }
    //
    function initScrollReveal() {
        const elements = document.querySelectorAll('.reveal');
        if (!elements.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');

                    // Stagger les enfants .reveal-child
                    const children = entry.target.querySelectorAll('.reveal-child');
                    children.forEach((child, index) => {
                        child.style.transitionDelay = `${index * 0.1}s`;
                        child.classList.add('revealed');
                    });

                    observer.unobserve(entry.target);
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -50px 0px',
            threshold: 0.1
        });

        elements.forEach(el => observer.observe(el));
    }

    // =============================================
    // 3. COUNTER ANIMATION
    // =============================================
    function initCounters() {
        const counters = document.querySelectorAll('.stat__number, .stat-card__number');
        if (counters.length) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        animateCounter(entry.target);
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.5 });

            counters.forEach(counter => observer.observe(counter));
        }

        // Combined stats counters (ads-sea page)
        const combinedCounters = document.querySelectorAll('.combined-stat__value[data-count]');
        if (combinedCounters.length) {
            const combinedObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                        animateCombinedCounter(entry.target);
                        combinedObserver.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.2, rootMargin: '0px 0px 50px 0px' });
            combinedCounters.forEach(el => combinedObserver.observe(el));
        }
    }

    function animateCombinedCounter(element) {
        const target = parseFloat(element.dataset.count);
        const suffix = element.dataset.suffix || '';
        const decimals = parseInt(element.dataset.decimals || '0', 10);
        const duration = 2000;
        const startTime = performance.now();

        element.classList.add('counting');

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo for a nice deceleration
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = eased * target;

            element.textContent = current.toFixed(decimals) + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target.toFixed(decimals) + suffix;
                element.classList.remove('counting');
                element.classList.add('counted');
            }
        }

        requestAnimationFrame(update);
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

            element.innerHTML = `${prefix}${Math.floor(current)}<span class="stat__unit">${suffix}</span>`;
        }, stepTime);
    }

    // =============================================
    // 4. NAVIGATION
    // =============================================

    // --- Menu mobile ---
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

    // --- Header scroll ---
    function handleScroll() {
        if (!header) return;
        header.classList.toggle('scrolled', window.scrollY > SCROLL_THRESHOLD);
    }

    // --- Smooth scroll ancres ---
    function handleSmoothScroll(e) {
        const href = e.currentTarget.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        closeMenu();

        const headerHeight = header ? header.offsetHeight : 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - headerHeight - 20;

        window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }

    // --- Pole sub-nav active state ---
    function initPoleNav() {
        const poleNav = document.querySelector('.pole-nav');
        if (!poleNav) return;

        const navItems = poleNav.querySelectorAll('.pole-nav__item');
        const sections = [];

        navItems.forEach(item => {
            const targetId = item.getAttribute('href')?.replace('#', '');
            if (targetId) {
                const section = document.getElementById(targetId);
                if (section) sections.push({ el: section, navItem: item });
            }
        });

        if (!sections.length) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    navItems.forEach(item => item.classList.remove('pole-nav__item--active'));
                    const match = sections.find(s => s.el === entry.target);
                    if (match) match.navItem.classList.add('pole-nav__item--active');
                }
            });
        }, { rootMargin: '-20% 0px -60% 0px', threshold: 0 });

        sections.forEach(s => observer.observe(s.el));
    }

    // --- Nav active on scroll ---
    function initActiveNavOnScroll() {
        const sections = document.querySelectorAll('section[id]');
        if (!sections.length) return;

        window.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(section => {
                const sectionTop = section.offsetTop - 150;
                if (window.scrollY >= sectionTop && window.scrollY < sectionTop + section.offsetHeight) {
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

    // --- Smooth scroll pole tabs ---
    function initSmoothScroll() {
        document.querySelectorAll('.pole-hero__tab, .pole-nav__item').forEach(link => {
            link.addEventListener('click', (e) => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        const top = target.getBoundingClientRect().top + window.pageYOffset - 70;
                        window.scrollTo({ top, behavior: 'smooth' });
                    }
                }
            });
        });
    }

    // =============================================
    // 5. CAROUSELS
    // =============================================

    // --- Témoignages ---
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
        const autoPlayDelay = 5000;

        function getVisibleSlides() {
            if (window.innerWidth <= 768) return 1;
            if (window.innerWidth <= 1024) return 2;
            return 3;
        }

        function getTotalPositions() {
            return Math.max(1, cards.length - getVisibleSlides() + 1);
        }

        function createDots() {
            dotsContainer.innerHTML = '';
            const total = getTotalPositions();
            for (let i = 0; i < total; i++) {
                const dot = document.createElement('button');
                dot.className = 'testimonials-carousel__dot';
                dot.setAttribute('aria-label', `Aller au témoignage ${i + 1}`);
                if (i === 0) dot.classList.add('active');
                dot.addEventListener('click', () => goToSlide(i));
                dotsContainer.appendChild(dot);
            }
        }

        function updateDots() {
            dotsContainer.querySelectorAll('.testimonials-carousel__dot').forEach((dot, i) => {
                dot.classList.toggle('active', i === currentIndex);
            });
        }

        function goToSlide(index) {
            currentIndex = Math.max(0, Math.min(index, getTotalPositions() - 1));
            const gap = parseFloat(getComputedStyle(track).gap) || 24;
            const offset = currentIndex * (cards[0].offsetWidth + gap);
            track.style.transform = `translateX(-${offset}px)`;
            updateDots();
        }

        function nextSlide() {
            goToSlide(currentIndex < getTotalPositions() - 1 ? currentIndex + 1 : 0);
        }

        function prevSlide() {
            goToSlide(currentIndex > 0 ? currentIndex - 1 : getTotalPositions() - 1);
        }

        function startAutoPlay() {
            stopAutoPlay();
            autoPlayInterval = setInterval(nextSlide, autoPlayDelay);
        }

        function stopAutoPlay() {
            if (autoPlayInterval) clearInterval(autoPlayInterval);
        }

        prevBtn.addEventListener('click', () => { prevSlide(); startAutoPlay(); });
        nextBtn.addEventListener('click', () => { nextSlide(); startAutoPlay(); });

        carousel.addEventListener('mouseenter', stopAutoPlay);
        carousel.addEventListener('mouseleave', startAutoPlay);

        // Touch support
        let touchStartX = 0;
        track.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            stopAutoPlay();
        }, { passive: true });

        track.addEventListener('touchend', (e) => {
            const diff = touchStartX - e.changedTouches[0].screenX;
            if (diff > 50) nextSlide();
            else if (diff < -50) prevSlide();
            startAutoPlay();
        }, { passive: true });

        // Resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                createDots();
                goToSlide(Math.min(currentIndex, getTotalPositions() - 1));
            }, 250);
        });

        createDots();
        startAutoPlay();
    }

    // --- Réalisations ---
    function initRealisationsCarousel() {
        document.querySelectorAll('.realisations-showcase').forEach(showcase => {
            const track = showcase.querySelector('.realisations-showcase__track');
            const prevBtn = showcase.querySelector('.realisations-showcase__btn--prev');
            const nextBtn = showcase.querySelector('.realisations-showcase__btn--next');
            if (!track) return;

            let isDragging = false;
            let startX = 0;
            let scrollLeftStart = 0;

            function getScrollAmount() {
                const card = track.querySelector('.realisation-card');
                return card ? card.offsetWidth + 20 : 400;
            }

            if (prevBtn) prevBtn.addEventListener('click', () => track.scrollBy({ left: -getScrollAmount(), behavior: 'smooth' }));
            if (nextBtn) nextBtn.addEventListener('click', () => track.scrollBy({ left: getScrollAmount(), behavior: 'smooth' }));

            track.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.pageX - track.offsetLeft;
                scrollLeftStart = track.scrollLeft;
                track.style.cursor = 'grabbing';
            });

            track.addEventListener('mouseleave', () => { isDragging = false; track.style.cursor = 'grab'; });
            track.addEventListener('mouseup', () => { isDragging = false; track.style.cursor = 'grab'; });

            track.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                e.preventDefault();
                track.scrollLeft = scrollLeftStart - ((e.pageX - track.offsetLeft) - startX) * 1.5;
            });
        });
    }

    // =============================================
    // 6. EFFETS VISUELS
    // =============================================

    // --- Parallax ---
    function initParallax() {
        const elements = document.querySelectorAll('[data-parallax]');
        if (!elements.length) return;

        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrollY = window.scrollY;
                    elements.forEach(el => {
                        const speed = parseFloat(el.dataset.parallax) || 0.5;
                        const rect = el.getBoundingClientRect();
                        const elementCenter = rect.top + scrollY + rect.height / 2;
                        const distance = (scrollY + window.innerHeight / 2) - elementCenter;
                        el.style.transform = `translateY(${distance * speed * 0.1}px)`;
                    });
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });
    }

    // --- Magnetic buttons (désactivé) ---
    function initMagneticButtons() {
        return;
    }

    // --- Ripple on buttons ---
    function initRippleEffect() {
        document.querySelectorAll('.btn').forEach(btn => {
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

    // --- Floating icons delay ---
    function initFloatingAnimation() {
        document.querySelectorAll('.platform-icon, .hero__platforms').forEach((el, i) => {
            el.style.animationDelay = `${i * 0.5}s`;
        });
    }

    // --- Regen pulse on CTA ---
    function initRegenPulse() {
        document.querySelectorAll('.btn--primary').forEach(btn => {
            const pulse = document.createElement('span');
            pulse.className = 'regen-pulse';
            btn.appendChild(pulse);
        });
    }

    // --- Energy bars on stats ---
    function initEnergyBars() {
        document.querySelectorAll('.stat, .stat-card').forEach(stat => {
            const bar = document.createElement('div');
            bar.className = 'energy-bar';
            stat.appendChild(bar);
        });
    }

    // --- Scroll progress bar ---
    function initScrollProgress() {
        const bar = document.querySelector('.scroll-progress');
        if (!bar) return;

        window.addEventListener('scroll', () => {
            const progress = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            bar.style.width = `${progress}%`;
        }, { passive: true });
    }

    // =============================================
    // 7. FORMULAIRES
    // =============================================
    function initFormEffects() {
        document.querySelectorAll('.form-group').forEach(group => {
            const input = group.querySelector('input, textarea, select');
            if (!input) return;

            input.addEventListener('focus', () => group.classList.add('focused'));
            input.addEventListener('blur', () => {
                group.classList.remove('focused');
                group.classList.toggle('filled', !!input.value);
            });

            if (input.value) group.classList.add('filled');
        });
    }

    // =============================================
    // 8. FAQ ACCORDION
    // =============================================
    function initFaqAccordion() {
        const items = document.querySelectorAll('.faq-item');
        items.forEach(item => {
            item.addEventListener('toggle', () => {
                if (item.open) {
                    items.forEach(other => {
                        if (other !== item && other.open) other.open = false;
                    });
                }
            });
        });
    }

    // =============================================
    // 9. DARK MODE (optionnel)
    // =============================================
    function initDarkMode() {
        const toggle = document.querySelector('.theme-toggle');
        if (!toggle) return;

        const savedTheme = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

        if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
            document.documentElement.classList.add('dark-mode');
            toggle.classList.add('active');
        }

        toggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            toggle.classList.toggle('active');
            localStorage.setItem('theme', document.documentElement.classList.contains('dark-mode') ? 'dark' : 'light');
        });
    }

    // =============================================
    // EVENT LISTENERS
    // =============================================
    if (navToggle) navToggle.addEventListener('click', toggleMenu);

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => { closeMenu(); handleSmoothScroll(e); });
    });

    document.querySelectorAll('a[href^="#"]').forEach(link => {
        link.addEventListener('click', handleSmoothScroll);
    });

    document.addEventListener('click', (e) => {
        if (navMenu && navMenu.classList.contains('active') && !navMenu.contains(e.target) && !navToggle.contains(e.target)) {
            closeMenu();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu && navMenu.classList.contains('active')) closeMenu();
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', () => {
        handleScroll();
        if (!isMobile()) closeMenu();
    });

    // =============================================
    // =============================================
    // 10. HERO SLIDER (ads page)
    // =============================================
    function initHeroSlider() {
        const slider = document.querySelector('.hero-slider');
        if (!slider) return;

        const words = slider.querySelectorAll('.hero-slider__word');
        const platforms = slider.querySelectorAll('.hero-slider__platform');
        const mockups = slider.querySelectorAll('.hero-slider__mockup');
        const dots = slider.querySelectorAll('.hero-slider__dot');

        if (!words.length) return;

        let current = 0;
        const total = words.length;
        let interval;

        function goToSlide(index) {
            // Remove active from all
            words.forEach(w => w.classList.remove('hero-slider__word--active'));
            platforms.forEach(p => p.classList.remove('hero-slider__platform--active'));
            mockups.forEach(m => m.classList.remove('hero-slider__mockup--active'));
            dots.forEach(d => d.classList.remove('hero-slider__dot--active'));

            // Set active
            words[index].classList.add('hero-slider__word--active');
            platforms[index].classList.add('hero-slider__platform--active');
            if (mockups[index]) mockups[index].classList.add('hero-slider__mockup--active');
            if (dots[index]) dots[index].classList.add('hero-slider__dot--active');

            // Update dynamic color on the active word
            const color = words[index].dataset.color;
            if (color) {
                words[index].style.color = color;
                platforms[index].style.color = color;
            }

            current = index;
        }

        function nextSlide() {
            goToSlide((current + 1) % total);
        }

        function startAutoplay() {
            interval = setInterval(nextSlide, 2500);
        }

        function resetAutoplay() {
            clearInterval(interval);
            startAutoplay();
        }

        // Click on dots
        dots.forEach(dot => {
            dot.addEventListener('click', () => {
                const index = parseInt(dot.dataset.slide, 10);
                goToSlide(index);
                resetAutoplay();
            });
        });

        // Init first slide colors
        goToSlide(0);
        startAutoplay();
    }

    // INITIALISATION
    // =============================================
    function init() {
        initLoader();
        initScrollReveal();
        initCounters();
        initParallax();
        initMagneticButtons();
        initFaqAccordion();
        initTestimonialsCarousel();
        initRealisationsCarousel();
        initScrollProgress();
        initDarkMode();
        initActiveNavOnScroll();
        initRippleEffect();
        initFloatingAnimation();
        initRegenPulse();
        initEnergyBars();
        initFormEffects();
        initPoleNav();
        initSmoothScroll();
        initHeroSlider();
        initRealisationsMarquee();
        initProcessLine();
        handleScroll();

        console.log('🌱 Regen Agency - Regeneration complete!');
    }

    // =====================================================
    // MARQUEE RÉALISATIONS (auto-scroll + drag)
    // =====================================================
    function initRealisationsMarquee() {
        const marquee = document.querySelector('.realisations-marquee');
        if (!marquee) return;

        const track = marquee.querySelector('.realisations-marquee__track');
        if (!track) return;

        // Dupliquer les cards pour boucle infinie
        const cards = track.innerHTML;
        track.innerHTML = cards + cards;

        // Drag interaction
        let isDragging = false;
        let startX = 0;
        let scrollStart = 0;
        let currentTranslate = 0;

        function getTranslateX() {
            const style = window.getComputedStyle(track);
            const matrix = new DOMMatrix(style.transform);
            return matrix.m41;
        }

        marquee.addEventListener('mousedown', (e) => {
            isDragging = true;
            marquee.classList.add('is-dragging');
            startX = e.clientX;
            currentTranslate = getTranslateX();
            track.style.animation = 'none';
            track.style.transform = `translateX(${currentTranslate}px)`;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const diff = e.clientX - startX;
            const halfWidth = track.scrollWidth / 2;
            let newX = currentTranslate + diff;

            // Boucle infinie
            if (newX > 0) newX -= halfWidth;
            if (newX < -halfWidth) newX += halfWidth;

            track.style.transform = `translateX(${newX}px)`;
        });

        window.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            marquee.classList.remove('is-dragging');

            // Reprendre l'animation depuis la position actuelle
            const currentX = getTranslateX();
            const halfWidth = track.scrollWidth / 2;
            const progress = Math.abs(currentX) / halfWidth;

            track.style.animation = '';
            track.style.transform = '';
            track.style.animationDelay = `-${progress * 35}s`;
        });

        // Touch support
        marquee.addEventListener('touchstart', (e) => {
            isDragging = true;
            marquee.classList.add('is-dragging');
            startX = e.touches[0].clientX;
            currentTranslate = getTranslateX();
            track.style.animation = 'none';
            track.style.transform = `translateX(${currentTranslate}px)`;
        }, { passive: true });

        marquee.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            const diff = e.touches[0].clientX - startX;
            const halfWidth = track.scrollWidth / 2;
            let newX = currentTranslate + diff;
            if (newX > 0) newX -= halfWidth;
            if (newX < -halfWidth) newX += halfWidth;
            track.style.transform = `translateX(${newX}px)`;
        }, { passive: true });

        marquee.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            marquee.classList.remove('is-dragging');
            const currentX = getTranslateX();
            const halfWidth = track.scrollWidth / 2;
            const progress = Math.abs(currentX) / halfWidth;
            track.style.animation = '';
            track.style.transform = '';
            track.style.animationDelay = `-${progress * 35}s`;
        });
    }

    // =====================================================
    // PROCESS LINE — scroll-driven fill animation
    // =====================================================
    function initProcessLine() {
        const section = document.querySelector('.process-creation');
        if (!section) return;

        const lineFill = section.querySelector('.process-creation__line-fill');
        if (!lineFill) return;

        const steps = section.querySelectorAll('.process-creation__step');
        if (!steps.length) return;

        const visual = document.getElementById('processVisual');

        let ticking = false;

        function updateLine() {
            const firstStep = steps[0];
            const lastStep = steps[steps.length - 1];

            const firstRect = firstStep.getBoundingClientRect();
            const lastRect = lastStep.getBoundingClientRect();

            const timelineTop = firstRect.top;
            const timelineBottom = lastRect.top + lastRect.height / 2;
            const timelineHeight = timelineBottom - timelineTop;

            if (timelineHeight <= 0) return;

            const viewportCenter = window.innerHeight * 0.6;
            const progress = (viewportCenter - timelineTop) / timelineHeight;
            const clampedProgress = Math.max(0, Math.min(1, progress));

            lineFill.style.height = `${clampedProgress * 100}%`;

            // Active steps
            let activeCount = 0;
            steps.forEach((step) => {
                const stepRect = step.getBoundingClientRect();
                const stepCenter = stepRect.top + stepRect.height / 2;
                if (stepCenter < viewportCenter) {
                    step.classList.add('process-creation__step--active');
                    activeCount++;
                } else {
                    step.classList.remove('process-creation__step--active');
                }
            });

            // Piloter l'illustration : 7 steps → 4 phases visuelles
            // Steps 1-2 → phase 1 (wireframe)
            // Steps 3-4 → phase 2 (design)
            // Step 5    → phase 3 (code)
            // Steps 6-7 → phase 4 (live)
            if (visual) {
                let phase = 1;
                if (activeCount >= 6) phase = 4;
                else if (activeCount >= 5) phase = 3;
                else if (activeCount >= 3) phase = 2;
                else phase = 1;

                const prevPhase = visual.getAttribute('data-phase') || '1';
                visual.setAttribute('data-phase', phase);

                // Toggle active class for animation triggers
                const layers = visual.querySelectorAll('.process-visual__layer');
                layers.forEach(l => l.classList.remove('active'));

                const activeLayerClass = ['wireframe', 'design', 'code', 'live'][phase - 1];
                const activeLayer = visual.querySelector(`.process-visual__layer--${activeLayerClass}`);
                if (activeLayer) activeLayer.classList.add('active');

                // Update URL text dynamically
                const urlText = visual.querySelector('.process-visual__url-text');
                if (urlText) {
                    const urls = ['votre-site.com', 'votre-site.com/maquette', 'localhost:3000', '🟢 votre-site.com'];
                    urlText.textContent = urls[phase - 1] || urls[0];
                }
            }
        }

        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    updateLine();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Initial call
        updateLine();
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
