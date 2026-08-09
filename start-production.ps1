# Builds and starts the CMMS as one production web service for an internal network.
# Run from PowerShell: powershell -ExecutionPolicy Bypass -File .\start-production.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$productionPort = 8080

Get-Content (Join-Path $projectRoot ".env") | ForEach-Object {
  if ($_ -match "^([^#=]+)=(.*)$") {
    Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2]
  }
}

$listener = Get-NetTCPConnection -LocalPort $productionPort -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  throw "Port $productionPort is already in use. Stop the existing CMMS production service first."
}

$env:NODE_ENV = "production"
$env:PORT = [string]$productionPort
$env:COOKIE_SECURE = "false"
if (-not $env:DB_POOL_MAX) { $env:DB_POOL_MAX = "20" }

Push-Location $projectRoot
try {
  pnpm --filter @workspace/cmms run build
  if ($LASTEXITCODE -ne 0) { throw "Web build failed." }

  pnpm --filter @workspace/api-server run build
  if ($LASTEXITCODE -ne 0) { throw "API build failed." }

  $logsDirectory = Join-Path $projectRoot "logs"
  New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
  $outputLog = Join-Path $logsDirectory "cmms-production.log"
  $errorLog = Join-Path $logsDirectory "cmms-production-error.log"

  Start-Process -FilePath "node.exe" `
    -ArgumentList @("--enable-source-maps", "./artifacts/api-server/dist/index.mjs") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $outputLog `
    -RedirectStandardError $errorLog
} finally {
  Pop-Location
}

Start-Sleep -Seconds 3
$health = Invoke-WebRequest -Uri "http://localhost:$productionPort/api/healthz" -UseBasicParsing -TimeoutSec 10
if ($health.StatusCode -ne 200) { throw "Production health check failed." }

Write-Host "CMMS production is running: http://localhost:$productionPort/login" -ForegroundColor Green
