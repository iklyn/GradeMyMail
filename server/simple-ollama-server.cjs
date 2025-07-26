#!/usr/bin/env node

/**
 * Simple server to test Ollama GMM and FMM models
 * This bypasses the complex server setup to test the models directly
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5176', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));

// Ollama client configuration
const gmmClient = axios.create({
  baseURL: 'http://localhost:11434',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

const fmmClient = axios.create({
  baseURL: 'http://localhost:11434', 
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Health check endpoint
app.get('/api/health/ready', async (req, res) => {
  try {
    const gmmHealth = await gmmClient.get('/api/tags', { timeout: 5000 }).then(() => true).catch(() => false);
    const fmmHealth = await fmmClient.get('/api/tags', { timeout: 5000 }).then(() => true).catch(() => false);
    
    res.json({
      status: 'ready',
      services: {
        gmm: gmmHealth,
        fmm: fmmHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      services: { gmm: false, fmm: false },
      error: error.message
    });
  }
});

// Analyze email with GMM model
app.post('/api/analyze', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📧 Analyzing with GMM: ${message.substring(0, 50)}...`);

    // GMM is a custom model with system prompt built-in, just send the raw input
    const response = await gmmClient.post('/api/generate', {
      model: 'GMM',
      prompt: message,
      stream: false
    });

    console.log('✅ GMM analysis complete');
    console.log('🔍 Raw GMM response:', JSON.stringify(response.data.response, null, 2));

    res.json({
      message: {
        content: response.data.response.trim()
      }
    });

  } catch (error) {
    console.error('❌ GMM analysis failed:', error.message);
    res.status(500).json({
      error: 'Analysis failed',
      details: error.message
    });
  }
});

// Fix email with FMM model
app.post('/api/fix', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`🔧 Fixing with FMM: ${message.substring(0, 50)}...`);

    // FMM is a custom model with system prompt built-in, just send the raw tagged content
    const response = await fmmClient.post('/api/generate', {
      model: 'FMM',
      prompt: message,
      stream: false
    });

    console.log('✅ FMM improvements complete');
    console.log('🔍 Raw FMM response:', JSON.stringify(response.data.response, null, 2));

    res.json({
      message: {
        content: response.data.response.trim()
      }
    });

  } catch (error) {
    console.error('❌ FMM improvements failed:', error.message);
    res.status(500).json({
      error: 'Improvements failed',
      details: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Ollama server is running!',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Simple Ollama Server running on port ${PORT}`);
  console.log(`📊 GMM Model: http://localhost:11434`);
  console.log(`🔧 FMM Model: http://localhost:11434`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log(`\n🧪 Test endpoints:`);
  console.log(`   GET  /api/health/ready - Check model status`);
  console.log(`   POST /api/analyze - Analyze with GMM`);
  console.log(`   POST /api/fix - Fix with FMM`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down gracefully...');
  process.exit(0);
});