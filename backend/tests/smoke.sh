#!/usr/bin/env bash
# Quick one-shot smoke test using curl. Hits each endpoint once.
# Usage: ./tests/smoke.sh https://<api-id>.execute-api.us-east-1.amazonaws.com [path/to.pdf]

set -euo pipefail

API_URL="${1:-${API_URL:-}}"
PDF="${2:-}"

if [ -z "$API_URL" ]; then
  echo "Usage: $0 <api-url> [pdf-path]"
  exit 1
fi
API_URL="${API_URL%/}"

GREEN=$'\033[32m'; RED=$'\033[31m'; GRAY=$'\033[90m'; RESET=$'\033[0m'
ok()   { echo "  ${GREEN}✓${RESET} $1"; }
fail() { echo "  ${RED}✗${RESET} $1"; echo "    $2"; exit 1; }

echo "API: $API_URL"

# 1. legal-aid
echo
echo "GET /legal-aid"
RESP=$(curl -sS "${API_URL}/legal-aid?country=US&language=ar")
echo "$RESP" | grep -q '"organizations"' && ok "returns organizations" || fail "no organizations key" "$RESP"

# 2. session 404
echo
echo "GET /session/nonexistent"
STATUS=$(curl -sS -o /dev/null -w "%{http_code}" "${API_URL}/session/00000000-0000-0000-0000-000000000000")
[ "$STATUS" = "404" ] && ok "returns 404" || fail "expected 404, got $STATUS"

# 3. upload validation
echo
echo "POST /upload (no file)"
RESP=$(curl -sS -X POST "${API_URL}/upload" -F "language=ar")
echo "$RESP" | grep -q "MISSING_FILE" && ok "rejects missing file" || fail "expected MISSING_FILE" "$RESP"

# 4. upload happy path (requires a PDF)
if [ -n "$PDF" ] && [ -f "$PDF" ]; then
  echo
  echo "POST /upload (real PDF)"
  RESP=$(curl -sS -X POST "${API_URL}/upload" -F "file=@${PDF}" -F "language=ar")
  SESSION_ID=$(echo "$RESP" | sed -n 's/.*"sessionId":"\([^"]*\)".*/\1/p')
  [ -n "$SESSION_ID" ] && ok "got sessionId: $SESSION_ID" || fail "no sessionId" "$RESP"

  echo
  echo "GET /session/$SESSION_ID"
  RESP=$(curl -sS "${API_URL}/session/${SESSION_ID}")
  echo "$RESP" | grep -q "$SESSION_ID" && ok "session retrievable" || fail "session not found" "$RESP"

  echo
  echo "POST /session/save"
  RESP=$(curl -sS -X POST "${API_URL}/session/save" \
    -H "Content-Type: application/json" \
    -d "{\"sessionId\":\"${SESSION_ID}\",\"answers\":[{\"fieldId\":\"f1\",\"fieldLabel\":\"Name\",\"userAnswer\":\"Test\",\"confirmed\":true}],\"completionPercent\":50}")
  echo "$RESP" | grep -q '"saved":true' && ok "save works" || fail "save failed" "$RESP"

  echo "${GRAY}(skipping /analyze and /generate-draft — run test-api.mjs for those)${RESET}"
else
  echo
  echo "${GRAY}(skipping upload + analyze — pass a PDF path as the 2nd argument)${RESET}"
fi

echo
echo "${GREEN}smoke test passed${RESET}"
