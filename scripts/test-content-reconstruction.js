#!/usr/bin/env node

/**
 * Test script for content reconstruction algorithm
 * Tests the core functionality of replacing tagged portions with improvements
 */

import { ContentReconstructionEngine, contentReconstructionUtils } from '../src/utils/contentReconstruction.js';

console.log('🧪 Testing Content Reconstruction Algorithm\n');

// Test data
const testCases = [
  {
    name: 'Simple fluff replacement',
    originalContent: 'This is amazing content with incredible results.',
    taggedContent: 'This is <fluff>amazing</fluff> content with <fluff>incredible</fluff> results.',
    improvementContent: '<old_draft>amazing</old_draft><optimized_draft>excellent</optimized_draft>\n<old_draft>incredible</old_draft><optimized_draft>remarkable</optimized_draft>',
  },
  {
    name: 'Spam words replacement',
    originalContent: 'Get free access now! Limited time offer.',
    taggedContent: 'Get <spam_words>free</spam_words> access now! <spam_words>Limited time</spam_words> offer.',
    improvementContent: '<old_draft>free</old_draft><optimized_draft>complimentary</optimized_draft>\n<old_draft>Limited time</old_draft><optimized_draft>Time-sensitive</optimized_draft>',
  },
  {
    name: 'Hard to read with UUID',
    originalContent: 'This is a complex sentence. Another sentence follows.',
    taggedContent: 'This is a complex sentence. <hard_to_read>b8100ff0-09aa-4eb0-97a6-010c757abb02</hard_to_read> Another sentence follows.',
    improvementContent: '<old_draft>This is a complex sentence.</old_draft><optimized_draft>This is clear.</optimized_draft>',
  },
  {
    name: 'Mixed tag types',
    originalContent: 'This amazing offer is free for everyone.',
    taggedContent: 'This <fluff>amazing</fluff> offer is <spam_words>free</spam_words> for everyone.',
    improvementContent: '<old_draft>amazing</old_draft><optimized_draft>excellent</optimized_draft>\n<old_draft>free</old_draft><optimized_draft>complimentary</optimized_draft>',
  },
  {
    name: 'HTML content preservation',
    originalContent: 'This is amazing content.',
    taggedContent: 'This is <fluff>amazing</fluff> content.',
    improvementContent: '<old_draft>amazing</old_draft><optimized_draft>excellent</optimized_draft>',
    originalHtmlContent: '<p>This is <strong>amazing</strong> content.</p>',
  },
];

