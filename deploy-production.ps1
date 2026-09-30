# EventSlot Production Deployment Script for PowerShell
$ErrorActionPreference = "Stop"

$PROJECT_ID = gcloud config get-value project 2>$null
if (-not $PROJECT_ID -or $PROJECT_ID -eq "(unset)") {
    $PROJECT_ID = "project-d46be384-233e-47fb-bb5"
}

$REGION = "us-central1"
$SERVICE = "eventslot-web"
$REPOSITORY = "eventslot"
$IMAGE_TAG = (Get-Date -Format "yyyyMMdd-HHmmss")

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Deploying EventSlot to PRODUCTION (eventslot-web)" -ForegroundColor Green
Write-Host "  Project:     $PROJECT_ID"
Write-Host "  Region:      $REGION"
Write-Host "  Service:     $SERVICE"
Write-Host "  Repository:  $REPOSITORY"
Write-Host "  Image Tag:   $IMAGE_TAG"
Write-Host "  Target URL:  https://www.eventsslot.com"
Write-Host "============================================================" -ForegroundColor Cyan

# Ensure project is set
gcloud config set project $PROJECT_ID

# Submit Cloud Build for Production
Write-Host "==> Submitting build to Cloud Build (Production)..." -ForegroundColor Yellow
gcloud builds submit `
  --project="$PROJECT_ID" `
  --config=cloudbuild.yaml `
  --substitutions="_SERVICE=$SERVICE,_REGION=$REGION,_REPOSITORY=$REPOSITORY,_IMAGE_TAG=$IMAGE_TAG" `
  .

Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Production Deployment Complete!" -ForegroundColor Green
Write-Host "  Live at: https://www.eventsslot.com" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
