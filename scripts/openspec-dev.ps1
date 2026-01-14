# OpenSpec Dev Workflow
# 自动化 OpenSpec + MyClaude 完整开发流程

param(
    [Parameter(Mandatory=$true)]
    [string]$FeatureDescription,
    
    [Parameter(Mandatory=$false)]
    [string]$ChangeId,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipApproval,
    
    [Parameter(Mandatory=$false)]
    [string]$Backend = "codex"
)

# 颜色输出函数
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Cyan }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Error-Custom { Write-Host "❌ $args" -ForegroundColor Red }

# 检查依赖
function Test-Dependencies {
    Write-Info "检查依赖..."
    
    if (-not (Get-Command openspec -ErrorAction SilentlyContinue)) {
        Write-Error-Custom "OpenSpec 未安装,请运行: npm install -g @fission-ai/openspec"
        exit 1
    }
    
    if (-not (Get-Command codeagent-wrapper -ErrorAction SilentlyContinue)) {
        Write-Warning "MyClaude 未安装,将跳过自动执行步骤"
        return $false
    }
    
    Write-Success "依赖检查通过"
    return $true
}

# 生成变更 ID
function New-ChangeId {
    param([string]$Description)
    
    # 转换为 kebab-case
    $id = $Description.ToLower() `
        -replace '[^\w\s-]', '' `
        -replace '\s+', '-' `
        -replace '^-+|-+$', ''
    
    # 添加动词前缀
    if ($id -notmatch '^(add|update|remove|refactor|fix)-') {
        $id = "add-$id"
    }
    
    return $id
}

# Phase 1: 创建提案
function New-Proposal {
    param(
        [string]$ChangeId,
        [string]$Description
    )
    
    Write-Info "Phase 1: 创建提案..."
    
    # 创建目录结构
    $changePath = "openspec/changes/$ChangeId"
    New-Item -ItemType Directory -Path "$changePath/specs" -Force | Out-Null
    
    # 收集需求 (简化版,实际应该交互式询问)
    Write-Info "请提供以下信息:"
    $why = Read-Host "为什么需要这个功能?"
    $whatChanges = Read-Host "主要变更内容? (逗号分隔)"
    $affectedSpecs = Read-Host "影响的规范? (例如: user-profile)"
    $affectedCode = Read-Host "影响的代码文件? (逗号分隔)"
    
    # 生成 proposal.md
    @"
# Change: $Description

## Why
$why

## What Changes
$(($whatChanges -split ',') | ForEach-Object { "- $_" } | Out-String)

## Impact
- Affected specs: $affectedSpecs
- Affected code: 
$(($affectedCode -split ',') | ForEach-Object { "  - $_" } | Out-String)
"@ | Out-File -Encoding UTF8 "$changePath/proposal.md"
    
    # 生成 tasks.md
    @"
## 1. 实施
- [ ] 1.1 分析需求
- [ ] 1.2 实现核心功能
- [ ] 1.3 编写单元测试
- [ ] 1.4 更新文档

## Started
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@ | Out-File -Encoding UTF8 "$changePath/tasks.md"
    
    # 生成 spec.md
    $specPath = "$changePath/specs/$affectedSpecs"
    New-Item -ItemType Directory -Path $specPath -Force | Out-Null
    
    @"
## ADDED Requirements

### Requirement: $Description
系统 SHALL 提供 $Description 功能

#### Scenario: 基本场景
- **WHEN** 用户执行操作
- **THEN** 系统返回预期结果
"@ | Out-File -Encoding UTF8 "$specPath/spec.md"
    
    Write-Success "提案已生成: $changePath"
    
    # 验证提案
    Write-Info "验证提案格式..."
    $validateResult = openspec validate $ChangeId --strict 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "提案验证失败:"
        Write-Host $validateResult
        return $false
    }
    
    Write-Success "提案验证通过"
    return $true
}

# Phase 2: 实施
function Invoke-Implementation {
    param(
        [string]$ChangeId,
        [string]$Backend
    )
    
    Write-Info "Phase 2: 实施..."
    
    $changePath = "openspec/changes/$ChangeId"
    
    # 检查 MyClaude
    if (-not (Get-Command codeagent-wrapper -ErrorAction SilentlyContinue)) {
        Write-Warning "MyClaude 未安装,请手动执行任务"
        Write-Info "任务清单: $changePath/tasks.md"
        return $false
    }
    
    # 调用 MyClaude
    Write-Info "调用 MyClaude 执行任务..."
    
    $prompt = @"
请按照 $changePath/tasks.md 中的任务清单执行:

1. 读取 $changePath/proposal.md 了解需求
2. 读取 $changePath/specs/*/spec.md 了解规范
3. 严格按照 tasks.md 中的任务顺序执行
4. 每个任务完成后更新 tasks.md 标记为 [x]
5. 确保测试覆盖率 ≥90%

项目根目录: $(Get-Location)
"@
    
    $prompt | codeagent-wrapper --backend $Backend -
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "实施失败"
        return $false
    }
    
    Write-Success "实施完成"
    return $true
}

# Phase 3: 归档
function Invoke-Archive {
    param([string]$ChangeId)
    
    Write-Info "Phase 3: 归档..."
    
    $changePath = "openspec/changes/$ChangeId"
    
    # 标记完成时间
    @"

## Completed
$(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
"@ | Out-File -Append -Encoding UTF8 "$changePath/tasks.md"
    
    # 归档
    Write-Info "归档变更..."
    openspec archive $ChangeId --yes
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Custom "归档失败"
        return $false
    }
    
    Write-Success "归档完成"
    
    # 验证归档
    Write-Info "验证归档..."
    openspec validate --strict
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "归档后验证失败,请检查规范"
    }
    
    return $true
}

# 主流程
function Main {
    Write-Info "OpenSpec 自动化工作流"
    Write-Info "功能描述: $FeatureDescription"
    Write-Info ""
    
    # 检查依赖
    $hasMyClaude = Test-Dependencies
    
    # 生成变更 ID
    if (-not $ChangeId) {
        $ChangeId = New-ChangeId -Description $FeatureDescription
        Write-Info "生成变更 ID: $ChangeId"
    }
    
    # Phase 1: 创建提案
    $proposalSuccess = New-Proposal -ChangeId $ChangeId -Description $FeatureDescription
    
    if (-not $proposalSuccess) {
        Write-Error-Custom "提案创建失败"
        exit 1
    }
    
    # 请求审核
    if (-not $SkipApproval) {
        Write-Info ""
        Write-Info "请审核以下文件:"
        Write-Info "- openspec/changes/$ChangeId/proposal.md"
        Write-Info "- openspec/changes/$ChangeId/tasks.md"
        Write-Info "- openspec/changes/$ChangeId/specs/*/spec.md"
        Write-Info ""
        
        $approval = Read-Host "是否批准开始实施? (yes/no)"
        
        if ($approval -ne "yes") {
            Write-Warning "已取消实施"
            exit 0
        }
    }
    
    # Phase 2: 实施
    if ($hasMyClaude) {
        $implSuccess = Invoke-Implementation -ChangeId $ChangeId -Backend $Backend
        
        if (-not $implSuccess) {
            Write-Error-Custom "实施失败"
            exit 1
        }
    } else {
        Write-Warning "跳过自动实施,请手动执行任务"
        Write-Info "完成后运行: .\openspec-dev.ps1 -ChangeId $ChangeId -SkipApproval -ArchiveOnly"
        exit 0
    }
    
    # Phase 3: 归档
    $archiveSuccess = Invoke-Archive -ChangeId $ChangeId
    
    if (-not $archiveSuccess) {
        Write-Error-Custom "归档失败"
        exit 1
    }
    
    # 完成
    Write-Success ""
    Write-Success "🎉 功能开发完成并已归档!"
    Write-Success "- 变更 ID: $ChangeId"
    Write-Success "- 规范已更新到 openspec/specs/"
    Write-Success ""
}

# 执行
Main
