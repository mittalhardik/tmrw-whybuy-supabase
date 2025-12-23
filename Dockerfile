# Build Stage for Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./

# Build Arguments (passed via --build-arg)
ARG SUPABASE_URL
ARG SUPABASE_KEY

# Write env vars to .env file for Vite to pick up
RUN echo "VITE_SUPABASE_URL=$SUPABASE_URL" > .env && \
    echo "VITE_SUPABASE_KEY=$SUPABASE_KEY" >> .env

# Verify .env creation (optional but good for logs)
RUN cat .env

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

# Copy Entrypoint Script
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Environment Variables
ENV PORT=8080

# Set Entrypoint
ENTRYPOINT ["./entrypoint.sh"]

# Command to run the application (passed to entrypoint)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
