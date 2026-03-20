# AgileAI Role Testing Script
# Runs API-based tests for Admin, PM, and Developer roles

$baseUrl = "http://localhost:5001/api"
$results = @()

function Test-API {
    param($Method, $Endpoint, $Body = $null, $Token = $null, $ExpectedStatus)
    $headers = @{ "Content-Type" = "application/json" }
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }
    
    try {
        $params = @{ Uri = "$baseUrl$Endpoint"; Method = $Method; Headers = $headers; ErrorAction = "Stop" }
        if ($Body) { $params["Body"] = ($Body | ConvertTo-Json) }
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; Status = "OK" }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        return @{ Success = $false; Status = $statusCode; Error = $_.ToString() }
    }
}

Write-Host "=== AGILEAI ROLE-BASED INTEGRATION TESTS ===" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# STEP 1: REGISTER ALL THREE USERS
# =====================================================
Write-Host "--- STEP 1: REGISTERING USERS ---" -ForegroundColor Yellow

# Admin
Write-Host "Registering Admin..." -NoNewline
$adminReg = Test-API POST "/auth/register" @{ name = "Admin User"; email = "admin@agileai.com"; password = "Admin123!" }
if ($adminReg.Success) {
    $adminToken = $adminReg.Data.data.token
    $adminRole = $adminReg.Data.data.role
    Write-Host " SUCCESS | Role: $adminRole" -ForegroundColor Green
} else {
    # Try login if already registered
    $adminLogin = Test-API POST "/auth/login" @{ email = "admin@agileai.com"; password = "Admin123!" }
    if ($adminLogin.Success) {
        $adminToken = $adminLogin.Data.data.token
        $adminRole = $adminLogin.Data.data.role
        Write-Host " ALREADY EXISTS - Logged in | Role: $adminRole" -ForegroundColor Yellow
    } else {
        $adminToken = $null
        Write-Host " FAILED: $($adminReg.Error)" -ForegroundColor Red
    }
}

# PM
Write-Host "Registering PM User..." -NoNewline
$pmReg = Test-API POST "/auth/register" @{ name = "PM User"; email = "pm@agileai.com"; password = "PM12345!" }
if ($pmReg.Success) {
    $pmId = $pmReg.Data.data._id
    $pmToken = $pmReg.Data.data.token
    Write-Host " SUCCESS | Role: $($pmReg.Data.data.role)" -ForegroundColor Green
} else {
    $pmLogin = Test-API POST "/auth/login" @{ email = "pm@agileai.com"; password = "PM12345!" }
    if ($pmLogin.Success) {
        $pmId = $pmLogin.Data.data._id
        $pmToken = $pmLogin.Data.data.token
        Write-Host " ALREADY EXISTS | Role: $($pmLogin.Data.data.role)" -ForegroundColor Yellow
    } else {
        $pmToken = $null; $pmId = $null
        Write-Host " FAILED" -ForegroundColor Red
    }
}

# Developer
Write-Host "Registering Developer..." -NoNewline
$devReg = Test-API POST "/auth/register" @{ name = "Dev User"; email = "dev@agileai.com"; password = "Dev12345!" }
if ($devReg.Success) {
    $devToken = $devReg.Data.data.token
    Write-Host " SUCCESS | Role: $($devReg.Data.data.role)" -ForegroundColor Green
} else {
    $devLogin = Test-API POST "/auth/login" @{ email = "dev@agileai.com"; password = "Dev12345!" }
    if ($devLogin.Success) {
        $devToken = $devLogin.Data.data.token
        Write-Host " ALREADY EXISTS | Role: $($devLogin.Data.data.role)" -ForegroundColor Yellow
    } else {
        $devToken = $null
        Write-Host " FAILED" -ForegroundColor Red
    }
}

Write-Host ""

# =====================================================
# STEP 2: ADMIN ROLE TESTS
# =====================================================
Write-Host "--- STEP 2: ADMIN ROLE TESTS ---" -ForegroundColor Yellow

