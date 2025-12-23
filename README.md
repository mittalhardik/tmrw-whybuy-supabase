# Gemini Pipeline V5 (Supabase + Cloud Run)

## Setup

### 1. Environment
Ensure you have `.env` in the root and `frontend/.env` configured with your Supabase credentials.

### 2. Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

## Features Implemented
- **Authentication**: via Supabase (Google Auth).
- **Brand Isolation**: Logic ready in backend, UI switcher in Header.
- **Products**:
    - List view with Filters.
    - Upload Excel (Standard Shopify Export).
    - **Hybrid Storage**: Data saved to DB *and* `products.json` in Storage for parity.
- **Pipeline**:
    - Job triggering logic.
    - Mocked Gemini Service (ready for logic porting).

## Deployment
Build the Dockerfile in the root:
```bash
docker build -t gemini-pipeline .
# Deploy to Cloud Run
gcloud run deploy gemini-pipeline --image gemini-pipeline --platform managed
```
