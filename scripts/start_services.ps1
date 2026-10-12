# scripts/start_services.ps1
# Automated startup script with pre-flight checks and health-check polling

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

. "$PSScriptRoot\service_utils.ps1"
$projDir = Get-ProjectRoot -ScriptDir $PSScriptRoot
Set-Location -Path $projDir

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "KHOI DONG HE THONG FACTORY VISION AI" -ForegroundColor Cyan
Write-Host "Thu muc du an: $projDir" -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 0. Kiem tra thu vien node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "[0/5] Dang cai dat thu vien node_modules..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# 1. Kiem tra cac cong can thiet truoc khi khoi chay: 3000, 8080, 8787, 8790, 1984
Write-Host "[PRE-FLIGHT] Kiem tra xung dot cong truoc khi khoi chay..." -ForegroundColor Yellow
$ports = @(8787, 1984, 8080, 8790, 3000)
$foreignCollisions = @()

foreach ($port in $ports) {
    $conns = Get-PortListenStatus -Port $port -ProjectDir $projDir
    if ($conns -and $conns.Count -gt 0) {
        foreach ($conn in $conns) {
            if ($conn.IsProject) {
                Write-Host "  -> Port ${port}: Phat hien tien trinh cu cua du an $($conn.Name) (PID: $($conn.ProcessId)). Dang dung..." -ForegroundColor DarkYellow
                Stop-Process -Id $conn.ProcessId -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 300
            } else {
                Write-Host "  -> [CANH BAO] Port ${port} dang bi chiem boi tien trinh NGOAI du an:" -ForegroundColor Magenta
                Write-Host "     + PID: $($conn.ProcessId)" -ForegroundColor Magenta
                Write-Host "     + Ten: $($conn.Name)" -ForegroundColor Magenta
                Write-Host "     + Lenh: $($conn.CommandLine)" -ForegroundColor DarkGray
                $foreignCollisions += $conn
            }
        }
    } else {
        Write-Host "  -> Port ${port}: Trong (San sang)" -ForegroundColor Green
    }
}
Write-Host ""

