#!/bin/bash

# Function to kill all background processes on exit
cleanup() {
    echo "Stopping all services..."
    # Kill all child processes of this script
    pkill -P $$ 
    exit
}

# Trap SIGINT (Ctrl+C) and call cleanup
trap cleanup SIGINT

echo "Starting Backend..."
cd backend
# Check if venv exists, if not create it (optional safety)
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Run uvicorn in background
uvicorn app.main:app --host 0.0.0.0 --port 8080 --reload &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

# Run frontend in background
npm run dev &
FRONTEND_PID=$!
cd ..

echo "App is running."
echo "Backend: http://localhost:8080"
echo "Frontend: http://localhost:5173" 
echo "Press Ctrl+C to stop both."

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
