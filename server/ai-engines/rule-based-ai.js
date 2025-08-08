// Professional Rule-Based AI Engine
// This provides intelligent newsletter analysis without external dependencies

import { readFileSync } from 'fs';
import { join } from 'path';

// Load system prompts
let systemPrompts = new Map();

function loadSystemPrompts() {
  try {
    const gmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_GM.txt'), 'utf-8');
    systemPrompts.set('grademymail', gmPrompt);
    
    const fmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_FM.txt'), 'utf-8');
    systemPrompts.set('fixmymail', fmPrompt);
    
    console.log('✅ Rule-based AI: System prompts loaded');
  } catch (error) {
    console.log('⚠️ Rule-based AI: Using default prompts');
    setDefaultPrompts();
  }
}

function setDefaultPrompts() {
  systemPrompts.set('grademymail', 
    'Analyze newsletter content and identify issues with clarity, engagement, and tone.'
  );
  systemPrompts.set('fixmymail', 
    'Improve newsletter content by fixing identified issues and enhancing readability.'
  );
}

// Initialize prompts
loadSystemPrompts();

export async function ruleBasedAnalysis(content) {
  console.log('🤖 Running rule-based newsletter analysis...');
  
  let taggedContent = content;
  const issues = [];
  
  // 1. Detect hard-to-read sentences (long sentences)
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  let hardToReadCount = 0;
  
  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/);
    if (words.length > 20) { // Sentences with more than 20 words
      const trimmed = sentence.trim();
      if (trimmed && !taggedContent.includes(`<hard_to_read>${trimmed}</hard_to_read>`)) {
        taggedContent = taggedContent.replace(trimmed, `<hard_to_read>${trimmed}</hard_to_read>`);
        hardToReadCount++;
        issues.push(`Long sentence detected: ${words.length} words`);
      }
    }
  });
  
  // 2. Detect spam words
  const spamWords = [
    'free', 'urgent', 'act now', 'limited time', 'amazing', 'incredible', 
    'guaranteed', 'revolutionary', 'transform', 'instantly', 'boost',
    'supercharge', 'once-in-a-lifetime', 'don\'t miss out'
  ];
  
  let spamWordsCount = 0;
  spamWords.forEach(word => {
    const regex = new RegExp(`\\b${word.replace(/'/g, "\\'")}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches) {
      spamWordsCount += matches.length;
      taggedContent = taggedContent.replace(regex, `<spam_words>$&</spam_words>`);
      issues.push(`Spam word detected: "${word}" (${matches.length} times)`);
    }
  });
  
  // 3. Detect fluff words
  const fluffWords = [
    'very', 'really', 'quite', 'extremely', 'absolutely', 'totally',
    'completely', 'definitely', 'certainly', 'obviously'
  ];
  
  let fluffWordsCount = 0;
  fluffWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    const matches = content.match(regex);
    if (matches) {
      fluffWordsCount += matches.length;
      taggedContent = taggedContent.replace(regex, `<fluff>$&</fluff>`);
      issues.push(`Fluff word detected: "${word}" (${matches.length} times)`);
    }
  });
  
  // 4. Detect excessive exclamation marks
  const exclamationMatches = content.match(/!+/g);
  if (exclamationMatches && exclamationMatches.length > 3) {
    issues.push(`Excessive exclamation marks: ${exclamationMatches.length} instances`);
  }
  
  // 5. Detect ALL CAPS words
  const capsWords = content.match(/\b[A-Z]{3,}\b/g);
  if (capsWords && capsWords.length > 0) {
    issues.push(`ALL CAPS words detected: ${capsWords.join(', ')}`);
  }
  
  console.log(`📊 Analysis complete:`);
  console.log(`   • Hard-to-read sentences: ${hardToReadCount}`);
  console.log(`   • Spam words: ${spamWordsCount}`);
  console.log(`   • Fluff words: ${fluffWordsCount}`);
  console.log(`   • Total issues: ${issues.length}`);
  
  return taggedContent;
}

export async function ruleBasedImprovement(taggedContent) {
  console.log('🔧 Running rule-based newsletter improvement...');
  
  const improvements = [];
  
  // 1. Fix hard-to-read sentences
  const hardToReadMatches = taggedContent.match(/<hard_to_read>(.*?)<\/hard_to_read>/gs) || [];
  hardToReadMatches.forEach(match => {
    const content = match.replace(/<\/?hard_to_read>/g, '');
    const improved = simplifyText(content);
    if (improved !== content) {
      improvements.push(`<old_draft>${content}</old_draft><optimized_draft>${improved}</optimized_draft>`);
    }
  });
  
  // 2. Fix spam words
  const spamMatches = taggedContent.match(/<spam_words>(.*?)<\/spam_words>/gs) || [];
  const processedSpamWords = new Set();
  
  spamMatches.forEach(match => {
    const content = match.replace(/<\/?spam_words>/g, '');
    const lowerContent = content.toLowerCase();
    
    if (!processedSpamWords.has(lowerContent)) {
      const improved = replaceProfessionally(content);
      if (improved !== content) {
        improvements.push(`<old_draft>${content}</old_draft><optimized_draft>${improved}</optimized_draft>`);
        processedSpamWords.add(lowerContent);
      }
    }
  });
  
  // 3. Fix fluff words
  const fluffMatches = taggedContent.match(/<fluff>(.*?)<\/fluff>/gs) || [];
  const processedFluffWords = new Set();
  
  fluffMatches.forEach(match => {
    const content = match.replace(/<\/?fluff>/g, '');
    const lowerContent = content.toLowerCase();
    
    if (!processedFluffWords.has(lowerContent)) {
      const improved = removeFluff(content);
      if (improved !== content && improved.trim() !== '') {
        improvements.push(`<old_draft>${content}</old_draft><optimized_draft>${improved}</optimized_draft>`);
        processedFluffWords.add(lowerContent);
      }
    }
  });
  
  console.log(`🎯 Generated ${improvements.length} improvements`);
  
  return improvements.length > 0 
    ? improvements.join('\n\n') 
    : '<old_draft>No improvements needed</old_draft><optimized_draft>Content is already well-written</optimized_draft>';
}

function simplifyText(text) {
  // Break long sentences into shorter ones
  const words = text.trim().split(/\s+/);
  if (words.length > 25) {
    // Find a good breaking point (look for conjunctions)
    const breakWords = ['and', 'but', 'or', 'so', 'because', 'while', 'although'];
    let breakPoint = Math.floor(words.length / 2);
    
    // Try to find a natural break point
    for (let i = Math.floor(words.length / 3); i < Math.floor(2 * words.length / 3); i++) {
      if (breakWords.includes(words[i].toLowerCase())) {
        breakPoint = i;
        break;
      }
    }
    
    const firstPart = words.slice(0, breakPoint).join(' ');
    const secondPart = words.slice(breakPoint).join(' ');
    
    return `${firstPart}. ${secondPart.charAt(0).toUpperCase()}${secondPart.slice(1)}`;
  }
  return text;
}

function replaceProfessionally(word) {
  const replacements = {
    'free': 'complimentary',
    'urgent': 'time-sensitive',
    'act now': 'take action',
    'limited time': 'for a short period',
    'amazing': 'excellent',
    'incredible': 'remarkable',
    'guaranteed': 'assured',
    'revolutionary': 'innovative',
    'transform': 'improve',
    'instantly': 'quickly',
    'boost': 'enhance',
    'supercharge': 'optimize',
    'once-in-a-lifetime': 'unique',
    'don\'t miss out': 'consider this opportunity'
  };
  
  const lowerWord = word.toLowerCase();
  return replacements[lowerWord] || word;
}

function removeFluff(word) {
  const fluffRemovals = {
    'very': '',
    'really': '',
    'quite': '',
    'extremely': '',
    'absolutely': '',
    'totally': '',
    'completely': '',
    'definitely': '',
    'certainly': '',
    'obviously': ''
  };
  
  const lowerWord = word.toLowerCase();
  const replacement = fluffRemovals[lowerWord];
  return replacement !== undefined ? replacement : word;
}