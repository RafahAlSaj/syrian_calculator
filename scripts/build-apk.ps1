param(
    [string]$ProjectRoot = "d:\xampp\htdocs\syrian_calculator",
    [string]$ToolsDir = "$env:USERPROFILE\dev-tools"
)

$ErrorActionPreference = 'Stop'

$nodeDir = Join-Path $ToolsDir 'node-v20.19.5-win-x64'
if (-not (Test-Path (Join-Path $nodeDir 'node.exe'))) {
    throw "Node.js not found at $nodeDir."
}

$jdkDir = Get-ChildItem -Path $ToolsDir -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -like 'jdk-17*' -or $_.Name -like 'OpenJDK17*' } | Select-Object -First 1
if (-not $jdkDir) {
    throw "JDK 17 not found in $ToolsDir. Run scripts/download-jdk17.ps1 first."
}

$env:PATH = "$nodeDir;$($jdkDir.FullName)\bin;$env:PATH"
$env:JAVA_HOME = $jdkDir.FullName

Push-Location $ProjectRoot
try {
    npm install
    npm run build:web
    npm run cap:sync

    Push-Location (Join-Path $ProjectRoot 'android')
    try {
        .\gradlew.bat assembleDebug
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}

Write-Output 'APK build complete.'
Write-Output 'Output: android\app\build\outputs\apk\debug\app-debug.apk'