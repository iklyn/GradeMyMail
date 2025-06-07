console.log("✅ fix.js loaded properly.");

// Store tagged text in memory for this session
let originalTaggedText = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 FixMyMail page loaded, starting bootstrap…');

  // Make sure the split columns exist
  const leftColumn  = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  if (!leftColumn || !rightColumn) {
    console.error('❌ Split columns not found in DOM');
    showError('Page layout error – please ensure .split-left and .split-right exist.');
    return;
  }
  console.log('✅ Split columns found');

  const storedData = getFullDataFromStorage();   // <— already defined below
  if (storedData) {
    window.fixMyMailData = storedData;           // expose globally for later use
  }

  const taggedBlob = getTaggedTextFromStorage(); // <— helper you added earlier

  if (!taggedBlob || !taggedBlob.trim()) {
    console.log('❌ No tagged text found in storage');
    showError('No content to fix. Please go back to GradeMyMail first.');
    return;
  }

  console.log('📝 Tagged blob found:', taggedBlob.substring(0, 120) + '…');

  const taggedSentences = extractTaggedSentences(taggedBlob);
  if (taggedSentences.length === 0) {
    showError('No <fluff> / <spam_words> / <hard_to_read> tags detected.');
    return;
  }

  console.log(`🎯 Extracted ${taggedSentences.length} tagged sentences`);
  await sendToFixAPI(taggedSentences);           // kicks off the /api/fix call
});

// Extract tagged sentences from the full text
function extractTaggedSentences(fullText) {
  const taggedSentences = [];
  const regex = /<(fluff|spam_words|hard_to_read)>\s*(.*?)\s*<\/\1>/gi;
  let match;

  while ((match = regex.exec(fullText)) !== null) {
    const tag = match[1].toLowerCase();
    const sentence = match[2].trim();
    
    if (sentence) {
      taggedSentences.push({
        tag: tag,
        sentence: sentence
      });
      console.log(`📌 Extracted <${tag}> sentence: "${sentence}"`);
    }
  }

  return taggedSentences;
}

// Get full data from localStorage or sessionStorage
function getFullDataFromStorage() {
  try {
    // Try localStorage first
    let dataString = localStorage.getItem('fixMyMailData');
    if (dataString) {
      console.log('📦 Found full data in localStorage');
      return JSON.parse(dataString);
    }
    
    // Try sessionStorage as fallback
    dataString = sessionStorage.getItem('fixMyMailData');
    if (dataString) {
      console.log('📦 Found full data in sessionStorage');
      return JSON.parse(dataString);
    }
    
    // Legacy support - check for old taggedText format
    let taggedText = localStorage.getItem('taggedText') || sessionStorage.getItem('taggedText');
    if (taggedText) {
      console.log('📦 Found legacy tagged text, converting...');
      return {
        fullOriginalText: taggedText, // Fallback
        taggedContent: taggedText,
        taggedResponse: taggedText
      };
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error reading from storage:', error);
    return null;
  }
}

/**
 * Pulls the tagged text that FixMyMail needs.
 * – Looks first at the object we create in showFixMyMailButton()
 * – Falls back to the legacy single-string key for backwards compatibility
 * Returns: string | null
 */
function getTaggedTextFromStorage() {
  // Newer versions save an object – reuse the existing helper
  const data = getFullDataFromStorage();

  if (data) {
    // Preferred field: only the tagged sentences that need fixing
    if (data.taggedContent && data.taggedContent.trim()) {
      return data.taggedContent;
    }

    // Old field: full AI response that already contains tags
    if (data.taggedResponse && data.taggedResponse.trim()) {
      return data.taggedResponse;
    }
  }

  // Very first prototype stored a plain string in its own key
  const legacy = localStorage.getItem('taggedText') ||
                 sessionStorage.getItem('taggedText');
  return legacy || null;
}

// Send only tagged sentences to /api/fix endpoint
async function sendToFixAPI(taggedSentences) {
  console.log('📤 Sending tagged sentences to /api/fix...');
  
  try {
    showLoading();
    
    // Format the tagged sentences for the API
    const formattedMessage = taggedSentences.map(item => {
      return `<${item.tag}>${item.sentence}</${item.tag}>`;
    }).join('\n\n');
    
    console.log('📝 Formatted message for API:', formattedMessage);
    
    const response = await fetch('http://127.0.0.1:3000/api/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: formattedMessage })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    // Handle streaming response from OpenRouter
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    console.log('📦 Streaming response from server...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('✅ Streaming finished.');
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      
      // Parse OpenRouter streaming format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            continue;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta && parsed.choices[0].delta.content) {
              fullResponse += parsed.choices[0].delta.content;
            }
          } catch (e) {
            // Skip invalid JSON lines
            continue;
          }
        }
      }
    }

    hideLoading();
    console.log('📝 Full response received:', fullResponse);
    
    // Wait a bit to ensure all content is received
    setTimeout(() => {
      parseAndRenderDiffs(fullResponse);
    }, 100);

  } catch (error) {
    hideLoading();
    console.error('❌ Error calling /api/fix:', error);
    showError(`Failed to improve content: ${error.message}`);
  }
}

