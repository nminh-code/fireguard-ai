# scripts/check_services.ps1
# Comprehensive status inspection for Factory Vision AI across all 5 dimensions

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

. "$PSScriptRoot\service_utils.ps1"
$projDir = Get-ProjectRoot -ScriptDir $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "KIEM TRA TRANG THAI HE THONG FACTORY VISION AI" -ForegroundColor Cyan
Write-Host "Thu muc du an: $projDir" -ForegroundColor DarkGray
Write-Host "Thoi diem kiem tra: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$statusResults = @()

# ----------------------------------------------------
# 1. VIDEO BRIDGE & GO2RTC (Port 8787, 1984)
# ----------------------------------------------------
Write-Host "[1/4] VIDEO BRIDGE & GO2RTC" -ForegroundColor Yellow
$bridgePorts = Get-PortListenStatus -Port 8787 -ProjectDir $projDir
$go2rtcPorts = Get-PortListenStatus -Port 1984 -ProjectDir $projDir

$bridgeProcessRunning = if ($bridgePorts -and $bridgePorts[0].IsProject) { "DANG CHAY (PID: $($bridgePorts[0].ProcessId))" } else { "KHONG" }
$bridgePortListening  = if ($bridgePorts) { "PORT 8787 OPEN" } else { "PORT 8787 CLOSED" }
$go2rtcPortListening  = if ($go2rtcPorts) { "PORT 1984 OPEN" } else { "PORT 1984 CLOSED" }

$bridgeHealth = Test-HttpHealth -Url "http://127.0.0.1:8787/health" -TimeoutSeconds 3
$bridgeHealthStatus = if ($bridgeHealth.Success -and $bridgeHealth.Json -and $bridgeHealth.Json.ok) {
    "HEALTHY (FFmpeg: $($bridgeHealth.Json.ffmpeg))"
} else {
    "UNAVAILABLE"
}

Write-Host "  - Tien trinh:     $bridgeProcessRunning"
Write-Host "  - Port TCP 8787:  $bridgePortListening"
Write-Host "  - Port TCP 1984:  $go2rtcPortListening"
Write-Host "  - Health Check:   $bridgeHealthStatus"

$statusResults += [PSCustomObject]@{
    DichVu = "Video Bridge (:8787)"
    Process = $bridgeProcessRunning
    TcpPort = $bridgePortListening
    HealthCheck = $bridgeHealthStatus
    ChiTiet = "go2rtc: $go2rtcPortListening"
}

# ----------------------------------------------------
# 2. BACKEND API (Port 8080)
# ----------------------------------------------------
Write-Host "`n[2/4] BACKEND API SERVER" -ForegroundColor Yellow
$backendPorts = Get-PortListenStatus -Port 8080 -ProjectDir $projDir
$backendProcessRunning = if ($backendPorts -and $backendPorts[0].IsProject) { "DANG CHAY (PID: $($backendPorts[0].ProcessId))" } else { "KHONG" }
$backendPortListening  = if ($backendPorts) { "PORT 8080 OPEN" } else { "PORT 8080 CLOSED" }

$backendHealth = Test-HttpHealth -Url "http://localhost:8080/health" -TimeoutSeconds 3
$backendHealthStatus = if ($backendHealth.Success -and $backendHealth.Json -and $backendHealth.Json.status -eq 'UP') {
    "HEALTHY (Uptime: $([Math]::Round($backendHealth.Json.uptime, 1))s, v$($backendHealth.Json.version))"
} else {
    "UNAVAILABLE"
}

# Kiem tra nhanh cac file du lieu backend
$dataFilesInfo = ""
$camFile = Join-Path $projDir "backend\data\cameras.json"
$incFile = Join-Path $projDir "backend\data\incidents.json"
if ((Test-Path $camFile) -and (Test-Path $incFile)) {
    try {
        $camJson = Get-Content $camFile -Raw | ConvertFrom-Json
        $incJson = Get-Content $incFile -Raw | ConvertFrom-Json
        $camCount = if ($camJson.cameras) { $camJson.cameras.Count } else { $camJson.Count }
        $incCount = if ($incJson.incidents) { $incJson.incidents.Count } else { $incJson.Count }
        $dataFilesInfo = "Cameras: $camCount, Incidents: $incCount"
    } catch {}
}

