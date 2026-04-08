import process from 'node:process';

const FEISHU_OPEN_API = process.env.FEISHU_OPEN_BASE_URL || 'https://open.feishu.cn/open-apis';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { raw: await response.text() };

  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.detail || payload?.raw || `HTTP ${response.status}`;
    throw new Error(`Feishu API request failed: ${response.status} ${message}`);
  }

  if (typeof payload.code === 'number' && payload.code !== 0) {
    throw new Error(`Feishu API error: ${payload.code} ${payload.msg || 'unknown error'}`);
  }

  return payload;
}

export class FeishuBitableClient {
  constructor({ appId, appSecret, baseUrl = FEISHU_OPEN_API, fetchImpl = fetch } = {}) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
    this.tenantAccessToken = null;
  }

  requireCredentials() {
    if (!this.appId || !this.appSecret) {
      throw new Error('Missing FEISHU_APP_ID or FEISHU_APP_SECRET');
    }
  }

  async getTenantAccessToken(force = false) {
    this.requireCredentials();
    if (!force && this.tenantAccessToken) {
      return this.tenantAccessToken;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });
    const payload = await parseResponse(response);
    this.tenantAccessToken = payload.tenant_access_token;
    return this.tenantAccessToken;
  }

  async request(path, { body, headers, method = 'GET' } = {}) {
    const token = await this.getTenantAccessToken();
    const signal = AbortSignal.timeout(20_000);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      signal,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return parseResponse(response);
  }

  async createBase({ name, folderToken } = {}) {
    return this.request('/bitable/v1/apps', {
      method: 'POST',
      body: {
        name,
        folder_token: folderToken,
      },
    });
  }

  async listTables({ appToken, pageSize = 100 } = {}) {
    const query = new URLSearchParams();
    query.set('page_size', String(pageSize));
    return this.request(`/bitable/v1/apps/${appToken}/tables?${query.toString()}`);
  }

  async createTable({ appToken, name }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables`, {
      method: 'POST',
      body: {
        table: {
          name,
        },
      },
    });
  }

  async updateTable({ appToken, tableId, name }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}`, {
      method: 'PATCH',
      body: { name },
    });
  }

  async createField({ appToken, tableId, field }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, {
      method: 'POST',
      body: field,
    });
  }

  async createView({ appToken, tableId, view }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/views`, {
      method: 'POST',
      body: {
        view_name: view.view_name,
        view_type: view.view_type || 'grid',
      },
    });
  }

  async listViews({ appToken, tableId, pageSize = 100 } = {}) {
    const query = new URLSearchParams();
    query.set('page_size', String(pageSize));
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/views?${query.toString()}`);
  }

  async updateView({ appToken, tableId, viewId, payload }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/views/${viewId}`, {
      method: 'PATCH',
      body: payload,
    });
  }

  async deleteView({ appToken, tableId, viewId }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/views/${viewId}`, {
      method: 'DELETE',
    });
  }

  async listRecords({ appToken, tableId, filter, pageSize = 100 } = {}) {
    const query = new URLSearchParams();
    query.set('page_size', String(pageSize));
    if (filter) {
      query.set('filter', filter);
    }
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/records?${query.toString()}`);
  }

  async createRecord({ appToken, tableId, fields }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: 'POST',
      body: {
        fields,
      },
    });
  }

  async updateRecord({ appToken, tableId, recordId, fields }) {
    return this.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`, {
      method: 'PUT',
      body: {
        fields,
      },
    });
  }

  async upsertRecord({ appToken, tableId, uniqueFieldName, uniqueFieldValue, fields }) {
    const escaped = String(uniqueFieldValue).replaceAll('"', '\\"');
    const listed = await this.listRecords({
      appToken,
      tableId,
      filter: `CurrentValue.[${uniqueFieldName}] = "${escaped}"`,
      pageSize: 1,
    });

    const existing = listed?.data?.items?.[0];
    if (existing?.record_id) {
      return this.updateRecord({
        appToken,
        tableId,
        recordId: existing.record_id,
        fields,
      });
    }

    return this.createRecord({ appToken, tableId, fields });
  }
}

export function readFeishuEnv() {
  return {
    appId: process.env.FEISHU_APP_ID || '',
    appSecret: process.env.FEISHU_APP_SECRET || '',
    folderToken: process.env.FEISHU_FOLDER_TOKEN || '',
    baseName: process.env.FEISHU_BITABLE_NAME || 'home-decoration 问题提报与协同底座',
  };
}
