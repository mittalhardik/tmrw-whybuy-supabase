#!/bin/bash

# Define the output path for env.js
ENV_JS_PATH="./frontend_dist/env.js"

echo "Generating runtime env.js at $ENV_JS_PATH"

# Create the file with environment variables
cat > "$ENV_JS_PATH" <<EOF
window.env = {
  VITE_SUPABASE_URL: "${SUPABASE_URL}",
  VITE_SUPABASE_KEY: "${SUPABASE_KEY}"
};
EOF

# Verify content (optional, safe for public keys)
echo "Generated env.js content:"
cat "$ENV_JS_PATH"

# Exec the main command (passed as arguments to this script, or default to uvicorn)
echo "Starting application..."
exec "$@"
