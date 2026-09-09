#!/bin/bash
# Starts the whole stack locally behind one origin (http://localhost:8080),
# which is what the mobile app expects from `--dart-define=API_BASE_URL`.
#
#   ./start-local.sh          # start everything
#   ./stop-local.sh           # stop everything
#
# Requires Postgres and Redis to already be running.

cd "$(dirname "$0")" || exit 1

LOG_DIR="$(pwd)/logs-local"
mkdir -p "$LOG_DIR"

start() {
  local name="$1"
  local dir="$2"
  echo "  starting $name…"
  (cd "$dir" && npm run dev > "$LOG_DIR/$name.log" 2>&1 &)
}

echo "Starting HEP services locally…"
start auth-service            auth-service
start user_service            user_service
start approval-admin-service  approval-admin-service
start qr-service              qr-service
start email_service           email_service
start face_verify             face_verify
start gate-service            gate-service

sleep 6

echo "  starting dev-gateway…"
node dev-gateway.js > "$LOG_DIR/dev-gateway.log" 2>&1 &

sleep 2
echo
echo "Gateway:  http://localhost:8080"
echo "Logs:     $LOG_DIR"
echo
echo "Run the app against it with:"
echo "  flutter run \\"
echo "    --dart-define=API_BASE_URL=http://localhost:8080/api/ \\"
echo "    --dart-define=GATE_SERVICE_URL=http://localhost:8080"
echo
echo "(on an Android emulator use http://10.0.2.2:8080 instead of localhost)"
