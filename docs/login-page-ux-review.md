# 用户 Web 登录页 UI/UX 审查报告

> 审查日期：2026-03-13
> 对象：`web/src/pages/LoginPage.tsx` + `LoginPage.module.scss`
> 参考：`figma/stitch/screen.png`（Figma 设计稿）、`output/user-web-login-current.png`（当前截图）

---

## 一、Critical — 必须修复

### 1.1 协议复选框默认勾选（合规风险）
- **现状**：`useState(true)` — 用户未主动操作即视为同意
- **问题**：违反《个人信息保护法》第14条"同意应当由个人在充分知情的前提下自愿、明确作出"
- **修复**：默认值改为 `false`

### 1.2 表单无 `<form>` 语义
- **现状**：用 `<div className="form-grid">` 包裹，按 Enter 无法提交
- **修复**：包进 `<form onSubmit>`，登录按钮改为 `type="submit"`

### 1.3 成功/错误消息不区分
- **现状**：`pageError` 同时存"验证码已发送"（成功）和错误信息，均用蓝色 `status-note`
- **修复**：拆为 `pageError`（红色）+ `pageSuccess`（绿色）

### 1.4 无障碍属性缺失
- input 缺少 `aria-describedby`、`aria-invalid`
- 验证码按钮外有多余 `<label>` 造成屏幕阅读器重复播报

---

## 二、Important — 应该修复

### 2.1 品牌面板视觉（vs Figma 偏差大）
- **Figma**：深色背景 + 真实家具摄影 → 高端家装氛围
- **现状**：浅蓝渐变 → 看起来通用、缺乏行业感
- **修复**：深色渐变叠加家具摄影背景，文字反转为白色系

### 2.2 卖点图标
- **现状**：单字"约/价/进/信"在小尺寸辨识度低
- **修复**：改为 inline SVG 图标（日历/价签/趋势/消息）

### 2.3 中英文混杂
- "禾泽云出品" + "User Workspace" + "Home Decoration Operating System"
- **修复**：删除英文徽章，eyebrow 改中文或删除

### 2.4 表单文案
- "登录工作台" / "登录到工作台" 是开发者语言
- **修复**：标题改为"登录以查看报价、进度与预约"，按钮改为"登录"

### 2.5 响应式问题
- ≤1180px 品牌面板堆在表单上方，卖点卡片占过多空间
- **修复**：平板端隐藏卖点卡片，品牌面板限高

### 2.6 验证码行布局
- 按钮固定 160px，输入框在小屏被压缩
- **修复**：按钮改为 `auto` 宽度，移动端保持并排

---

## 三、Nice-to-have — 锦上添花

| 项目 | 说明 |
|------|------|
| 自动聚焦 | 页面加载聚焦手机号，发码后跳到验证码 |
| 自动提交 | 验证码满6位 + 已同意协议 → 自动登录 |
| 手机号格式化 | 显示为 `138 0000 0000` |
| 按钮 loading | spinner 动画 |
| debug 验证码分离 | 开发环境用独立 chip 显示，不混入正式消息 |
| 进入动画 | `fadeSlideUp 0.4s`，尊重 `prefers-reduced-motion` |

---

## 原型预览

见 `output/login-page-prototype.html`，浏览器直接打开即可查看优化后效果。
