# scripts/stop_services.ps1
# Safe shutdown script for Factory Vision AI services

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "SilentlyContinue"

. "$PSScriptRoot\service_utils.ps1"
$projDir = Get-ProjectRoot -ScriptDir $PSScriptRoot

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "DANG DUNG CAC DICH VU FACTORY VISION AI..." -ForegroundColor Cyan
Write-Host "Thu muc du an: $projDir" -ForegroundColor DarkGray
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Gui tin hieu dung luong Camera AI neu AI Pipeline dang hoat dong
Write-Host "[1/4] Gui lenh ngat ket noi luong Camera AI..." -ForegroundColor Yellow
$aiStatus = Test-HttpHealth -Url "http://127.0.0.1:8790/health" -TimeoutSeconds 2
if ($aiStatus.Success) {
    try {
        $stopReq = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:8790/v1/pipeline/stop")
        $stopReq.Timeout = 3000
        $stopReq.Method = "POST"
        $stopReq.ContentType = "application/json"
        $stopReq.ContentLength = 2
        $stream = $stopReq.GetRequestStream()
        $writer = New-Object System.IO.StreamWriter($stream)
        $writer.Write("{}")
        $writer.Flush()
        $writer.Close()
        $stream.Close()
        $resp = $stopReq.GetResponse()
        $resp.Close()
        Write-Host "  -> Da gui lenh stop camera toi AI Pipeline." -ForegroundColor Green
    } catch {
        Write-Host "  -> Khong the gui lenh stop toi AI Pipeline (da offline hoac ban)." -ForegroundColor DarkGray
    }
} else {
    Write-Host "  -> AI Pipeline khong phan hoi (da dung san)." -ForegroundColor DarkGray
}

# 2. Dong cac cua so dich vu theo WINDOWTITLE
Write-Host "[2/4] Dong cac cua so dich vu cua du an..." -ForegroundColor Yellow
$windowTitles = @(
    "FireGuard AI - Video Bridge*",
    "FireGuard AI - Backend API*",
    "FireGuard AI - Web Frontend*",
    "FireGuard AI - AI Pipeline*"
)
foreach ($title in $windowTitles) {
    taskkill /FI "WINDOWTITLE eq $title" /F >$null 2>&1
}

# 3. Kiem tra va dung tien trinh go2rtc thuoc du an
Write-Host "[3/4] Kiem tra tien trinh go2rtc..." -ForegroundColor Yellow
$go2rtcProcs = Get-Process -Name "go2rtc" -ErrorAction SilentlyContinue
if ($go2rtcProcs) {
    foreach ($gp in $go2rtcProcs) {
        if (Test-IsProjectProcess -ProcessId $gp.Id -ProjectDir $projDir) {
            Stop-Process -Id $gp.Id -Force -ErrorAction SilentlyContinue
            Write-Host "  -> [DA DUNG] go2rtc.exe cua du an (PID: $($gp.Id))" -ForegroundColor Green
        } else {
            Write-Host "  -> [GIU NGUYEN] go2rtc.exe ngoai du an (PID: $($gp.Id))" -ForegroundColor Magenta
        }
    }
} else {
    Write-Host "  -> Khong co tien trinh go2rtc dang chay." -ForegroundColor DarkGray
}

# 4. Kiem tra cac cong va chi dung tien trinh XAC MINH thuoc du an
Write-Host "[4/4] Kiem tra giai phong cong (8080, 8790, 8787, 1984, 3000)..." -ForegroundColor Yellow

$serviceMap = @{
    8080 = "Backend API"
    8790 = "AI Pipeline"
    8787 = "Video Bridge"
    1984 = "go2rtc Stream"
    3000 = "Web Frontend"
}

$summary = @()

foreach ($port in @(8080, 8790, 8787, 1984, 3000)) {
    $svcName = $serviceMap[$port]
    $conns = Get-PortListenStatus -Port $port -ProjectDir $projDir
    if (-not $conns -or $conns.Count -eq 0) {
        $summary += [PSCustomObject]@{
            Port = $port
            DichVu = $svcName
            TrangThai = "DA DUNG (Cong trong)"
            KetQua = "OK"
        }
    } else {
        foreach ($conn in $conns) {
            if ($conn.IsProject) {
                Stop-Process -Id $conn.ProcessId -Force -ErrorAction SilentlyContinue
                Start-Sleep -Milliseconds 200
                # Kiem tra lai
                $recheck = Get-PortListenStatus -Port $port -ProjectDir $projDir
                if (-not $recheck -or $recheck.Count -eq 0) {
                    Write-Host "  -> [DA DUNG] Port $port ($svcName) - Tien trinh du an $($conn.Name) (PID: $($conn.ProcessId))" -ForegroundColor Green
                    $summary += [PSCustomObject]@{
                        Port = $port
                        DichVu = $svcName
                        TrangThai = "DA DUNG (PID: $($conn.ProcessId))"
                        KetQua = "OK"
                    }
                } else {
                    Write-Host "  -> [THAT BAI] Khong the dung tien trinh PID $($conn.ProcessId) tren port $port" -ForegroundColor Red
                    $summary += [PSCustomObject]@{
                        Port = $port
                        DichVu = $svcName
                        TrangThai = "KHONG DUNG DUOC (PID: $($conn.ProcessId))"
                        KetQua = "LOI"
                    }
                }
            } else {
                Write-Host "  -> [CANH BAO] Port $port dang bi chiem boi tien trinh NGOAI du an: $($conn.Name) (PID: $($conn.ProcessId)). KHONG DUNG." -ForegroundColor Magenta
                $summary += [PSCustomObject]@{
                    Port = $port
                    DichVu = $svcName
                    TrangThai = "TIEN TRINH NGOAI DU AN (PID: $($conn.ProcessId))"
                    KetQua = "GIU NGUYEN"
                }
            }
        }
    }
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "TONG HOP TRANG THAI DUNG DICH VU:" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
$summary | Format-Table -AutoSize
Write-Host ""
