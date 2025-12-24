from fastapi import FastAPI
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
# In production, we build React and serve 'dist' from here or Nginx
# For now, placeholder for where static files will go
# app.mount("/", StaticFiles(directory="../frontend/dist", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
