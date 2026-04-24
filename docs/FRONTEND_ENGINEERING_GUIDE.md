# 前端工程约束指南

本指南约束 `admin/`、`merchant/`、`web/`、`website/`、`mini/`、`mobile/` 的后续前端开发。短硬规则见根目录 `AGENTS.md`；这里解释如何落地。

## 1. Design Tokens

唯一源头是 `shared/design-tokens/tokens.json`。不要在业务代码里新增 Hex、RGB、HSL 色值，也不要临时发明 spacing、radius、shadow。

更新流程：

```bash
npm run gen:tokens
```

生成产物：

- `admin/src/styles/theme.ts`
- `merchant/src/styles/theme.ts`
- `merchant/src/constants/merchantTheme.ts`
- `web/src/app/tokens.css`
- `website/styles/tokens.css`
- `mini/src/theme/tokens.ts`
- `mini/src/theme/tokens.scss`
- `mobile/src/theme/tokens.ts`
- `mobile/src/theme/tokens.raw.ts`

这些文件是生成文件，不手改。要改颜色、字号、间距、圆角、阴影，先改 `tokens.json`。

## 2. Component Rules

### admin / merchant

- 使用 Ant Design 5 和本端已有 PageShell、Header、ContentPanel、StatusTag 等组件。
- 不新增其他 UI 框架。
- 业务页不要用 raw `<button>` 伪造按钮；按钮、表单、弹窗、表格动作走 AntD 或本端封装。
- `merchant` 统一通过 `merchant/src/styles/theme.ts` 注入 AntD theme；`admin` 统一通过 `admin/src/styles/theme.ts` 注入 AntD theme。

### web / website

- 使用生成的 CSS variables：`var(--color-*)`、`var(--space-*)`、`var(--radius-*)`、`var(--shadow-*)`。
- 新增业务按钮、状态块、详情卡、弹窗时，优先抽到 `web/src/components` 或 website 局部公共样式，不在页面里重复拼。
- 允许纯展示页有自己的布局节奏，但视觉值仍必须来自 token。

### mini

- 页面层优先使用 `mini/src/components` 里的 `Button`、`Input`、`Card`、`Empty`、`Skeleton`、`Tabs`、`Tag`、`MiniPageNav`。
- 只有这些原子组件内部可以直接使用 Taro 原生 `Button/Input` 等控件。
- SCSS 使用 `$color-*`、`$spacing-*`、`$radius-*`、`$font-*`。

### mobile

- 页面层使用 `mobile/src/components/primitives` 的 `AppButton`、`AppTextField`、`SurfaceCard`。
- 只有 primitives 内部可以直接使用 React Native `Pressable`、`Touchable*`、`TextInput` 来构造业务控件。
- 样式值使用 `mobile/src/theme/tokens.ts` 的 `colors`、`spacing`、`radii`、`typography`、`shadows`。

## 3. Mobile Visual Baseline

`mini/` 和 `mobile/` 不按 Android Material 与 iOS 双风格分叉，默认统一走 iOS-like 简洁风格：

- 白底和浅灰分层为主，少用大面积品牌色背景。
- 状态色低饱和且只服务语义。
- 轻边框、少阴影，避免重投影和强玻璃拟态。
- 底部主操作贴近安全区，单屏只有一个主 CTA。
- 保留平台必要差异：安全区、状态栏、原生导航能力、微信小程序限制。
- 不做 Android Material 专属大色块、FAB 泛滥、复杂长按/左滑手势依赖；需要手势时必须提供可点击替代操作。

## 4. Style Guard

检查命令：

```bash
npm run check:frontend-style
npm run check:frontend-style -- --scope admin
npm run check:frontend-style -- --scope merchant
npm run check:frontend-style -- --scope web
npm run check:frontend-style -- --scope website
npm run check:frontend-style -- --scope mini
npm run check:frontend-style -- --scope mobile
```

门禁做两件事：

- stylelint 做 CSS/SCSS 基础语法检查。
- `scripts/frontend-style-guard.mjs` 用 `scripts/frontend-style-baseline.json` 阻止新增硬编码颜色、inline style、raw 控件用法。

基线只用于承认历史债务，不代表推荐写法。只有在迁移旧页面或明确保留 legacy debt 时才更新：

```bash
node scripts/frontend-style-guard.mjs --scope <scope> --update-baseline
```

更新基线的提交说明必须写清楚原因。

## 5. UI Change Checklist

任何用户可见 UI 改动，交付前至少自查：

- 加载态
- 空态
- 错误态
- 禁用态
- 多项数据
- 长文本
- 窄屏
- 无输入/缺字段
- 按钮和底部操作不漂移
- 容器不被内容撑破

验证时从最小命令开始：

- `npm run check:frontend-style -- --scope <scope>`
- 对应端 `build` / `lint` / `typecheck`
- 需要真实交互时再跑 Playwright 或设备端验证
