#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
SUPABASE_URL="https://cpbodmxgevxxvtkyjofz.supabase.co"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwYm9kbXhnZXZ4eHZ0a3lqb2Z6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1NjA5NzIsImV4cCI6MjA3NzEzNjk3Mn0.rTm2rj7b9scUN_Z-RLuSG9U-RRqXJ8JJ3hf9zQ-mHLA"
BOT_URL="http://localhost:3001"
TEST_TELEGRAM_ID=555777

echo -e "${BLUE}===== Telegram Auth Flow Test =====${NC}"

echo ""
echo -e "${YELLOW}Step 1: Check bot health${NC}"
curl -s ${BOT_URL}/health
echo ""

echo -e "${YELLOW}Step 2: Generate test token${NC}"
TOKEN_RESPONSE=$(curl -s -X POST ${BOT_URL}/debug/generate-test-token \
  -H "Content-Type: application/json" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")
echo "$TOKEN_RESPONSE"

TOKEN=$(echo "$TOKEN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
echo -e "${GREEN}Token generated: ${TOKEN:0:16}...${NC}"
echo ""

echo -e "${YELLOW}Step 3: Validate token with bot${NC}"
VALIDATE=$(curl -s -X POST ${BOT_URL}/api/validate-token \
  -H "Content-Type: application/json" \
  -d "{\"token\": \"$TOKEN\"}")
echo "$VALIDATE"
echo ""

echo -e "${YELLOW}Step 4: Call Supabase Edge Function (auth-telegram)${NC}"
AUTH_RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/functions/v1/auth-telegram" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -d "{\"telegramId\": ${TEST_TELEGRAM_ID}}")
echo "$AUTH_RESPONSE"
echo ""

echo -e "${GREEN}===== Test Complete =====${NC}"
