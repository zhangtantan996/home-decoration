#!/usr/bin/env node
import process from 'node:process';
import { FeishuBitableClient, readFeishuEnv } from './bitable-client.mjs';
import { baseSchema, summarizeSchema } from './bitable-schema.mjs';

const TABLE_NAME_ALIASES = new Map([
  ['问题池', ['问题池', 'Issues']],
  ['项目协同', ['项目协同', 'Projects']],
  ['成员目录', ['成员目录', 'Members']],
  ['验证记录', ['验证记录', 'Verifications']],
]);

const VIEW_NAME_ALIASES = new Map([
  ['按负责人', ['按负责人', '按负责人-测试']],
]);

const VIEW_FILTER_SPECS = {
  问题池: {
    待我处理: {
      conjunction: 'or',
      conditions: [
        { field_name: '状态', field_type: 3, operator: 'is', option_names: ['待分派'] },
        { field_name: '状态', field_type: 3, operator: 'is', option_names: ['进行中'] },
      ],
    },
    待我验证: {
      conjunction: 'and',
      conditions: [
        { field_name: '状态', field_type: 3, operator: 'is', option_names: ['待验证'] },
      ],
    },
    'P0/P1': {
      conjunction: 'or',
      conditions: [
        { field_name: '优先级', field_type: 3, operator: 'is', option_names: ['P0'] },
        { field_name: '优先级', field_type: 3, operator: 'is', option_names: ['P1'] },
      ],
    },
    阻塞项: {
      conjunction: 'and',
      conditions: [
        { field_name: '状态', field_type: 3, operator: 'is', option_names: ['阻塞'] },
      ],
    },
    已解决待关闭: {
      conjunction: 'and',
      conditions: [
        { field_name: '状态', field_type: 3, operator: 'is', option_names: ['已解决'] },
      ],
    },
  },
  项目协同: {
    阻塞与风险: {
      conjunction: 'or',
      conditions: [
        { field_name: '阶段', field_type: 3, operator: 'is', option_names: ['阻塞'] },
        { field_name: '风险等级', field_type: 3, operator: 'is', option_names: ['高'] },
      ],
    },
  },
  验证记录: {
    待验证: {
      conjunction: 'and',
      conditions: [
        { field_name: '结果', field_type: 3, operator: 'is', option_names: ['阻塞'] },
      ],
    },
    验证失败: {
      conjunction: 'and',
      conditions: [
        { field_name: '结果', field_type: 3, operator: 'is', option_names: ['失败'] },
      ],
    },
    最近通过: {
      conjunction: 'and',
      conditions: [
        { field_name: '结果', field_type: 3, operator: 'is', option_names: ['通过'] },
      ],
    },
  },
};

function logProgress(message) {
  console.error(`[feishu-bitable] ${message}`);
}

function printUsage() {
  console.log(`Usage:
  node scripts/feishu/setup-bitable-issue-base.mjs --dry-run
  node scripts/feishu/setup-bitable-issue-base.mjs --create
  node scripts/feishu/setup-bitable-issue-base.mjs --sync-existing --app-token <appToken>

Environment:
  FEISHU_APP_ID
  FEISHU_APP_SECRET
  FEISHU_FOLDER_TOKEN (optional)
  FEISHU_BITABLE_NAME (optional)
`);
}

function readArgs(argv) {
  const args = argv.slice(2);
  const result = {
    appToken: '',
    create: false,
    dryRun: false,
    syncExisting: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === '--create') {
      result.create = true;
      continue;
    }
    if (value === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (value === '--sync-existing') {
      result.syncExisting = true;
      continue;
    }
    if (value === '--app-token') {
      result.appToken = args[index + 1] || '';
      index += 1;
      continue;
    }
    if (value === '--help' || value === '-h') {
      result.help = true;
    }
  }

  if (!result.create && !result.syncExisting) {
    result.dryRun = true;
  }

  return result;
}

function requireAppToken(appToken) {
  if (!appToken) {
    throw new Error('Missing --app-token or FEISHU_BITABLE_APP_TOKEN');
  }
}

function buildAliasMap() {
  const map = new Map();
  for (const [canonical, aliases] of TABLE_NAME_ALIASES.entries()) {
    for (const alias of aliases) {
      map.set(alias, canonical);
    }
  }
  return map;
}

