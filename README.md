# WhyBuy Platform - Gemini Pipeline V5

A Next.js + FastAPI application for AI-powered product content generation, built with Supabase and deployed on Google Cloud Run.

## Features

- **Authentication**: Google OAuth via Supabase
- **Brand Isolation**: Multi-brand support with brand-specific data
- **Product Management**: 
  - List view with filters
  - Excel upload (Standard Shopify Export)
  - Hybrid storage (Database + Cloud Storage)
- **AI Pipeline**: 
  - Gemini-powered content generation
  - Job queue management
  - Real-time status updates
- **Shopify Integration**: Sync generated content to Shopify stores

## Tech Stack

- **Frontend**: Next.js 16.1.1, React 19, Tailwind CSS
- **Backend**: FastAPI, Python 3.10
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: Google Gemini API
- **Deployment**: Google Cloud Run

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.10+
- Supabase account
- Google Gemini API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd whybuy-supabase
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

4. **Frontend Setup**
   ```bash
   cd frontend-nextjs
   npm install
   cp .env.local.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

### Running Locally

**Option 1: Using the run script**
```bash
./run_app_nextjs.sh
```

**Option 2: Manual start**

Terminal 1 (Backend):
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8080
```

Terminal 2 (Frontend):
```bash
cd frontend-nextjs
npm run dev
```

Access the application at `http://localhost:3000`

## Deployment to Google Cloud Run

### Quick Deploy

1. **Set up Google Cloud**
   ```bash
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable cloudbuild.googleapis.com run.googleapis.com
   ```

2. **Configure secrets**
   ```bash
   echo -n "your-supabase-url" | gcloud secrets create SUPABASE_URL --data-file=-
   echo -n "your-supabase-key" | gcloud secrets create SUPABASE_KEY --data-file=-
   ```

3. **Deploy**
   ```bash
   gcloud builds submit --config cloudbuild.yaml
   ```

### Automatic Deployment from GitHub

1. **Connect GitHub repository** to Cloud Build
2. **Create a trigger** for the `main` branch
3. **Push to GitHub** - deployment happens automatically!

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md)

## Project Structure

```
whybuy-supabase/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── main.py         # FastAPI app entry point
│   │   ├── routers/        # API route handlers
│   │   ├── services/       # Business logic
│   │   └── auth.py         # Authentication
│   └── requirements.txt
├── frontend-nextjs/        # Next.js frontend
│   ├── app/                # Next.js app directory
│   ├── components/         # React components
│   ├── contexts/           # React contexts
│   └── lib/                # Utilities
├── Dockerfile              # Multi-stage Docker build
├── cloudbuild.yaml         # Cloud Build configuration
├── start.sh                # Container startup script
└── DEPLOYMENT.md           # Detailed deployment guide
```

## Environment Variables

### Required

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase anon key
- `NEXT_PUBLIC_SUPABASE_URL` - Public Supabase URL (for frontend)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public Supabase key (for frontend)

### Optional

- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)

See `.env.example` for a complete list.

## API Documentation

Once running, visit:
- **API Docs**: `http://localhost:8080/docs` (Swagger UI)
- **ReDoc**: `http://localhost:8080/redoc`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test locally
4. Submit a pull request

## License

[Your License Here]

## Support

For deployment issues, see [DEPLOYMENT.md](./DEPLOYMENT.md) troubleshooting section.
