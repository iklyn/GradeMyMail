#!/usr/bin/env node

/**
 * Test ONNX Runtime Status and Fallback
 */

import { ONNXAIEngine } from '../server/ai-engines/onnx-engine.js';

async function testONNXStatus() {
  console.log('🔍 Testing ONNX Runtime Status');
  console.log('================================\n');

  const TEST_CONTENT = "This is an amazing newsletter with incredible results!";

  try {
    const onnxEngine = new ONNXAIEngine();
    
    console.log('🤖 Attempting ONNX Runtime initialization...');
    
    try {
      await onnxEngine.initialize();
      console.log('✅ ONNX Runtime initialized successfully');
    } catch (initError) {
      console.log('❌ ONNX Runtime initialization failed:', initError.message);
      console.log('🔄 But the engine will use rule-based fallback...\n');
    }

    // Test analysis (should work with fallback)
    console.log('📧 Testing analysis with ONNX engine...');
    const analysisResult = await onnxEngine.analyzeNewsletter(TEST_CONTENT);
    console.log('✅ Analysis completed successfully!');
    console.log('Result:', analysisResult.substring(0, 100) + '...\n');

    // Test improvement
    console.log('🔧 Testing improvement with ONNX engine...');
    const improvementResult = await onnxEngine.improveNewsletter(analysisResult);
    console.log('✅ Improvement completed successfully!');
    console.log('Result:', improvementResult.substring(0, 100) + '...\n');

    // Check health
    console.log('💓 Testing health check...');
    const healthResult = await onnxEngine.healthCheck();
    console.log('Health status:', healthResult);
    console.log('');

    // Get model info
    console.log('ℹ️ Model information:');
    const modelInfo = onnxEngine.getModelInfo();
    console.log(modelInfo);

    console.log('\n🎯 CONCLUSION:');
    if (modelInfo.usingFallback) {
      console.log('✅ ONNX Engine is working via RULE-BASED FALLBACK');
      console.log('💡 This provides the same functionality as the rule-based system');
      console.log('🔧 To get true ONNX Runtime, you would need to fix the backend installation');
    } else {
      console.log('✅ ONNX Runtime is working with actual ML models');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testONNXStatus().catch(console.error);