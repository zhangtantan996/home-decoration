# 微信小程序与App UI一致性实施计划

## TL;DR
> **Summary**: 建立跨平台Design Tokens系统，统一Mobile和Mini的颜色/间距/圆角/字体，实现UI布局完全一致
> **Deliverables**: 
> - shared/design-tokens/系统（JSON源文件 + 生成脚本）
> - mobile/src/theme/tokens.ts（自动生成）
> - 10个Mobile组件文件的样式值替换（约750处）
> **Effort**: Medium（2个工作日，18小时）
> **Parallel**: YES - 3 waves
> **Critical Path**: Token系统建立 → HomeScreen pilot验证 → 批量替换其他文件

## Context

### Original Request
用户需求："我需要开发微信小程序，然后想让微信小程序的页面ui和app的页面ui布局完全一致，希望你真对现在的项目设计开发方案和技术框架"

### Interview Summary
**用户明确的需求**:
1. 只改颜色和间距，不涉及组件逻辑、框架、业务代码
2. 优先处理首页 + 详情页
3. 接受重构Mobile代码（纯样式值替换）
4. Mini保持现状，不需要重构现有代码

**技术决策**:
- 建立单一数据源JSON → 生成RN/Taro tokens → 替换Mobile硬编码值
- Mini的tokens.ts和tokens.scss存在不一致，手动审查后创建新JSON作为权威源
- 生成两套token：对象格式（常规样式）+ 字符串格式（RN动画）
- 先做HomeScreen作为pilot，验证后批量处理其他文件

**工作量评估**:
- Mobile HomeScreen: 257处样式属性
- 总计约10个文件，750处样式值
- 预计1-2天开发时间

### Metis Review (gaps addressed)
**关键风险已识别**:
1. ✅ Mini token数据源冲突 → 解决方案：手动审查创建新JSON
2. ✅ 动画颜色格式不兼容 → 解决方案：生成两套token（对象+字符串）
3. ✅ TypeScript类型安全 → 解决方案：生成脚本输出类型定义
4. ✅ 作用域蔓延风险 → 解决方案：明确Must NOT Have列表

**Metis建议已采纳**:
- Pilot阶段必须验证：静态样式、动画颜色、TypeScript类型、视觉对比
- 每个文件替换后立即运行lint和test
- 使用ast_grep_search查找所有硬编码样式值
- 替换前运行测试作为baseline，替换后对比结果

## Work Objectives

### Core Objective
实现微信小程序与React Native App的UI布局完全一致，通过统一的Design Tokens系统管理颜色、间距、圆角、字体，确保两端视觉效果像素级同步。

### Deliverables
1. **跨平台Design Tokens系统**
   - `shared/design-tokens/tokens.json`（单一数据源）
   - `shared/design-tokens/scripts/generate-rn.js`（生成RN tokens）
   - `shared/design-tokens/scripts/generate-taro.js`（生成Taro tokens）
   - `shared/design-tokens/README.md`（使用文档）

2. **Mobile端tokens文件**
   - `mobile/src/theme/tokens.ts`（自动生成，包含类型定义）
   - `mobile/src/theme/tokens.raw.ts`（动画专用字符串格式）

3. **重构的Mobile组件**（样式值替换）
   - HomeScreen.tsx（pilot）
   - DesignerCard.tsx, WorkerCard.tsx, MaterialShopCard.tsx
   - ProviderDetailScreen.tsx及相关组件

4. **验证产物**
   - 测试对比报告（替换前后）
   - 硬编码值清除报告
   - 视觉对比截图（可选）

### Definition of Done (verifiable conditions with commands)
```bash
# 1. Token系统生成成功
cat shared/design-tokens/tokens.json | jq empty  # JSON格式正确
cd mobile && npx tsc --noEmit src/theme/tokens.ts  # TS类型检查通过

# 2. 所有硬编码颜色值已清除
cd mobile && ! grep -r "color: ['\"]#" src/screens/HomeScreen.tsx src/components/DesignerCard.tsx  # 无匹配

# 3. TypeScript编译通过
cd mobile && npx tsc --noEmit  # 无类型错误

# 4. ESLint检查通过
cd mobile && npm run lint  # 退出码0

# 5. 测试套件通过（无回归）
cd mobile && npm test  # 所有测试通过

# 6. Mini视觉效果无变化（生成新tokens后）
cd mini && npm run dev:weapp  # 手动验证首页视觉与之前一致
```

