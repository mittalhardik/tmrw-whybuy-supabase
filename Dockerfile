# Build Stage for Frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Copy package files
COPY frontend-nextjs/package*.json ./
RUN npm ci

# Copy frontend source
COPY frontend-nextjs/ ./

# Set placeholder environment variables for build
# Real values will be injected at runtime via window.env
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_KEY=placeholder-anon-key
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js in standalone mode
RUN npm run build

# Final Stage - Python Backend serving Next.js
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies including Node.js and nginx
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    gnupg \
    nginx \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/app ./app

# Copy Next.js standalone build - server.js is in the standalone root
COPY --from=frontend-build /app/frontend/.next/standalone ./
COPY --from=frontend-build /app/frontend/.next/static ./.next/static
COPY --from=frontend-build /app/frontend/public ./public

# Copy startup scripts
COPY start.sh inject-env.sh ./
RUN chmod +x start.sh inject-env.sh

# Copy nginx configuration
COPY nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default && \
    ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

# Expose port
EXPOSE 8080

# Use startup script
CMD ["./start.sh"]
