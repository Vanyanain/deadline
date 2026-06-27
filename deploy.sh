#!/usr/bin/env bash
# Deploy Deadline to Google Cloud Run (single container: FastAPI + built React).
# Reads secrets from backend/.env (which is gitignored) so they never hit git.
#
# Usage:  ./deploy.sh           (after the one-time setup in DEPLOY.md)
set -euo pipefail
cd "$(dirname "$0")"

REGION="${REGION:-asia-south1}"
SERVICE="${SERVICE:-deadline}"

if [[ ! -f backend/.env ]]; then
  echo "✗ backend/.env not found — it holds GEMINI_API_KEY / GOOGLE_CLIENT_ID / JWT_SECRET."
  exit 1
fi

# Load values from backend/.env
set -a; source backend/.env; set +a

: "${GEMINI_API_KEY:?Set GEMINI_API_KEY in backend/.env}"
: "${GOOGLE_CLIENT_ID:?Set GOOGLE_CLIENT_ID in backend/.env}"
: "${JWT_SECRET:?Set JWT_SECRET in backend/.env}"
GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash-lite}"

echo "Deploying '$SERVICE' to region '$REGION'…"
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GEMINI_API_KEY=${GEMINI_API_KEY},GEMINI_MODEL=${GEMINI_MODEL},GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID},JWT_SECRET=${JWT_SECRET},USE_FIRESTORE=1"

echo ""
echo "✓ Deployed. Your public URL is shown above (https://${SERVICE}-...-${REGION}.run.app)."
echo "  Next: add that URL to your OAuth client's Authorized JavaScript origins (see DEPLOY.md)."
