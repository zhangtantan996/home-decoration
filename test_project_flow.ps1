$baseUrl = "http://localhost:8080/api/v1"

# 1. 登录
$loginBody = @{
    phone = "13800138001"
    code = "123456"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $loginResp.data.token
Write-Host "Login Success. Token: $token"

# 2. 创建项目
$headers = @{
    Authorization = "Bearer $token"
}

$projectBody = @{
    name = "我的新家装修"
    address = "北京市朝阳区xx小区1号楼"
    providerId = 1
    area = 120
    budget = 500000
    startDate = "2025-01-01"
    expectedEnd = "2025-06-01"
} | ConvertTo-Json

try {
    $createResp = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Post -Headers $headers -ContentType "application/json" -Body $projectBody
    Write-Host "Create Project Success: $($createResp.message), ID: $($createResp.data.id)"
} catch {
    Write-Host "Create Project Failed: $_"
    exit
}

# 3. 获取项目列表
try {
    $listResp = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Get -Headers $headers
    Write-Host "List Projects Success. Total: $($listResp.data.total)"
    $listResp.data.list | Format-Table id, name, status, currentPhase
} catch {
    Write-Host "List Projects Failed: $_"
}

# 4. 获取项目详情
try {
    $detailResp = Invoke-RestMethod -Uri "$baseUrl/projects/1" -Method Get -Headers $headers
    Write-Host "Get Project Detail Success."
    Write-Host "Owner: $($detailResp.data.ownerName)"
    Write-Host "Provider: $($detailResp.data.providerName)"
    Write-Host "Milestones: $($detailResp.data.milestones.Count)"
} catch {
    Write-Host "Get Detail Failed: $_"
}
