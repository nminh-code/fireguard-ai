# scripts/service_utils.ps1
# Shared utility functions for Factory Vision AI service management

function Get-ProjectRoot {
    param([string]$ScriptDir = $PSScriptRoot)
    if ($ScriptDir) {
        $parent = Split-Path -Parent $ScriptDir
        if ($parent -and (Test-Path $parent)) {
            return (Resolve-Path $parent).Path
        }
    }
    if (Test-Path "package.json") {
        return (Resolve-Path ".").Path
    }
    return "D:\NewCameraAI\fireguard-ai"
}

function Get-ProcessDetails {
    param([int]$ProcessId)
    try {
        $p = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
        if ($p) {
            return [PSCustomObject]@{
                Id = $p.ProcessId
                Name = $p.Name
                CommandLine = if ($p.CommandLine) { $p.CommandLine } else { "" }
                ExecutablePath = if ($p.ExecutablePath) { $p.ExecutablePath } else { "" }
                ParentProcessId = $p.ParentProcessId
            }
        }
    } catch {}
    return $null
}

function Test-IsProjectProcess {
    param(
        [int]$ProcessId,
        [string]$ProjectDir
    )
    if (-not $ProcessId -or $ProcessId -le 0) { return $false }
    if ([string]::IsNullOrWhiteSpace($ProjectDir)) { return $false }

    $details = Get-ProcessDetails -ProcessId $ProcessId
    if (-not $details) { return $false }

    $projNorm = $ProjectDir.Replace('/', '\').TrimEnd('\')
    if ([string]::IsNullOrWhiteSpace($projNorm)) { return $false }

    # 1. Direct path check in ExecutablePath
    if ($details.ExecutablePath -and $details.ExecutablePath.IndexOf($projNorm, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $true
    }

    # 2. Check project path in CommandLine
    if ($details.CommandLine -and $details.CommandLine.IndexOf($projNorm, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return $true
    }

    # 3. Check specific project signatures in CommandLine
    $signatures = @(
        'video-bridge\server.mjs', 'video-bridge/server.mjs',
        'ai-pipeline\server.mjs',  'ai-pipeline/server.mjs',
        'backend\src\server.ts',   'backend/src/server.ts',
        'video-bridge\bin\go2rtc.exe'
    )
    foreach ($sig in $signatures) {
        if ($details.CommandLine -and $details.CommandLine.IndexOf($sig, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            return $true
        }
    }

    # 4. Check if parent process belongs to project
    if ($details.ParentProcessId -and $details.ParentProcessId -ne 0) {
        $parent = Get-ProcessDetails -ProcessId $details.ParentProcessId
        if ($parent) {
            if ($parent.CommandLine -and $parent.CommandLine.IndexOf($projNorm, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                return $true
            }
        }
    }

    return $false
}

function Get-PortListenStatus {
    param(
        [int]$Port,
        [string]$ProjectDir
    )
    $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    $results = @()
    if ($connections) {
        $uniquePids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($pidVal in $uniquePids) {
            $details = Get-ProcessDetails -ProcessId $pidVal
            $isProj = Test-IsProjectProcess -ProcessId $pidVal -ProjectDir $ProjectDir
            $results += [PSCustomObject]@{
                Port = $Port
                ProcessId = $pidVal
                Name = if ($details) { $details.Name } else { "Unknown" }
                CommandLine = if ($details) { $details.CommandLine } else { "" }
                IsProject = $isProj
            }
        }
    }
    return $results
}

function Test-HttpHealth {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 3
    )
    try {
        $req = [System.Net.HttpWebRequest]::Create($Url)
        $req.Timeout = $TimeoutSeconds * 1000
        $req.Method = "GET"
        $req.KeepAlive = $false
        
        $response = $req.GetResponse()
        $stream = $response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        $code = [int]$response.StatusCode
        $response.Close()

        $json = $null
        try { $json = $content | ConvertFrom-Json } catch {}

        return [PSCustomObject]@{
            Success = $true
            StatusCode = $code
            Content = $content
            Json = $json
            Error = $null
        }
    } catch [System.Net.WebException] {
        $statusCode = 0
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return [PSCustomObject]@{
            Success = $false
            StatusCode = $statusCode
            Content = $null
            Json = $null
            Error = $_.Exception.Message
        }
    } catch {
        return [PSCustomObject]@{
            Success = $false
            StatusCode = 0
            Content = $null
            Json = $null
            Error = $_.Exception.Message
        }
    }
}
