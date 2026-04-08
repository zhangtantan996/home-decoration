#!/usr/bin/env node
import process from 'node:process';
import { FeishuBitableClient, readFeishuEnv } from './bitable-client.mjs';

const TABLE_ALIASES = {
  成员目录: ['成员目录', 'Members'],
  项目协同: ['项目协同', 'Projects'],
  问题池: ['问题池', 'Issues'],
  验证记录: ['验证记录', 'Verifications'],
};

function parseArgs(argv) {
  const args = argv.slice(2);
  const result = { appToken: process.env.FEISHU_BITABLE_APP_TOKEN || '' };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--app-token') {
      result.appToken = args[index + 1] || '';
      index += 1;
    }
  }
  return result;
}

function requireAppToken(appToken) {
  if (!appToken) {
    throw new Error('Missing FEISHU_BITABLE_APP_TOKEN or --app-token');
  }
}

function nowPlusDays(days) {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

async function mapTablesByName(client, appToken) {
  const response = await client.listTables({ appToken });
  const items = response?.data?.items || [];
  return new Map(items.map((item) => [item.name, item.table_id]));
}

function getTableId(tables, canonicalName) {
  for (const alias of TABLE_ALIASES[canonicalName] || [canonicalName]) {
    const tableId = tables.get(alias);
    if (tableId) {
      return tableId;
    }
  }
  throw new Error(`Missing table: ${canonicalName}`);
}

async function seedMembers(client, appToken, tableId) {
  const members = [
    {
      key: '张三',
      fields: {
        成员名: '张三',
        角色: '前端',
        负责模块: ['web', 'mini'],
        飞书用户标识: 'demo.frontend',
        可指派状态: true,
      },
    },
    {
      key: '李四',
      fields: {
        成员名: '李四',
        角色: '后端',
        负责模块: ['server', 'deploy'],
        飞书用户标识: 'demo.backend',
        可指派状态: true,
      },
    },
    {
      key: '王五',
      fields: {
        成员名: '王五',
        角色: '测试',
        负责模块: ['tests/e2e', 'web'],
        飞书用户标识: 'demo.qa',
        可指派状态: true,
      },
    },
  ];

  for (const member of members) {
    await client.upsertRecord({
      appToken,
      tableId,
      uniqueFieldName: '成员名',
      uniqueFieldValue: member.key,
      fields: member.fields,
    });
  }
}

async function seedProjects(client, appToken, tableId) {
  const projects = [
    {
      key: '用户侧 Web 身份验收',
      fields: {
        项目项名称: '用户侧 Web 身份验收',
        所属模块: ['web', 'server', 'tests/e2e'],
        阶段: '进行中',
        计划日期: nowPlusDays(-1),
        截止日期: nowPlusDays(3),
        风险等级: '高',
        关联问题: 'HD-ISSUE-0001, HD-ISSUE-0002',
      },
    },
    {
      key: '商家端入驻冒烟',
      fields: {
        项目项名称: '商家端入驻冒烟',
        所属模块: ['merchant', 'tests/e2e'],
        阶段: '待验收',
        计划日期: nowPlusDays(-2),
        截止日期: nowPlusDays(2),
        风险等级: '中',
        关联问题: 'HD-ISSUE-0003',
      },
    },
    {
      key: '发布前部署核查',
      fields: {
        项目项名称: '发布前部署核查',
        所属模块: ['deploy', 'server', 'ops'],
        阶段: '阻塞',
        计划日期: nowPlusDays(-3),
        截止日期: nowPlusDays(1),
        风险等级: '高',
        关联问题: 'HD-ISSUE-0004, HD-ISSUE-0006',
      },
    },
    {
      key: '小程序首页体验优化',
      fields: {
        项目项名称: '小程序首页体验优化',
        所属模块: ['mini', 'web'],
        阶段: '待开始',
        计划日期: nowPlusDays(1),
        截止日期: nowPlusDays(5),
        风险等级: '低',
        关联问题: 'HD-ISSUE-0005',
      },
    },
  ];

  for (const project of projects) {
    await client.upsertRecord({
      appToken,
      tableId,
      uniqueFieldName: '项目项名称',
      uniqueFieldValue: project.key,
      fields: project.fields,
    });
  }
}

async function seedIssues(client, appToken, tableId) {
  const issues = [
    {
      key: 'HD-ISSUE-0001',
      fields: {
        编号: 'HD-ISSUE-0001',
        标题: '用户侧登录后首页状态不同步',
        类型: '缺陷',
        来源: '测试',
        模块: ['web', 'server'],
        业务域: ['身份', '多端一致性'],
        优先级: 'P0',
        严重度: '阻断',
        状态: '进行中',
        计划开始时间: nowPlusDays(-1),
        截止时间: nowPlusDays(1),
        关联项目任务: '用户侧 Web 身份验收',
        验证状态: '验证中',
      },
    },
    {
      key: 'HD-ISSUE-0002',
      fields: {
        编号: 'HD-ISSUE-0002',
        标题: '身份验收报告缺少失败摘要归档',
        类型: '任务',
        来源: '会议',
        模块: ['ops', 'tests/e2e'],
        业务域: ['身份'],
        优先级: 'P1',
        严重度: '中',
        状态: '待验证',
        计划开始时间: nowPlusDays(-1),
        截止时间: nowPlusDays(2),
        关联项目任务: '用户侧 Web 身份验收',
        验证状态: '未验证',
      },
    },
    {
      key: 'HD-ISSUE-0003',
      fields: {
        编号: 'HD-ISSUE-0003',
        标题: '商家端入驻页手机号校验提示不一致',
        类型: '问题提报',
        来源: '用户反馈',
        模块: ['merchant'],
        业务域: ['公网 Web'],
        优先级: 'P1',
        严重度: '高',
        状态: '待分派',
        计划开始时间: nowPlusDays(0),
        截止时间: nowPlusDays(3),
        关联项目任务: '商家端入驻冒烟',
        验证状态: '未验证',
      },
    },
    {
      key: 'HD-ISSUE-0004',
      fields: {
        编号: 'HD-ISSUE-0004',
        标题: '部署脚本缺少回滚提示',
        类型: '风险',
        来源: '自动巡检',
        模块: ['deploy', 'server'],
        业务域: ['部署'],
        优先级: 'P2',
        严重度: '中',
        状态: '阻塞',
        计划开始时间: nowPlusDays(-3),
        截止时间: nowPlusDays(5),
        关联项目任务: '发布前检查',
        验证状态: '未验证',
      },
    },
    {
      key: 'HD-ISSUE-0005',
      fields: {
        编号: 'HD-ISSUE-0005',
        标题: '小程序首页瀑布流首屏图片加载抖动',
        类型: '任务',
        来源: '会议',
        模块: ['mini'],
        业务域: ['公网 Web'],
        优先级: 'P2',
        严重度: '低',
        状态: '已解决',
        计划开始时间: nowPlusDays(-4),
        截止时间: nowPlusDays(-1),
        实际完成时间: nowPlusDays(-1),
        关联项目任务: '小程序首页体验优化',
        验证状态: '验证通过',
      },
    },
    {
      key: 'HD-ISSUE-0006',
      fields: {
        编号: 'HD-ISSUE-0006',
        标题: '生产环境 Nginx 静态资源缓存策略待确认',
        类型: '风险',
        来源: '手工提报',
        模块: ['deploy', 'web'],
        业务域: ['部署', '公网 Web'],
        优先级: 'P1',
        严重度: '高',
        状态: '阻塞',
        计划开始时间: nowPlusDays(-2),
        截止时间: nowPlusDays(2),
        关联项目任务: '发布前部署核查',
        验证状态: '未验证',
      },
    },
    {
      key: 'HD-ISSUE-0007',
      fields: {
        编号: 'HD-ISSUE-0007',
        标题: '后台审核列表状态标签文案需要统一',
        类型: '需求澄清',
        来源: '会议',
        模块: ['admin'],
        业务域: ['其他'],
        优先级: 'P3',
        严重度: '低',
        状态: '已关闭',
        计划开始时间: nowPlusDays(-6),
        截止时间: nowPlusDays(-5),
        实际完成时间: nowPlusDays(-5),
        关联项目任务: '管理后台审核体验梳理',
        验证状态: '验证通过',
      },
    },
  ];

  for (const issue of issues) {
    await client.upsertRecord({
      appToken,
      tableId,
      uniqueFieldName: '编号',
      uniqueFieldValue: issue.key,
      fields: issue.fields,
    });
  }
}

async function seedVerifications(client, appToken, tableId) {
  const verifications = [
    {
      key: '身份验收-2026-04-02',
      fields: {
        验证名称: '身份验收-2026-04-02',
        关联问题: 'HD-ISSUE-0001, HD-ISSUE-0002',
        关联项目项: '用户侧 Web 身份验收',
        验证类型: '接口',
        结果: '通过',
        执行时间: nowPlusDays(0),
        '相关命令/入口': 'npm run test:identity:acceptance',
      },
    },
    {
      key: '商家端冒烟-2026-04-02',
      fields: {
        验证名称: '商家端冒烟-2026-04-02',
        关联问题: 'HD-ISSUE-0003',
        关联项目项: '商家端入驻冒烟',
        验证类型: 'E2E',
        结果: '失败',
        执行时间: nowPlusDays(0),
        '相关命令/入口': 'npm run test:e2e:merchant:smoke',
      },
    },
    {
      key: '用户侧验证包-2026-04-02',
      fields: {
        验证名称: '用户侧验证包-2026-04-02',
        关联问题: 'HD-ISSUE-0001',
        关联项目项: '用户侧 Web 身份验收',
        验证类型: '回归',
        结果: '阻塞',
        执行时间: nowPlusDays(0),
        '相关命令/入口': 'npm run verify:user-web',
      },
    },
    {
      key: '小程序首页优化回归-2026-04-03',
      fields: {
        验证名称: '小程序首页优化回归-2026-04-03',
        关联问题: 'HD-ISSUE-0005',
        关联项目项: '小程序首页体验优化',
        验证类型: '回归',
        结果: '通过',
        执行时间: nowPlusDays(0),
        '相关命令/入口': 'npm run verify:user-web',
      },
    },
    {
      key: '部署前检查-2026-04-03',
      fields: {
        验证名称: '部署前检查-2026-04-03',
        关联问题: 'HD-ISSUE-0004, HD-ISSUE-0006',
        关联项目项: '发布前部署核查',
        验证类型: '手工',
        结果: '阻塞',
        执行时间: nowPlusDays(0),
        '相关命令/入口': 'cd server && make test',
      },
    },
  ];

  for (const verification of verifications) {
    await client.upsertRecord({
      appToken,
      tableId,
      uniqueFieldName: '验证名称',
      uniqueFieldValue: verification.key,
      fields: verification.fields,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv);
  requireAppToken(args.appToken);
  const env = readFeishuEnv();
  const client = new FeishuBitableClient(env);
  const tables = await mapTablesByName(client, args.appToken);

  await seedMembers(client, args.appToken, getTableId(tables, '成员目录'));
  await seedProjects(client, args.appToken, getTableId(tables, '项目协同'));
  await seedIssues(client, args.appToken, getTableId(tables, '问题池'));
  await seedVerifications(client, args.appToken, getTableId(tables, '验证记录'));

  console.log(JSON.stringify({
    appToken: args.appToken,
    seeded: ['成员目录', '项目协同', '问题池', '验证记录'],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
