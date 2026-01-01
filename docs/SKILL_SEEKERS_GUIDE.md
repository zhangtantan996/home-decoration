# Skill_Seekers 使用说明 (家装平台项目)

## 1. 工具价值
Skill_Seekers 已集成到本项目中，主要用于：
- **AI 赋能**：将项目代码高度结构化，方便上传到 Claude/Gemini 等 AI 助手作为私有知识库。
- **一致性检查**：自动对比 API 文档 (`server/docs/API接口文档.md`) 与 Go 源代码中的 `struct` 定义，发现命名错误或类型不匹配。

## 2. 核心文件
- `skill_seekers_config.json`: 工具配置文件，定义了后端、管理端和移动端的扫描范围。
- `output/HomeDecoration`: 生成的结构化知识库目录。
- `project_skill.zip`: (生成后) 用于上传给 AI 的压缩包。

## 3. 常用操作 (PowerShell)

### 3.1 生成 AI 知识库
当你修改了大量代码或文档，想要让 AI 获取最新上下文时运行：
```powershell
skill-seekers unified --config skill_seekers_config.json
```

### 3.2 运行 API 一致性检查
检查接口文档是否过期：
```powershell
skill-seekers unified --config skill_seekers_config.json --check-only
```

### 3.3 打包分发
```powershell
# 使用内置打包逻辑
skill-seekers package --dir output/HomeDecoration --output project_skill.zip
```

## 4. 最佳实践
- 建议在提交代码前运行 `check-only`，确保 API 文档与代码同步更新。
- 团队成员只需安装 `pip install skill-seekers` 即可在本地使用这些配置。
