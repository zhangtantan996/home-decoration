import { setLang, applyTranslations, getLang } from './i18n.js';
import { initAnimations, initSmoothScroll, initNavbarScroll, animateCounters } from './animations.js';
import {
    Apple,
    BookOpen,
    Bot,
    Calendar,
    ChartBar,
    Home,
    Image,
    Megaphone,
    MessageSquare,
    Palette,
    Shield,
    ShieldCheck,
    Smartphone,
    Star,
    Target,
    TrendingUp,
    Wrench,
    createIcons,
} from 'lucide';

const iconSet = {
    Apple,
    BookOpen,
    Bot,
    Calendar,
    ChartBar,
    Home,
    Image,
    Megaphone,
    MessageSquare,
    Palette,
    Shield,
    ShieldCheck,
    Smartphone,
    Star,
    Target,
    TrendingUp,
    Wrench,
};

document.documentElement.classList.add('motion-ready');

document.addEventListener('DOMContentLoaded', () => {
    createIcons({ icons: iconSet });
    applyTranslations();

    const langBtns = document.querySelectorAll('.lang-btn');
    const activeLang = getLang();
    langBtns.forEach((btn) => {
        const btnLang = btn.getAttribute('data-lang');
        btn.classList.toggle('active', btnLang === activeLang);
        btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            if (!lang) {
                return;
            }
            setLang(lang);
            langBtns.forEach((candidate) => {
                candidate.classList.toggle('active', candidate.getAttribute('data-lang') === lang);
            });
        });
    });

    const body = document.body;
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    const closeMenu = () => {
        if (!menuToggle || !navLinks) {
            return;
        }
        menuToggle.classList.remove('active');
        menuToggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('active');
        body.classList.remove('menu-open');
    };

    const openMenu = () => {
        if (!menuToggle || !navLinks) {
            return;
        }
        menuToggle.classList.add('active');
        menuToggle.setAttribute('aria-expanded', 'true');
        navLinks.classList.add('active');
        body.classList.add('menu-open');
    };

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            if (navLinks.classList.contains('active')) {
                closeMenu();
                return;
            }
            openMenu();
        });

        navLinks.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }
            if (target.closest('a') || target === navLinks) {
                closeMenu();
            }
        });

        window.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                closeMenu();
            }
        });
    }

    initAnimations();
    initSmoothScroll();
    initNavbarScroll();
    animateCounters();

    const hero = document.querySelector('.hero');
    if (hero) {
        window.addEventListener('scroll', () => {
            const scrolled = window.scrollY;
            const rate = scrolled * 0.3;
            hero.style.setProperty('--parallax-y', `${rate}px`);
        }, { passive: true });
    }
});
