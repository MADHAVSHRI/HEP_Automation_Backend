#!/bin/bash

echo "Stopping existing Kafka containers..."
docker compose -f docker-compose.kafka.yml down

echo "Starting Kafka and Zookeeper..."
docker compose -f docker-compose.kafka.yml up -d

echo "Waiting 10 seconds for Kafka to start..."
sleep 10

echo "Starting Approval Admin Service..."
cd approval-admin-service
npm run dev &
cd ..

echo "Starting Auth Service..."
cd auth-service
npm run dev &
cd ..

echo "Starting User Service..."
cd user_service
npm run dev &
cd ..

echo "Starting Qr Service..."
cd qr-service
npm run dev &
cd ..

echo "Starting Email Service..."
cd email_service
npm run dev &
cd ..

echo "Starting Face Verify Service..."
cd face_verify
npm run dev &
cd ..

echo "Starting Gate Service..."
cd gate-service
npm run dev &
cd ..

echo "All services started successfully 🚀"
echo "Note: the capture PWA is a separate project and is NOT started here."
echo "      Run it from photo-capture-link with: npm run dev --workspace capture"