Write-Host "  - Tien trinh:     $backendProcessRunning"
Write-Host "  - Port TCP 8080:  $backendPortListening"
Write-Host "  - Health Check:   $backendHealthStatus"
if ($dataFilesInfo) { Write-Host "  - Du lieu DB:     $dataFilesInfo" }

$statusResults += [PSCustomObject]@{
    DichVu = "Backend API (:8080)"
    Process = $backendProcessRunning
    TcpPort = $backendPortListening
    HealthCheck = $backendHealthStatus
    ChiTiet = $dataFilesInfo
}

# ----------------------------------------------------
# 3. WEB FRONTEND (Port 3000)
# ----------------------------------------------------
Write-Host "`n[3/4] WEB FRONTEND" -ForegroundColor Yellow
$frontendPorts = Get-PortListenStatus -Port 3000 -ProjectDir $projDir
$frontendProcessRunning = if ($frontendPorts) {
    if ($frontendPorts[0].IsProject) {
        "DANG CHAY (PID: $($frontendPorts[0].ProcessId))"
    } else {
        "TIEN TRINH NGOAI DU AN (PID: $($frontendPorts[0].ProcessId))"
    }
} else {
    "KHONG"
}
$frontendPortListening = if ($frontendPorts) { "PORT 3000 OPEN" } else { "PORT 3000 CLOSED" }

$frontendHealth = Test-HttpHealth -Url "http://localhost:3000" -TimeoutSeconds 3
$frontendHealthStatus = if ($frontendHealth.Success -and $frontendHealth.StatusCode -eq 200) {
    "HTTP 200 OK (Web UI Active)"
} else {
    "UNAVAILABLE"
}

Write-Host "  - Tien trinh:     $frontendProcessRunning"
Write-Host "  - Port TCP 3000:  $frontendPortListening"
Write-Host "  - Health Check:   $frontendHealthStatus"

$statusResults += [PSCustomObject]@{
    DichVu = "Web Frontend (:3000)"
    Process = $frontendProcessRunning
    TcpPort = $frontendPortListening
    HealthCheck = $frontendHealthStatus
    ChiTiet = if ($frontendPorts -and -not $frontendPorts[0].IsProject) { "Chiem boi ngoai du an" } else { "OK" }
}

# ----------------------------------------------------
# 4. AI PIPELINE & FRAME / INFERENCE STATE (Port 8790)
# ----------------------------------------------------
Write-Host "`n[4/4] AI PIPELINE & CAMERA INFERENCE" -ForegroundColor Yellow
$aiPorts = Get-PortListenStatus -Port 8790 -ProjectDir $projDir
$aiProcessRunning = if ($aiPorts -and $aiPorts[0].IsProject) { "DANG CHAY (PID: $($aiPorts[0].ProcessId))" } else { "KHONG" }
$aiPortListening  = if ($aiPorts) { "PORT 8790 OPEN" } else { "PORT 8790 CLOSED" }

$aiHealth = Test-HttpHealth -Url "http://127.0.0.1:8790/health" -TimeoutSeconds 3
$aiHealthStatus = if ($aiHealth.Success -and $aiHealth.Json -and $aiHealth.Json.ok) {
    "HEALTHY (FFmpeg: $($aiHealth.Json.ffmpeg))"
} else {
    "UNAVAILABLE"
}

# Kiem tra chi tiet pipeline status: camera frame moi va inference thuc te
$pipelineStatus = Test-HttpHealth -Url "http://127.0.0.1:8790/v1/pipeline/status" -TimeoutSeconds 3
$cameraFrameStatus = "KHONG CO THONG TIN"
$aiInferenceStatus = "KHONG CO THONG TIN"
$pipelineState = "OFFLINE"

