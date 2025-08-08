#!/usr/bin/env node

/**
 * Simple AI Test - Tests rule-based fallbacks without external dependencies
 */

import { ONNXAIEngine } from '../server/ai-engines/onnx-engine.js';

const TEST_NEWSLETTER = `
Subject: Amazing Newsletter - Don't Miss Out!

This is an incredible opportunity to unlock the secrets of successful newsletter writing! 

Our revolutionary system will transform your writing instantly. You'll be amazed at the results - guaranteed!

Act now before this limited-time offer expires! This once-in-a-lifetime chance won't last forever.

Click here to boost your productivity by 300% and supercharge your content creation process.
`;

async function testSimpleAI() {
  console.log('🧪 Testing AI System (Rule-Based Fallbacks)');
  console.log('=============================================\n');

  try {
    // Test ONNX Engine with rule-based fallback
    console.log('🤖 Testing ONNX Engine (Rule-Based Fallback)...');
    const onnxEngine = new ONNXAIEngine();
    
    await onnxEngine.initialize();
    console.log('✅ ONNX Engine initialized');

    // Test analysis
    console.log('\n📧 Testing newsletter analysis...');
    const startTime = Date.now();
    const analysisResult = await onnxEngine.analyzeNewsletter(TEST_NEWSLETTER);
    const analysisTime = Date.now() - startTime;
    
    console.log(`✅ Analysis completed in ${analysisTime}ms`);
    console.log('Analysis result:');
    console.log(analysisResult);
    console.log('');

    // Test improvement
    console.log('🔧 Testing newsletter improvement...');
    const improvementStart = Date.now();
    const improvementResult = await onnxEngine.improveNewsletter(analysisResult);
    const improvementTime = Date.now() - improvementStart;
    
    console.log(`✅ Improvement completed in ${improvementTime}ms`);
    console.log('Improvement result:');
    console.log(improvementResult);
    console.log('');

    // Test health check
    console.log('💓 Testing health check...');
    const healthResult = await onnxEngine.healthCheck();
    console.log('Health status:', healthResult);
    console.log('');

    // Test model info
    console.log('ℹ️ Model information:');
    const modelInfo = onnxEngine.getModelInfo();
    console.log(modelInfo);

    console.log('\n🎉 All tests passed successfully!');
    console.log(`Total test time: ${Date.now() - startTime}ms`);

    await onnxEngine.shutdown();

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testSimpleAI().catch(console.error);