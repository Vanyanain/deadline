# Deploying Deadline to Google Cloud Run

The app ships as **one container**: FastAPI serves the built React app, so you get
a single public HTTPS URL. Data lives in **Firestore** in production.

You only do the **one-time setup** once. After that, deploying is one command.

---

## 0. Prerequisites (one-time, on your machine)

Install the Google Cloud CLI if you don't have it:
- macOS: `brew install --cask google-cloud-sdk`  (or see https://cloud.google.com/sdk/docs/install)

Check it works: `gcloud --version`

---

## 1. One-time project setup

```bash
# Log in (opens a browser)
gcloud auth login

# Use your project
gcloud config set project deadline-500515

# Enable the APIs we need
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  firestore.googleapis.com
```

**Billing:** Cloud Run requires a billing account linked to the project.
The **free tier covers ~2,000,000 requests/month**, so a hackathon demo won't be
charged — but the account must exist. If `gcloud run deploy` later complains about
billing, enable it at https://console.cloud.google.com/billing (link your project).

---

## 2. Create the Firestore database (one-time)

```bash
gcloud firestore databases create --location=asia-south1 --type=firestore-native
```
*(Location is permanent. `asia-south1` = Mumbai. Use `nam5` for US if you prefer.)*

---

## 3. Deploy

From the repo root:

```bash
./deploy.sh
```

This builds the container (React + FastAPI) and deploys it. It reads your secrets
from `backend/.env`, so make sure that file has `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`,
and `JWT_SECRET` filled in.

- The **first** deploy takes ~3–5 min (it builds the image).
- When it finishes, gcloud prints your **Service URL** like
  `https://deadline-xxxxxxxx-el.a.run.app`. **Copy it.**

> If gcloud asks to enable an API or grant Cloud Build permissions, answer **yes**.

---

## 4. Make Google Sign-In work on the live URL (one-time)

Google only allows sign-in from origins you've whitelisted.

1. Go to https://console.cloud.google.com/auth/clients?project=deadline-500515
2. Open your **Deadline Web** client.
3. Under **Authorized JavaScript origins**, click **+ Add URI** and paste your
   Cloud Run URL **with no trailing slash**, e.g. `https://deadline-xxxxxxxx-el.a.run.app`
4. **Save.** (Changes can take a few minutes to take effect.)

Email/password sign-in works immediately — this step is only for the Google button.

---

## 5. If Firestore writes fail with a permissions error

The Cloud Run service runs as the default compute service account. Grant it
Firestore access (only if you see permission errors in the logs):

```bash
PROJECT_NUMBER=$(gcloud projects describe deadline-500515 --format='value(projectNumber)')
gcloud projects add-iam-policy-binding deadline-500515 \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

---

## Re-deploying after code changes

Just run `./deploy.sh` again. Same URL, new version.

## Useful

- Logs:   `gcloud run services logs read deadline --region asia-south1`
- Delete: `gcloud run services delete deadline --region asia-south1`