# Helper polling function
function Wait-ForEndpoint {
    param(
        [string]$ServiceName,
        [string]$Url,
        [int]$TimeoutSeconds = 15,
        [scriptblock]$Validator = { param($r) $r.Success }
    )
    Write-Host "  Dang cho $ServiceName san sang tai $Url (toi da ${TimeoutSeconds}s)... " -NoNewline
    $timer = [System.Diagnostics.Stopwatch]::StartNew()
    while ($timer.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        $res = Test-HttpHealth -Url $Url -TimeoutSeconds 2
        if (&$Validator $res) {
            $duration = [Math]::Round($timer.Elapsed.TotalSeconds, 1)
            Write-Host "[OK] (${duration}s)" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 800
    }
    Write-Host "[TIMEOUT] sau ${TimeoutSeconds}s" -ForegroundColor Red
    return $false
}

# 1. Khoi dong Video Bridge Server & go2rtc (Port 8787, 1984)
$bridgeCollisions = $foreignCollisions | Where-Object { $_.Port -eq 8787 -or $_.Port -eq 1984 }
if ($bridgeCollisions) {
    Write-Host "[1/5] [LOI] Khong the khoi dong Video Bridge vi port 8787 hoac 1984 bi chiem boi tien trinh ngoai du an!" -ForegroundColor Red
} else {
    Write-Host "[1/5] Dang khoi dong Video Bridge Server & go2rtc (Port 8787, 1984)..." -ForegroundColor Cyan
    $env:VIDEO_BRIDGE_FPS = "15"
    Start-Process -FilePath "cmd.exe" -ArgumentList '/k', 'title FireGuard AI - Video Bridge && set VIDEO_BRIDGE_FPS=15 && npm run bridge' -WorkingDirectory $projDir
    $bridgeOk = Wait-ForEndpoint -ServiceName "Video Bridge" -Url "http://127.0.0.1:8787/health" -TimeoutSeconds 15 -Validator {
        param($r) $r.Success -and $r.Json -and $r.Json.ok -eq $true
    }
    if (-not $bridgeOk) {
        Write-Host "  [CANH BAO] Video Bridge chua phan hoi endpoint /health trong 15s. Tiep tuc theo doi..." -ForegroundColor Yellow
    }
}
Write-Host ""

# 2. Khoi dong Backend Server (Port 8080)
$backendCollisions = $foreignCollisions | Where-Object { $_.Port -eq 8080 }
if ($backendCollisions) {
    Write-Host "[2/5] [LOI] Khong the khoi dong Backend vi port 8080 bi chiem boi tien trinh ngoai du an!" -ForegroundColor Red
} else {
    Write-Host "[2/5] Dang khoi dong Backend API Server (Port 8080)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList '/k', 'title FireGuard AI - Backend API && npm run backend' -WorkingDirectory $projDir
    $backendOk = Wait-ForEndpoint -ServiceName "Backend API" -Url "http://localhost:8080/health" -TimeoutSeconds 30 -Validator {
        param($r) $r.Success -and $r.Json -and $r.Json.status -eq 'UP'
    }
    if (-not $backendOk) {
        Write-Host "  [CANH BAO] Backend API chua phan hoi endpoint /health trong 30s. Tiep tuc theo doi..." -ForegroundColor Yellow
    }
}
Write-Host ""

# 3. Khoi dong Frontend Web UI (Port 3000)
$frontendCollisions = $foreignCollisions | Where-Object { $_.Port -eq 3000 }
if ($frontendCollisions) {
    Write-Host "[3/5] [BO QUA] Cong 3000 dang bi chiem boi tien trinh ngoai du an (PID: $($frontendCollisions[0].ProcessId), $($frontendCollisions[0].Name))." -ForegroundColor Magenta
    Write-Host "      He thong KHONG khoi chay Web Frontend de tranh xung dot hoac kill tien trinh ngoai du an." -ForegroundColor Magenta
    Write-Host "      Vui long giai phong cong 3000 neu muon su dung Web Frontend tren port nay." -ForegroundColor Magenta
} else {
    Write-Host "[3/5] Dang khoi dong Web Frontend (Port 3000)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList '/k', 'title FireGuard AI - Web Frontend && npm run dev' -WorkingDirectory $projDir
    $frontendOk = Wait-ForEndpoint -ServiceName "Web Frontend" -Url "http://localhost:3000" -TimeoutSeconds 15 -Validator {
        param($r) $r.Success -and $r.StatusCode -eq 200
    }
    if (-not $frontendOk) {
        Write-Host "  [CANH BAO] Web Frontend chua phan hoi trong 15s. Tiep tuc theo doi..." -ForegroundColor Yellow
    }
}
Write-Host ""

# 4. Khoi dong AI Pipeline Server (Port 8790)
$aiCollisions = $foreignCollisions | Where-Object { $_.Port -eq 8790 }
if ($aiCollisions) {
    Write-Host "[4/5] [LOI] Khong the khoi dong AI Pipeline vi port 8790 bi chiem boi tien trinh ngoai du an!" -ForegroundColor Red
} else {
    Write-Host "[4/5] Dang khoi dong AI Pipeline Server (Port 8790)..." -ForegroundColor Cyan
    Start-Process -FilePath "cmd.exe" -ArgumentList '/k', 'title FireGuard AI - AI Pipeline && npm run ai:frames' -WorkingDirectory $projDir
    $aiOk = Wait-ForEndpoint -ServiceName "AI Pipeline" -Url "http://127.0.0.1:8790/health" -TimeoutSeconds 15 -Validator {
        param($r) $r.Success -and $r.Json -and $r.Json.ok -eq $true
    }
    if (-not $aiOk) {
        Write-Host "  [CANH BAO] AI Pipeline chua phan hoi endpoint /health trong 15s. Tiep tuc theo doi..." -ForegroundColor Yellow
    }
}
Write-Host ""

# 5. Kich hoat luong quet Camera AI
Write-Host "[5/5] Dang kich hoat luong quet Camera AI..." -ForegroundColor Cyan
try {
    node ai-pipeline/control.mjs start
} catch {
    Write-Host "  Khong the goi lenh start toi AI Pipeline." -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Trang thai luong AI hien tai:" -ForegroundColor Yellow
try {
    node ai-pipeline/control.mjs status
} catch {
    Write-Host "  Chua lay duoc status tu AI Pipeline." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "TONG KET KHOI DONG DICH VU FIREGUARD AI:" -ForegroundColor Cyan
Write-Host "  - Video Bridge: http://127.0.0.1:8787 (go2rtc: http://127.0.0.1:1984)" -ForegroundColor White
Write-Host "  - Backend API:  http://localhost:8080 (Health: /health)" -ForegroundColor White
Write-Host "  - Web Frontend: http://localhost:3000" -ForegroundColor White
Write-Host "  - AI Pipeline:  http://127.0.0.1:8790 (Health: /health, Status: /v1/pipeline/status)" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
