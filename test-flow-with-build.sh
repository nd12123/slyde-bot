#!/bin/bash

echo "════════════════════════════════════════════════"
echo "  Telegram Auth Flow Test (Using Built Binary)"
echo "════════════════════════════════════════════════"
echo ""

# Kill any existing processes
echo "Killing any existing bot processes..."
pkill -f "node.*dist/index.js" || true
sleep 2

# Configuration
SUPABASE_URL="https://cpbodmxgevxxvtkyjofz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYm9kbXhnZXZ4eHZ0a3lqb2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjA5NzIsImV4cCI6MjA3NzEzNjk3Mn0.rTm2rj7b9scUN_Z-RLuSG9U-RRqXJ8JJ3hf9zQ-mHLA"
BOT_URL="http://localhost:3001"
TEST_TELEGRAM_ID=555999

# Start the bot (not with hot reload)
echo "STEP 1: Starting bot (no hot reload)..."
npm start &
BOT_PID=$!
sleep 5

# Test if health check passes
echo ""
echo "STEP 2: Checking bot health..."
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q "ok"; then
  echo "✅ Bot is healthy"
else
  echo "❌ Bot health check failed"
  kill $BOT_PID
  exit 1
fi
echo ""

# Generate test token
echo "STEP 3: Generate test token..."
TOKEN_RESPONSE=$(curl -s -X POST "${BOT_URL}/debug/generate-test-token" \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
LOGIN_URL=$(echo "$TOKEN_RESPONSE" | grep -o '"loginUrl":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate token"
  echo "Response: $TOKEN_RESPONSE"
  kill $BOT_PID
  exit 1
fi

echo "✅ Token generated: ${TOKEN:0:32}..."
echo "   Login URL: $LOGIN_URL"
echo ""

# Validate token
echo "STEP 4: Validate token..."
VALIDATE_RESPONSE=$(curl -s -X POST "${BOT_URL}/api/validate-token" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}")

VALID=$(echo "$VALIDATE_RESPONSE" | grep -o '"valid":[^,}]*' | cut -d':' -f2)
VALIDATE_TG_ID=$(echo "$VALIDATE_RESPONSE" | grep -o '"telegramId":[0-9]*' | cut -d':' -f2)

if [ "$VALID" = "true" ]; then
  echo "✅ Token validation successful"
  echo "   Telegram ID: $VALIDATE_TG_ID"
else
  echo "❌ Token validation failed"
  echo "Response: $VALIDATE_RESPONSE"
  kill $BOT_PID
  exit 1
fi
echo ""

# Authenticate with Supabase
echo "STEP 5: Authenticate with Supabase Edge Function..."
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/auth-telegram" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")

if echo "$AUTH_RESPONSE" | grep -q '"session"' && echo "$AUTH_RESPONSE" | grep -q '"user"'; then
  echo "✅ Supabase authentication successful"
  echo ""
  echo "Response:"
  echo "$AUTH_RESPONSE" | grep -o '"[^"]*":' | head -5
else
  echo "⚠️ Possible issue with Supabase response"
  echo "Response: $AUTH_RESPONSE"
fi
echo ""

# Cleanup
echo "════════════════════════════════════════════════"
echo "  ✅ Complete Flow Test Finished"
echo "════════════════════════════════════════════════"

kill $BOT_PID
echo "Bot stopped."
