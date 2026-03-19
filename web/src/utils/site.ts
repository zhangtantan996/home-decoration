export function getPublicSiteUrl() {
  return (import.meta.env.VITE_PUBLIC_SITE_URL || 'http://127.0.0.1:5175').replace(/\/$/, '');
}
