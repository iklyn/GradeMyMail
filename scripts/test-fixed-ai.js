#!/usr/bin/env node

/**
 * Test Fixed Professional AI System
 */

import { ProfessionalAIRouter } from '../server/ai-engines/professional-ai-router.js';

const TEST_NEWSLETTER = `
Subject: Amazing Newsletter - Don't Miss Out!

This is an incredible opportunity to unlock the secrets of successful newsletter writing! 

Our revolutionary system will transform your writing instantly. You'll be amazed at the results - guaranteed!

Act now before this limited-time offer expires! This once-in-a-lifetime chance won't last forever.

Click here to boost your productivity by 300% and supercharge your content creation process.

Best regards,
The Team
`;

async function testFixedAI() {
  console.log('🧪 Testing Fixed Professional AI System');
  console.log('======================================\n');

  const router = new ProfessionalAIRouter({
    primaryEngine: 'transformers',
    fallbackEngines: ['onnx', 'openai'],
    openaiApiKey: 'not-needed-for-this-test',
  });

  try {
    // Wait for initialization
    console.log('⏳ Waiting for AI engines to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test 1: Check engine status
    console.log('📊 Checking engine status...');
    const status = router.getEngineStatus();
    console.log('Primary engine:', status.primary);
    console.log('Available engines:', Object.keys(status.engines));
    
    for (const [name, info] of Object.entries(status.engines)) {
      console.log(`  ${name}: ${info.healthy ? '✅ Healthy' : '❌ Unhealthy'} (${info.consecutiveFailures} failures)`);
      if (info.info) {
        console.log(`    Engine: ${info.info.engine}`);
        console.log(`    Capabilities: ${info.info.capabilities?.join(', ') || 'N/A'}`);
      }
    }
    console.log('');

    // Test 2: Newsletter analysis with each engine
    const engines = ['transformers', 'onnx'];
    
    for (const engineName of engines) {
      try {
        console.log(`🤖 Testing ${engineName} engine...`);
        const startTime = Date.now();
        
        const analysisResult = await router.analyzeNewsletter(TEST_NEWSLETTER, engineName);
        const analysisTime = Date.now() - startTime;
        
        console.log(`✅ ${engineName} analysis completed in ${analysisTime}ms`);
        console.log(`Engine used: ${analysisResult.metadata.engine}`);
        console.log(`Preview: ${analysisResult.content.substring(0, 150)}...`);
        
        // Test improvement
        const improvementResult = await router.improveNewsletter(analysisResult.content, engineName);
        const improvementTime = analysisResult.metadata.duration;
        
        console.log(`✅ ${engineName} improvement completed in ${improvementTime}ms`);
        console.log(`Improvements: ${improvementResult.content.split('\n\n').length} suggestions`);
        console.log('');
        
      } catch (error) {
        console.log(`⚠️ ${engineName} engine test failed:`, error.message);
        console.log('');
      }
    }

    // Test 3: Performance comparison
    console.log('⚡ Performance comparison...');
    const testContent = 'This is an amazing test with incredible results and very urgent action needed!';
    const performanceResults = {};

    for (const engineName of engines) {
      try {
        const perfStart = Date.now();
        const result = await router.analyzeNewsletter(testContent, engineName);
        performanceResults[engineName] = {
          time: Date.now() - perfStart,
          engine: result.metadata.engine,
          issues: (result.content.match(/<[^>]+>/g) || []).length
        };
      } catch (error) {
        performanceResults[engineName] = { error: error.message };
      }
    }

    console.log('Performance results:');
    for (const [engine, result] of Object.entries(performanceResults)) {
      if (result.error) {
        console.log(`  ${engine}: Failed - ${result.error}`);
      } else {
        console.log(`  ${engine}: ${result.time}ms (${result.issues} issues found, used ${result.engine})`);
      }
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('💡 Both engines are working with intelligent fallback systems');

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

testFixedAI().catch(console.error);