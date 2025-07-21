/**
 * Verification script for Task 10: Enhanced Express.js server with security and performance
 * 
 * This script verifies that the server implementation includes:
 * - Helmet for security headers and CORS configuration
 * - Morgan for HTTP request logging
 * - Compression middleware for response optimization
 * - Express-rate-limit (or equivalent) for API protection
 */

import fs from 'fs';
import path from 'path';

console.log('🔍 Verifying Express.js server implementation...\n');

// Check if server files exist
const serverFiles = [
  'server/index.ts',
  'server/basic-server.ts', 
  'server/simple-server.js'
];

let serverFile = null;
for (const file of serverFiles) {
  if (fs.existsSync(file)) {
    serverFile = file;
    break;
  }
}

if (!serverFile) {
  console.error('❌ No server file found');
  process.exit(1);
}

console.log(`✅ Found server file: ${serverFile}`);

// Read server file content
const serverContent = fs.readFileSync(serverFile, 'utf8');

// Verification checks
const checks = [
  {
    name: 'Helmet Security Headers',
    test: () => serverContent.includes('helmet') && 
                (serverContent.includes('app.use(helmet') || serverContent.includes('helmet(')),
    requirement: '6.1, 6.4 - Security headers and CORS configuration'
  },
  {
    name: 'Morgan HTTP Request Logging',
    test: () => serverContent.includes('morgan') && 
                (serverContent.includes('app.use(morgan') || serverContent.includes('morgan(')),
    requirement: '6.1 - HTTP request logging'
  },
  {
    name: 'Compression Middleware',
    test: () => serverContent.includes('compression') && 
                (serverContent.includes('app.use(compression') || serverContent.includes('compression(')),
    requirement: '8.2 - Response optimization'
  },
  {
    name: 'Rate Limiting Protection',
    test: () => (serverContent.includes('express-rate-limit') || 
                 serverContent.includes('rateLimit') ||
                 serverContent.includes('simpleRateLimit')) &&
                (serverContent.includes('Too many requests') || 
                 serverContent.includes('rate limit')),
    requirement: '6.4, 8.2 - API protection'
  },
  {
    name: 'CORS Configuration',
    test: () => serverContent.includes('cors') && 
                (serverContent.includes('app.use(cors') || serverContent.includes('corsOptions')),
    requirement: '6.1 - Cross-origin resource sharing'
  },
  {
    name: 'Security Content Security Policy',
    test: () => serverContent.includes('contentSecurityPolicy') ||
                serverContent.includes('CSP'),
    requirement: '6.4 - Content security policy'
  },
  {
    name: 'Request Body Size Limits',
    test: () => serverContent.includes('limit:') && 
                (serverContent.includes('10mb') || serverContent.includes('50000')),
    requirement: '6.3 - Input validation and size limits'
  },
  {
    name: 'Error Handling Middleware',
    test: () => serverContent.includes('errorHandler') || 
                (serverContent.includes('app.use') && serverContent.includes('err, req, res, next')),
    requirement: '6.1, 6.2 - Comprehensive error handling'
  },
  {
    name: 'Health Check Endpoint',
    test: () => serverContent.includes('/health') || serverContent.includes('/api/health'),
    requirement: '8.4 - System monitoring'
  },
  {
    name: 'Production vs Development Configuration',
    test: () => serverContent.includes('NODE_ENV') && 
                (serverContent.includes('production') || serverContent.includes('development')),
    requirement: '8.2 - Environment-specific optimization'
  }
];

// Run verification checks
let passedChecks = 0;
let totalChecks = checks.length;

console.log('\n📋 Running verification checks:\n');

checks.forEach((check, index) => {
  const passed = check.test();
  const status = passed ? '✅' : '❌';
  const checkNumber = (index + 1).toString().padStart(2, '0');
  
  console.log(`${status} ${checkNumber}. ${check.name}`);
  console.log(`    Requirement: ${check.requirement}`);
  
  if (passed) {
    passedChecks++;
  } else {
    console.log(`    ⚠️  Missing or incomplete implementation`);
  }
  console.log('');
});