### Must Have
- ✅ 单一数据源JSON（colors, spacing, radii, typography）
- ✅ 自动生成脚本（RN和Taro）
- ✅ TypeScript类型定义（防止拼写错误）
- ✅ 两套token格式（对象 + 字符串）
- ✅ HomeScreen pilot验证（静态样式 + 动画）
- ✅ 所有硬编码值替换为token引用
- ✅ 测试无回归（lint + test通过）

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- ❌ 不修改组件业务逻辑、状态管理、事件处理
- ❌ 不改变组件DOM结构或层级关系
- ❌ 不统一图标系统（lucide vs NutUI保持独立）
- ❌ 不添加新的依赖包（除生成脚本必需的且用户批准）
- ❌ 不重构Mini现有代码（Mini保持现状）
- ❌ 不改变React Native版本、导航系统、UI组件库
- ❌ 不优化组件性能、不添加新功能
- ❌ 不创建Storybook或文档站点（仅README）

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.

- **Test decision**: 无需新增测试，使用现有测试套件验证无回归
- **QA policy**: 每个task都有agent-executed验证命令
- **Evidence**: 
  - `.sisyphus/evidence/task-1-tokens-json.txt`（tokens.json内容）
  - `.sisyphus/evidence/task-2-pilot-lint.txt`（HomeScreen lint结果）
  - `.sisyphus/evidence/task-3-batch-test.txt`（批量替换后测试结果）
  - `.sisyphus/evidence/task-4-final-report.md`（最终验证报告）

## Execution Strategy

### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

**Wave 1: Token系统建立**（2 tasks，串行）
- Task 1: 审查Mini tokens差异，创建tokens.json
- Task 2: 编写生成脚本，生成mobile/src/theme/tokens.ts

**Wave 2: Pilot验证**（1 task）
- Task 3: 替换HomeScreen.tsx，完整验证流程

**Wave 3: 批量替换**（6 tasks，可并行）
- Task 4: 替换卡片组件（DesignerCard, WorkerCard, MaterialShopCard）
- Task 5: 替换详情页（ProviderDetailScreen）
- Task 6: 替换其他首页相关组件（3-5个文件）
- Task 7: 替换其他详情页相关组件（2-3个文件）
- Task 8: 最终验证和报告生成
- Task 9: 清理和文档更新

### Dependency Matrix (full, all tasks)
```
Task 1 (审查tokens) → Task 2 (生成脚本)
Task 2 (生成脚本) → Task 3 (Pilot)
Task 3 (Pilot) → Task 4, 5, 6, 7 (批量替换，可并行)
Task 4, 5, 6, 7 → Task 8 (最终验证)
Task 8 → Task 9 (清理文档)
```

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1: 2 tasks → quick (审查) + quick (脚本)
- Wave 2: 1 task → unspecified-high (pilot验证)
- Wave 3: 6 tasks → quick (4个替换) + unspecified-high (验证) + quick (文档)

## TODOs

