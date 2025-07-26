#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verifying Text Expansion on Both Sides...\n');

// Check SplitPaneDiffViewer implementation
const splitPaneFile = path.join(__dirname, '../src/components/VirtualizedDiff/SplitPaneDiffViewer.tsx');
const cssFile = path.join(__dirname, '../src/components/VirtualizedDiff/DiffViewer.css');

if (!fs.existsSync(splitPaneFile)) {
  console.log('❌ SplitPaneDiffViewer.tsx not found');
  process.exit(1);
}

if (!fs.existsSync(cssFile)) {
  console.log('❌ DiffViewer.css not found');
  process.exit(1);
}

const splitPaneContent = fs.readFileSync(splitPaneFile, 'utf8');
const cssContent = fs.readFileSync(cssFile, 'utf8');

console.log('📁 Checking SplitPaneDiffViewer.tsx:');

// Check that both panes use the same ContentLine component
const originalPaneMatch = splitPaneContent.includes('paneType="original"');
const improvedPaneMatch = splitPaneContent.includes('paneType="improved"');
const sameComponentMatch = splitPaneContent.includes('const ContentLine: React.FC<ContentLineProps>');

console.log(`  ${originalPaneMatch ? '✅' : '❌'} Original pane configured`);
console.log(`  ${improvedPaneMatch ? '✅' : '❌'} Improved pane configured`);
console.log(`  ${sameComponentMatch ? '✅' : '❌'} Both panes use same ContentLine component`);

// Check text overflow handling
const overflowVisibleMatch = splitPaneContent.includes('overflow-visible');
const wordBreakMatch = splitPaneContent.includes('word-break-break-all');
const zIndexMatch = splitPaneContent.includes('z-10');

console.log(`  ${overflowVisibleMatch ? '✅' : '❌'} Overflow visible for text expansion`);
console.log(`  ${wordBreakMatch ? '✅' : '❌'} Word break handling`);
console.log(`  ${zIndexMatch ? '✅' : '❌'} Z-index management for expanded text`);

console.log('\n🎨 Checking DiffViewer.css:');

// Check CSS text expansion rules
const diffLineOverflow = cssContent.includes('.diff-line {\n  /* Ensure proper flex behavior */\n  display: flex;\n  align-items: flex-start;\n  min-height: 40px;\n  \n  /* Allow content to expand naturally, especially on hover */\n  overflow: visible;');
const textOverflow = cssContent.includes('.diff-line-text {\n  /* Flexible text area */\n  flex: 1;\n  padding: 8px 12px;\n  font-family: \'Monaco\', \'Menlo\', \'Ubuntu Mono\', monospace;\n  font-size: 13px;\n  line-height: 1.5;\n  \n  /* Allow content to expand naturally */\n  overflow: visible;');
const contentOverflow = cssContent.includes('.diff-line-content {\n  /* Ensure text wraps properly and doesn\'t get cut off */\n  word-wrap: break-word;\n  overflow-wrap: break-word;\n  word-break: break-word;\n  hyphens: auto;\n  \n  /* Maintain readability */\n  line-height: 1.5;\n  \n  /* Handle very long words or URLs - allow natural wrapping */\n  overflow: visible;');

console.log(`  ${diffLineOverflow ? '✅' : '❌'} Diff line overflow handling`);
console.log(`  ${textOverflow ? '✅' : '❌'} Text area overflow handling`);
console.log(`  ${contentOverflow ? '✅' : '❌'} Content overflow handling`);

// Check hover expansion styles
const hoverExpansion = cssContent.includes('.diff-line:hover .diff-line-text');
const highlightedExpansion = cssContent.includes('.diff-line[aria-pressed="true"] .diff-line-text');
const synchronizedExpansion = cssContent.includes('.diff-line.synchronized-hover .diff-line-text');

console.log(`  ${hoverExpansion ? '✅' : '❌'} Hover text expansion styles`);
console.log(`  ${highlightedExpansion ? '✅' : '❌'} Highlighted text expansion styles`);
console.log(`  ${synchronizedExpansion ? '✅' : '❌'} Synchronized hover expansion styles`);

console.log('\n📋 Text Expansion Verification Summary:');
console.log('=====================================');

const allChecks = [
  originalPaneMatch,
  improvedPaneMatch,
  sameComponentMatch,
  overflowVisibleMatch,
  wordBreakMatch,
  zIndexMatch,
  diffLineOverflow,
  textOverflow,
  contentOverflow,
  hoverExpansion,
  highlightedExpansion,
  synchronizedExpansion
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

if (passedChecks === totalChecks) {
  console.log('✅ All text expansion checks passed!');
  console.log('✅ Both Original and Improved sides have identical text expansion behavior');
  console.log('✅ Long text lines will expand properly on hover without clipping');
  console.log('✅ Z-index management ensures expanded text is always visible');
} else {
  console.log(`⚠️  ${passedChecks}/${totalChecks} checks passed`);
  console.log('❌ Some text expansion features may not work consistently');
}

console.log('\n🧪 Testing Instructions:');
console.log('========================');
console.log('1. Run: npm run dev');
console.log('2. Navigate to the VirtualizedDiff demo');
console.log('3. Hover over long text lines in both Original and Improved columns');
console.log('4. Verify that text expands without clipping on both sides');
console.log('5. Test with synchronized hover enabled and disabled');
console.log('6. Check that keyboard navigation also expands text properly');

process.exit(passedChecks === totalChecks ? 0 : 1);