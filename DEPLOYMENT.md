# Deployment Guide - Google Cloud Run

This guide walks you through deploying the WhyBuy platform to Google Cloud Run with automatic deployment from GitHub using Google Cloud Build.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Configure Secrets](#configure-secrets)
- [Set Up Cloud Build Trigger](#set-up-cloud-build-trigger)
- [First Deployment](#first-deployment)
- [Verify Deployment](#verify-deployment)
- [Troubleshooting](#troubleshooting)
- [Environment Variables](#environment-variables)

## Prerequisites

Before you begin, ensure you have:

1. **Google Cloud Project**
   - A GCP project with billing enabled
   - Project ID ready (e.g., `my-whybuy-project`)

2. **GitHub Repository**
   - Code pushed to GitHub
   - Repository accessible to Google Cloud Build

3. **Required Credentials**
   - Supabase URL and Anon Key
   - (Optional) Google OAuth credentials

4. **Local Tools** (for manual deployment)
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) installed
   - Docker installed (for local testing)

## Initial Setup

### 1. Enable Required APIs

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com
```

### 2. Configure IAM Permissions

Grant Cloud Build permission to deploy to Cloud Run:

```bash
# Get the Cloud Build service account
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
export CLOUD_BUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/run.admin"

# Grant Service Account User role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/iam.serviceAccountUser"

# Grant Secret Manager Secret Accessor role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${CLOUD_BUILD_SA}" \
  --role="roles/secretmanager.secretAccessor"
```

## Configure Secrets

Store sensitive environment variables in Google Cloud Secret Manager:

### 1. Create Secrets

```bash
# Supabase URL
echo -n "your-supabase-url" | gcloud secrets create SUPABASE_URL \
  --data-file=- \
  --replication-policy="automatic"

# Supabase Key
echo -n "your-supabase-anon-key" | gcloud secrets create SUPABASE_KEY \
  --data-file=- \
  --replication-policy="automatic"

# Optional: Google OAuth credentials
echo -n "your-google-client-id" | gcloud secrets create GOOGLE_CLIENT_ID \
  --data-file=- \
  --replication-policy="automatic"

echo -n "your-google-client-secret" | gcloud secrets create GOOGLE_CLIENT_SECRET \
  --data-file=- \
  --replication-policy="automatic"
```

### 2. Grant Cloud Run Access to Secrets

```bash
# Get the default compute service account
export COMPUTE_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Grant access to secrets
for SECRET in SUPABASE_URL SUPABASE_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:${COMPUTE_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

## Set Up Cloud Build Trigger

### Option 1: Using Google Cloud Console (Recommended)

1. Go to [Cloud Build Triggers](https://console.cloud.google.com/cloud-build/triggers)
2. Click **"Create Trigger"**
3. Configure the trigger:
   - **Name**: `whybuy-deploy-trigger`
   - **Event**: Push to a branch
   - **Source**: Connect your GitHub repository
   - **Branch**: `^main$` (or your default branch)
   - **Configuration**: Cloud Build configuration file (yaml or json)
   - **Location**: `cloudbuild.yaml`
4. Click **"Create"**

### Option 2: Using gcloud CLI

First, connect your GitHub repository:

```bash
# This will open a browser to connect your GitHub account
gcloud beta builds triggers create github \
  --name="whybuy-deploy-trigger" \
  --repo-name="your-repo-name" \
  --repo-owner="your-github-username" \
  --branch-pattern="^main$" \
  --build-config="cloudbuild.yaml"
```

## First Deployment

### Automatic Deployment (via GitHub Push)

Once the Cloud Build trigger is set up:

```bash
# Make any change and push to main branch
git add .
git commit -m "Deploy to Cloud Run"
git push origin main
```

The deployment will start automatically. Monitor progress:
- [Cloud Build History](https://console.cloud.google.com/cloud-build/builds)

### Manual Deployment (for testing)

```bash
# Build and deploy manually
gcloud builds submit --config cloudbuild.yaml

# Or deploy directly without Cloud Build
gcloud run deploy whybuy-platform \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars NODE_ENV=production \
  --set-secrets SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_KEY=SUPABASE_KEY:latest
```

## Verify Deployment

### 1. Get Service URL

```bash
gcloud run services describe whybuy-platform \
  --region us-central1 \
  --format 'value(status.url)'
```

### 2. Test Health Endpoint

```bash
SERVICE_URL=$(gcloud run services describe whybuy-platform --region us-central1 --format 'value(status.url)')
curl $SERVICE_URL/api/health
```

Expected response:
```json
{"status":"ok","environment":"production"}
```

### 3. Open in Browser

```bash
# Open the service URL
open $SERVICE_URL
```

## Troubleshooting

### Build Fails

**Check build logs:**
```bash
# View recent builds
gcloud builds list --limit 5

# View specific build logs
gcloud builds log <BUILD_ID>
```

**Common issues:**
- **Out of memory**: Increase machine type in `cloudbuild.yaml`
- **Timeout**: Increase timeout in `cloudbuild.yaml`
- **Permission denied**: Check IAM permissions

### Deployment Fails

**Check Cloud Run logs:**
```bash
gcloud run services logs read whybuy-platform \
  --region us-central1 \
  --limit 50
```

**Common issues:**
- **Container crashes**: Check application logs for errors
- **Port mismatch**: Ensure app listens on `$PORT` environment variable
- **Missing secrets**: Verify secrets are created and accessible

### Application Errors

**View real-time logs:**
```bash
gcloud run services logs tail whybuy-platform --region us-central1
```

**Check environment variables:**
```bash
gcloud run services describe whybuy-platform \
  --region us-central1 \
  --format 'value(spec.template.spec.containers[0].env)'
```

### Update Secrets

```bash
# Update a secret
echo -n "new-value" | gcloud secrets versions add SUPABASE_URL --data-file=-

# Redeploy to use new secret version
gcloud run services update whybuy-platform \
  --region us-central1 \
  --update-secrets SUPABASE_URL=SUPABASE_URL:latest
```

## Environment Variables

### Required Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `SUPABASE_URL` | Supabase project URL | Secret Manager |
| `SUPABASE_KEY` | Supabase anon key | Secret Manager |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL (for Next.js) | Maps to SUPABASE_URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase key (for Next.js) | Maps to SUPABASE_KEY |
| `NODE_ENV` | Environment (production) | Set in cloudbuild.yaml |
| `PORT` | Port to listen on | Auto-set by Cloud Run |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | - |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | - |
| `ALLOWED_ORIGINS` | CORS allowed origins | `*` |

### Updating cloudbuild.yaml

Edit the `--set-env-vars` and `--set-secrets` flags in `cloudbuild.yaml`:

```yaml
- '--set-env-vars'
- 'NODE_ENV=production,CUSTOM_VAR=value'
- '--set-secrets'
- 'SUPABASE_URL=SUPABASE_URL:latest,SUPABASE_KEY=SUPABASE_KEY:latest'
```

## Custom Domain

### 1. Map Custom Domain

```bash
gcloud run services add-iam-policy-binding whybuy-platform \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"

gcloud beta run domain-mappings create \
  --service whybuy-platform \
  --domain yourdomain.com \
  --region us-central1
```

### 2. Update DNS

Follow the instructions provided by the domain mapping command to update your DNS records.

### 3. Update CORS

Update the `ALLOWED_ORIGINS` environment variable:

```bash
gcloud run services update whybuy-platform \
  --region us-central1 \
  --update-env-vars ALLOWED_ORIGINS=https://yourdomain.com
```

## Monitoring & Scaling

### View Metrics

```bash
# Open Cloud Run metrics dashboard
open "https://console.cloud.google.com/run/detail/us-central1/whybuy-platform/metrics?project=$PROJECT_ID"
```

### Update Scaling Configuration

```bash
gcloud run services update whybuy-platform \
  --region us-central1 \
  --min-instances 1 \
  --max-instances 10 \
  --concurrency 80
```

### Update Resources

```bash
gcloud run services update whybuy-platform \
  --region us-central1 \
  --memory 4Gi \
  --cpu 4
```

## Cost Optimization

1. **Set minimum instances to 0** (default) to scale to zero when not in use
2. **Use appropriate memory/CPU** - Start with 2Gi/2 CPU and adjust based on metrics
3. **Enable request timeout** - Set appropriate timeout to prevent long-running requests
4. **Monitor usage** - Use Cloud Monitoring to track requests and costs

## Next Steps

- Set up [Cloud Monitoring alerts](https://cloud.google.com/monitoring/alerts)
- Configure [Cloud Armor](https://cloud.google.com/armor) for DDoS protection
- Set up [Cloud CDN](https://cloud.google.com/cdn) for static assets
- Implement [Cloud Logging](https://cloud.google.com/logging) for better observability
- Configure [Uptime checks](https://cloud.google.com/monitoring/uptime-checks)

## Support

For issues related to:
- **Google Cloud**: [GCP Support](https://cloud.google.com/support)
- **Cloud Run**: [Cloud Run Documentation](https://cloud.google.com/run/docs)
- **Cloud Build**: [Cloud Build Documentation](https://cloud.google.com/build/docs)
