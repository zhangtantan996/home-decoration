# OpenSpec Integration Skill

## Description
集成 OpenSpec 规范驱动开发到 MyClaude 工作流中

## When to Activate

### 自动激活条件
触发 `/dev` 命令时，如果满足以下任一条件，建议使用 OpenSpec：

1. **新功能开发**
   - 用户提到 "添加"、"新增"、"实现" 新功能
   - 需要创建新的 API 端点
   - 需要创建新的 UI 组件
   - 需要新的数据库表/字段

2. **破坏性变更**
   - 修改现有 API 的请求/响应格式
   - 数据库 schema 变更（字段类型、添加约束等）
   - 修改公共接口或配置格式

3. **架构调整**
   - 重构现有模块
   - 引入新的设计模式
   - 修改文件组织结构

4. **性能优化**（改变行为时）
   - 修改缓存策略
   - 改变数据加载方式
   - 优化导致行为变化

### 不激活条件
直接使用 `/dev` 或 `/debug`：

- Bug 修复（恢复预期行为）
- 拼写/格式/注释修正
- 配置文件调整
- 依赖版本更新（非破坏性）
- 日志添加
- 测试补充（针对现有功能）

## Workflow

### Phase 1: 检测与建议

当用户请求开发任务时：

```
1. 分析请求类型
2. 如果满足激活条件：
   显示建议：
   "📋 检测到这是 [新功能开发/破坏性变更/架构调整]，建议使用 OpenSpec 规范驱动开发：
   
   ✅ 需求明确后再开发（减少 30% 返工）
   ✅ 自动生成规范文档（节省 50% 文档时间）
   ✅ 强制测试覆盖率 ≥90%
   ✅ 变更历史可追溯
   
   是否使用 OpenSpec 工作流？[yes/no] (默认 yes)"
   
3. 等待用户确认
```

### Phase 2: OpenSpec 提案创建

如果用户确认使用 OpenSpec：

```bash
# Step 1: 生成变更 ID
CHANGE_ID=$(echo "$用户描述" | 转换为 kebab-case 并添加动词前缀)
# 例如: "用户头像上传" → "add-user-avatar-upload"

# Step 2: 收集需求（简短问答）
询问用户:
- "这个功能的核心目标是什么？"
- "主要影响哪些模块？(backend/admin/mobile)"
- "有哪些技术选型偏好？"
- "是否有性能/兼容性要求？"

# Step 3: 创建目录结构
mkdir -p openspec/changes/$CHANGE_ID/specs

# Step 4: 生成 proposal.md
基于用户回答生成：
---
# Change: [用户描述]

## Why
[根据用户回答生成问题/机会描述]

## What Changes
- [提取的变更列表]
- [标记破坏性变更]

## Impact
- Affected specs: [影响的规范]
- Affected code: [关键文件]
---

# Step 5: 生成 tasks.md
将工作分解为 2-5 分钟的小任务：
---
## 1. [模块名称] 实施
- [ ] 1.1 [任务描述]
- [ ] 1.2 [任务描述]
...

## 2. 测试
- [ ] 2.1 单元测试
- [ ] 2.2 集成测试
---

# Step 6: 生成 specs/*/spec.md
根据影响的模块创建规范增量：
---
## ADDED Requirements

### Requirement: [需求名称]
系统 SHALL [需求描述]

#### Scenario: [场景名称]
- **WHEN** [条件]
- **THEN** [结果]
- **AND** [额外条件]（可选）

[针对每个需求至少添加 2 个场景：成功场景 + 失败场景]
---

# Step 7: 验证提案
运行: openspec validate $CHANGE_ID --strict

如果验证失败，自动修复常见问题：
- 场景格式错误 → 修正为 "#### Scenario:"
- 缺少场景 → 添加基本场景
- 重新验证直到通过

# Step 8: 展示给用户
显示生成的文件路径和内容摘要：
"✅ OpenSpec 提案已生成：
- proposal.md - 变更说明
- tasks.md - 实施任务清单（共 X 个任务）
- specs/[capability]/spec.md - 规范增量

请审核以上文件，是否批准开始实施？[yes/no]"
```

### Phase 3: MyClaude 执行

用户批准后：

