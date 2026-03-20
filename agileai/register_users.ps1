$baseUrl = "http://localhost:5001/api"

Write-Host "--- AgileAI User Registration Script ---"
Write-Host ""

# Register Admin (will be first user -> admin role)
Write-Host "1. Registering Admin User..."
try {
    $adminBody = [PSCustomObject]@{ name = "Admin User"; email = "admin@agileai.com"; password = "Admin123!" } | ConvertTo-Json
    $adminResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -ContentType "application/json" -Body $adminBody -ErrorAction Stop
    Write-Host "   Admin registered: $($adminResponse.data.email) | Role: $($adminResponse.data.role)"
    $adminToken = $adminResponse.data.token
} catch {
    Write-Host "   ERROR registering admin: $_"
    $adminToken = $null
}

Start-Sleep -Seconds 1

# Register PM User
Write-Host "2. Registering Project Manager User..."
try {
    $pmBody = [PSCustomObject]@{ name = "PM User"; email = "pm@agileai.com"; password = "PM12345!" } | ConvertTo-Json
    $pmResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -ContentType "application/json" -Body $pmBody -ErrorAction Stop
    Write-Host "   PM registered: $($pmResponse.data.email) | Role: $($pmResponse.data.role)"
    $pmId = $pmResponse.data._id
    if (-not $pmId) { $pmId = $pmResponse.data.user._id }
} catch {
    Write-Host "   ERROR registering PM: $_"
    $pmId = $null
}

Start-Sleep -Seconds 1

# Register Developer User
Write-Host "3. Registering Developer User..."
try {
    $devBody = [PSCustomObject]@{ name = "Dev User"; email = "dev@agileai.com"; password = "Dev12345!" } | ConvertTo-Json
    $devResponse = Invoke-RestMethod -Uri "$baseUrl/auth/register" -Method POST -ContentType "application/json" -Body $devBody -ErrorAction Stop
    Write-Host "   Dev registered: $($devResponse.data.email) | Role: $($devResponse.data.role)"
    $devId = $devResponse.data._id
    if (-not $devId) { $devId = $devResponse.data.user._id }
} catch {
    Write-Host "   ERROR registering Developer: $_"
    $devId = $null
}

# If admin token available, upgrade PM role
if ($adminToken -and $pmId) {
    Write-Host "4. Upgrading PM User to 'pm' role..." 
    try {
        $headers = @{ Authorization = "Bearer $adminToken" }
        $upgradeBody = [PSCustomObject]@{ role = "pm" } | ConvertTo-Json
        $upgradeResponse = Invoke-RestMethod -Uri "$baseUrl/admin/users/$pmId" -Method PATCH -ContentType "application/json" -Headers $headers -Body $upgradeBody -ErrorAction Stop
        Write-Host "   PM role updated: $($upgradeResponse.data.role)"
    } catch {
        Write-Host "   ERROR upgrading PM role: $_"
    }
}

Write-Host ""
Write-Host "--- Registration Complete ---"
Write-Host "Admin: admin@agileai.com / Admin123!"
Write-Host "PM:    pm@agileai.com    / PM12345!"
Write-Host "Dev:   dev@agileai.com   / Dev12345!"