// Parse the response and extract old_draft/optimized_draft pairs
// Parse the response and extract old_draft/optimized_draft pairs, then render full text diff
function parseAndRenderDiffs(responseText) {
  console.log('🔍 Parsing response for draft pairs...');
  
  const pairs = [];
  const regex = /<old_draft>\s*([\s\S]*?)\s*<\/old_draft>\s*<optimized_draft>\s*([\s\S]*?)\s*<\/optimized_draft>/gi;
  let match;

  while ((match = regex.exec(responseText)) !== null) {
    const oldDraft = match[1].trim();
    const optimizedDraft = match[2].trim();
    
    if (oldDraft && optimizedDraft) {
      pairs.push({
        original: oldDraft,
        improved: optimizedDraft
      });
      console.log(`✅ Found pair: "${oldDraft.substring(0, 50)}..." -> "${optimizedDraft.substring(0, 50)}..."`);
    }
  }

  if (pairs.length === 0) {
    console.log('⚠️ No draft pairs found in response');
    showError(`No improvements were generated. Raw response: ${responseText.substring(0, 200)}...`);
    return;
  }

  console.log(`🎯 Found ${pairs.length} improvement pairs`);
  
  // Get the original full text
  const originalFullText = window.fixMyMailData?.fullOriginalText || 'Original text not found';
  
  // Reconstruct the full improved text
  const improvedFullText = reconstructFullImprovedText(originalFullText, pairs);
  
  // Generate line-by-line diff
  const diffLines = generateLineDiff(originalFullText, improvedFullText);
  
  // Render the full text diff
  renderFullTextDiff(diffLines);
}

// Render the diff pairs in the split view
// Render the full text diff in the split view
function renderFullTextDiff(diffLines) {
  // First restore the original structure if it was replaced by loading state
  restoreSplitStructure();
  
  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  
  if (!leftColumn || !rightColumn) {
    console.error('❌ Could not find split columns in DOM after restoration');
    showError('Page layout error. Please refresh and try again.');
    return;
  }

  console.log('✅ Split columns found successfully');

  // Clear any existing content
  leftColumn.innerHTML = '';
  rightColumn.innerHTML = '';

  // Add headers
  const leftHeader = document.createElement('div');
  leftHeader.className = 'diff-header';
  leftHeader.textContent = 'Original Text';
  leftColumn.appendChild(leftHeader);

  const rightHeader = document.createElement('div');
  rightHeader.className = 'diff-header';
  rightHeader.textContent = 'Improved Text';
  rightColumn.appendChild(rightHeader);

  // Add content containers
  const leftContent = document.createElement('div');
  leftContent.className = 'diff-content';
  leftColumn.appendChild(leftContent);

  const rightContent = document.createElement('div');
  rightContent.className = 'diff-content';
  rightColumn.appendChild(rightContent);

  // Render each line
  diffLines.forEach((line, index) => {
    // Create original version (left side)
    const originalDiv = document.createElement('div');
    if (line.type === 'changed') {
      originalDiv.className = 'diff-line removed';
      originalDiv.innerHTML = `<span class="diff-symbol">−</span>${escapeHtml(line.original)}`;
    } else {
      originalDiv.className = 'diff-line';
      originalDiv.innerHTML = `<span class="diff-symbol">&nbsp;</span>${escapeHtml(line.original)}`;
    }
    leftContent.appendChild(originalDiv);

    // Create improved version (right side)
    const improvedDiv = document.createElement('div');
    if (line.type === 'changed') {
      improvedDiv.className = 'diff-line added';
      improvedDiv.innerHTML = `<span class="diff-symbol">+</span>${escapeHtml(line.improved)}`;
    } else {
      improvedDiv.className = 'diff-line';
      improvedDiv.innerHTML = `<span class="diff-symbol">&nbsp;</span>${escapeHtml(line.improved)}`;
    }
    rightContent.appendChild(improvedDiv);
  });

  console.log(`🎨 Rendered ${diffLines.length} lines successfully`);
  
  // Clear the storage after successful rendering
  clearTaggedTextFromStorage();
}

// Restore the original split structure if it was replaced
function restoreSplitStructure() {
  const container = document.querySelector('.split-diff-container');
  if (!container) {
    console.error('❌ Split diff container not found');
    return;
  }

  // Check if split columns exist
  const leftColumn = container.querySelector('.split-left');
  const rightColumn = container.querySelector('.split-right');

  // If they don't exist, recreate them
  if (!leftColumn || !rightColumn) {
    console.log('🔄 Restoring split structure...');
    container.innerHTML = `
      <div class="split-left">
        <!-- Content will be populated by JavaScript -->
      </div>
      <div class="split-right">
        <!-- Content will be populated by JavaScript -->
      </div>
    `;
    console.log('✅ Split structure restored');
  }
}