function canonicalizeViewName(viewName) {
  for (const [canonical, aliases] of VIEW_NAME_ALIASES.entries()) {
    if (aliases.includes(viewName)) {
      return canonical;
    }
  }
  return viewName;
}

function mapByName(items, nameKey = 'name') {
  return new Map(items.map((item) => [item[nameKey], item]));
}

function buildSelectValue(field, optionNames) {
  const optionIds = optionNames.map((name) => {
    const option = field?.property?.options?.find((item) => item.name === name);
    if (!option?.id) {
      throw new Error(`Missing option "${name}" on field "${field?.field_name || 'unknown'}"`);
    }
    return option.id;
  });

  return JSON.stringify(optionIds);
}

function buildFilterPayload(tableName, viewName, fieldsByName) {
  const spec = VIEW_FILTER_SPECS[tableName]?.[viewName];
  if (!spec) {
    return null;
  }

  return {
    filter_info: {
      conjunction: spec.conjunction,
      conditions: spec.conditions.map((condition) => {
        const field = fieldsByName.get(condition.field_name);
        if (!field?.field_id) {
          throw new Error(`Missing field "${condition.field_name}" on table "${tableName}"`);
        }

        return {
          field_id: field.field_id,
          field_type: condition.field_type,
          operator: condition.operator,
          value: buildSelectValue(field, condition.option_names),
        };
      }),
    },
  };
}