- [x] 1. 审查Mini tokens差异，创建权威JSON源文件

  **What to do**:
  1. 对比`mini/src/theme/tokens.ts`和`mini/src/theme/tokens.scss`的差异
  2. 识别不一致的值（如spacing: ts用20/24，scss用24/32）
  3. 以Mini实际渲染效果为准，创建`shared/design-tokens/tokens.json`
  4. JSON结构：`{ colors: {...}, spacing: {...}, radii: {...}, typography: {...} }`
  5. 确保包含所有必需的token（primary, secondary, bgPage, bgCard等）

  **Must NOT do**:
  - 不添加Mini或Mobile当前未使用的token
  - 不改变Mini现有的视觉效果
  - 不创建嵌套超过2层的JSON结构

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 纯数据整理，无复杂逻辑
  - Skills: [] — Reason: 不需要特殊技能
  - Omitted: [`git-master`] — Reason: 仅创建新文件，无git操作

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [Task 2] | Blocked By: []

  **References**:
  - Source 1: `mini/src/theme/tokens.ts:1-54` — Mini TS格式tokens（数值类型）
  - Source 2: `mini/src/theme/tokens.scss:1-60` — Mini SCSS格式tokens（rpx单位）
  - Diff重点: 
    - spacing差异：ts的lg=20/xl=24 vs scss的lg=24/xl=32
    - radii差异：ts的xs=8/sm=12 vs scss的xs=4/sm=8
    - bgPage差异：ts用#F8F9FA vs scss用#FAFAFA
  - 决策原则：以Mini实际页面渲染效果为准（可通过`cd mini && npm run dev:weapp`验证）

  **Acceptance Criteria**:
  - [ ] `shared/design-tokens/tokens.json`文件存在
  - [ ] JSON格式正确：`cat shared/design-tokens/tokens.json | jq empty`
  - [ ] 包含4个顶层key：colors, spacing, radii, typography
  - [ ] colors包含至少15个颜色值（primary, secondary, brand, success等）
  - [ ] 所有颜色值为6位十六进制格式（如"#FFFFFF"）
  - [ ] spacing/radii/typography为数值类型（不带单位）

  **QA Scenarios**:
  ```
  Scenario: JSON格式验证
    Tool: Bash
    Steps: 
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. cat shared/design-tokens/tokens.json | jq empty
    Expected: 退出码0，无错误输出
    Evidence: .sisyphus/evidence/task-1-json-valid.txt

  Scenario: 必需token存在性检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. cat shared/design-tokens/tokens.json | jq '.colors.primary, .colors.brand, .spacing.md, .radii.md, .typography.body'
    Expected: 输出5个非null值
    Evidence: .sisyphus/evidence/task-1-required-tokens.txt
  ```

  **Commit**: YES | Message: `feat(design-tokens): create unified token source JSON` | Files: [shared/design-tokens/tokens.json]

- [x] 2. 编写生成脚本，生成Mobile tokens文件

  **What to do**:
  1. 创建`shared/design-tokens/scripts/generate-rn.js`
  2. 读取`tokens.json`，生成两个文件：
     - `mobile/src/theme/tokens.ts`（对象格式，用于常规样式）
     - `mobile/src/theme/tokens.raw.ts`（字符串格式，用于动画）
  3. tokens.ts结构：
     ```typescript
     export const colors = { primary: '#09090B', ... };
     export const spacing = { xs: 8, md: 16, ... };
     export const radii = { xs: 8, md: 16, ... };
     export const typography = { body: 14, h1: 20, ... };
     export type DesignTokens = { colors: typeof colors, ... };
     ```
  4. tokens.raw.ts结构：
     ```typescript
     export const colorsRaw = { primary: '#09090B', ... };
     ```
  5. 添加package.json script：`"gen:tokens": "node shared/design-tokens/scripts/generate-rn.js"`

  **Must NOT do**:
  - 不生成Mini的tokens文件（Mini保持现状）
  - 不添加tokens.json中不存在的值
  - 不使用复杂的模板引擎（用简单的字符串拼接）

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 简单的Node.js脚本，无复杂逻辑
  - Skills: [] — Reason: 标准文件读写操作
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [Task 3, 4, 5, 6, 7] | Blocked By: [Task 1]

  **References**:
  - Input: `shared/design-tokens/tokens.json` — 数据源
  - Output 1: `mobile/src/theme/tokens.ts` — RN对象格式
  - Output 2: `mobile/src/theme/tokens.raw.ts` — RN字符串格式（动画专用）
  - Pattern: Node.js fs模块读写文件
  - 单位转换：JSON中的数值直接用于RN（RN用px，不需要rpx转换）
  - 字体大小转换：Mini的rpx值需要除以2转为RN的px（如28rpx → 14px）

  **Acceptance Criteria**:
  - [ ] `shared/design-tokens/scripts/generate-rn.js`文件存在
  - [ ] `mobile/src/theme/tokens.ts`文件存在且格式正确
  - [ ] `mobile/src/theme/tokens.raw.ts`文件存在
  - [ ] TypeScript编译通过：`cd mobile && npx tsc --noEmit src/theme/tokens.ts`
  - [ ] tokens.ts导出4个对象：colors, spacing, radii, typography
  - [ ] tokens.ts包含TypeScript类型定义：`export type DesignTokens = ...`
  - [ ] tokens.raw.ts的颜色值与tokens.ts完全一致
  - [ ] 运行`npm run gen:tokens`可重新生成文件

  **QA Scenarios**:
  ```
  Scenario: 生成脚本执行成功
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. node shared/design-tokens/scripts/generate-rn.js
    Expected: 退出码0，生成2个文件
    Evidence: .sisyphus/evidence/task-2-generate-success.txt

  Scenario: TypeScript类型检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npx tsc --noEmit src/theme/tokens.ts
    Expected: 无类型错误
    Evidence: .sisyphus/evidence/task-2-ts-check.txt

  Scenario: Token值一致性检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. node -e "const t = require('./src/theme/tokens'); const r = require('./src/theme/tokens.raw'); console.assert(t.colors.primary === r.colorsRaw.primary, 'Color mismatch')"
    Expected: 无断言错误
    Evidence: .sisyphus/evidence/task-2-consistency.txt
  ```

  **Commit**: YES | Message: `feat(design-tokens): add RN token generation script` | Files: [shared/design-tokens/scripts/generate-rn.js, mobile/src/theme/tokens.ts, mobile/src/theme/tokens.raw.ts, package.json]

