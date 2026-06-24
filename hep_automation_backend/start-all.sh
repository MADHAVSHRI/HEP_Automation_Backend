#!/bin/bash

echo "Starting all HEP services..."
echo "==========================="

# Kill any existing node processes on these ports
echo "Cleaning up old processes..."
pkill -f "node src/index.js" 2>/dev/null || true
sleep 2

cd /home/boss/Desktop/PORT/HEP

# 1. Start User Service
echo "[1/5] Starting User Service on port 5001..."
cd HEP_Automation_Backend/hep_automation_backend/user_service
npm run dev > /tmp/user_service.log 2>&1 &
USER_PID=$!
echo "User Service PID: $USER_PID"

cd /home/boss/Desktop/PORT/HEP

# 2. Start Approval Admin Service
echo "[2/5] Starting Approval Admin Service on port 5005..."
cd HEP_Automation_Backend/hep_automation_backend/approval-admin-service
npm run dev > /tmp/approval_service.log 2>&1 &
APPROVAL_PID=$!
echo "Approval Admin Service PID: $APPROVAL_PID"

cd /home/boss/Desktop/PORT/HEP

# 3. Start Auth Service
echo "[3/5] Starting Auth Service on port 5006..."
cd HEP_Automation_Backend/hep_automation_backend/auth-service
npm run dev > /tmp/auth_service.log 2>&1 &
AUTH_PID=$!
echo "Auth Service PID: $AUTH_PID"

cd /home/boss/Desktop/PORT/HEP

# 4. Start Email Service
echo "[4/5] Starting Email Service on port 5002..."
cd HEP_Automation_Backend/hep_automation_backend/email_service
npm run dev > /tmp/email_service.log 2>&1 &
EMAIL_PID=$!
echo "Email Service PID: $EMAIL_PID"

cd /home/boss/Desktop/PORT/HEP

# 5. Start QR Service
echo "[5/5] Starting QR Service on port 5007..."
cd HEP_Automation_Backend/hep_automation_backend/qr-service
npm run dev > /tmp/qr_service.log 2>&1 &
QR_PID=$!
echo "QR Service PID: $QR_PID"

cd /home/boss/Desktop/PORT/HEP

echo ""
echo "==========================="
echo "All backend services started!"
echo ""
echo "Waiting 10 seconds for services to initialize..."
sleep 10

echo ""
echo "Checking service health..."
curl -s http://localhost:5001/health && echo " - User Service OK" || echo " - User Service FAILED"
curl -s http://localhost:5005/health && echo " - Approval Service OK" || echo " - Approval Service FAILED"
curl -s http://localhost:5006/health && echo " - Auth Service OK" || echo " - Auth Service FAILED"
curl -s http://localhost:5002/health && echo " - Email Service OK" || echo " - Email Service FAILED"
curl -s http://localhost:5007/health && echo " - QR Service OK" || echo " - QR Service FAILED"

echo ""
echo "To view logs:"
echo "  User Service:     tail -f /tmp/user_service.log"
echo "  Approval Service:   tail -f /tmp/approval_service.log"
echo "  Auth Service:     tail -f /tmp/auth_service.log"
echo "  Email Service:    tail -f /tmp/email_service.log"
echo "  QR Service:       tail -f /tmp/qr_service.log"
echo ""
echo "To stop all services: pkill -f 'node src/index.js'"
echo "==========================="