async function ensureFields(client, appToken, tableId, tableSchema) {
  const response = await client.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`);
  const fields = response?.data?.items || [];
  const fieldsByName = mapByName(fields, 'field_name');

  for (const field of tableSchema.fields) {
    if (fieldsByName.has(field.field_name)) {
      continue;
    }
    logProgress(`creating missing field "${field.field_name}" on table "${tableSchema.name}"`);
    await client.createField({ appToken, tableId, field });
  }

  const refreshed = await client.request(`/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=100`);
  return mapByName(refreshed?.data?.items || [], 'field_name');
}

async function ensureViews(client, appToken, tableId, tableSchema, fieldsByName) {
  const listed = await client.listViews({ appToken, tableId });
  const existingViews = listed?.data?.items || [];

  for (const view of existingViews) {
    if (view.view_name === '表格视图 1') {
      logProgress(`deleting bootstrap view on table "${tableSchema.name}"`);
      await client.deleteView({ appToken, tableId, viewId: view.view_id });
    }
  }

  const refreshed = await client.listViews({ appToken, tableId });
  const currentViews = refreshed?.data?.items || [];
  const canonicalViewMap = new Map();
  for (const view of currentViews) {
    canonicalViewMap.set(canonicalizeViewName(view.view_name), view);
  }

  for (const desiredView of tableSchema.views) {
    let targetView = canonicalViewMap.get(desiredView.view_name);
    if (!targetView) {
      logProgress(`creating missing view "${desiredView.view_name}" on table "${tableSchema.name}"`);
      await client.createView({
        appToken,
        tableId,
        view: desiredView,
      });
    }
  }

  const finalList = await client.listViews({ appToken, tableId });
  const finalViews = finalList?.data?.items || [];
  const finalMap = new Map();
  for (const view of finalViews) {
    finalMap.set(canonicalizeViewName(view.view_name), view);
  }

  for (const desiredView of tableSchema.views) {
    const view = finalMap.get(desiredView.view_name);
    if (!view?.view_id) {
      throw new Error(`Missing view "${desiredView.view_name}" on table "${tableSchema.name}"`);
    }

    const property = buildFilterPayload(tableSchema.name, desiredView.view_name, fieldsByName);
    const payload = { view_name: desiredView.view_name };
    if (property) {
      payload.property = property;
    }

    if (view.view_name !== desiredView.view_name || property) {
      logProgress(`updating view "${desiredView.view_name}" on table "${tableSchema.name}"`);
      await client.updateView({
        appToken,
        tableId,
        viewId: view.view_id,
        payload,
      });
    }
  }

  const synced = await client.listViews({ appToken, tableId });
  return synced?.data?.items || [];
}

async function createBaseFromSchema() {
  const env = readFeishuEnv();
  const client = new FeishuBitableClient(env);

  let createdBase;
  let folderFallback = false;
  try {
    logProgress(`creating base "${env.baseName || baseSchema.baseName}"`);
    createdBase = await client.createBase({
      name: env.baseName || baseSchema.baseName,
      folderToken: env.folderToken || undefined,
    });
  } catch (error) {
    if (env.folderToken && /DriveNodePermNotAllow/.test(error.message)) {
      folderFallback = true;
      logProgress('folder token not allowed for app, retrying without folder token');
      createdBase = await client.createBase({
        name: env.baseName || baseSchema.baseName,
      });
    } else {
      throw error;
    }
  }
  const appToken = createdBase?.data?.app?.app_token || createdBase?.data?.app_token;
  const defaultTableId = createdBase?.data?.app?.default_table_id;
  const baseUrl = createdBase?.data?.app?.url || '';
  if (!appToken) {
    throw new Error('Feishu did not return app_token when creating the bitable base');
  }

  const createdTables = [];
  for (const table of baseSchema.tables) {
    logProgress(`creating table "${table.name}"`);
    const createdTable = await client.createTable({
      appToken,
      name: table.name,
    });
    const tableId = createdTable?.data?.table_id || createdTable?.data?.table?.table_id;
    if (!tableId) {
      throw new Error(`Feishu did not return table_id for table ${table.name}`);
    }

    const fieldsByName = await ensureFields(client, appToken, tableId, table);
    const views = await ensureViews(client, appToken, tableId, table, fieldsByName);

    createdTables.push({
      name: table.name,
      tableId,
      fieldCount: fieldsByName.size,
      viewCount: views.length,
    });
  }

  if (defaultTableId) {
    logProgress('deleting default bootstrap table');
    await client.request(`/bitable/v1/apps/${appToken}/tables/${defaultTableId}`, {
      method: 'DELETE',
    });
  }

  return {
    appToken,
    baseUrl,
    baseName: env.baseName || baseSchema.baseName,
    folderFallback,
    defaultTableDeleted: Boolean(defaultTableId),
    tables: createdTables,
  };
}

async function syncExistingBase(appToken) {
  requireAppToken(appToken);
  const env = readFeishuEnv();
  const client = new FeishuBitableClient(env);
  const aliasMap = buildAliasMap();
  const listed = await client.listTables({ appToken });
  const existingTables = listed?.data?.items || [];
  const canonicalTables = new Map();
  const untouchedTables = [];

  for (const table of existingTables) {
    const canonicalName = aliasMap.get(table.name);
    if (canonicalName) {
      canonicalTables.set(canonicalName, table);
    } else {
      untouchedTables.push({ name: table.name, tableId: table.table_id });
    }
  }

  const syncedTables = [];
  for (const tableSchema of baseSchema.tables) {
    let table = canonicalTables.get(tableSchema.name);
    if (!table) {
      logProgress(`creating missing table "${tableSchema.name}"`);
      const created = await client.createTable({ appToken, name: tableSchema.name });
      table = {
        name: tableSchema.name,
        table_id: created?.data?.table_id || created?.data?.table?.table_id,
      };
    }

    if (table.name !== tableSchema.name) {
      logProgress(`renaming table "${table.name}" -> "${tableSchema.name}"`);
      await client.updateTable({
        appToken,
        tableId: table.table_id,
        name: tableSchema.name,
      });
    }

    const fieldsByName = await ensureFields(client, appToken, table.table_id, tableSchema);
    const views = await ensureViews(client, appToken, table.table_id, tableSchema, fieldsByName);

    syncedTables.push({
      name: tableSchema.name,
      tableId: table.table_id,
      fieldCount: fieldsByName.size,
      viewCount: views.length,
    });
  }

  return {
    appToken,
    syncedTables,
    untouchedTables,
  };
}

async function main() {
  const args = readArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  if (args.dryRun) {
    console.log(JSON.stringify(summarizeSchema(baseSchema), null, 2));
    return;
  }

  if (args.syncExisting) {
    const appToken = args.appToken || process.env.FEISHU_BITABLE_APP_TOKEN || '';
    const result = await syncExistingBase(appToken);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await createBaseFromSchema();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
