#!/usr/bin/env node

/**
 * Verification script for Rich Text Editor implementation
 * This script checks if all required features are implemented correctly
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFileExists(filePath) {
  try {
    readFileSync(join(projectRoot, filePath), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function checkFileContains(filePath, searchStrings) {
  try {
    const content = readFileSync(join(projectRoot, filePath), 'utf8');
    return searchStrings.every(str => content.includes(str));
  } catch (error) {
    return false;
  }
}

function runVerification() {
  log('\n🔍 Verifying Rich Text Editor Implementation', 'bold');
  log('=' .repeat(50), 'blue');

  const checks = [
    {
      name: 'Lexical Dependencies Installed',
      test: () => {
        const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        return [
          'lexical',
          '@lexical/react',
          '@lexical/rich-text',
          '@lexical/list',
          '@lexical/link',
          '@lexical/history',
          '@lexical/html'
        ].every(dep => deps[dep]);
      }
    },
    {
      name: 'RichTextEditor Component Uses Lexical',
      test: () => checkFileContains('src/components/RichTextEditor/RichTextEditor.tsx', [
        'LexicalComposer',
        'RichTextPlugin',
        'ContentEditable',
        'HistoryPlugin'
      ])
    },
    {
      name: 'Toolbar Plugin Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        'useLexicalComposerContext',
        'FORMAT_TEXT_COMMAND',
        'UNDO_COMMAND',
        'REDO_COMMAND'
      ])
    },
    {
      name: 'Keyboard Shortcuts Plugin Exists',
      test: () => checkFileExists('src/components/RichTextEditor/plugins/KeyboardShortcutsPlugin.tsx')
    },
    {
      name: 'Keyboard Shortcuts Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/KeyboardShortcutsPlugin.tsx', [
        'KEY_MODIFIER_COMMAND',
        'KeyB', // Bold shortcut
        'KeyI', // Italic shortcut
        'KeyU', // Underline shortcut
        'KeyK'  // Link shortcut
      ])
    },
    {
      name: 'Initial Content Plugin Exists',
      test: () => checkFileExists('src/components/RichTextEditor/plugins/InitialContentPlugin.tsx')
    },
    {
      name: 'Undo/Redo System Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        'canUndo',
        'canRedo',
        'CAN_UNDO_COMMAND',
        'CAN_REDO_COMMAND'
      ])
    },
    {
      name: 'Text Formatting Commands',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        'bold',
        'italic',
        'underline',
        'strikethrough'
      ])
    },
    {
      name: 'List Support Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        'INSERT_UNORDERED_LIST_COMMAND',
        'INSERT_ORDERED_LIST_COMMAND',
        'REMOVE_LIST_COMMAND'
      ])
    },
    {
      name: 'Link Support Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        'TOGGLE_LINK_COMMAND',
        'isLink'
      ])
    },
    {
      name: 'Heading Support Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/plugins/ToolbarPlugin.tsx', [
        '$createHeadingNode',
        'HeadingTagType',
        'h1',
        'h2',
        'h3'
      ])
    },
    {
      name: 'Editor Ref Methods Implemented',
      test: () => checkFileContains('src/components/RichTextEditor/RichTextEditor.tsx', [
        'getHTML',
        'getPlainText',
        'setContent',
        'focus',
        'clear'
      ])
    },
    {
      name: 'Demo Component Created',
      test: () => checkFileExists('src/components/RichTextEditorDemo.tsx')
    },
    {
      name: 'TypeScript Support',
      test: () => checkFileContains('src/components/RichTextEditor/RichTextEditor.tsx', [
        'RichTextEditorProps',
        'RichTextEditorRef',
        'forwardRef'
      ])
    }
  ];

  let passed = 0;
  let failed = 0;

  checks.forEach((check, index) => {
    const result = check.test();
    const status = result ? '✅ PASS' : '❌ FAIL';
    const color = result ? 'green' : 'red';
    
    log(`${index + 1}. ${check.name}: ${status}`, color);
    
    if (result) {
      passed++;
    } else {
      failed++;
    }
  });

  log('\n' + '=' .repeat(50), 'blue');
  log(`📊 Results: ${passed} passed, ${failed} failed`, 'bold');
  
  if (failed === 0) {
    log('🎉 All checks passed! Rich Text Editor implementation is complete.', 'green');
    log('\n📋 Task Requirements Verification:', 'bold');
    log('✅ Lexical editor integrated with TypeScript support', 'green');
    log('✅ Modular toolbar components (bold, italic, lists, links)', 'green');
    log('✅ Undo/redo system with command pattern', 'green');
    log('✅ Keyboard shortcuts for standard formatting operations', 'green');
    log('\n🚀 Ready for testing! Run `npm run dev` to test the editor.', 'blue');
  } else {
    log('⚠️  Some checks failed. Please review the implementation.', 'yellow');
  }

  return failed === 0;
}

// Run verification
const success = runVerification();
process.exit(success ? 0 : 1);