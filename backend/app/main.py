from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

app = FastAPI(title="Gemini Pipeline API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for now, restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health Check
@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# Routers
from .routers import brands, products, pipeline, prompts, dashboard
app.include_router(brands.router)
app.include_router(products.router)
app.include_router(pipeline.router)
app.include_router(prompts.router)
app.include_router(dashboard.router)

# Static files (Frontend)
from fastapi.responses import FileResponse

# Determine path to frontend build
frontend_dist_path = Path("frontend_dist")  # Docker path
if not frontend_dist_path.exists():
    frontend_dist_path = Path("../frontend/dist")  # Local dev path

if frontend_dist_path.exists():
    # Mount assets folder explicitly if it exists (Vite output usually has an assets folder)
    assets_path = frontend_dist_path / "assets"
    if assets_path.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_path)), name="assets")

    # Serve runtime environment configuration
    @app.get("/env.js")
    async def get_env():
        supabase_url = os.environ.get("SUPABASE_URL", "")
        supabase_key = os.environ.get("SUPABASE_KEY", "")
        # Add any other public env vars here
        content = f"""
        window.env = {{
            VITE_SUPABASE_URL: "{supabase_url}",
            VITE_SUPABASE_KEY: "{supabase_key}"
        }};
        """
        return Response(content=content, media_type="application/javascript")

    # Catch-all route to serve index.html or other static files in root
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Prevent accessing API routes (though they are matched first)
        if full_path.startswith("api/"):
            return {"detail": "Not Found"}
            
        # Check if file exists (e.g., vite.svg, favicon.ico)
        file_path = frontend_dist_path / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
            
        # Fallback to index.html for SPA routing
        return FileResponse(frontend_dist_path / "index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
