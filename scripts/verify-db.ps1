# DevSentinel Database Health Verification Script
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  DevSentinel Database Health Check" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$dbHost = "127.0.0.1"
$dbPort = if ($env:POSTGRES_PORT) { $env:POSTGRES_PORT } else { "5433" }
$dbUser = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "devsentinel" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "devsentinel_db" }

Write-Host "Target: ${dbUser}@${dbHost}:${dbPort}/${dbName}" -ForegroundColor DarkGray

# 1. Container Status Check
Write-Host "`n[1/4] Checking Docker Container..." -NoNewline
$containerStatus = docker inspect --format="{{.State.Status}} (Health: {{.State.Health.Status}})" devsentinel-postgres 2>$null
if ($containerStatus) {
    Write-Host " [ONLINE]" -ForegroundColor Green
    Write-Host "      Container State: $containerStatus" -ForegroundColor DarkGray
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    Write-Host "      Container 'devsentinel-postgres' is not running." -ForegroundColor Yellow
    exit 1
}

# 2. Resource Footprint Check
Write-Host "`n[2/4] Checking Container Resource Consumption..." -NoNewline
$stats = docker stats --no-stream --format "{{.MemUsage}} ({{.MemPerc}}), CPU: {{.CPUPerc}}" devsentinel-postgres 2>$null
Write-Host " [OK]" -ForegroundColor Green
Write-Host "      RAM / CPU Footprint: $stats" -ForegroundColor DarkGray

# 3. Connection & Query Verification
Write-Host "`n[3/4] Verifying PostgreSQL Connectivity..." -NoNewline
$query = "SELECT current_database(), current_user;"
$result = docker compose exec postgres psql -U $dbUser -d $dbName -t -c $query 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host " [CONNECTED]" -ForegroundColor Green
    Write-Host "      Session: $($result.Trim())" -ForegroundColor DarkGray
} else {
    Write-Host " [FAILED]" -ForegroundColor Red
    exit 1
}

# 4. pgvector Verification
Write-Host "`n[4/4] Verifying pgvector Extension..." -NoNewline
$vecResult = docker compose exec postgres psql -U $dbUser -d $dbName -t -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';" 2>$null
if ($vecResult -match "vector") {
    Write-Host " [ENABLED]" -ForegroundColor Green
    Write-Host "      Extension: $($vecResult.Trim())" -ForegroundColor DarkGray
} else {
    Write-Host " [WARNING] pgvector extension not found. Enabling now..." -ForegroundColor Yellow
    docker compose exec postgres psql -U $dbUser -d $dbName -c "CREATE EXTENSION IF NOT EXISTS vector;"
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "  Database is healthy and ready for use!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
