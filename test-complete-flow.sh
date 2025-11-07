#!/bin/bash

echo "════════════════════════════════════════════════"
echo "  Complete Telegram Authentication Flow Test"
echo "════════════════════════════════════════════════"
echo ""

# Configuration
SUPABASE_URL="https://cpbodmxgevxxvtkyjofz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYm9kbXhnZXZ4eHZ0a3lqb2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjA5NzIsImV4cCI6MjA3NzEzNjk3Mn0.rTm2rj7b9scUN_Z-RLuSG9U-RRqXJ8JJ3hf9zQ-mHLA"
BOT_URL="http://localhost:3001"
TEST_TELEGRAM_ID=333444

echo "STEP 1: Generate Test Token (Bot)"
echo "─────────────────────────────────────"
TOKEN_RESPONSE=$(curl -s -X POST "${BOT_URL}/debug/generate-test-token" \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo "Token generated: ${TOKEN:0:32}..."
echo "Telegram ID: $TEST_TELEGRAM_ID"
echo ""

echo "STEP 2: Validate Token (Bot)"
echo "─────────────────────────────────────"
VALIDATE_RESPONSE=$(curl -s -X POST "${BOT_URL}/api/validate-token" \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}")

VALIDATE_TGID=$(echo "$VALIDATE_RESPONSE" | grep -o '"telegramId":[0-9]*' | cut -d':' -f2)
VALID=$(echo "$VALIDATE_RESPONSE" | grep -o '"valid":[^,}]*' | cut -d':' -f2)

if [ "$VALID" = "true" ]; then
  echo "✅ Token validation successful"
  echo "   Telegram ID: $VALIDATE_TGID"
else
  echo "❌ Token validation failed"
  echo "   Response: $VALIDATE_RESPONSE"
  exit 1
fi
echo ""

echo "STEP 3: Authenticate with Supabase Edge Function"
echo "─────────────────────────────────────"
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/auth-telegram" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")

echo "Response:"
echo "$AUTH_RESPONSE" | grep -o '"[^"]*":' | head -5

# Check if response contains session and user data
if echo "$AUTH_RESPONSE" | grep -q '"session"' && echo "$AUTH_RESPONSE" | grep -q '"user"'; then
  echo "✅ Supabase authentication successful"
else
  echo "⚠️ Possible issue with Supabase response"
fi
echo ""

echo "STEP 4: Verify Session Token"
echo "─────────────────────────────────────"
ACCESS_TOKEN=$(echo "$AUTH_RESPONSE" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
if [ ! -z "$ACCESS_TOKEN" ]; then
  echo "✅ Session token generated: ${ACCESS_TOKEN:0:32}..."
else
  echo "⚠️ No session token in response"
fi
echo ""

echo "════════════════════════════════════════════════"
echo "  ✅ Complete Flow Test Finished"
echo "════════════════════════════════════════════════"
