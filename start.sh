#!/bin/bash
set -e

# Get the port from environment or default to 8080
export PORT=${PORT:-8080}

echo "Starting application on port $PORT..."

# Inject runtime environment variables into Next.js
echo "Injecting runtime environment variables..."
/app/inject-env.sh

# Start FastAPI backend in background on port 8080 (internal)
echo "Starting FastAPI backend on port 8080..."
uvicorn app.main:app --host 127.0.0.1 --port 8080 &
BACKEND_PID=$!

# Wait for backend to be ready
echo "Waiting for backend to start..."
for i in {1..30}; do
    if curl -f http://127.0.0.1:8080/api/health > /dev/null 2>&1; then
        echo "Backend is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "Backend failed to start"
        kill $BACKEND_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

# Start Next.js on the main PORT (exposed to Cloud Run)
echo "Starting Next.js frontend on port $PORT..."
cd /app/nextjs
node server.js &
FRONTEND_PID=$!

# Wait for frontend to be ready
echo "Waiting for frontend to start..."
sleep 5

if ! kill -0 $FRONTEND_PID 2>/dev/null; then
    echo "Frontend failed to start"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo "Application started successfully!"
echo "Frontend (Next.js): http://0.0.0.0:$PORT"
echo "Backend (FastAPI): http://127.0.0.1:8080"

# Function to handle shutdown
cleanup() {
    echo "Shutting down..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
    wait $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
    exit 0
}

# Trap termination signals
trap cleanup SIGTERM SIGINT SIGQUIT

# Wait for any process to exit
wait -n

# If we reach here, one process died
echo "A process exited unexpectedly"
cleanup
exit 1
