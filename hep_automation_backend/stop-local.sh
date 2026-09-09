#!/bin/bash
# Stops everything start-local.sh launched.
pkill -f "nodemon src/index.js" 2>/dev/null
pkill -f "node src/index.js" 2>/dev/null
pkill -f "dev-gateway.js" 2>/dev/null
sleep 1
echo "Local HEP services stopped."
