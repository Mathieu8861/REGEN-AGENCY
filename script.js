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
    
    // === HEADER COLLAPSE (desktop only) ===
    function handleScroll() {
        if (!header) return;
        
        if (isMobile()) {
            header.classList.remove('collapsed');
            return;
        }
        
        if (window.scrollY > SCROLL_THRESHOLD) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    
    // === SMOOTH SCROLL ===
    function handleSmoothScroll(e) {
        const href = e.currentTarget.getAttribute('href');
        
        if (href.startsWith('#')) {
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
    
    // === EVENT LISTENERS ===
    if (navToggle) {
        navToggle.addEventListener('click', toggleMenu);
    }
    
    // Fermer menu au clic sur lien
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            closeMenu();
            handleSmoothScroll(e);
        });
    });
    
    // Fermer menu au clic en dehors
    document.addEventListener('click', (e) => {
        if (navMenu && navMenu.classList.contains('active')) {
            if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
                closeMenu();
            }
        }
    });
    
    // Fermer menu avec Escape
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
    
    // === ANIMATION AU SCROLL (Intersection Observer) ===
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observer les éléments avec animation
    document.querySelectorAll('.value-card, .expertise-card, .testimonial-card, .collab-item').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // Style pour les éléments visibles
    const style = document.createElement('style');
    style.textContent = `
        .is-visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
    
    // === INIT ===
    handleScroll();
    console.log('✅ Regen Agency - Script loaded');
    
})();
