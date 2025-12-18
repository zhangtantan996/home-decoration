$headers = @{
    "Content-Type" = "application/json"
}

$body = @{
    "phone" = "13800138000"
    "code"  = "111111" 
    "type"  = "code"
} | ConvertTo-Json

$url = "http://localhost:8080/api/v1/auth/login"

Write-Host "Attempting login with WRONG code..."
Write-Host "URL: $url"
Write-Host "Body: $body"

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $body -ErrorAction Stop
    Write-Host "Login SUCCESS (FAILURE! Backend did NOT block wrong code)" -ForegroundColor Red
    Write-Host "Response:" 
    $response | Format-List
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    $errorResp = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorResp)
    $respBody = $reader.ReadToEnd()
    
    if ($statusCode -eq 400 -or $statusCode -eq 401) {
        Write-Host "Login Refused (SUCCESS)" -ForegroundColor Green
        Write-Host "Status: $statusCode"
        Write-Host "Response: $respBody"
    }
    else {
        Write-Host "Request Failed with unexpected status: $statusCode" -ForegroundColor Yellow
        Write-Host "Response: $respBody"
    }
}
