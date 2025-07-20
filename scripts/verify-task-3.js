#!/usr/bin/env node

/**
 * Verification script for Task 3: Configure development and build optimization
 * This script verifies that all sub-tasks have been completed successfully.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔍 Verifying Task 3: Configure development and build optimization\n');

let allPassed = true;

// Sub-task 1: Set up Storybook for component development and documentation
console.log('📚 Sub-task 1: Storybook Configuration');
try {
  // Check Storybook config files
  const storybookMainExists = fs.existsSync(path.join(rootDir, '.storybook/main.ts'));
  const storybookPreviewExists = fs.existsSync(path.join(rootDir, '.storybook/preview.ts'));
  const storybookStaticExists = fs.existsSync(path.join(rootDir, 'storybook-static'));
  
  console.log(`  ✅ Storybook main config: ${storybookMainExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ✅ Storybook preview config: ${storybookPreviewExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ✅ Storybook build output: ${storybookStaticExists ? 'EXISTS' : 'MISSING'}`);
  
  if (!storybookMainExists || !storybookPreviewExists || !storybookStaticExists) {
    allPassed = false;
  }
} catch (error) {
  console.log('  ❌ Error checking Storybook configuration:', error.message);
  allPassed = false;
}

// Sub-task 2: Configure bundle analyzer and code splitting strategies
console.log('\n📊 Sub-task 2: Bundle Analysis & Code Splitting');
try {
  // Check if bundle analyzer stats file exists
  const statsFileExists = fs.existsSync(path.join(rootDir, 'dist/stats.html'));
  console.log(`  ✅ Bundle analyzer stats: ${statsFileExists ? 'GENERATED' : 'MISSING'}`);
  
  // Check Vite config for code splitting
  const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
  const hasManualChunks = viteConfig.includes('manualChunks');
  const hasRollupOptions = viteConfig.includes('rollupOptions');
  
  console.log(`  ✅ Manual chunks configuration: ${hasManualChunks ? 'CONFIGURED' : 'MISSING'}`);
  console.log(`  ✅ Rollup options: ${hasRollupOptions ? 'CONFIGURED' : 'MISSING'}`);
  
  if (!statsFileExists || !hasManualChunks || !hasRollupOptions) {
    allPassed = false;
  }
} catch (error) {
  console.log('  ❌ Error checking bundle configuration:', error.message);
  allPassed = false;
}

// Sub-task 3: Implement service worker for offline functionality
console.log('\n🔧 Sub-task 3: Service Worker Implementation');
try {
  // Check if service worker files exist
  const swExists = fs.existsSync(path.join(rootDir, 'src/sw.ts'));
  const distSwExists = fs.existsSync(path.join(rootDir, 'dist/sw.js'));
  const manifestExists = fs.existsSync(path.join(rootDir, 'dist/manifest.webmanifest'));
  
  console.log(`  ✅ Service worker source: ${swExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ✅ Built service worker: ${distSwExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ✅ PWA manifest: ${manifestExists ? 'EXISTS' : 'MISSING'}`);
  
  // Check Vite config for PWA plugin
  const viteConfig = fs.readFileSync(path.join(rootDir, 'vite.config.ts'), 'utf8');
  const hasPWAPlugin = viteConfig.includes('VitePWA');
  
  console.log(`  ✅ PWA plugin configured: ${hasPWAPlugin ? 'YES' : 'NO'}`);
  
  if (!swExists || !distSwExists || !manifestExists || !hasPWAPlugin) {
    allPassed = false;
  }
} catch (error) {
  console.log('  ❌ Error checking service worker:', error.message);
  allPassed = false;
}

// Sub-task 4: Set up performance monitoring with Web Vitals
console.log('\n📈 Sub-task 4: Web Vitals Performance Monitoring');
try {
  // Check if Web Vitals files exist
  const webVitalsExists = fs.existsSync(path.join(rootDir, 'src/utils/webVitals.ts'));
  const performanceMonitorExists = fs.existsSync(path.join(rootDir, 'src/components/PerformanceMonitor.tsx'));
  
  console.log(`  ✅ Web Vitals utility: ${webVitalsExists ? 'EXISTS' : 'MISSING'}`);
  console.log(`  ✅ Performance Monitor component: ${performanceMonitorExists ? 'EXISTS' : 'MISSING'}`);
  
  // Check if Web Vitals is integrated in main.tsx
  const mainTsx = fs.readFileSync(path.join(rootDir, 'src/main.tsx'), 'utf8');
  const hasWebVitalsImport = mainTsx.includes('webVitals');
  const hasWebVitalsInit = mainTsx.includes('initWebVitals');
  
  console.log(`  ✅ Web Vitals integration: ${hasWebVitalsImport && hasWebVitalsInit ? 'INTEGRATED' : 'MISSING'}`);
  
  // Check package.json for web-vitals dependency
  const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const hasWebVitalsDep = packageJson.dependencies && packageJson.dependencies['web-vitals'];
  
  console.log(`  ✅ Web Vitals dependency: ${hasWebVitalsDep ? 'INSTALLED' : 'MISSING'}`);
  
  if (!webVitalsExists || !performanceMonitorExists || !hasWebVitalsImport || !hasWebVitalsInit || !hasWebVitalsDep) {
    allPassed = false;
  }
} catch (error) {
  console.log('  ❌ Error checking Web Vitals:', error.message);
  allPassed = false;
}

// Final result
console.log('\n' + '='.repeat(60));
if (allPassed) {
  console.log('🎉 ALL SUB-TASKS COMPLETED SUCCESSFULLY!');
  console.log('✅ Task 3: Configure development and build optimization - COMPLETE');
} else {
  console.log('❌ SOME SUB-TASKS FAILED');
  console.log('Please review the issues above and fix them.');
}
console.log('='.repeat(60));

process.exit(allPassed ? 0 : 1);