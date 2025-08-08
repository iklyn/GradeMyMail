#!/bin/bash

# Setup script for Ollama and Llama 3.2 model
# This script will install Ollama and download the Llama 3.2 model

set -e

echo "🚀 Setting up Ollama and Llama 3.2 for Newsletter Grading System"
echo "================================================================"

# Check if we're on macOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "✅ Detected macOS"
    
    # Check if Ollama is already installed
    if command -v ollama &> /dev/null; then
        echo "✅ Ollama is already installed"
        ollama --version
    else
        echo "📥 Installing Ollama..."
        
        # Check if Homebrew is available
        if command -v brew &> /dev/null; then
            echo "🍺 Using Homebrew to install Ollama"
            brew install ollama
        else
            echo "📦 Downloading Ollama installer..."
            curl -fsSL https://ollama.ai/install.sh | sh
        fi
        
        echo "✅ Ollama installed successfully"
    fi
    
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "✅ Detected Linux"
    
    # Check if Ollama is already installed
    if command -v ollama &> /dev/null; then
        echo "✅ Ollama is already installed"
        ollama --version
    else
        echo "📥 Installing Ollama..."
        curl -fsSL https://ollama.ai/install.sh | sh
        echo "✅ Ollama installed successfully"
    fi
    
else
    echo "❌ Unsupported operating system: $OSTYPE"
    echo "Please install Ollama manually from https://ollama.ai/download"
    exit 1
fi

echo ""
echo "🤖 Setting up Llama 3.2 model..."
echo "================================"

# Start Ollama service in background if not running
if ! pgrep -f "ollama serve" > /dev/null; then
    echo "🔄 Starting Ollama service..."
    ollama serve &
    OLLAMA_PID=$!
    
    # Wait for Ollama to start
    echo "⏳ Waiting for Ollama to start..."
    sleep 5
    
    # Check if Ollama is responding
    for i in {1..10}; do
        if curl -s http://localhost:11434/api/tags > /dev/null; then
            echo "✅ Ollama service is running"
            break
        fi
        echo "⏳ Waiting for Ollama service... ($i/10)"
        sleep 2
    done
else
    echo "✅ Ollama service is already running"
fi

# Pull Llama 3.2 model
echo "📥 Downloading Llama 3.2 model (this may take several minutes)..."
echo "💡 The model is approximately 2GB in size"

if ollama list | grep -q "llama3.2"; then
    echo "✅ Llama 3.2 model is already downloaded"
else
    echo "⏳ Pulling Llama 3.2... (please be patient)"
    ollama pull llama3.2
    echo "✅ Llama 3.2 model downloaded successfully"
fi

echo ""
echo "🧪 Testing the setup..."
echo "======================"

# Test the model
echo "🔍 Testing Llama 3.2 model..."
TEST_RESPONSE=$(ollama run llama3.2 "Hello, respond with just 'OK' if you're working" --timeout 30s)

if [[ "$TEST_RESPONSE" == *"OK"* ]]; then
    echo "✅ Llama 3.2 model is working correctly"
else
    echo "⚠️ Llama 3.2 model test returned unexpected response: $TEST_RESPONSE"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo "==============================="
echo ""
echo "📋 Summary:"
echo "  • Ollama is installed and running"
echo "  • Llama 3.2 model is downloaded and ready"
echo "  • Service is running on http://localhost:11434"
echo ""
echo "🚀 You can now start the Newsletter Grading System server:"
echo "  npm run dev:server"
echo ""
echo "💡 To manually start/stop Ollama:"
echo "  Start: ollama serve"
echo "  Stop: pkill -f 'ollama serve'"
echo ""