// Professional Rule-Based AI Engine - CommonJS Version
// This provides intelligent newsletter analysis without external dependencies

const { readFileSync } = require('fs');
const { join } = require('path');

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

async function ruleBasedAnalysis(content) {
  console.log('🤖 Running professional rule-based newsletter analysis...');
  console.log('📝 Input content type:', content.includes('<') ? 'HTML' : 'Plain text');
  
  let taggedContent = content;
  const issues = [];
  
  // Extract plain text for analysis but keep HTML structure
  const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  
  // 1. Detect hard-to-read sentences (long sentences) in plain text
  // Better sentence splitting that handles multiple sentences
  const sentences = plainText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Also try to find individual sentences within the HTML content
  const htmlSentences = [];
  const htmlText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const htmlSentenceSplit = htmlText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  // Combine both approaches
  const allSentences = [...new Set([...sentences, ...htmlSentenceSplit])];
  
  let hardToReadCount = 0;
  
  sentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/);
    if (words.length > 15) { // Lower threshold to catch more sentences
      const trimmed = sentence.trim();
      if (trimmed && trimmed.length > 10) {
        console.log(`🔍 Checking sentence (${words.length} words): "${trimmed.substring(0, 80)}..."`);
        
        // Try a simpler approach first - direct string replacement
        if (taggedContent.includes(trimmed) && !taggedContent.includes(`<hard_to_read>${trimmed}</hard_to_read>`)) {
          taggedContent = taggedContent.replace(trimmed, `<hard_to_read>${trimmed}</hard_to_read>`);
          hardToReadCount++;
          issues.push(`Long sentence detected: ${words.length} words`);
          console.log(`🎯 Tagged long sentence: "${trimmed.substring(0, 50)}..."`);
        } else {
          console.log(`❌ Sentence not found or already tagged`);
        }
      }
    }
  });
  
  // 2. Detect spam words in plain text, apply to HTML
  const spamWords = [
    'free', 'urgent', 'act now', 'limited time', 'amazing', 'incredible', 
    'guaranteed', 'revolutionary', 'transform', 'instantly', 'boost',
    'supercharge', 'once-in-a-lifetime', 'don\'t miss out'
  ];
  
  let spamWordsCount = 0;
  spamWords.forEach(word => {
    const regex = new RegExp(`\\b${word.replace(/'/g, "\\'")}\\b`, 'gi');
    let match;
    
    // Reset regex for each word
    regex.lastIndex = 0;
    
    while ((match = regex.exec(plainText)) !== null) {
      const actualWord = match[0];
      
      // Apply to HTML content - find and replace the word (not inside HTML tags)
      const wordRegex = new RegExp(`(?<!<[^>]*>)\\b${actualWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?![^<]*>)`, 'gi');
      
      if (wordRegex.test(taggedContent) && !taggedContent.includes(`<spam_words>${actualWord}</spam_words>`)) {
        taggedContent = taggedContent.replace(wordRegex, `<spam_words>${actualWord}</spam_words>`);
        spamWordsCount++;
        issues.push(`Spam word detected: "${actualWord}"`);
        console.log(`🎯 Tagged spam word: "${actualWord}"`);
      }
      
      // Prevent infinite loop
      if (!regex.global) break;
    }
  });
  
  // 3. Detect fluff words in plain text, apply to HTML
  const fluffWords = [
    'very', 'really', 'quite', 'extremely', 'absolutely', 'totally',
    'completely', 'definitely', 'certainly', 'obviously'
  ];
  
  let fluffWordsCount = 0;
  fluffWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    let match;
    
    // Reset regex for each word
    regex.lastIndex = 0;
    
    while ((match = regex.exec(plainText)) !== null) {
      const actualWord = match[0];
      
      // Apply to HTML content - find and replace the word (not inside HTML tags)
      const wordRegex = new RegExp(`(?<!<[^>]*>)\\b${actualWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?![^<]*>)`, 'gi');
      
      if (wordRegex.test(taggedContent) && !taggedContent.includes(`<fluff>${actualWord}</fluff>`)) {
        taggedContent = taggedContent.replace(wordRegex, `<fluff>${actualWord}</fluff>`);
        fluffWordsCount++;
        issues.push(`Fluff word detected: "${actualWord}"`);
        console.log(`🎯 Tagged fluff word: "${actualWord}"`);
      }
      
      // Prevent infinite loop
      if (!regex.global) break;
    }
  });
  
  // 4. Detect excessive exclamation marks in plain text
  const exclamationMatches = plainText.match(/!+/g);
  if (exclamationMatches && exclamationMatches.length > 3) {
    issues.push(`Excessive exclamation marks: ${exclamationMatches.length} instances`);
  }
  
  // 5. Detect ALL CAPS words in plain text
  const capsWords = plainText.match(/\b[A-Z]{3,}\b/g);
  if (capsWords && capsWords.length > 0) {
    issues.push(`ALL CAPS words detected: ${capsWords.join(', ')}`);
  }
  
  console.log(`📊 Professional analysis complete:`);
  console.log(`   • Hard-to-read sentences: ${hardToReadCount}`);
  console.log(`   • Spam words: ${spamWordsCount}`);
  console.log(`   • Fluff words: ${fluffWordsCount}`);
  console.log(`   • Total issues: ${issues.length}`);
  
  return taggedContent;
}

async function ruleBasedImprovement(taggedContent) {
  console.log('🔧 Running professional rule-based newsletter improvement...');
  
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
  
  console.log(`🎯 Generated ${improvements.length} professional improvements`);
  
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

module.exports = {
  ruleBasedAnalysis,
  ruleBasedImprovement
};