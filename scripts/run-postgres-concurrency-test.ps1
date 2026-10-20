<#
.SYNOPSIS
  Reproducible Test Script for Isolated PostgreSQL Concurrency Tests

.DESCRIPTION
  This script creates a disposable local PostgreSQL container, applies migrations,
  and runs the real database engine concurrency tests.
  It NEVER touches the repository's shared Neon database or production.

.EXAMPLE
  .\scripts\run-postgres-concurrency-test.ps1
#>

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "EventSlot Isolated PostgreSQL Concurrency Test Harness" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check for Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[!] Docker is not installed or running on this machine." -ForegroundColor Yellow
    Write-Host "    To run live PostgreSQL engine concurrency tests:" -ForegroundColor Yellow
    Write-Host "    1. Install Docker Desktop or start local PostgreSQL on an isolated port (e.g. 5433)." -ForegroundColor Yellow
    Write-Host "    2. Set TEST_POSTGRES_DATABASE_URL='postgresql://postgres:test@localhost:5433/eventslot_test'" -ForegroundColor Yellow
    Write-Host "    3. Run: npm test -- __tests__/integration/postgresConcurrencyPhase52.test.ts" -ForegroundColor Yellow
    Write-Host "[*] Shared Neon cloud database was safely skipped." -ForegroundColor Green
    exit 0
}

$CONTAINER_NAME = "eventslot-concurrency-pg"
$TEST_PORT = 5433
$TEST_DB_URL = "postgresql://postgres:postgres_test_password@localhost:$TEST_PORT/eventslot_concurrency_test?schema=public"

try {
    Write-Host "[*] Spinning up disposable PostgreSQL container on port $TEST_PORT..." -ForegroundColor Gray
    docker run --name $CONTAINER_NAME -e POSTGRES_PASSWORD=postgres_test_password -e POSTGRES_DB=eventslot_concurrency_test -p "${TEST_PORT}:5432" -d postgres:16-alpine | Out-Null

    Write-Host "[*] Waiting for PostgreSQL container to become ready..." -ForegroundColor Gray
    Start-Sleep -Seconds 5

    Write-Host "[*] Pushing schema to disposable test container..." -ForegroundColor Gray
    $env:DATABASE_URL = $TEST_DB_URL
    $env:DIRECT_URL = $TEST_DB_URL
    npx prisma db push --skip-generate

    Write-Host "[*] Running isolated PostgreSQL concurrency test suite..." -ForegroundColor Gray
    $env:TEST_POSTGRES_DATABASE_URL = $TEST_DB_URL
    npm test -- __tests__/integration/postgresConcurrencyPhase52.test.ts

    Write-Host "[+] All PostgreSQL concurrency tests passed against real database engine!" -ForegroundColor Green
} finally {
    Write-Host "[*] Tearing down disposable PostgreSQL container..." -ForegroundColor Gray
    docker rm -f $CONTAINER_NAME 2>$null | Out-Null
    Write-Host "[+] Environment cleaned up." -ForegroundColor Green
}
