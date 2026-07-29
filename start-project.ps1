# Starts one clean API server and one Vite frontend for local development.
# Run from PowerShell: .\start-project.ps1

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Avoid an old server on localhost returning stale errors.
Get-NetTCPConnection -LocalPort 5000, 5173 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }

# Load local configuration without printing its values.
Get-Content (Join-Path $projectRoot ".env") | ForEach-Object {
  if ($_ -match "^([^=]+)=(.*)$") {
    Set-Item -Path ("Env:" + $matches[1]) -Value $matches[2]
  }
}

Push-Location $projectRoot
try {
  pnpm --filter @workspace/api-server run build
  if ($LASTEXITCODE -ne 0) { throw "API build failed; the project was not started." }

  Start-Process -FilePath pnpm.cmd -ArgumentList @("--filter", "@workspace/api-server", "run", "start") -WorkingDirectory $projectRoot -WindowStyle Hidden
  $env:PORT = "5173"
  Start-Process -FilePath pnpm.cmd -ArgumentList @("--filter", "@workspace/cmms", "run", "dev") -WorkingDirectory $projectRoot -WindowStyle Hidden
} finally {
  Pop-Location
}

Start-Sleep -Seconds 3
Write-Host "Project is running: http://localhost:5173/login" -ForegroundColor Green
