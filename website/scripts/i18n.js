// i18n.js — Lightweight i18n module
import zhData from './lang/zh.json';
import enData from './lang/en.json';

const translations = { zh: zhData, en: enData };

let currentLang = localStorage.getItem('nestcraft-lang') || 'zh';
if (!translations[currentLang]) {
    currentLang = 'zh';
}

function syncDocumentLang() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';
}

export function getLang() {
    return currentLang;
}

export function t(key) {
    return translations[currentLang]?.[key] || translations['zh']?.[key] || key;
}

export function setLang(lang) {
    if (!translations[lang]) {
        return;
    }
    currentLang = lang;
    localStorage.setItem('nestcraft-lang', lang);
    syncDocumentLang();
    applyTranslations();
}

export function applyTranslations() {
    syncDocumentLang();
    document.querySelectorAll('[data-i18n]').forEach((el) => {
        const key = el.getAttribute('data-i18n');
        const text = t(key);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            el.placeholder = text;
        } else {
            el.textContent = text;
        }
    });
    // Also handle data-i18n-aria
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
}
