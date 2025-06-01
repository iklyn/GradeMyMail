console.log("✅ fix.js loaded properly.");

// Store tagged text in memory for this session
let originalTaggedText = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 FixMyMail page loaded, checking for tagged text...');
  
  // Verify DOM elements exist first
  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  
  if (!leftColumn || !rightColumn) {
    console.error('❌ Split columns not found in DOM');
    showError('Page layout error. DOM elements missing. Please ensure the HTML has .split-left and .split-right elements.');
    return;
  }
  
  console.log('✅ DOM elements found successfully');
  
  // Try to get tagged text from localStorage first, then sessionStorage
  const fullText = getTaggedTextFromStorage();
  
  if (fullText && fullText.trim()) {
    originalTaggedText = fullText;
    console.log('📝 Found full text:', fullText.substring(0, 100) + '...');
    
    // Extract only the tagged sentences
    const taggedSentences = extractTaggedSentences(fullText);
    
    if (taggedSentences.length > 0) {
      console.log(`🎯 Extracted ${taggedSentences.length} tagged sentences`);
      await sendToFixAPI(taggedSentences);
    } else {
      console.log('❌ No tagged sentences found in text');
      showError('No tagged content found to improve. The text may not have been analyzed yet.');
    }
  } else {
    console.log('❌ No tagged text found in storage');
    showError('No content to fix. Please go back to GradeMyMail first.');
  }
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

// Get tagged text from localStorage or sessionStorage
function getTaggedTextFromStorage() {
  try {
    // Try localStorage first
    let taggedText = localStorage.getItem('taggedText');
    if (taggedText) {
      console.log('📦 Found tagged text in localStorage');
      return taggedText;
    }
    
    // Try sessionStorage as fallback
    taggedText = sessionStorage.getItem('taggedText');
    if (taggedText) {
      console.log('📦 Found tagged text in sessionStorage');
      return taggedText;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Error reading from storage:', error);
    return null;
  }
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
function parseAndRenderDiffs(responseText) {
  console.log('🔍 Parsing response for draft pairs...');
  console.log('📄 Full response text:', responseText); // Debug log
  
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
    console.log('📄 Response text for debugging:', responseText);
    
    // Show raw response for debugging
    showError(`No improvements were generated. Raw response: ${responseText.substring(0, 200)}...`);
    return;
  }

  console.log(`🎯 Found ${pairs.length} improvement pairs`);
  renderDiffPairs(pairs);
}

// Render the diff pairs in the split view
function renderDiffPairs(pairs) {
  // First restore the original structure if it was replaced by loading state
  restoreSplitStructure();
  
  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  
  if (!leftColumn || !rightColumn) {
    console.error('❌ Could not find split columns in DOM after restoration');
    console.error('Available elements:', document.querySelectorAll('div').length, 'divs found');
    console.error('Container HTML:', document.querySelector('.split-diff-container')?.innerHTML);
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
  leftHeader.textContent = 'Original Tagged Sentences';
  leftColumn.appendChild(leftHeader);

  const rightHeader = document.createElement('div');
  rightHeader.className = 'diff-header';
  rightHeader.textContent = 'Improved Sentences';
  rightColumn.appendChild(rightHeader);

  // Add content containers
  const leftContent = document.createElement('div');
  leftContent.className = 'diff-content';
  leftColumn.appendChild(leftContent);

  const rightContent = document.createElement('div');
  rightContent.className = 'diff-content';
  rightColumn.appendChild(rightContent);

  // Render each pair
  pairs.forEach((pair, index) => {
    // Create original version (left side)
    const originalDiv = document.createElement('div');
    originalDiv.className = 'diff-line removed';
    originalDiv.innerHTML = `<span class="diff-symbol">−</span>${escapeHtml(pair.original)}`;
    leftContent.appendChild(originalDiv);

    // Create improved version (right side)
    const improvedDiv = document.createElement('div');
    improvedDiv.className = 'diff-line added';
    improvedDiv.innerHTML = `<span class="diff-symbol">+</span>${escapeHtml(pair.improved)}`;
    rightContent.appendChild(improvedDiv);

    console.log(`✅ Rendered pair ${index + 1}/${pairs.length}`);
  });

  console.log('🎨 All diff pairs rendered successfully');
  
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

// Clear tagged text from storage after use
function clearTaggedTextFromStorage() {
  try {
    localStorage.removeItem('taggedText');
    sessionStorage.removeItem('taggedText');
    console.log('🧹 Cleared tagged text from storage');
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

// Export functions for potential external use
window.FixMyMail = {
  sendToFixAPI,
  parseAndRenderDiffs,
  renderDiffPairs,
  getTaggedTextFromStorage,
  extractTaggedSentences
};