- [x] 3. Pilot: 替换HomeScreen.tsx样式值

  **What to do**:
  1. 在`mobile/src/screens/HomeScreen.tsx`顶部添加：`import { tokens } from '@/theme/tokens';`
  2. 在动画相关代码中添加：`import { colorsRaw } from '@/theme/tokens.raw';`
  3. 使用ast_grep_search查找所有硬编码样式值：
     - 颜色：`color: '#XXXXXX'`, `backgroundColor: '#XXXXXX'`
     - 间距：`padding: 数字`, `margin: 数字`
     - 圆角：`borderRadius: 数字`
     - 字体：`fontSize: 数字`
  4. 逐个替换为token引用（约257处）
  5. 特别注意动画颜色插值：使用`colorsRaw.xxx`而非`tokens.colors.xxx`
  6. 运行验证命令确保无回归

  **Must NOT do**:
  - 不修改组件的JSX结构
  - 不修改业务逻辑（fetchProviders, handlePress等）
  - 不修改状态管理（useState, useProviderStore）
  - 不修改动画逻辑（仅替换颜色值）

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: 需要仔细验证，257处替换，风险中等
  - Skills: [] — Reason: 标准代码替换
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: [Task 4, 5, 6, 7] | Blocked By: [Task 2]

  **References**:
  - Target: `mobile/src/screens/HomeScreen.tsx:1-1920` — 需要替换的文件
  - Token source: `mobile/src/theme/tokens.ts` — 常规样式token
  - Animation token: `mobile/src/theme/tokens.raw.ts` — 动画颜色token
  - Pattern: 
    ```typescript
    // 替换前
    backgroundColor: '#FFFFFF'
    padding: 16
    borderRadius: 12
    fontSize: 14
    
    // 替换后
    backgroundColor: tokens.colors.bgCard
    padding: tokens.spacing.md
    borderRadius: tokens.radii.md
    fontSize: tokens.typography.body
    ```
  - 动画特殊处理：
    ```typescript
    // 替换前
    outputRange: ['#F8F9FA', '#09090B']
    
    // 替换后
    outputRange: [colorsRaw.bgPage, colorsRaw.textPrimary]
    ```

  **Acceptance Criteria**:
  - [ ] 文件顶部有token导入语句
  - [ ] 无硬编码颜色值残留：`! grep -E "color: ['\"]#" mobile/src/screens/HomeScreen.tsx`
  - [ ] TypeScript编译通过：`cd mobile && npx tsc --noEmit`
  - [ ] ESLint检查通过：`cd mobile && npx eslint src/screens/HomeScreen.tsx`
  - [ ] 现有测试通过（如果有）：`cd mobile && npm test -- HomeScreen`
  - [ ] 动画正常工作（手动验证或E2E测试）

  **QA Scenarios**:
  ```
  Scenario: 硬编码颜色清除验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. grep -E "color: ['\"]#|backgroundColor: ['\"]#" src/screens/HomeScreen.tsx
    Expected: 退出码非0（无匹配）或仅匹配注释行
    Evidence: .sisyphus/evidence/task-3-no-hardcoded-colors.txt

  Scenario: TypeScript类型检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npx tsc --noEmit
    Expected: 无类型错误
    Evidence: .sisyphus/evidence/task-3-ts-check.txt

  Scenario: ESLint检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npx eslint src/screens/HomeScreen.tsx
    Expected: 退出码0，无错误
    Evidence: .sisyphus/evidence/task-3-eslint.txt

  Scenario: 测试套件无回归
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npm test 2>&1 | tee test-results.txt
    Expected: 所有测试通过
    Evidence: .sisyphus/evidence/task-3-test-results.txt
  ```

  **Commit**: YES | Message: `refactor(mobile): replace hardcoded styles in HomeScreen with tokens` | Files: [mobile/src/screens/HomeScreen.tsx]

