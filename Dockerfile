# Build Stage for Frontend
FROM node:18-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./

# Build Arguments (passed via --build-arg)
ARG SUPABASE_URL
ARG SUPABASE_KEY

# Set as Environment Variables for the build process
ENV VITE_SUPABASE_URL=$SUPABASE_URL
ENV VITE_SUPABASE_KEY=$SUPABASE_KEY

# Check if variables are set (Fail build if missing)
RUN if [ -z "$VITE_SUPABASE_URL" ]; then echo "Build failed: VITE_SUPABASE_URL is missing. You must pass --build-arg SUPABASE_URL=..."; exit 1; fi

RUN npm run build

# Final Stage for Backend
FROM python:3.10-slim

WORKDIR /app

# Copy Backend Code
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app

# Copy Built Frontend Assets
COPY --from=frontend-build /app/frontend/dist ./frontend_dist

# Environment Variables
ENV PORT=8080

# Command to run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}