if ($adminToken) {
    # Admin: Get all users
    Write-Host "Admin - GET /admin/users..." -NoNewline
    $usersRes = Test-API GET "/admin/users" -Token $adminToken
    if ($usersRes.Success) {
        Write-Host " SUCCESS | $($usersRes.Data.data.Count) users found" -ForegroundColor Green
        $usersRes.Data.data | ForEach-Object { Write-Host "   -> $($_.name) ($($_.email)) | Role: $($_.role)" }
    } else {
        Write-Host " FAILED: $($usersRes.Status)" -ForegroundColor Red
    }

    # Upgrade PM role
    if ($pmId -and $adminToken) {
        Write-Host "Admin - Upgrade PM role to 'pm'..." -NoNewline
        $upgradeRes = Test-API PATCH "/admin/users/$pmId" @{ role = "pm" } -Token $adminToken
        if ($upgradeRes.Success) {
            Write-Host " SUCCESS | New role: $($upgradeRes.Data.data.role)" -ForegroundColor Green
        } else {
            Write-Host " FAILED: $($upgradeRes.Status)" -ForegroundColor Red
        }
    }

    # Admin: Create Project
    Write-Host "Admin - POST /projects (Create project)..." -NoNewline
    $projectRes = Test-API POST "/projects" @{ name = "Alpha Integration Project"; description = "Integration test project"; status = "planning"; color = "#4f46e5" } -Token $adminToken
    if ($projectRes.Success) {
        $projectId = $projectRes.Data.data._id
        Write-Host " SUCCESS | Project ID: $projectId" -ForegroundColor Green
    } else {
        Write-Host " FAILED: $($projectRes.Status)" -ForegroundColor Red
    }

    # Admin: Get Stats
    Write-Host "Admin - GET /admin/stats..." -NoNewline
    $statsRes = Test-API GET "/admin/stats" -Token $adminToken
    if ($statsRes.Success) {
        $d = $statsRes.Data.data
        Write-Host " SUCCESS | Users=$($d.users), Projects=$($d.projects), Tasks=$($d.tasks), Sprints=$($d.sprints)" -ForegroundColor Green
    } else {
        Write-Host " FAILED: $($statsRes.Status)" -ForegroundColor Red
    }
}

Write-Host ""

# =====================================================
# STEP 3: PM ROLE TESTS
# =====================================================
Write-Host "--- STEP 3: PROJECT MANAGER (PM) ROLE TESTS ---" -ForegroundColor Yellow

# Re-login as PM (now with updated role)
$pmRelog = Test-API POST "/auth/login" @{ email = "pm@agileai.com"; password = "PM12345!" }
if ($pmRelog.Success) {
    $pmToken = $pmRelog.Data.data.token
    $pmId = $pmRelog.Data.data._id
    Write-Host "PM re-login successful | Role: $($pmRelog.Data.data.role)" -ForegroundColor Green
}

if ($pmToken) {
    # PM: try to access admin route (should FAIL with 403)
    Write-Host "PM - GET /admin/users (should FAIL 403)..." -NoNewline
    $pmAdminRes = Test-API GET "/admin/users" -Token $pmToken
    if (-not $pmAdminRes.Success -and $pmAdminRes.Status -eq 403) {
        Write-Host " BLOCKED 403 as expected ✅" -ForegroundColor Green
    } elseif ($pmAdminRes.Success) {
        Write-Host " UNEXPECTED SUCCESS (Bug!)" -ForegroundColor Red
    } else {
        Write-Host " Error $($pmAdminRes.Status)" -ForegroundColor Yellow
    }

    # PM: Create Project
    Write-Host "PM - POST /projects (Create project)..." -NoNewline
    $pmProjectRes = Test-API POST "/projects" @{ name = "PM's Project"; description = "PM-created project"; status = "active"; color = "#10b981" } -Token $pmToken
    if ($pmProjectRes.Success) {
        $pmProjectId = $pmProjectRes.Data.data._id
        Write-Host " SUCCESS | Project ID: $pmProjectId" -ForegroundColor Green
    } else {
        Write-Host " FAILED: $($pmProjectRes.Status)" -ForegroundColor Red
    }

    # PM: Create Sprint
    if ($projectId) {
        Write-Host "PM - POST /projects/$projectId/sprints..." -NoNewline
        $sprintRes = Test-API POST "/projects/$projectId/sprints" @{ name = "Sprint 1"; startDate = "2026-03-18"; endDate = "2026-04-01"; project = $projectId } -Token $pmToken
        if ($sprintRes.Success) {
            $sprintId = $sprintRes.Data.data._id
            Write-Host " SUCCESS | Sprint ID: $sprintId" -ForegroundColor Green

            # PM: Start Sprint
            Write-Host "PM - Start Sprint..." -NoNewline
            $startRes = Test-API POST "/projects/$projectId/sprints/$sprintId/start" -Token $pmToken
            if ($startRes.Success) {
                Write-Host " SUCCESS | Sprint started" -ForegroundColor Green
            } else {
                Write-Host " FAILED: $($startRes.Status)" -ForegroundColor Red
            }
        } else {
            Write-Host " FAILED: $($sprintRes.Status)" -ForegroundColor Red
        }
    }

    # PM: Create Task
    if ($projectId) {
        Write-Host "PM - POST /projects/$projectId/tasks..." -NoNewline
        $pmTaskRes = Test-API POST "/projects/$projectId/tasks" @{ title = "Design new login page"; type = "Story"; priority = "High"; storyPoints = 5; project = $projectId } -Token $pmToken
        if ($pmTaskRes.Success) {
            $taskId = $pmTaskRes.Data.data._id
            Write-Host " SUCCESS | Task ID: $taskId" -ForegroundColor Green
        } else {
            Write-Host " FAILED: $($pmTaskRes.Status)" -ForegroundColor Red
        }
    }
}