if ($pipelineStatus.Success -and $pipelineStatus.Json) {
    $pj = $pipelineStatus.Json
    $pipelineState = if ($pj.state) { $pj.state } else { "UNKNOWN" }
    
    # 1. Kiem tra frame moi tu camera
    # The AI status contract exposes receivedFrames/lastFrameAt. Keep the
    # older field names as a fallback for compatibility with older services.
    $receivedFrames = if ($pj.receivedFrames -ne $null) {
        [int]$pj.receivedFrames
    } elseif ($pj.received -ne $null) {
        [int]$pj.received
    } else { 0 }
    $lastFrameTime = if ($pj.lastFrameAt) { $pj.lastFrameAt } elseif ($pj.lastFrameTime) { $pj.lastFrameTime } else { 0 }
    
    if ($receivedFrames -gt 0) {
        $cameraFrameStatus = "CO FRAME MOI (Da nhan: $receivedFrames frames)"
    } else {
        $cameraFrameStatus = "CHUA CO FRAME NAO (0 frames, Pipeline: $pipelineState)"
    }

    # 2. Kiem tra inference thuc te
    $infPerformed = $false
    if ($pj.processor -and $pj.processor.inferencePerformed) {
        $infPerformed = [bool]$pj.processor.inferencePerformed
    } elseif ($aiHealth.Json -and $aiHealth.Json.inferencePerformed) {
        $infPerformed = [bool]$aiHealth.Json.inferencePerformed
    }

    if ($infPerformed) {
        $aiInferenceStatus = "CO INFERENCE THUC TE (Model YOLO da nhan dien)"
    } else {
        $aiInferenceStatus = "CHUA CO INFERENCE (Chua phat hien hoac chua xu ly frame)"
    }

    Write-Host "  - Tien trinh:     $aiProcessRunning"
    Write-Host "  - Port TCP 8790:  $aiPortListening"
    Write-Host "  - Health Check:   $aiHealthStatus"
    Write-Host "  - Pipeline State: $pipelineState"
    Write-Host "  - Camera Frame:   $cameraFrameStatus" -ForegroundColor $(if ($receivedFrames -gt 0) { "Green" } else { "Yellow" })
    Write-Host "  - AI Inference:   $aiInferenceStatus" -ForegroundColor $(if ($infPerformed) { "Green" } else { "Cyan" })
    if ($pj.lastError) {
        Write-Host "  - Loi gan nhat:   $($pj.lastError)" -ForegroundColor Red
    }
} else {
    Write-Host "  - Tien trinh:     $aiProcessRunning"
    Write-Host "  - Port TCP 8790:  $aiPortListening"
    Write-Host "  - Health Check:   $aiHealthStatus"
    Write-Host "  - Camera Frame:   AI Pipeline chua khoi chay hoac offline" -ForegroundColor DarkGray
    Write-Host "  - AI Inference:   AI Pipeline chua khoi chay hoac offline" -ForegroundColor DarkGray
}

$statusResults += [PSCustomObject]@{
    DichVu = "AI Pipeline (:8790)"
    Process = $aiProcessRunning
    TcpPort = $aiPortListening
    HealthCheck = $aiHealthStatus
    ChiTiet = "Frame: $cameraFrameStatus | Inf: $aiInferenceStatus"
}

# ----------------------------------------------------
# 5. BANG TONG HOP TRANG THAI TOAN HE THONG
# ----------------------------------------------------
Write-Host ""
Write-Host "==========================================================================================" -ForegroundColor Cyan
Write-Host "BANG TONG HOP TRANG THAI HE THONG (PHAN BIET RO CAC TANG)" -ForegroundColor Cyan
Write-Host "==========================================================================================" -ForegroundColor Cyan
$statusResults | Format-Table -AutoSize
Write-Host ""
