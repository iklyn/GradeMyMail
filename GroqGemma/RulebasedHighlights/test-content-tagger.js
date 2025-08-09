/**
 * Test Script for the Advanced Content Tagger
 * This script imports the analyzeContent function and runs it on a sample newsletter.
 */

import { analyzeContent } from './content-tagger.js';

async function testTagger() {
  console.log('🧪 Testing Advanced Content Tagger (with internal dictionary)');
  console.log('==================================================\n');

  const TEST_NEWSLETTER = `
Subject: Amazing Newsletter - Don't Miss Out!

This is an incredible opportunity to unlock the secrets of successful newsletter writing! 

Our revolutionary system will transform your writing instantly. You'll be amazed at the results - guaranteed!

Act now before this limited-time offer expires! This once-in-a-lifetime chance won't last forever.

It is important to think outside the box and leverage your core competencies to achieve a paradigm shift. This is a sentance with a typo.

Click here to boost your productivity by 300% and supercharge your content creation process. This was done to ensure results.

Best regards,
The Team
`;

  try {
    console.log('📧 Input Newsletter:');
    console.log(TEST_NEWSLETTER);
    console.log('\n' + '='.repeat(50) + '\n');

    // Test the analyzer using the internal dictionary
    const startTime = Date.now();
    const { annotated, report } = analyzeContent(TEST_NEWSLETTER, {
      grammar: {
        enabled: true,
        minWordLength: 3,
        skipProperNouns: true,
        skipNonLexical: true
      }
    });
    const analysisTime = Date.now() - startTime;

    console.log(`✅ Analysis completed in ${analysisTime}ms`);
    console.log('\n' + '-'.repeat(50) + '\n');
    
    console.log('📊 Annotated Result:');
    console.log(annotated);
    
    console.log('\n' + '-'.repeat(50) + '\n');

    console.log('📋 JSON Report:');
    console.log(JSON.stringify(report, null, 2));

    console.log('\n' + '='.repeat(50));
    console.log('🎉 Test finished successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTagger().catch(console.error);