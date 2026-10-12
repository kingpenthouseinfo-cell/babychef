#!/bin/bash
# Double-click to stop Baby Chef Studio if it is running in the background.
lsof -ti:3000 | xargs kill 2>/dev/null && echo "Baby Chef Studio stopped." || echo "It was not running."
sleep 1