```bash
# Step 1: 标记开始时间
echo "## Started: $(date)" >> openspec/changes/$CHANGE_ID/tasks.md

# Step 2: 执行 MyClaude /dev 工作流
调用: codeagent-wrapper --backend codex - <<EOF
任务上下文:
- 提案文件: openspec/changes/$CHANGE_ID/proposal.md
- 任务清单: openspec/changes/$CHANGE_ID/tasks.md  
- 技术规范: openspec/changes/$CHANGE_ID/specs/*/spec.md
- 项目根目录: $(pwd)

执行要求:
1. 严格按照 tasks.md 的顺序执行
2. 参考 specs/*.md 中的场景实现功能
3. 每个任务完成后自动更新 tasks.md 标记为 [x]
4. 确保测试覆盖率 ≥90%
5. 遵循项目规范 (见 openspec/project.md)

请开始执行...
EOF

# Step 3: 监控进度
实时显示任务完成状态
```

### Phase 4: 质量保证（QA Gate）

**重要**: 实施完成后必须通过质量保证检查才能归档

```bash
# Step 1: 代码审查
运行 MyClaude /review 命令:

codeagent-wrapper --backend codex - <<EOF
请审查 $CHANGE_ID 的代码变更:

审查清单:
1. ✅ 代码质量
   - 是否符合项目规范 (见 openspec/project.md)
   - 命名是否规范 (Go: snake_case, React: PascalCase)
   - 是否有重复代码
   - 是否有安全隐患

2. ✅ 功能完整性
   - 是否实现了所有 specs/*.md 中的场景
   - 是否处理了所有边界条件
   - 错误处理是否完善

3. ✅ 架构合规性
   - 是否遵循分层架构 (Handler → Service → Repository)
   - 是否违反现有架构约束

4. ✅ 性能考虑
   - 是否有性能隐患 (N+1 查询、内存泄漏等)
   - 是否需要添加索引

审查完成后，生成审查报告到:
openspec/changes/$CHANGE_ID/CODE_REVIEW.md

格式:
- ✅ 通过项
- ⚠️  警告项 (建议优化但不阻塞)
- ❌ 阻塞项 (必须修复)
EOF

# Step 2: 检查审查结果
if [ -f "openspec/changes/$CHANGE_ID/CODE_REVIEW.md" ]; then
    # 检查是否有阻塞项
    if grep -q "❌" "openspec/changes/$CHANGE_ID/CODE_REVIEW.md"; then
        显示:
        "❌ 代码审查发现阻塞问题，请修复后重新执行:
        $(grep "❌" openspec/changes/$CHANGE_ID/CODE_REVIEW.md)
        
        修复后运行: /dev 继续执行"
        
        # 暂停归档，等待修复
        exit 1
    fi
    
    # 显示警告项（不阻塞）
    if grep -q "⚠️" "openspec/changes/$CHANGE_ID/CODE_REVIEW.md"; then
        显示:
        "⚠️  代码审查发现以下建议优化（不阻塞归档）:
        $(grep "⚠️" openspec/changes/$CHANGE_ID/CODE_REVIEW.md)"
    fi
fi

# Step 3: 测试验证
显示:
"🧪 运行测试验证..."

# 3.1 单元测试
case "$影响的模块" in
    *backend*)
        运行: cd server && go test -cover ./...
        提取覆盖率: COVERAGE=$(go test -cover ./... | grep -oP '\d+\.\d+%' | head -1)
        ;;
    *admin*)
        运行: cd admin && npm run test:coverage
        提取覆盖率: COVERAGE=$(npm run test:coverage | grep -oP '\d+\.\d+%')
        ;;
    *mobile*)
        运行: cd mobile && npm run test:coverage
        提取覆盖率: COVERAGE=$(npm run test:coverage | grep -oP '\d+\.\d+%')
        ;;
esac

# 3.2 验证覆盖率阈值
THRESHOLD=90
if [ ${COVERAGE%\%} -lt $THRESHOLD ]; then
    显示:
    "❌ 测试覆盖率不足: $COVERAGE (要求 ≥${THRESHOLD}%)
    
    请添加测试用例，然后运行: /test 补充测试"
    
    # 暂停归档
    exit 1
fi

显示:
"✅ 测试覆盖率: $COVERAGE (≥${THRESHOLD}%)"

# 3.3 集成测试（如果有）
if [ -f "tests/integration/$CHANGE_ID.test.js" ]; then
    运行: npm run test:integration
    
    if [ $? -ne 0 ]; then
        显示:
        "❌ 集成测试失败，请检查日志"
        exit 1
    fi
fi

# Step 4: 文档更新验证
显示:
"📝 验证文档更新..."

# 4.1 检查 API 文档更新（如果是 API 变更）
if grep -q "API" "openspec/changes/$CHANGE_ID/proposal.md"; then
    if ! git diff --cached | grep -q "docs/API接口文档.md"; then
        显示:
        "⚠️  检测到 API 变更但未更新 API 文档
        是否需要更新 docs/API接口文档.md? [yes/no]"
        
        if 用户回答 yes; then
            调用: codeagent-wrapper --backend codex - <<EOF
请更新 docs/API接口文档.md，添加新增/修改的 API 端点:

参考规范: openspec/changes/$CHANGE_ID/specs/*/spec.md
EOF
        fi
    fi
fi

# 4.2 检查 README 更新（如果是新功能）
if grep -q "新增" "openspec/changes/$CHANGE_ID/proposal.md"; then
    显示:
    "💡 建议更新 README.md 中的功能列表"
fi

# 4.3 生成 CHANGELOG
自动生成变更日志条目:
---
## [$版本号] $(date +%Y-%m-%d)

### Added
- [从 proposal.md 提取新增功能]

### Changed
- [从 proposal.md 提取变更内容]

### Fixed
- [如果有 bug 修复]
---

追加到 CHANGELOG.md

# Step 5: 安全检查
显示:
"🔒 运行安全检查..."

# 5.1 检查敏感信息泄漏
检查是否提交了:
- .env 文件
- 密钥/密码
- API Token

if git diff --cached | grep -iE "(password|secret|token|api.?key)" | grep -v "//"; then
    显示:
    "⚠️  检测到可能的敏感信息，请人工确认:
    $(git diff --cached | grep -iE '(password|secret|token|api.?key)')"
fi

# 5.2 依赖安全扫描（可选）
if [ -f "package.json" ] || [ -f "go.mod" ]; then
    显示:
    "运行依赖安全扫描..."
    # npm audit 或 go list -m all | nancy sleuth
fi

# Step 6: 构建验证
显示:
"🏗️  验证构建..."

# 6.1 本地构建测试
case "$影响的模块" in
    *backend*)
        运行: cd server && go build ./...
        if [ $? -ne 0 ]; then
            显示: "❌ 后端构建失败"
            exit 1
        fi
        ;;
    *admin*)
        运行: cd admin && npm run build
        if [ $? -ne 0 ]; then
            显示: "❌ Admin 构建失败"
            exit 1
        fi
        ;;
    *mobile*)
        # 跳过移动端构建（太耗时）
        显示: "⏭️  跳过移动端构建验证（请手动测试）"
        ;;
esac

# Step 7: 质量保证报告
生成 QA 报告:
---
# Quality Assurance Report

## Change ID: $CHANGE_ID

### Code Review
[从 CODE_REVIEW.md 复制摘要]

### Test Coverage
- 单元测试覆盖率: $COVERAGE
- 集成测试: [Pass/Fail/Skip]

### Documentation
- API 文档: [Updated/N/A]
- README: [Updated/N/A]
- CHANGELOG: ✅ Updated

### Security
- 敏感信息检查: ✅ Pass
- 依赖扫描: [Pass/Skip]

### Build
- Backend: ✅ Pass
- Admin: ✅ Pass
- Mobile: ⏭️  Skip

### Overall Status: ✅ PASS
---

保存到: openspec/changes/$CHANGE_ID/QA_REPORT.md

显示:
"✅ 质量保证检查通过！

📊 QA 摘要:
- 代码审查: ✅ 通过
- 测试覆盖率: $COVERAGE
- 文档更新: ✅ 完成
- 安全检查: ✅ 通过
- 构建验证: ✅ 通过

详细报告: openspec/changes/$CHANGE_ID/QA_REPORT.md

是否继续归档？[yes/no] (默认 yes)"
```

