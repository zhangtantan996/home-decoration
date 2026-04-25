const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 720" fill="none">
  <defs>
    <linearGradient id="bg" x1="120" y1="80" x2="1060" y2="640" gradientUnits="userSpaceOnUse">
      <stop stop-color="#EEF6FF"/>
      <stop offset="1" stop-color="#F5F7F2"/>
    </linearGradient>
    <linearGradient id="card" x1="260" y1="180" x2="950" y2="580" gradientUnits="userSpaceOnUse">
      <stop stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#F7FAFC"/>
    </linearGradient>
    <linearGradient id="accent" x1="360" y1="250" x2="790" y2="520" gradientUnits="userSpaceOnUse">
      <stop stop-color="#0EA5E9"/>
      <stop offset="1" stop-color="#22C55E"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="720" rx="48" fill="url(#bg)"/>
  <circle cx="170" cy="138" r="118" fill="#DDEEFF"/>
  <circle cx="1038" cy="560" r="154" fill="#E7F8EB"/>
  <rect x="178" y="150" width="844" height="438" rx="34" fill="url(#card)" stroke="#E2E8F0" stroke-width="2"/>
  <rect x="230" y="206" width="496" height="292" rx="28" fill="#0F172A"/>
  <rect x="266" y="244" width="178" height="20" rx="10" fill="#334155"/>
  <rect x="266" y="286" width="332" height="18" rx="9" fill="#475569"/>
  <rect x="266" y="326" width="280" height="18" rx="9" fill="#475569"/>
  <rect x="266" y="378" width="410" height="84" rx="22" fill="url(#accent)"/>
  <rect x="772" y="206" width="198" height="158" rx="28" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
  <path d="M826 258h90" stroke="#22C55E" stroke-width="18" stroke-linecap="round"/>
  <path d="M826 298h120" stroke="#BFDBFE" stroke-width="18" stroke-linecap="round"/>
  <path d="M826 338h70" stroke="#CBD5E1" stroke-width="18" stroke-linecap="round"/>
  <rect x="772" y="390" width="198" height="158" rx="28" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="2"/>
  <circle cx="835" cy="444" r="26" fill="#E0F2FE"/>
  <path d="M820 446l11 11 20-24" stroke="#0EA5E9" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="878" y="428" width="56" height="16" rx="8" fill="#334155"/>
  <rect x="878" y="460" width="72" height="16" rx="8" fill="#CBD5E1"/>
  <path d="M530 576c31-61 77-94 138-94s107 33 138 94" stroke="#CBD5E1" stroke-width="18" stroke-linecap="round"/>
  <circle cx="600" cy="446" r="56" fill="#E2F5EA"/>
  <path d="M562 434c4-34 28-56 62-56 31 0 55 20 62 50l-12 6h-126l14-0z" fill="#F59E0B"/>
  <rect x="558" y="434" width="128" height="24" rx="12" fill="#FBBF24"/>
  <path d="M556 512h132" stroke="#22C55E" stroke-width="18" stroke-linecap="round"/>
  <path d="M602 456v82" stroke="#16A34A" stroke-width="18" stroke-linecap="round"/>
  <path d="M642 456v82" stroke="#16A34A" stroke-width="18" stroke-linecap="round"/>
</svg>
`;

export const DEFAULT_PROGRESS_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
