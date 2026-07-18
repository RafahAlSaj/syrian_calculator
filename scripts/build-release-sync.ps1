param(
    [string]$ProjectRoot = "d:\xampp\htdocs\syrian_calculator",
    [string]$JdkHome = "C:\Users\Dev1\dev-tools\jdk-17"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ProjectRoot)) {
    throw "Project root not found: $ProjectRoot"
}

if (-not (Test-Path (Join-Path $JdkHome 'bin\java.exe'))) {
    throw "JDK 17 not found: $JdkHome"
}

$releaseDir = Join-Path $ProjectRoot 'ready'
New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null

$env:JAVA_HOME = $JdkHome
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

Push-Location (Join-Path $ProjectRoot 'android')
try {
    .\gradlew.bat --no-daemon clean assembleRelease bundleRelease
}
finally {
    Pop-Location
}

$apkCandidates = @(
    (Join-Path $ProjectRoot 'android\app\build\outputs\apk\release\app-release.apk'),
    (Join-Path $ProjectRoot 'android\app\build\outputs\apk\release\app-release-unsigned.apk')
)
$aabCandidates = @(
    (Join-Path $ProjectRoot 'android\app\build\outputs\bundle\release\app-release-signed.aab'),
    (Join-Path $ProjectRoot 'android\app\build\outputs\bundle\release\app-release.aab')
)

$apkSource = $apkCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
$aabSource = $aabCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $apkSource) {
    throw "Release APK not found in expected paths."
}
if (-not $aabSource) {
    throw "Release AAB not found in expected paths."
}

$apkTarget = Join-Path $releaseDir 'app-release.apk'
$aabTarget = Join-Path $releaseDir 'app-release.aab'

Copy-Item -Path $apkSource -Destination $apkTarget -Force
Copy-Item -Path $aabSource -Destination $aabTarget -Force

Write-Output "Release artifacts synced:"
Write-Output "- $apkTarget"
Write-Output "- $aabTarget"