### Phase 5: 归档

所有任务完成后自动归档：

```bash
# Step 1: 验证完成
检查 tasks.md 所有任务是否标记为 [x]

# Step 2: 标记完成时间
echo "## Completed: $(date)" >> openspec/changes/$CHANGE_ID/tasks.md

# Step 3: 归档变更
运行: openspec archive $CHANGE_ID --yes

# Step 4: 验证归档
运行: openspec validate --strict

# Step 5: 报告结果
显示:
"✅ 功能开发完成并已归档！

📊 统计:
- 变更 ID: $CHANGE_ID
- 完成任务: X 个
- 测试覆盖率: XX%
- 规范已更新到: openspec/specs/[capability]/spec.md
- 归档位置: openspec/changes/archive/[date]-$CHANGE_ID/

📝 变更摘要:
[从 proposal.md 提取摘要]
"
```

## Integration Points

### 与 MyClaude `/dev` 工作流集成

```
用户请求
    ↓
检测是否需要 OpenSpec
    ↓ 是
    建议使用 OpenSpec
    ↓ 用户确认
    创建 OpenSpec 提案
    ↓
    用户审核批准
    ↓
    调用 MyClaude /dev 执行
    ↓
    自动归档
    ↓ 否
    直接调用 MyClaude /dev
```

