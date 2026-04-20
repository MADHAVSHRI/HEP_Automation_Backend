#!/bin/bash

echo "Stopping Node services..."
pkill -f nodemon

echo "Stopping Kafka containers..."
docker compose -f docker-compose.kafka.yml down

echo "All services stopped"