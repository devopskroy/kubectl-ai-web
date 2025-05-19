#!/bin/bash

# Ensure GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ]; then
    echo "GEMINI_API_KEY environment variable is not set"
    echo "Please set it with: export GEMINI_API_KEY=your_key_here"
    exit 1
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed"
    exit 1
fi

# Check if kubectl-ai is installed
if ! command -v kubectl-ai &> /dev/null; then
    echo "kubectl-ai is not installed"
    echo "Please install it from: https://github.com/GoogleCloudPlatform/kubectl-ai"
    exit 1
fi

# Install requirements if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Start the application
echo "Starting kubectl-ai web interface..."
python app.py 