- [x] 4. 替换卡片组件样式值

  **What to do**:
  1. 替换`mobile/src/components/DesignerCard.tsx`（约50处）
  2. 替换`mobile/src/components/WorkerCard.tsx`（约50处）
  3. 替换`mobile/src/components/MaterialShopCard.tsx`（约50处）
  4. 每个文件添加token导入，替换硬编码值
  5. 运行验证命令确保无回归

  **Must NOT do**:
  - 不修改组件Props接口
  - 不修改组件业务逻辑
  - 不统一三个卡片的样式（保持各自特色）

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 重复性工作，已有pilot验证
  - Skills: [] — Reason: 标准代码替换
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [Task 8] | Blocked By: [Task 3]

  **References**:
  - Pattern: 参考Task 3的替换模式
  - Target 1: `mobile/src/components/DesignerCard.tsx:1-184`
  - Target 2: `mobile/src/components/WorkerCard.tsx`
  - Target 3: `mobile/src/components/MaterialShopCard.tsx`
  - Token source: `mobile/src/theme/tokens.ts`

  **Acceptance Criteria**:
  - [ ] 3个文件都有token导入
  - [ ] 无硬编码颜色值残留
  - [ ] TypeScript编译通过
  - [ ] ESLint检查通过
  - [ ] 现有测试通过

  **QA Scenarios**:
  ```
  Scenario: 批量硬编码清除验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. grep -rE "color: ['\"]#|backgroundColor: ['\"]#" src/components/DesignerCard.tsx src/components/WorkerCard.tsx src/components/MaterialShopCard.tsx
    Expected: 退出码非0（无匹配）
    Evidence: .sisyphus/evidence/task-4-no-hardcoded.txt

  Scenario: 全量TypeScript检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npx tsc --noEmit
    Expected: 无类型错误
    Evidence: .sisyphus/evidence/task-4-ts-check.txt
  ```

  **Commit**: YES | Message: `refactor(mobile): replace hardcoded styles in card components` | Files: [mobile/src/components/DesignerCard.tsx, mobile/src/components/WorkerCard.tsx, mobile/src/components/MaterialShopCard.tsx]

- [x] 5. 替换详情页样式值

  **What to do**:
  1. 替换`mobile/src/screens/ProviderDetailScreen.tsx`（约150处）
  2. 添加token导入，替换硬编码值
  3. 运行验证命令确保无回归

  **Must NOT do**:
  - 不修改页面结构和业务逻辑

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 重复性工作
  - Skills: [] — Reason: 标准代码替换
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [Task 8] | Blocked By: [Task 3]

  **References**:
  - Pattern: 参考Task 3的替换模式
  - Target: `mobile/src/screens/ProviderDetailScreen.tsx`
  - Token source: `mobile/src/theme/tokens.ts`

  **Acceptance Criteria**:
  - [ ] 文件有token导入
  - [ ] 无硬编码颜色值残留
  - [ ] TypeScript编译通过
  - [ ] ESLint检查通过

  **QA Scenarios**:
  ```
  Scenario: 硬编码清除验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. grep -rE "color: ['\"]#" src/screens/ProviderDetailScreen.tsx
    Expected: 退出码非0
    Evidence: .sisyphus/evidence/task-5-no-hardcoded.txt
  ```

  **Commit**: YES | Message: `refactor(mobile): replace hardcoded styles in ProviderDetailScreen` | Files: [mobile/src/screens/ProviderDetailScreen.tsx]

