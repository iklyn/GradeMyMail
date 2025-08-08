#!/usr/bin/env node

/**
 * Test Local AI System - No API keys required
 * Tests rule-based analysis and improvement
 */

async function testLocalAI() {
  console.log('🧪 Testing Local AI System (No API Keys Required)');
  console.log('==================================================\n');

  const TEST_NEWSLETTER = `
Subject: Amazing Newsletter - Don't Miss Out!

This is an incredible opportunity to unlock the secrets of successful newsletter writing! 

Our revolutionary system will transform your writing instantly. You'll be amazed at the results - guaranteed!

Act now before this limited-time offer expires! This once-in-a-lifetime chance won't last forever.

Click here to boost your productivity by 300% and supercharge your content creation process.

Best regards,
The Team
`;

  try {
    // Import the rule-based functions directly
    const { ruleBasedAnalysis, ruleBasedImprovement } = await import('../server/ai-engines/rule-based-ai.js');

    console.log('📧 Testing Newsletter Analysis...');
    console.log('Input content:');
    console.log(TEST_NEWSLETTER);
    console.log('\n' + '='.repeat(50) + '\n');

    // Test analysis
    const startTime = Date.now();
    const analysisResult = await ruleBasedAnalysis(TEST_NEWSLETTER);
    const analysisTime = Date.now() - startTime;

    console.log('✅ Analysis completed in', analysisTime, 'ms');
    console.log('📊 Analysis Result:');
    console.log(analysisResult);
    console.log('\n' + '='.repeat(50) + '\n');

    // Test improvement
    console.log('🔧 Testing Newsletter Improvement...');
    const improvementStart = Date.now();
    const improvementResult = await ruleBasedImprovement(analysisResult);
    const improvementTime = Date.now() - improvementStart;

    console.log('✅ Improvement completed in', improvementTime, 'ms');
    console.log('🎯 Improvement Result:');
    console.log(improvementResult);

    console.log('\n' + '='.repeat(50));
    console.log('🎉 All tests passed successfully!');
    console.log(`📈 Total processing time: ${Date.now() - startTime}ms`);
    console.log('💡 This system works entirely offline with no API keys required!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testLocalAI().catch(console.error);