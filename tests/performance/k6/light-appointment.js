import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Trend } from 'k6/metrics';

const apiBaseUrl = (__ENV.API_BASE_URL || 'http://127.0.0.1:8080/api/v1').replace(/\/$/, '');
const profile = __ENV.K6_PROFILE || 'read';
const opsToken = __ENV.OPS_ADMIN_TOKEN || '';
const adminToken = __ENV.ADMIN_TOKEN || '';
const userToken = __ENV.USER_TOKEN || '';
const enableWrites = __ENV.K6_ENABLE_WRITES === '1';
const providerId = Number(__ENV.K6_PROVIDER_ID || '0');
const providerType = __ENV.K6_PROVIDER_TYPE || 'designer';
const productionApiHosts = (__ENV.PRODUCTION_API_HOSTS || 'api.hezeyunchuang.com,hezeyunchuang.com,www.hezeyunchuang.com')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

const targetVus = Number(__ENV.K6_TARGET_VUS || (profile === 'trial' ? '100' : '50'));
const peakVus = Number(__ENV.K6_PEAK_VUS || String(targetVus * 2));
const warmupDuration = __ENV.K6_WARMUP_DURATION || '2m';
const steadyDuration = __ENV.K6_STEADY_DURATION || '5m';
const spikeDuration = __ENV.K6_SPIKE_DURATION || '2m';
const cooldownDuration = __ENV.K6_COOLDOWN_DURATION || '1m';

const endpointDurations = {
  health: new Trend('endpoint_health_duration', true),
  homepage: new Trend('endpoint_homepage_duration', true),
  'public-site-config': new Trend('endpoint_public_site_config_duration', true),
  providers: new Trend('endpoint_providers_duration', true),
  designers: new Trend('endpoint_designers_duration', true),
  companies: new Trend('endpoint_companies_duration', true),
  foremen: new Trend('endpoint_foremen_duration', true),
  'material-shops': new Trend('endpoint_material_shops_duration', true),
  inspiration: new Trend('endpoint_inspiration_duration', true),
  'service-cities': new Trend('endpoint_service_cities_duration', true),
  'ops-bookings': new Trend('endpoint_ops_bookings_duration', true),
  'ops-quote-inquiries': new Trend('endpoint_ops_quote_inquiries_duration', true),
  'ops-providers': new Trend('endpoint_ops_providers_duration', true),
  'ops-material-shops': new Trend('endpoint_ops_material_shops_duration', true),
  'ops-projects': new Trend('endpoint_ops_projects_duration', true),
  'admin-health': new Trend('endpoint_admin_health_duration', true),
  'admin-users': new Trend('endpoint_admin_users_duration', true),
  'quote-inquiry-create': new Trend('endpoint_quote_inquiry_create_duration', true),
  'booking-create': new Trend('endpoint_booking_create_duration', true),
  'feedback-create': new Trend('endpoint_feedback_create_duration', true),
};

if (enableWrites && (!userToken || providerId <= 0)) {
  throw new Error('K6_ENABLE_WRITES=1 requires USER_TOKEN and K6_PROVIDER_ID');
}

