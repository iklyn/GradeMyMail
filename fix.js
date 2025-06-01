console.log("✅ fix.js loaded properly.");

// Get tagged text from URL parameters
function getTaggedTextFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  const taggedText = urlParams.get('text');
  return taggedText ? decodeURIComponent(taggedText) : null;
}

// Store tagged text in memory for this session
let originalTaggedText = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 FixMyMail page loaded, checking for tagged text...');
  
  // Try to get tagged text from URL
  const taggedText = getTaggedTextFromURL();
  
  if (taggedText && taggedText.trim()) {
    originalTaggedText = taggedText;
    console.log('📝 Found tagged text:', taggedText.substring(0, 100) + '...');
    await sendToFixAPI(taggedText);
  } else {
    console.log('❌ No tagged text found in URL');
    showError('No content to fix. Please go back to GradeMyMail first.');
  }
});

// Send tagged text to /api/fix endpoint
async function sendToFixAPI(taggedText) {
  console.log('📤 Sending tagged text to /api/fix...');
  
  try {
    showLoading();
    
    const response = await fetch('http://127.0.0.1:3000/api/fix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: taggedText })
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
    parseAndRenderDiffs(fullResponse);

  } catch (error) {
    hideLoading();
    console.error('❌ Error calling /api/fix:', error);
    showError(`Failed to improve content: ${error.message}`);
  }
}

// Parse the response and extract old_draft/optimized_draft pairs
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
    console.log('Response text:', responseText);
    showError('No improvements were generated. The content might already be well-written!');
    return;
  }

  console.log(`🎯 Found ${pairs.length} improvement pairs`);
  renderDiffPairs(pairs);
}

// Render the diff pairs in the split view
function renderDiffPairs(pairs) {
  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  
  if (!leftColumn || !rightColumn) {
    console.error('❌ Could not find split columns in DOM');
    showError('Page layout error. Please refresh and try again.');
    return;
  }

  // Clear any existing content
  leftColumn.innerHTML = '';
  rightColumn.innerHTML = '';

  // Add headers
  const leftHeader = document.createElement('div');
  leftHeader.className = 'diff-header';
  leftHeader.textContent = 'Original';
  leftColumn.appendChild(leftHeader);

  const rightHeader = document.createElement('div');
  rightHeader.className = 'diff-header';
  rightHeader.textContent = 'Improved';
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
}

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show loading state
function showLoading() {
  const container = document.querySelector('.split-diff-container');
  
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666; width: 100%;">
        <div style="font-size: 1.2rem; margin-bottom: 10px;">Improving your content...</div>
        <div style="font-size: 0.9rem;">This may take a few seconds</div>
      </div>
    `;
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
  }
}

// Export functions for potential external use
window.FixMyMail = {
  sendToFixAPI,
  parseAndRenderDiffs,
  renderDiffPairs
};