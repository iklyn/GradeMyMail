#!/usr/bin/env node

/**
 * Test script for Task 12: Error handling and monitoring endpoints
 * 
 * This script tests the health check and metrics endpoints to ensure
 * they are working correctly.
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

console.log('🧪 Testing Task 12: Error Handling and Monitoring Endpoints\n');

// Start the server
console.log('🚀 Starting server...');
const serverProcess = spawn('npx', ['tsx', 'server/index.ts'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' }
});

let serverOutput = '';
let serverReady = false;

serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  serverOutput += output;
  if (output.includes('Server running on port')) {
    serverReady = true;
  }
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server Error:', data.toString());
});

// Wait for server to start
console.log('⏳ Waiting for server to start...');
let attempts = 0;
while (!serverReady && attempts < 30) {
  await setTimeout(1000);
  attempts++;
}

if (!serverReady) {
  console.error('❌ Server failed to start within 30 seconds');
  serverProcess.kill();
  process.exit(1);
}

console.log('✅ Server started successfully\n');

// Test endpoints
const testEndpoints = [
  {
    name: 'Health Check (Comprehensive)',
    url: 'http://localhost:3001/api/health',
    expectedStatus: 200,
    expectedFields: ['status', 'timestamp', 'uptime', 'healthChecks', 'metrics']
  },
  {
    name: 'Health Check (Simple)',
    url: 'http://localhost:3001/api/health/simple',
    expectedStatus: 200,
    expectedFields: ['status', 'timestamp']
  },
  {
    name: 'Health Check (Ready)',
    url: 'http://localhost:3001/api/health/ready',
    expectedStatus: [200, 503], // Can be either depending on AI models
    expectedFields: ['status', 'timestamp', 'services']
  },
  {
    name: 'Health Check (Live)',
    url: 'http://localhost:3001/api/health/live',
    expectedStatus: 200,
    expectedFields: ['status', 'timestamp', 'uptime']
  },
  {
    name: 'Metrics Endpoint',
    url: 'http://localhost:3001/api/metrics',
    expectedStatus: 200,
    expectedFields: ['timestamp', 'metrics', 'retry', 'circuitBreakers']
  }
];

let passedTests = 0;
let totalTests = testEndpoints.length;

console.log('🧪 Testing endpoints:\n');

for (const test of testEndpoints) {
  try {
    console.log(`📡 Testing ${test.name}...`);
    
    const response = await fetch(test.url);
    const data = await response.json();
    
    // Check status code
    const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
    if (!expectedStatuses.includes(response.status)) {
      console.log(`❌ ${test.name}: Expected status ${test.expectedStatus}, got ${response.status}`);
      continue;
    }
    
    // Check required fields
    const missingFields = test.expectedFields.filter(field => !(field in data));
    if (missingFields.length > 0) {
      console.log(`❌ ${test.name}: Missing fields: ${missingFields.join(', ')}`);
      continue;
    }
    
    console.log(`✅ ${test.name}: Status ${response.status}, all fields present`);
    
    // Log some interesting data for health check
    if (test.url.includes('/api/health') && !test.url.includes('simple')) {
      console.log(`   Status: ${data.status}`);
      if (data.uptime) {
        console.log(`   Uptime: ${typeof data.uptime === 'object' ? data.uptime.formatted : data.uptime}`);
      }
      if (data.metrics && data.metrics.requests) {
        console.log(`   Requests: ${data.metrics.requests.total || 0} total`);
      }
    }
    
    passedTests++;
    
  } catch (error) {
    console.log(`❌ ${test.name}: Request failed - ${error.message}`);
  }
  
  console.log('');
}

// Test error handling by making a bad request
console.log('🧪 Testing error handling:\n');

try {
  console.log('📡 Testing validation error...');
  const response = await fetch('http://localhost:3001/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}) // Missing required 'message' field
  });
  
  const data = await response.json();
  
  if (response.status === 400 && data.error && data.error.type === 'VALIDATION') {
    console.log('✅ Validation error handling: Correct error response');
    console.log(`   Error type: ${data.error.type}`);
    console.log(`   Error message: ${data.error.message}`);
    passedTests++;
  } else {
    console.log('❌ Validation error handling: Unexpected response');
  }
  totalTests++;
} catch (error) {
  console.log(`❌ Validation error test failed: ${error.message}`);
  totalTests++;
}

console.log('');

// Test rate limiting
console.log('🧪 Testing rate limiting:\n');

try {
  console.log('📡 Testing rate limiting...');
  
  // Make multiple requests quickly to trigger rate limiting
  const requests = [];
  for (let i = 0; i < 25; i++) { // More than the 20 request limit for AI endpoints
    requests.push(
      fetch('http://localhost:3001/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: `Test message ${i}` })
      })
    );
  }
  
  const responses = await Promise.all(requests);
  const rateLimitedResponses = responses.filter(r => r.status === 429);
  
  if (rateLimitedResponses.length > 0) {
    console.log('✅ Rate limiting: Working correctly');
    console.log(`   Rate limited responses: ${rateLimitedResponses.length}/${responses.length}`);
    passedTests++;
  } else {
    console.log('⚠️  Rate limiting: No rate limited responses (may need more requests)');
  }
  totalTests++;
} catch (error) {
  console.log(`❌ Rate limiting test failed: ${error.message}`);
  totalTests++;
}

console.log('');

// Summary
console.log('📊 TEST SUMMARY\n');
console.log(`✅ Passed: ${passedTests}/${totalTests} tests`);
console.log(`📈 Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n`);

if (passedTests === totalTests) {
  console.log('🎉 ALL TESTS PASSED!');
  console.log('✨ Task 12 endpoints are working correctly.\n');
} else {
  console.log('⚠️  SOME TESTS FAILED');
  console.log('Please review the failed tests above.\n');
}

// Cleanup
console.log('🧹 Cleaning up...');
serverProcess.kill();
await setTimeout(1000);

process.exit(passedTests === totalTests ? 0 : 1);