#!/usr/bin/env bash
set -e

# Resolve project ID from gcloud config or default to the EventSlot project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  PROJECT_ID="project-d46be384-233e-47fb-bb5"
fi

REGION="us-central1"
SERVICE="eventslot-web"
REPOSITORY="eventslot"
IMAGE_TAG=$(date +%Y%m%d-%H%M%S)

echo "============================================================"
echo "  Deploying EventSlot Staging to Google Cloud Run"
echo "  Project:     ${PROJECT_ID}"
echo "  Region:      ${REGION}"
echo "  Service:     ${SERVICE}"
echo "  Repository:  ${REPOSITORY}"
echo "  Image Tag:   ${IMAGE_TAG}"
echo "============================================================"

# Ensure project is set
gcloud config set project "${PROJECT_ID}"

# Ensure Artifact Registry repository exists
if ! gcloud artifacts repositories describe "${REPOSITORY}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  echo "==> Creating Artifact Registry repository ${REPOSITORY} in ${REGION}..."
  gcloud artifacts repositories create "${REPOSITORY}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="EventSlot images"
fi

# Submit Cloud Build
echo "==> Submitting build to Cloud Build..."
gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config=cloudbuild.yaml \
  --substitutions="_SERVICE=${SERVICE},_REGION=${REGION},_REPOSITORY=${REPOSITORY},_IMAGE_TAG=${IMAGE_TAG}" \
  .

echo "============================================================"
echo "  Deployment Complete!"
echo "============================================================"
