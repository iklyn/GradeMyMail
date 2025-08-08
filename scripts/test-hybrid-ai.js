#!/usr/bin/env node

/**
 * Test script for the Hybrid AI Router
 * This script tests both Llama 3.2 and OpenAI GPT-4o-mini integration
 */

import { hybridAIRouter } from '../server/ai-router.js';

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

async function testHybridAI() {
  console.log('🧪 Testing Hybrid AI Router');
  console.log('============================\n');

  try {
    // Test 1: Check model status
    console.log('📊 Checking model status...');
    const status = hybridAIRouter.getModelStatus();
    console.log('Current primary model:', status.currentPrimary);
    console.log('Using fallback:', status.usingFallback);
    console.log('Llama 3.2 healthy:', status.llama.isHealthy);
    console.log('OpenAI healthy:', status.openai.isHealthy);
    console.log('');

    // Test 2: Newsletter analysis
    console.log('📧 Testing newsletter analysis...');
    console.log('Input content length:', TEST_NEWSLETTER_CONTENT.length, 'characters');
    
    const startTime = Date.now();
    const analysisResult = await hybridAIRouter.analyzeNewsletter(TEST_NEWSLETTER_CONTENT);
    const analysisTime = Date.now() - startTime;
    
    console.log('✅ Analysis completed in', analysisTime, 'ms');
    console.log('Analysis result length:', analysisResult.length, 'characters');
    console.log('Analysis preview:', analysisResult.substring(0, 200) + '...');
    console.log('');

    // Test 3: Newsletter improvement
    console.log('🔧 Testing newsletter improvement...');
    
    const improvementStartTime = Date.now();
    const improvementResult = await hybridAIRouter.improveNewsletter(analysisResult);
    const improvementTime = Date.now() - improvementStartTime;
    
    console.log('✅ Improvement completed in', improvementTime, 'ms');
    console.log('Improvement result length:', improvementResult.length, 'characters');
    console.log('Improvement preview:', improvementResult.substring(0, 200) + '...');
    console.log('');

    // Test 4: Final status check
    console.log('📊 Final model status...');
    const finalStatus = hybridAIRouter.getModelStatus();
    console.log('Final primary model:', finalStatus.currentPrimary);
    console.log('Llama response time:', finalStatus.llama.responseTime, 'ms');
    console.log('OpenAI response time:', finalStatus.openai.responseTime, 'ms');
    console.log('');

    console.log('🎉 All tests completed successfully!');
    console.log('Total test time:', Date.now() - startTime, 'ms');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    // Cleanup
    await hybridAIRouter.shutdown();
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Test interrupted, shutting down...');
  await hybridAIRouter.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Test terminated, shutting down...');
  await hybridAIRouter.shutdown();
  process.exit(0);
});

// Run the test
testHybridAI().catch(console.error);