Write-Host ""

# =====================================================
# STEP 4: DEVELOPER ROLE TESTS
# =====================================================
Write-Host "--- STEP 4: DEVELOPER ROLE TESTS ---" -ForegroundColor Yellow

if ($devToken) {
    # Dev: Try admin (should FAIL 403)
    Write-Host "Dev - GET /admin/users (should FAIL 403)..." -NoNewline
    $devAdminRes = Test-API GET "/admin/users" -Token $devToken
    if (-not $devAdminRes.Success -and $devAdminRes.Status -eq 403) {
        Write-Host " BLOCKED 403 as expected ✅" -ForegroundColor Green
    } elseif ($devAdminRes.Success) {
        Write-Host " UNEXPECTED SUCCESS (Bug!)" -ForegroundColor Red
    } else {
        Write-Host " Error $($devAdminRes.Status)" -ForegroundColor Yellow
    }

    # Dev: Try create project (should FAIL 403)
    Write-Host "Dev - POST /projects (should FAIL 403)..." -NoNewline
    $devProjectRes = Test-API POST "/projects" @{ name = "Hacked Project"; description = "test" } -Token $devToken
    if (-not $devProjectRes.Success -and $devProjectRes.Status -eq 403) {
        Write-Host " BLOCKED 403 as expected ✅" -ForegroundColor Green
    } elseif ($devProjectRes.Success) {
        Write-Host " UNEXPECTED SUCCESS (Bug!)" -ForegroundColor Red
    } else {
        Write-Host " Error $($devProjectRes.Status)" -ForegroundColor Yellow
    }

    # Dev: View all projects (should SUCCEED)
    Write-Host "Dev - GET /projects (should SUCCEED)..." -NoNewline
    $devGetProjects = Test-API GET "/projects" -Token $devToken
    if ($devGetProjects.Success) {
        Write-Host " SUCCESS | Projects visible: $($devGetProjects.Data.data.Count)" -ForegroundColor Green
    } else {
        Write-Host " FAILED: $($devGetProjects.Status)" -ForegroundColor Red
    }

    # Dev: Move task status (should SUCCEED for all authenticated)
    if ($taskId) {
        Write-Host "Dev - PATCH task status (Kanban move - should SUCCEED)..." -NoNewline
        $devMoveTask = Test-API PATCH "/projects/$projectId/tasks/$taskId/status" @{ status = "In Progress" } -Token $devToken
        if ($devMoveTask.Success) {
            Write-Host " SUCCESS | Task moved to In Progress ✅" -ForegroundColor Green
        } else {
            Write-Host " FAILED: $($devMoveTask.Status)" -ForegroundColor Red
        }
    }

    # Dev: Delete task (should FAIL 403)
    if ($taskId) {
        Write-Host "Dev - DELETE task (should FAIL 403)..." -NoNewline
        $devDeleteTask = Test-API DELETE "/projects/$projectId/tasks/$taskId" -Token $devToken
        if (-not $devDeleteTask.Success -and $devDeleteTask.Status -eq 403) {
            Write-Host " BLOCKED 403 as expected ✅" -ForegroundColor Green
        } elseif ($devDeleteTask.Success) {
            Write-Host " UNEXPECTED SUCCESS (Bug!)" -ForegroundColor Red
        } else {
            Write-Host " Error $($devDeleteTask.Status)" -ForegroundColor Yellow
        }
    }

    # Dev: Add comment (should SUCCEED)
    if ($taskId) {
        Write-Host "Dev - POST comment on task (should SUCCEED)..." -NoNewline
        $devComment = Test-API POST "/projects/$projectId/tasks/$taskId/comment" @{ text = "Looking into this now" } -Token $devToken
        if ($devComment.Success) {
            Write-Host " SUCCESS | Comment added ✅" -ForegroundColor Green
        } else {
            Write-Host " FAILED: $($devComment.Status)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== ALL TESTS COMPLETE ===" -ForegroundColor Cyan
