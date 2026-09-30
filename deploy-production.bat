@echo off
setlocal enabledelayedexpansion

for /f "tokens=*" %%i in ('gcloud config get-value project 2^>nul') do set PROJECT_ID=%%i
if "%PROJECT_ID%"=="" set PROJECT_ID=project-d46be384-233e-47fb-bb5
if "%PROJECT_ID%"=="(unset)" set PROJECT_ID=project-d46be384-233e-47fb-bb5

set REGION=us-central1
set SERVICE=eventslot-web
set REPOSITORY=eventslot

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set dt=%%I
set IMAGE_TAG=%dt:~0,8%-%dt:~8,6%

echo ============================================================
echo   Deploying EventSlot to PRODUCTION (eventslot-web)
echo   Project:     %PROJECT_ID%
echo   Region:      %REGION%
echo   Service:     %SERVICE%
echo   Repository:  %REPOSITORY%
echo   Image Tag:   %IMAGE_TAG%
echo   Target URL:  https://www.eventsslot.com
echo ============================================================

call gcloud config set project %PROJECT_ID%

echo ==^> Submitting build to Cloud Build (Production)...
call gcloud builds submit --project="%PROJECT_ID%" --config=cloudbuild.yaml --substitutions="_SERVICE=%SERVICE%,_REGION=%REGION%,_REPOSITORY=%REPOSITORY%,_IMAGE_TAG=%IMAGE_TAG%" .

echo ============================================================
echo   Production Deployment Complete!
echo   Live at: https://www.eventsslot.com
echo ============================================================