- [x] 6. 替换其他首页相关组件

  **What to do**:
  1. 使用ast_grep_search查找首页相关的其他组件文件
  2. 识别包含硬编码样式值的文件（预计3-5个）
  3. 逐个替换为token引用
  4. 运行验证命令

  **Must NOT do**:
  - 不处理与首页无关的组件

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 重复性工作
  - Skills: [] — Reason: 标准代码替换
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [Task 8] | Blocked By: [Task 3]

  **References**:
  - Pattern: 参考Task 3的替换模式
  - Search: 使用ast_grep_search查找`mobile/src/components/`中被HomeScreen引用的组件
  - Token source: `mobile/src/theme/tokens.ts`

  **Acceptance Criteria**:
  - [ ] 所有相关文件有token导入
  - [ ] 无硬编码颜色值残留
  - [ ] TypeScript编译通过

  **QA Scenarios**:
  ```
  Scenario: 批量验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. find src/components -name "*.tsx" -exec grep -l "HomeScreen" {} \; | xargs grep -E "color: ['\"]#"
    Expected: 退出码非0
    Evidence: .sisyphus/evidence/task-6-no-hardcoded.txt
  ```

  **Commit**: YES | Message: `refactor(mobile): replace hardcoded styles in home-related components` | Files: [相关组件文件列表]

- [x] 7. 替换其他详情页相关组件

  **What to do**:
  1. 使用ast_grep_search查找详情页相关的其他组件文件
  2. 识别包含硬编码样式值的文件（预计2-3个）
  3. 逐个替换为token引用
  4. 运行验证命令

  **Must NOT do**:
  - 不处理与详情页无关的组件

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 重复性工作
  - Skills: [] — Reason: 标准代码替换
  - Omitted: [`git-master`] — Reason: 后续统一提交

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [Task 8] | Blocked By: [Task 3]

  **References**:
  - Pattern: 参考Task 3的替换模式
  - Search: 使用ast_grep_search查找`mobile/src/components/`中被ProviderDetailScreen引用的组件
  - Token source: `mobile/src/theme/tokens.ts`

  **Acceptance Criteria**:
  - [ ] 所有相关文件有token导入
  - [ ] 无硬编码颜色值残留
  - [ ] TypeScript编译通过

  **QA Scenarios**:
  ```
  Scenario: 批量验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. find src/components -name "*.tsx" -exec grep -l "ProviderDetail" {} \; | xargs grep -E "color: ['\"]#"
    Expected: 退出码非0
    Evidence: .sisyphus/evidence/task-7-no-hardcoded.txt
  ```

  **Commit**: YES | Message: `refactor(mobile): replace hardcoded styles in detail-related components` | Files: [相关组件文件列表]

- [x] 8. 最终验证和报告生成

  **What to do**:
  1. 运行全量测试套件：`cd mobile && npm test`
  2. 运行全量lint检查：`cd mobile && npm run lint`
  3. 统计硬编码值清除情况：
     ```bash
     # 替换前（从git历史获取）
     git show HEAD~N:mobile/src/screens/HomeScreen.tsx | grep -cE "color: ['\"]#"
     # 替换后
     grep -cE "color: ['\"]#" mobile/src/screens/HomeScreen.tsx
     ```
  4. 生成对比报告：`.sisyphus/evidence/task-8-final-report.md`
  5. 验证Mini视觉效果无变化（手动检查）

  **Must NOT do**:
  - 不修改任何代码
  - 不添加新功能

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: 需要综合验证和报告生成
  - Skills: [] — Reason: 标准验证流程
  - Omitted: [`git-master`] — Reason: 仅验证，不提交

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [Task 9] | Blocked By: [Task 4, 5, 6, 7]

  **References**:
  - Test command: `cd mobile && npm test`
  - Lint command: `cd mobile && npm run lint`
  - Report template: 包含替换前后对比、测试结果、lint结果

  **Acceptance Criteria**:
  - [ ] 全量测试通过
  - [ ] 全量lint检查通过
  - [ ] 报告文件存在：`.sisyphus/evidence/task-8-final-report.md`
  - [ ] 报告包含：替换文件数、替换行数、测试结果、lint结果
  - [ ] 无硬编码颜色值残留（全局检查）

  **QA Scenarios**:
  ```
  Scenario: 全量测试验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npm test 2>&1 | tee .sisyphus/evidence/task-8-test-full.txt
    Expected: 所有测试通过
    Evidence: .sisyphus/evidence/task-8-test-full.txt

  Scenario: 全量lint验证
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npm run lint 2>&1 | tee .sisyphus/evidence/task-8-lint-full.txt
    Expected: 退出码0
    Evidence: .sisyphus/evidence/task-8-lint-full.txt

  Scenario: 全局硬编码检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. grep -rE "color: ['\"]#|backgroundColor: ['\"]#" src/screens src/components | grep -v "tokens" | wc -l
    Expected: 输出0（无残留）
    Evidence: .sisyphus/evidence/task-8-global-check.txt
  ```

  **Commit**: NO | Message: N/A | Files: []