// Clear data from storage after use
function clearTaggedTextFromStorage() {
  try {
    localStorage.removeItem('fixMyMailData');
    localStorage.removeItem('taggedText'); // Legacy cleanup
    sessionStorage.removeItem('fixMyMailData');
    sessionStorage.removeItem('taggedText'); // Legacy cleanup
    console.log('🧹 Cleared all data from storage');
  } catch (error) {
    console.error('❌ Error clearing storage:', error);
  }
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show loading state - FIXED: Don't replace the split structure
function showLoading() {
  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  
  if (leftColumn && rightColumn) {
    // Clear existing content but keep the structure
    leftColumn.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 1.2rem; margin-bottom: 10px;">🔄 Analyzing tagged content...</div>
        <div style="font-size: 0.9rem;">Please wait</div>
      </div>
    `;
    
    rightColumn.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 1.2rem; margin-bottom: 10px;">✨ Generating improvements...</div>
        <div style="font-size: 0.9rem;">This may take a few seconds</div>
      </div>
    `;
  } else {
    console.error('❌ Could not find split columns for loading state');
    // Fallback to container replacement only if split columns don't exist
    const container = document.querySelector('.split-diff-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; width: 100%;">
          <div style="font-size: 1.2rem; margin-bottom: 10px;">🔄 Improving tagged content...</div>
          <div style="font-size: 0.9rem;">This may take a few seconds</div>
        </div>
      `;
    }
  }
}

// Hide loading state
function hideLoading() {
  // Loading will be replaced by renderDiffPairs or showError
}

// Show error message
function showError(message) {
  const container = document.querySelector('.split-diff-container');
  
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #d73a49; width: 100%;">
        <div style="font-size: 1.2rem; margin-bottom: 10px;">⚠️ ${escapeHtml(message)}</div>
        <div style="margin-top: 20px;">
          <button onclick="window.history.back()" style="
            background: #f6f8fa;
            border: 2px solid #d1d5da;
            border-radius: 6px;
            color: #24292e;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            padding: 6px 16px;
            text-decoration: none;
            white-space: nowrap;
          ">← Back to GradeMyMail</button>
        </div>
      </div>
    `;
  } else {
    console.error('❌ Could not find .split-diff-container for error message');
    // Fallback: show alert
    alert(message);
  }
}

// Reconstruct the full improved text by replacing tagged portions with improvements
function reconstructFullImprovedText(originalFullText, improvementPairs) {
  let improvedText = originalFullText;
  
  // Sort pairs by length (longest first) to avoid partial replacements
  const sortedPairs = improvementPairs.sort((a, b) => b.original.length - a.original.length);
  
  for (const pair of sortedPairs) {
    // Use a more flexible matching approach
    const originalSentence = pair.original.trim();
    const improvedSentence = pair.improved.trim();
    
    // Try exact match first
    if (improvedText.includes(originalSentence)) {
      improvedText = improvedText.replace(originalSentence, improvedSentence);
      console.log(`✅ Replaced: "${originalSentence.substring(0, 50)}..." -> "${improvedSentence.substring(0, 50)}..."`);
    } else {
      // Try fuzzy matching for sentences that might have slight differences
      const words = originalSentence.split(' ');
      if (words.length >= 3) {
        const keyPhrase = words.slice(0, Math.min(5, words.length)).join(' ');
        const regex = new RegExp(escapeRegExp(keyPhrase) + '[^.!?]*[.!?]?', 'gi');
        const matches = improvedText.match(regex);
        
        if (matches && matches.length === 1) {
          improvedText = improvedText.replace(matches[0], improvedSentence);
          console.log(`✅ Fuzzy replaced: "${matches[0].substring(0, 50)}..." -> "${improvedSentence.substring(0, 50)}..."`);
        }
      }
    }
  }
  
  return improvedText;
}

// Helper function to escape regex special characters
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generate line-by-line diff between original and improved text
/* ------------------------------------------------------------------
   Helper - split text into *sentence* units (instead of whole paragraphs)
------------------------------------------------------------------ */
function splitIntoUnits(text) {
  return (
    text
      .replace(/\r\n/g, "\n")            // normalise line-breaks
      .split("\n")                       // first split on hard returns
      .map(p => p.trim())
      .filter(Boolean)                   // drop blank lines
      .flatMap(p => {
        // then split each paragraph into sentences
        const sentences = p.match(/[^.!?]+[.!?]*/g);
        return sentences ? sentences.map(s => s.trim()) : [p];
      })
  );
}

function generateLineDiff(originalText, improvedText) {
  const originalUnits  = splitIntoUnits(originalText);
  const improvedUnits  = splitIntoUnits(improvedText);

  const diffLines = [];
  const max = Math.max(originalUnits.length, improvedUnits.length);

  for (let i = 0; i < max; i++) {
    const orig = originalUnits[i]  || "";
    const imp  = improvedUnits[i]  || "";

    diffLines.push(
      orig === imp
        ? { type: "unchanged", original: orig, improved: imp }
        : { type: "changed",   original: orig, improved: imp }
    );
  }

  return diffLines;
}

// Export functions for potential external use
window.FixMyMail = {
  sendToFixAPI,
  parseAndRenderDiffs,
  renderFullTextDiff,
  getTaggedTextFromStorage,
  extractTaggedSentences
};