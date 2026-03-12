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
    Sun,
    Moon,
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
    Sun,
    Moon,
};

const USER_WEB_URL = (import.meta.env.VITE_USER_WEB_URL || '/app/').trim();
const MERCHANT_WEB_URL = (import.meta.env.VITE_MERCHANT_WEB_URL || '/merchant').trim();
const IOS_APP_URL = (import.meta.env.VITE_IOS_APP_URL || '').trim();
const ANDROID_APP_URL = (import.meta.env.VITE_ANDROID_APP_URL || '').trim();

const trimTrailingSlash = (value) => value.replace(/\/+$/, '');
const isLocalHost = (hostname) => hostname === 'localhost' || hostname === '127.0.0.1';

const resolveUserWebBase = () => {
    if (USER_WEB_URL && USER_WEB_URL !== '/app/') {
        return USER_WEB_URL;
    }

    if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) {
        return `${window.location.protocol}//${window.location.hostname}:5186/`;
    }

    return USER_WEB_URL || '/app/';
};

const resolveMerchantWebBase = () => {
    if (MERCHANT_WEB_URL && MERCHANT_WEB_URL !== '/merchant') {
        return MERCHANT_WEB_URL;
    }

    if (typeof window !== 'undefined' && isLocalHost(window.location.hostname)) {
        return `${window.location.protocol}//${window.location.hostname}:5174/merchant`;
    }

    return MERCHANT_WEB_URL || '/merchant';
};

const resolveAppDownloadURL = (value) => value || '#download';

const buildUserWebURL = (hashPath = '') => {
    const base = resolveUserWebBase();
    const normalizedBase = base.replace(/#.*$/, '');
    if (!hashPath) {
        return normalizedBase;
    }
    const nextHash = hashPath.startsWith('/') ? hashPath : `/${hashPath}`;
    return `${trimTrailingSlash(normalizedBase)}/#${nextHash}`;
};

const linkTargets = {
    'ios-app': () => resolveAppDownloadURL(IOS_APP_URL),
    'android-app': () => resolveAppDownloadURL(ANDROID_APP_URL),
    'user-web-home': () => buildUserWebURL('/pages/home/index'),
    'user-web-login': () => buildUserWebURL('/pages/auth/login/index'),
    'user-web-providers': () => buildUserWebURL('/pages/providers/list/index'),
    'user-web-foremen': () => buildUserWebURL('/pages/providers/list/index?type=foreman'),
    'user-web-inspiration': () => buildUserWebURL('/pages/inspiration/index'),
    'merchant-entry': () => resolveMerchantWebBase(),
    'merchant-web': () => resolveMerchantWebBase(),
};

document.documentElement.classList.add('motion-ready');

document.addEventListener('DOMContentLoaded', () => {
    createIcons({ icons: iconSet });
    applyTranslations();

    document.querySelectorAll('[data-link-target]').forEach((element) => {
        if (!(element instanceof HTMLAnchorElement)) {
            return;
        }
        const target = element.dataset.linkTarget;
        if (!target || !linkTargets[target]) {
            return;
        }
        element.href = linkTargets[target]();
    });

    // Theme Switch Logic
    const themeSwitches = document.querySelectorAll('.theme-switch');
    const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    
    const setTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('hezeyun-theme', theme);
    };

    const savedTheme = localStorage.getItem('hezeyun-theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        const sysTheme = getSystemTheme();
        if (sysTheme === 'light') setTheme('light');
    }

    themeSwitches.forEach(btn => {
        btn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || getSystemTheme();
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(newTheme);
        });
    });

    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
        if (!localStorage.getItem('hezeyun-theme')) {
            document.documentElement.setAttribute('data-theme', e.matches ? 'light' : 'dark');
        }
    });

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
