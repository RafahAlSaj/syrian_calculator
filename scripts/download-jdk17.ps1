param(
    [string]$ToolsDir = "$env:USERPROFILE\dev-tools"
)

$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Path $ToolsDir -Force | Out-Null
Set-Location $ToolsDir

$url = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse'
$zipPath = Join-Path $ToolsDir 'jdk17.zip'

while ($true) {
    curl.exe -L -C - --max-time 240 $url -o $zipPath

    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::OpenRead($zipPath).Dispose()
        Write-Output "JDK archive is complete: $zipPath"
        break
    }
    catch {
        $size = (Get-Item $zipPath).Length
        Write-Output "JDK archive incomplete (size: $size). Retrying..."
        Start-Sleep -Seconds 2
    }
}

Expand-Archive -Path $zipPath -DestinationPath $ToolsDir -Force
$jdkDir = Get-ChildItem -Path $ToolsDir -Directory | Where-Object { $_.Name -like 'jdk-17*' -or $_.Name -like 'OpenJDK17*' } | Select-Object -First 1

if (-not $jdkDir) {
    throw 'JDK folder was not found after extraction.'
}

Write-Output "JDK extracted to: $($jdkDir.FullName)"