### 与 MyClaude `/debug` 工作流集成

```
Bug 修复请求 → 直接使用 /debug (不使用 OpenSpec)
```

### 与 MyClaude `/bmad-pilot` 工作流集成

```
大型功能请求
    ↓
建议使用 OpenSpec + /bmad-pilot
    ↓
先创建 OpenSpec 提案
    ↓
然后使用 /bmad-pilot 的多智能体协作执行
```

## Examples

### Example 1: 新功能开发

```
用户: /dev "添加用户头像上传功能"

AI（激活 openspec-integration skill）:
"📋 检测到这是新功能开发，建议使用 OpenSpec 规范驱动开发：

✅ 需求明确后再开发（减少 30% 返工）
✅ 自动生成规范文档（节省 50% 文档时间）
✅ 强制测试覆盖率 ≥90%
✅ 变更历史可追溯

是否使用 OpenSpec 工作流？[yes/no] (默认 yes)"

用户: "yes"

AI: "好的，我需要了解一些细节：

1. 这个功能的核心目标是什么？"
用户: "允许用户上传和更新个人头像"

AI: "2. 主要影响哪些模块？"
用户: "backend, mobile"

AI: "3. 文件上传有什么要求？（格式、大小等）"
用户: "支持 JPG/PNG，最大 5MB，自动裁剪为 200x200"

AI: "4. 存储方案？"
用户: "阿里云 OSS"

AI: "正在生成 OpenSpec 提案..."

[创建 openspec/changes/add-user-avatar-upload/...]

AI: "✅ OpenSpec 提案已生成：
- proposal.md - 变更说明
- tasks.md - 8 个实施任务
- specs/user-profile/spec.md - 用户资料规范增量

请审核以上文件，是否批准开始实施？[yes/no]"

用户: "yes"

AI: "🚀 开始实施..."

[调用 MyClaude /dev 执行 tasks.md]

AI: "✅ 功能开发完成并已归档！
- 测试覆盖率: 94%
- 规范已更新"
```

### Example 2: Bug 修复（不使用 OpenSpec）

```
用户: /dev "修复登录页面的拼写错误"

AI（不激活 openspec-integration）:
直接使用 /dev 工作流修复
```

### Example 3: 破坏性变更

```
用户: /dev "修改 API 响应格式，添加分页信息"

AI（激活 openspec-integration skill）:
"📋 检测到这是破坏性变更（修改 API 响应格式），建议使用 OpenSpec：
- 记录变更影响
- 提供迁移指南
- 更新 API 文档

是否使用 OpenSpec 工作流？[yes/no]"
```

## Configuration

可以在 `~/.claude/config.json` 中配置：

```json
{
  "skills": {
    "openspec-integration": {
      "auto_suggest": true,
      "require_approval": true,
      "test_coverage_threshold": 90,
      "default_backend": "codex"
    }
  }
}
```

## Best Practices

1. **提案粒度**：单一职责，一个提案解决一个问题
2. **任务分解**：每个任务 2-5 分钟，按依赖顺序
3. **场景覆盖**：每个需求至少 2 个场景（成功 + 失败）
4. **命名规范**：变更 ID 使用 kebab-case，动词开头
5. **审核重点**：proposal.md（需求）、tasks.md（任务）、specs（场景）

## Troubleshooting

### 提案验证失败
自动检查并修复：
- 场景格式：确保使用 `#### Scenario:`
- 每个需求至少一个场景
- 存在规范增量文件

### MyClaude 执行失败
- 自动回滚变更
- 显示错误日志
- 建议修复方案

### 归档失败
- 检查规范格式
- 手动归档命令：`openspec archive <change-id>`
