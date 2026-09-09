#!/bin/bash
# Logs in as a CISF officer and fires a gate verification event, so the console
# can be tested without the hardware.
#
#   ./fire-test-event.sh <loginId> <password> [TYPE] [IDENTIFIER] [GATE]
#
#   ./fire-test-event.sh cisf@gmail.com 'secret'
#   ./fire-test-event.sh cisf@gmail.com 'secret' VEHICLE UP91AT4254
#   ./fire-test-event.sh cisf@gmail.com 'secret' CONTAINER BMOU6708365
#
# The captcha is fetched and solved automatically.

set -e

BASE="${BASE:-http://localhost:8080/api}"
LOGIN_ID="$1"
PASSWORD="$2"
TYPE="${3:-FACE}"
IDENTIFIER="${4:-1}"
GATE="${5:-GATE_01}"

if [ -z "$LOGIN_ID" ] || [ -z "$PASSWORD" ]; then
  echo "usage: $0 <loginId> <password> [TYPE] [IDENTIFIER] [GATE]"
  exit 2
fi

echo "1. captcha…"
CAPTCHA=$(curl -s "$BASE/captcha/get-captcha")
QUESTION=$(echo "$CAPTCHA" | python3 -c "import sys,json;print(json.load(sys.stdin)['captchaQuestion'])")
TOKEN_C=$(echo "$CAPTCHA" | python3 -c "import sys,json;print(json.load(sys.stdin)['captchaToken'])")
ANSWER=$(python3 -c "
q='''$QUESTION'''.replace('=','').replace('?','').strip()
print(int(eval(q)))
")
echo "   $QUESTION -> $ANSWER"

echo "2. login…"
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"loginId\":\"$LOGIN_ID\",\"password\":\"$PASSWORD\",\"captchaToken\":\"$TOKEN_C\",\"captchaValue\":\"$ANSWER\"}")

ACCESS=$(echo "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null || echo "")
if [ -z "$ACCESS" ]; then
  echo "   login failed: $LOGIN"
  exit 1
fi
echo "   ok"

echo "3. firing $TYPE / $IDENTIFIER at $GATE…"
curl -s -X POST "$BASE/gate-verification/test-event" \
  -H 'Content-Type: application/json' -H "Authorization: Bearer $ACCESS" \
  -d "{\"gateId\":\"$GATE\",\"verificationType\":\"$TYPE\",\"identifier\":\"$IDENTIFIER\",\"verified\":true,\"matchScore\":95,\"deviceId\":\"SIM-01\"}" |
  python3 -m json.tool 2>/dev/null || true

echo
echo "Watch the console screen — the card should update immediately."
