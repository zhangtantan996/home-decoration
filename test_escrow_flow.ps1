$baseUrl = "http://localhost:8080/api/v1"

# 1. 登录
$loginBody = @{
    phone = "13800138001"
    code  = "123456"
} | ConvertTo-Json

$loginResp = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
$token = $loginResp.data.token
$headers = @{ Authorization = "Bearer $token" }

# 2. 获取托管详情
$projectId = 1
try {
    $detailResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/escrow" -Method Get -Headers $headers
    Write-Host "Escrow Detail: Total=$($detailResp.data.escrowAccount.totalAmount), Frozen=$($detailResp.data.escrowAccount.frozenAmount)"
}
catch {
    Write-Host "Get Escrow Failed: $_"
    exit
}

# 3. 存入资金
$depositBody = @{
    amount      = 50000
    milestoneId = 1
} | ConvertTo-Json

try {
    $depResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/deposit" -Method Post -Headers $headers -ContentType "application/json" -Body $depositBody
    Write-Host "Deposit Success: $($depResp.message)"
}
catch {
    Write-Host "Deposit Failed: $_"
}

# 4. 再次查看余额
$detailResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/escrow" -Method Get -Headers $headers
Write-Host "Balance After Deposit: Total=$($detailResp.data.escrowAccount.totalAmount)"

# 5. 模拟节点验收通过
# (需直接操作数据库，暂时跳过或假设已通过)
# 这里仅演示资金释放请求，预期会失败（因为节点未通过）

$releaseBody = @{
    milestoneId = 1
} | ConvertTo-Json

try {
    $relResp = Invoke-RestMethod -Uri "$baseUrl/projects/$projectId/release" -Method Post -Headers $headers -ContentType "application/json" -Body $releaseBody
    Write-Host "Release Success: $($relResp.message)"
}
catch {
    # 预期失败: 节点未通过验收
    Write-Host "Release Failed (Expected): $($_.Exception.Message)" 
}