// Run tests
testCases.forEach((testCase, index) => {
  console.log(`\n📝 Test ${index + 1}: ${testCase.name}`);
  console.log('─'.repeat(50));
  
  try {
    // Test parsing tagged content
    console.log('🔍 Parsing tagged content...');
    const taggedSentences = ContentReconstructionEngine.parseTaggedContent(testCase.taggedContent);
    console.log(`   Found ${taggedSentences.length} tagged sentences:`);
    taggedSentences.forEach((sentence, i) => {
      console.log(`   ${i + 1}. [${sentence.type}] "${sentence.originalText}" ${sentence.tagId ? `(ID: ${sentence.tagId})` : ''}`);
    });

    // Test parsing improvements
    console.log('\n🔧 Parsing improvements...');
    const improvements = ContentReconstructionEngine.parseImprovements(testCase.improvementContent);
    console.log(`   Found ${improvements.length} improvements:`);
    improvements.forEach((improvement, i) => {
      console.log(`   ${i + 1}. "${improvement.original}" → "${improvement.improved}"`);
    });

    // Test content reconstruction
    console.log('\n🏗️  Reconstructing content...');
    const result = ContentReconstructionEngine.reconstructContent(
      testCase.originalContent,
      testCase.taggedContent,
      testCase.improvementContent,
      testCase.originalHtmlContent
    );

    console.log(`   ✅ Success! Applied ${result.appliedImprovements.length} improvements`);
    console.log(`   📊 Processing time: ${result.metadata.processingTime}ms`);
    console.log(`   🔄 Total replacements: ${result.metadata.totalReplacements}`);
    console.log(`   🎨 HTML preserved: ${result.metadata.preservedFormatting}`);
    
    if (result.errors.length > 0) {
      console.log(`   ⚠️  Errors encountered: ${result.errors.length}`);
      result.errors.forEach((error, i) => {
        console.log(`      ${i + 1}. [${error.type}] ${error.message}`);
      });
    }

    console.log('\n📄 Content comparison:');
    console.log(`   Original:  "${testCase.originalContent}"`);
    console.log(`   Improved:  "${result.improvedContent}"`);
    
    if (result.htmlImprovedContent && testCase.originalHtmlContent) {
      console.log(`   HTML Original: ${testCase.originalHtmlContent}`);
      console.log(`   HTML Improved: ${result.htmlImprovedContent}`);
    }

    // Test diff generation
    console.log('\n📊 Diff statistics:');
    console.log(`   Total lines: ${result.diffData.totalLines}`);
    console.log(`   Added lines: ${result.diffData.addedLines}`);
    console.log(`   Removed lines: ${result.diffData.removedLines}`);
    console.log(`   Modified lines: ${result.diffData.modifiedLines}`);

    // Test summary generation
    const summary = ContentReconstructionEngine.createReconstructionSummary(result);
    console.log('\n📈 Reconstruction summary:');
    console.log(`   Success: ${summary.success}`);
    console.log(`   Quality score: ${(summary.qualityScore * 100).toFixed(1)}%`);
    console.log(`   Improvements applied: ${summary.improvementsApplied}`);
    console.log(`   Errors encountered: ${summary.errorsEncountered}`);

  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    if (error.context) {
      console.log(`   Context:`, error.context);
    }
  }
});

// Test utility functions
console.log('\n\n🛠️  Testing Utility Functions');
console.log('═'.repeat(50));

// Test text normalization
console.log('\n📝 Text normalization:');
const messyText = '  This   has    multiple     spaces  \n\n\n\n  and   line breaks  ';
const normalizedText = contentReconstructionUtils.normalizeText(messyText);
console.log(`   Original: "${messyText}"`);
console.log(`   Normalized: "${normalizedText}"`);

// Test improvement score calculation
console.log('\n📊 Improvement scoring:');
const testPairs = [
  ['same content', 'same content'],
  ['original content', 'improved content'],
  ['This is a very long and verbose sentence with many unnecessary words', 'This is concise'],
  ['short', 'much longer and more verbose content'],
];

testPairs.forEach(([original, improved], i) => {
  const score = contentReconstructionUtils.calculateImprovementScore(original, improved);
  console.log(`   ${i + 1}. Score: ${(score * 100).toFixed(1)}% - "${original}" → "${improved}"`);
});

// Test HTML validation
console.log('\n🌐 HTML validation:');
const htmlTests = [
  '<p>Valid HTML</p>',
  '<p>Unclosed tag',
  '',
  '<div><span>Nested <strong>tags</strong></span></div>',
];

htmlTests.forEach((html, i) => {
  const isValid = contentReconstructionUtils.validateHtmlStructure(html);
  console.log(`   ${i + 1}. ${isValid ? '✅' : '❌'} "${html}"`);
});

// Test plain text extraction
console.log('\n📄 Plain text extraction:');
const htmlContent = '<p>This is <strong>formatted</strong> text with <em>emphasis</em>.</p>';
const plainText = contentReconstructionUtils.extractPlainText(htmlContent);
console.log(`   HTML: ${htmlContent}`);
console.log(`   Plain: ${plainText}`);

console.log('\n✅ Content reconstruction algorithm testing complete!');
console.log('\n🎯 Key Features Tested:');
console.log('   • Tagged content parsing (fluff, spam_words, hard_to_read)');
console.log('   • Improvement pair parsing');
console.log('   • Content reconstruction with replacements');
console.log('   • HTML structure preservation');
console.log('   • Diff generation');
console.log('   • Error handling and validation');
console.log('   • Utility functions for text processing');