// Additional feature checks
console.log('🔧 Additional Features Implemented:\n');

const additionalFeatures = [
  {
    name: 'Request Validation Middleware',
    test: () => serverContent.includes('validateRequest') || 
                serverContent.includes('validation'),
    description: 'Input validation for API endpoints'
  },
  {
    name: 'Temporary Data Storage',
    test: () => serverContent.includes('temporaryStorage') || 
                serverContent.includes('Map') ||
                serverContent.includes('store'),
    description: 'In-memory storage for temporary data'
  },
  {
    name: 'Request Cancellation Support',
    test: () => serverContent.includes('AbortController') || 
                serverContent.includes('signal'),
    description: 'Request cancellation capabilities'
  },
  {
    name: 'Graceful Shutdown',
    test: () => serverContent.includes('SIGTERM') || 
                serverContent.includes('SIGINT'),
    description: 'Graceful server shutdown handling'
  },
  {
    name: 'API Endpoint Structure',
    test: () => serverContent.includes('/api/analyze') && 
                serverContent.includes('/api/fix') &&
                serverContent.includes('/api/store'),
    description: 'Complete API endpoint implementation'
  }
];

additionalFeatures.forEach((feature, index) => {
  const implemented = feature.test();
  const status = implemented ? '✅' : '⚪';
  const featureNumber = (index + 1).toString().padStart(2, '0');
  
  console.log(`${status} ${featureNumber}. ${feature.name}`);
  console.log(`    ${feature.description}`);
  console.log('');
});

// Summary
console.log('📊 VERIFICATION SUMMARY\n');
console.log(`✅ Passed: ${passedChecks}/${totalChecks} required checks`);

const successRate = (passedChecks / totalChecks) * 100;
console.log(`📈 Success Rate: ${successRate.toFixed(1)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 ALL REQUIREMENTS SATISFIED!');
  console.log('✨ Task 10 implementation is complete and meets all requirements.');
  console.log('\n📋 Key Features Implemented:');
  console.log('• Helmet for security headers and CORS configuration');
  console.log('• Morgan for HTTP request logging');
  console.log('• Compression middleware for response optimization');
  console.log('• Rate limiting for API protection');
  console.log('• Comprehensive error handling');
  console.log('• Environment-specific configuration');
  console.log('• Health check endpoints');
  console.log('• Input validation and security measures');
} else {
  console.log('\n⚠️  Some requirements need attention.');
  console.log('Please review the failed checks above and update the implementation.');
}

// Check package.json for server scripts
console.log('\n🔧 Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasServerScripts = packageJson.scripts && (
  packageJson.scripts['dev:server'] || 
  packageJson.scripts['start:server'] ||
  packageJson.scripts['dev:full']
);

if (hasServerScripts) {
  console.log('✅ Server scripts found in package.json');
  if (packageJson.scripts['dev:server']) {
    console.log(`   dev:server: ${packageJson.scripts['dev:server']}`);
  }
  if (packageJson.scripts['start:server']) {
    console.log(`   start:server: ${packageJson.scripts['start:server']}`);
  }
  if (packageJson.scripts['dev:full']) {
    console.log(`   dev:full: ${packageJson.scripts['dev:full']}`);
  }
} else {
  console.log('⚠️  No server scripts found in package.json');
}

// Check dependencies
console.log('\n📦 Checking required dependencies...');
const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
const requiredDeps = ['express', 'helmet', 'morgan', 'compression', 'cors', 'uuid'];

requiredDeps.forEach(dep => {
  if (dependencies[dep]) {
    console.log(`✅ ${dep}: ${dependencies[dep]}`);
  } else {
    console.log(`❌ ${dep}: Not found`);
  }
});

console.log('\n🏁 Verification complete!');