- [x] 9. 清理和文档更新

  **What to do**:
  1. 创建`shared/design-tokens/README.md`，说明：
     - Token系统的用途
     - 如何修改tokens.json
     - 如何重新生成tokens文件
     - 使用示例
  2. 更新根目录`package.json`，添加script：`"gen:tokens": "node shared/design-tokens/scripts/generate-rn.js"`
  3. 删除draft文件：`.sisyphus/drafts/mini-mobile-ui-sync.md`和`.sisyphus/drafts/mobile-code-change-assessment.md`
  4. 提交所有更改（如果之前的task没有提交）

  **Must NOT do**:
  - 不创建额外的文档（如Storybook）
  - 不修改代码

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: 简单的文档和清理工作
  - Skills: [`git-master`] — Reason: 需要提交所有更改
  - Omitted: [] — Reason: 需要git操作

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [Task 8]

  **References**:
  - README template: 包含用途、使用方法、示例代码
  - Git commit: 使用git-master skill进行原子提交

  **Acceptance Criteria**:
  - [ ] `shared/design-tokens/README.md`文件存在
  - [ ] README包含：用途说明、修改流程、使用示例
  - [ ] 根目录`package.json`有`gen:tokens` script
  - [ ] Draft文件已删除
  - [ ] 所有更改已提交到git

  **QA Scenarios**:
  ```
  Scenario: README存在性检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. test -f shared/design-tokens/README.md && echo "EXISTS"
    Expected: 输出"EXISTS"
    Evidence: .sisyphus/evidence/task-9-readme-exists.txt

  Scenario: Package.json script检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. cat package.json | jq '.scripts["gen:tokens"]'
    Expected: 输出脚本命令
    Evidence: .sisyphus/evidence/task-9-script-exists.txt

  Scenario: Git状态检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. git status --porcelain
    Expected: 无未提交的更改（或仅有evidence文件）
    Evidence: .sisyphus/evidence/task-9-git-clean.txt
  ```

  **Commit**: YES | Message: `docs(design-tokens): add README and cleanup drafts` | Files: [shared/design-tokens/README.md, package.json]

## Final Verification Wave (4 parallel agents, ALL must APPROVE)

- [x] F1. Plan Compliance Audit

  **What to do**: 验证所有任务是否按计划完成，无遗漏
  
  **Recommended Agent Profile**: Category: `unspecified-high` | Skills: []
  
  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [] | Blocked By: [Task 9]
  
  **Acceptance Criteria**:
  - [ ] 所有9个主任务已完成
  - [ ] 所有文件已提交到git
  - [ ] 无未解决的TODO或FIXME注释
  
  **QA Scenarios**:
  ```
  Scenario: 任务完成度检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. test -f shared/design-tokens/tokens.json && test -f mobile/src/theme/tokens.ts && test -f shared/design-tokens/README.md && echo "ALL_COMPLETE"
    Expected: 输出"ALL_COMPLETE"
    Evidence: .sisyphus/evidence/f1-compliance.txt
  ```
  
  **Commit**: NO

- [x] F2. Code Quality Review

  **What to do**: 审查代码质量，确保符合项目规范
  
  **Recommended Agent Profile**: Category: `unspecified-high` | Skills: []
  
  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [] | Blocked By: [Task 9]
  
  **Acceptance Criteria**:
  - [ ] 无TypeScript类型错误
  - [ ] 无ESLint错误
  - [ ] 代码风格一致
  
  **QA Scenarios**:
  ```
  Scenario: 代码质量检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile
      2. npx tsc --noEmit && npm run lint
    Expected: 退出码0
    Evidence: .sisyphus/evidence/f2-quality.txt
  ```
  
  **Commit**: NO

