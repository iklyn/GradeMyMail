#!/usr/bin/env node

/**
 * Professional AI System Test Script
 * Tests Transformers.js, ONNX Runtime, and OpenAI integration
 */

import { ProfessionalAIRouter } from '../server/ai-engines/professional-ai-router.js';

const TEST_NEWSLETTER_CONTENT = `
Subject: Amazing Newsletter - Don't Miss Out!

Hey there!

This is an incredible opportunity to unlock the secrets of successful newsletter writing! 

Our revolutionary system will transform your writing instantly. You'll be amazed at the results - guaranteed!

Act now before this limited-time offer expires! This once-in-a-lifetime chance won't last forever.

Click here to boost your productivity by 300% and supercharge your content creation process.

Best regards,
The Team
`;

async function testProfessionalAI() {
  console.log('🧪 Testing Professional AI System');
  console.log('==================================\n');

  const router = new ProfessionalAIRouter({
    primaryEngine: 'transformers',
    fallbackEngines: ['onnx', 'openai'],
    openaiApiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // Wait for initialization
    console.log('⏳ Waiting for AI engines to initialize...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test 1: Check engine status
    console.log('📊 Checking engine status...');
    const status = router.getEngineStatus();
    console.log('Primary engine:', status.primary);
    console.log('Available engines:', Object.keys(status.engines));
    
    for (const [name, info] of Object.entries(status.engines)) {
      console.log(`  ${name}: ${info.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${info.consecutiveFailures} failures)`);
    }
    console.log('');

    // Test 2: Newsletter analysis
    console.log('📧 Testing newsletter analysis...');
    console.log('Input content length:', TEST_NEWSLETTER_CONTENT.length, 'characters');
    
    const startTime = Date.now();
    const analysisResult = await router.analyzeNewsletter(TEST_NEWSLETTER_CONTENT);
    const analysisTime = Date.now() - startTime;
    
    console.log('✅ Analysis completed in', analysisTime, 'ms');
    console.log('Engine used:', analysisResult.metadata.engine);
    console.log('Analysis result length:', analysisResult.content.length, 'characters');
    console.log('Analysis preview:', analysisResult.content.substring(0, 200) + '...');
    console.log('');

    // Test 3: Newsletter improvement
    console.log('🔧 Testing newsletter improvement...');
    
    const improvementStartTime = Date.now();
    const improvementResult = await router.improveNewsletter(analysisResult.content);
    const improvementTime = Date.now() - improvementStartTime;
    
    console.log('✅ Improvement completed in', improvementTime, 'ms');
    console.log('Engine used:', improvementResult.metadata.engine);
    console.log('Improvement result length:', improvementResult.content.length, 'characters');
    console.log('Improvement preview:', improvementResult.content.substring(0, 200) + '...');
    console.log('');

    // Test 4: Engine-specific tests
    console.log('🔧 Testing specific engines...');
    
    const engines = ['transformers', 'onnx', 'openai'];
    for (const engineName of engines) {
      try {
        console.log(`\n🤖 Testing ${engineName} engine specifically...`);
        const engineResult = await router.analyzeNewsletter(
          'This is a test message with amazing results!', 
          engineName
        );
        console.log(`✅ ${engineName} engine working (${engineResult.metadata.engine})`);
      } catch (error) {
        console.log(`⚠️ ${engineName} engine failed:`, error.message);
      }
    }

    // Test 5: Performance comparison
    console.log('\n⚡ Performance comparison...');
    const testContent = 'Quick test for performance measurement.';
    const performanceResults = {};

    for (const engineName of engines) {
      try {
        const perfStart = Date.now();
        await router.analyzeNewsletter(testContent, engineName);
        performanceResults[engineName] = Date.now() - perfStart;
      } catch (error) {
        performanceResults[engineName] = 'Failed';
      }
    }

    console.log('Performance results:');
    for (const [engine, time] of Object.entries(performanceResults)) {
      console.log(`  ${engine}: ${typeof time === 'number' ? time + 'ms' : time}`);
    }

    // Test 6: Final status check
    console.log('\n📊 Final engine status...');
    const finalStatus = router.getEngineStatus();
    
    for (const [name, info] of Object.entries(finalStatus.engines)) {
      console.log(`${name}:`);
      console.log(`  Health: ${info.healthy ? '✅' : '❌'}`);
      console.log(`  Response time: ${info.responseTime}ms`);
      console.log(`  Failures: ${info.consecutiveFailures}`);
      console.log(`  Engine info:`, info.info);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('Total test time:', Date.now() - startTime, 'ms');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    await router.shutdown();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, shutting down...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated, shutting down...');
  process.exit(0);
});

// Run the test
testProfessionalAI().catch(console.error);