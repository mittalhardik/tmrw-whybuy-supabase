#!/bin/sh
# This script generates a JavaScript file with runtime environment variables
# It will be called by the startup script before starting Next.js

# Output file - Next.js standalone puts public in the root
ENV_JS_FILE="/app/public/env.js"

echo "Generating runtime environment configuration..."

# Create the env.js file with actual environment variables from Cloud Run
cat > "$ENV_JS_FILE" << EOF
// Runtime environment variables injected by Cloud Run
window.env = {
  NEXT_PUBLIC_SUPABASE_URL: "${SUPABASE_URL}",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "${SUPABASE_KEY}"
};
EOF

echo "Runtime environment configuration generated at $ENV_JS_FILE"
