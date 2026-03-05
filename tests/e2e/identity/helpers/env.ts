import fs from 'node:fs/promises';
import path from 'node:path';

export interface IdentityAcceptanceEnv {
  apiBaseUrl: string;
  adminOrigin: string;
  adminUser: string;
  adminPass: string;
  phonePrefix: string;
  runId: string;
  uiStrict: boolean;
  dbCleanup: boolean;
  dbUrl: string;
}

const DEFAULT_ENV: IdentityAcceptanceEnv = {
  apiBaseUrl: process.env.E2E_API_BASE_URL || 'http://localhost:8080/api/v1',
  adminOrigin: process.env.E2E_ADMIN_ORIGIN || 'http://localhost:5173',
  adminUser: process.env.E2E_ADMIN_USER || 'admin',
  adminPass: process.env.E2E_ADMIN_PASS || 'admin123',
  phonePrefix: process.env.E2E_PHONE_PREFIX || '19999',
  runId: process.env.E2E_RUN_ID || `identity_${Date.now()}`,
  uiStrict: process.env.E2E_UI_STRICT === '1',
  dbCleanup: process.env.E2E_DB_CLEANUP === '1',
  dbUrl: process.env.E2E_DB_URL || '',
};

export function getIdentityAcceptanceEnv(): IdentityAcceptanceEnv {
  return DEFAULT_ENV;
}

export function buildTestPhone(prefix: string, runId: string, sequence: number): string {
  const sanitizedPrefix = (prefix || '19999').replace(/\D/g, '') || '19999';
  const runDigits = runId.replace(/\D/g, '').slice(-4).padStart(4, '0');
  const seqDigits = String(sequence).padStart(2, '0');

  let phone = `${sanitizedPrefix}${runDigits}${seqDigits}`;
  if (phone.length < 11) {
    phone = phone.padEnd(11, '7');
  }
  if (phone.length > 11) {
    phone = phone.slice(0, 11);
  }
  if (!phone.startsWith('1')) {
    phone = `1${phone.slice(1)}`;
  }

  return phone;
}

export async function writeRuntimeContext(data: Record<string, unknown>) {
  const target = path.resolve(process.cwd(), 'test-results/identity-run-context.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf8');
}