function hostnameOf(url) {
  const withoutProtocol = url.replace(/^https?:\/\//, '');
  const authority = withoutProtocol.split('/')[0];
  return authority.split('@').pop().split(':')[0].toLowerCase();
}

function isProductionApiUrl(url) {
  const host = hostnameOf(url);
  return host === 'hezeyunchuang.com' || host.endsWith('.hezeyunchuang.com') || productionApiHosts.includes(host);
}

if (enableWrites && isProductionApiUrl(apiBaseUrl)) {
  throw new Error('Production API only allows read-only k6 probes; unset K6_ENABLE_WRITES');
}

const thresholds = {
  http_req_failed: ['rate<0.01'],
  'http_req_duration{kind:read}': ['p(95)<500'],
  http_req_duration: ['p(95)<800'],
};

if (enableWrites) {
  thresholds['http_req_duration{kind:write}'] = ['p(95)<800'];
}

export const options = {
  scenarios: {
    light_appointment: {
      executor: 'ramping-vus',
      stages: [
        { duration: warmupDuration, target: targetVus },
        { duration: steadyDuration, target: targetVus },
        { duration: spikeDuration, target: peakVus },
        { duration: cooldownDuration, target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds,
};

function headers(token = '') {
  const result = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (token) {
    result.Authorization = `Bearer ${token}`;
  }
  return result;
}

function ok(response, label) {
  if (endpointDurations[label]) {
    endpointDurations[label].add(response.timings.duration);
  }
  check(response, {
    [`${label} status 2xx`]: (res) => res.status >= 200 && res.status < 300,
    [`${label} no stack leak`]: (res) => !String(res.body || '').includes('goroutine ') && !String(res.body || '').includes('panic:'),
  });
}

function get(path, label, token = '', extraTags = {}) {
  const response = http.get(`${apiBaseUrl}${path}`, {
    headers: headers(token),
    tags: { kind: 'read', endpoint: label, ...extraTags },
  });
  ok(response, label);
  return response;
}

function post(path, label, payload, token = '', extraTags = {}) {
  const response = http.post(`${apiBaseUrl}${path}`, JSON.stringify(payload), {
    headers: headers(token),
    tags: { kind: 'write', endpoint: label, ...extraTags },
  });
  ok(response, label);
  return response;
}

function phoneForVu() {
  const suffix = String((__VU * 100000 + __ITER) % 1000000000).padStart(9, '0');
  return `18${suffix}`;
}

function publicReadJourney() {
  group('public read journey', () => {
    get('/health', 'health');
    get('/homepage', 'homepage');
    get('/public/site-config', 'public-site-config');
    get('/providers?page=1&pageSize=10', 'providers');
    get('/designers?page=1&pageSize=10', 'designers');
    get('/companies?page=1&pageSize=10', 'companies');
    get('/foremen?page=1&pageSize=10', 'foremen');
    get('/material-shops?page=1&pageSize=10', 'material-shops');
    get('/inspiration?page=1&pageSize=10', 'inspiration');
    get('/regions/service-cities', 'service-cities');
  });
}

function opsReadJourney() {
  if (!opsToken) {
    return;
  }
  group('ops read journey', () => {
    get('/ops-admin/bookings?page=1&pageSize=10', 'ops-bookings', opsToken);
    get('/ops-admin/quote-inquiries?page=1&pageSize=10', 'ops-quote-inquiries', opsToken);
    get('/ops-admin/providers?page=1&pageSize=10', 'ops-providers', opsToken);
    get('/ops-admin/material-shops?page=1&pageSize=10', 'ops-material-shops', opsToken);
    get('/ops-admin/projects?page=1&pageSize=10', 'ops-projects', opsToken);
  });
}

function adminReadJourney() {
  if (!adminToken) {
    return;
  }
  group('admin read journey', () => {
    get('/admin/health', 'admin-health', adminToken);
    get('/admin/users?page=1&pageSize=10', 'admin-users', adminToken);
  });
}

function writeJourney() {
  if (!enableWrites) {
    return;
  }
  group('write journey', () => {
    const phone = phoneForVu();
    post('/quote-inquiries', 'quote-inquiry-create', {
      address: `西安市雁塔区压测${__VU}-${__ITER}号`,
      cityCode: '610100',
      area: 96,
      houseLayout: '三室两厅',
      renovationType: '旧房翻新',
      style: '现代简约',
      budgetRange: '20-30万',
      phone,
      source: 'k6_light_appointment',
    });

    if (userToken && providerId > 0) {
      post('/bookings', 'booking-create', {
        providerId,
        providerType,
        address: `西安市雁塔区预约压测${__VU}-${__ITER}号`,
        area: 96,
        renovationType: '旧房翻新',
        budgetRange: '20-30万',
        preferredDate: '2026-06-18 上午',
        phone,
        notes: 'k6 light appointment test',
      }, userToken);

      post('/user/feedback', 'feedback-create', {
        type: 'suggestion',
        content: 'k6 light appointment feedback',
        contact: phone,
      }, userToken);
    }
  });
}

export default function run() {
  publicReadJourney();
  opsReadJourney();
  adminReadJourney();
  writeJourney();
  sleep(Number(__ENV.K6_SLEEP_SECONDS || '1'));
}
