from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

app = FastAPI(title="Gemini Pipeline API")

# CORS - Configure based on environment
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
if allowed_origins == ["*"]:
    # Development mode - allow all
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Production mode - restrict to specific origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Health Check
@app.get("/api/health")
async def health_check():
    return {"status": "ok", "environment": os.getenv("NODE_ENV", "development")}

# Routers
from .routers import brands, products, pipeline, prompts, dashboard, sync
app.include_router(brands.router)
app.include_router(products.router)
app.include_router(pipeline.router)
app.include_router(prompts.router)
app.include_router(dashboard.router)
app.include_router(sync.router)

# Static files (Frontend)
# In production, Next.js runs separately and proxies API requests here
# No need to serve static files from FastAPI

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