- [x] F3. Real Manual QA

  **What to do**: 手动验证Mobile和Mini的视觉一致性
  
  **Recommended Agent Profile**: Category: `unspecified-high` | Skills: []
  
  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [] | Blocked By: [Task 9]
  
  **Acceptance Criteria**:
  - [ ] Mobile首页颜色与Mini一致
  - [ ] Mobile详情页颜色与Mini一致
  - [ ] 间距和圆角视觉一致
  
  **QA Scenarios**:
  ```
  Scenario: 视觉对比（需要人工）
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration/mobile && npm run start
      2. cd /Volumes/tantan/AI_project/home-decoration/mini && npm run dev:weapp
      3. 人工对比两端首页和详情页的视觉效果
    Expected: 颜色、间距、圆角一致
    Evidence: .sisyphus/evidence/f3-visual-comparison.md（人工记录）
  ```
  
  **Commit**: NO

- [x] F4. Scope Fidelity Check

  **What to do**: 确认没有超出范围的修改
  
  **Recommended Agent Profile**: Category: `deep` | Skills: []
  
  **Parallelization**: Can Parallel: YES | Wave Final | Blocks: [] | Blocked By: [Task 9]
  
  **Acceptance Criteria**:
  - [ ] 未修改组件业务逻辑
  - [ ] 未修改状态管理
  - [ ] 未修改导航系统
  - [ ] 未添加新依赖
  
  **QA Scenarios**:
  ```
  Scenario: 范围检查
    Tool: Bash
    Steps:
      1. cd /Volumes/tantan/AI_project/home-decoration
      2. git diff HEAD~10 mobile/package.json | grep -E "^\+.*\"" | grep -v "gen:tokens"
    Expected: 无新增依赖
    Evidence: .sisyphus/evidence/f4-scope.txt
  ```
  
  **Commit**: NO

## Commit Strategy

采用原子提交策略，每个task完成后立即提交：

1. **Task 1**: `feat(design-tokens): create unified token source JSON`
2. **Task 2**: `feat(design-tokens): add RN token generation script`
3. **Task 3**: `refactor(mobile): replace hardcoded styles in HomeScreen with tokens`
4. **Task 4**: `refactor(mobile): replace hardcoded styles in card components`
5. **Task 5**: `refactor(mobile): replace hardcoded styles in ProviderDetailScreen`
6. **Task 6**: `refactor(mobile): replace hardcoded styles in home-related components`
7. **Task 7**: `refactor(mobile): replace hardcoded styles in detail-related components`
8. **Task 8**: 无提交（仅验证）
9. **Task 9**: `docs(design-tokens): add README and cleanup drafts`

所有提交遵循Conventional Commits规范，使用`feat`/`refactor`/`docs`前缀。

## Success Criteria

项目成功的标志：

1. **技术指标**:
   - ✅ `shared/design-tokens/tokens.json`存在且格式正确
   - ✅ `mobile/src/theme/tokens.ts`自动生成且包含类型定义
   - ✅ Mobile代码中无硬编码颜色值残留（首页+详情页相关文件）
   - ✅ 所有TypeScript编译通过，无类型错误
   - ✅ 所有ESLint检查通过，无警告
   - ✅ 所有现有测试通过，无回归

2. **视觉指标**:
   - ✅ Mobile首页与Mini首页颜色一致
   - ✅ Mobile详情页与Mini详情页颜色一致
   - ✅ 间距和圆角视觉一致
   - ✅ 动画效果正常（颜色渐变无异常）

3. **流程指标**:
   - ✅ 可通过`npm run gen:tokens`重新生成tokens文件
   - ✅ README文档完整，开发者可自行维护token系统
   - ✅ 所有更改已提交到git，无未跟踪文件

4. **范围指标**:
   - ✅ 未修改组件业务逻辑
   - ✅ 未修改状态管理、导航系统
   - ✅ 未添加新依赖（除生成脚本必需的）
   - ✅ Mini代码保持不变（仅验证视觉效果）
