console.log("✅ fix.js loaded properly.");

// Store tagged text in memory for this session
let originalTaggedText = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 FixMyMail page loaded, starting bootstrap…');

  const leftColumn = document.querySelector('.split-left');
  const rightColumn = document.querySelector('.split-right');
  if (!leftColumn || !rightColumn) {
    console.error('❌ Split columns not found in DOM');
    showError('Page layout error – please ensure .split-left and .split-right exist.');
    return;
  }
  console.log('✅ Split columns found');

  const storedData = getFullDataFromStorage();
  if (storedData) {
    window.fixMyMailData = storedData;
  }

  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get("id");

  if (!id) {
    console.error("❌ No ID found in URL");
    showError("Missing data ID. Please return to GradeMyMail.");
    return;
  }

  try {
    const response = await fetch(`http://127.0.0.1:3000/api/load?id=${id}`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const { payload } = await response.json();
    const taggedBlob = payload;

    if (!taggedBlob || !taggedBlob.trim()) {
      console.log('❌ No tagged text found from server');
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
    await sendToFixAPI(taggedSentences);

  } catch (err) {
    console.error('❌ Error fetching tagged text:', err);
    showError('Failed to load content. Please try again.');
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

    const data = await response.json();
    const fullResponse = data.choices[0].message.content;

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
  
  // Get the original full HTML
  const originalFullHTML = window.fixMyMailData?.fullOriginalHTML || '<p>Original text not found</p>';
  
  // Reconstruct the full improved text
  const improvedFullHTML = reconstructFullImprovedHTML(originalFullHTML, pairs);
  
  // Render the full text diff
  renderFullTextDiff(originalFullHTML, improvedFullHTML);
}

// Render the diff pairs in the split view
// Render the full text diff in the split view
function renderFullTextDiff(originalHTML, improvedHTML) {
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
  leftHeader.textContent = 'Original';
  leftColumn.appendChild(leftHeader);

  const rightHeader = document.createElement('div');
  rightHeader.className = 'diff-header';
  rightHeader.textContent = 'Improved';
  rightColumn.appendChild(rightHeader);

  // Add content containers
  const leftContent = document.createElement('div');
  leftContent.className = 'diff-content';
  leftContent.innerHTML = `<div class="editable-area">${originalHTML}</div>`;
  leftColumn.appendChild(leftContent);

  const rightContent = document.createElement('div');
  rightContent.className = 'diff-content';
  rightContent.innerHTML = `<div class="editable-area">${improvedHTML}</div>`;
  rightColumn.appendChild(rightContent);

  // Add unique IDs and event listeners for hover-sync
  addHoverSync();

  console.log(`🎨 Rendered full text diff successfully`);
  
  // Clear the storage after successful rendering
  clearTaggedTextFromStorage();
}

function reconstructFullImprovedHTML(originalHTML, improvementPairs) {
  let improvedHTML = originalHTML;

  // Create a temporary DOM element to parse the original HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = improvedHTML;

  // Find all highlighted sentences in the temporary DOM
  const highlightedElements = tempDiv.querySelectorAll('.highlight-wrapper');

  highlightedElements.forEach(element => {
    const originalSentence = element.dataset.text;
    const pair = improvementPairs.find(p => p.original === originalSentence);

    if (pair) {
      // Create a new element for the improved sentence
      const improvedElement = document.createElement('span');
      improvedElement.textContent = pair.improved;
      improvedElement.className = 'highlight-wrapper'; // Keep the wrapper for styling
      improvedElement.dataset.text = pair.improved;

      // Replace the original element with the improved one
      element.parentNode.replaceChild(improvedElement, element);
    }
  });

  return tempDiv.innerHTML;
}

function addHoverSync() {
  const leftContent = document.querySelector('.split-left .diff-content');
  const rightContent = document.querySelector('.split-right .diff-content');

  const leftSentences = leftContent.querySelectorAll('.highlight-wrapper');
  const rightSentences = rightContent.querySelectorAll('.highlight-wrapper');

  // Assign unique IDs
  leftSentences.forEach((el, i) => {
    const id = `sentence-${i}`;
    el.dataset.syncId = id;
    if (rightSentences[i]) {
      rightSentences[i].dataset.syncId = id;
    }
  });

  // Add event listeners
  const allSentences = document.querySelectorAll('[data-sync-id]');
  allSentences.forEach(el => {
    el.addEventListener('mouseenter', () => {
      const id = el.dataset.syncId;
      const matchingElements = document.querySelectorAll(`[data-sync-id="${id}"]`);
      matchingElements.forEach(match => {
        match.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'; // Highlight color
      });
    });

    el.addEventListener('mouseleave', () => {
      const id = el.dataset.syncId;
      const matchingElements = document.querySelectorAll(`[data-sync-id="${id}"]`);
      matchingElements.forEach(match => {
        match.style.backgroundColor = ''; // Remove highlight
      });
    });
  });
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

function reconstructFullImprovedHTML(originalHTML, improvementPairs) {
  let improvedHTML = originalHTML;

  // Create a temporary DOM element to parse the original HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = improvedHTML;

  // Find all highlighted sentences in the temporary DOM
  const highlightedElements = tempDiv.querySelectorAll('.highlight-wrapper');

  highlightedElements.forEach(element => {
    const originalSentence = element.dataset.text;
    const pair = improvementPairs.find(p => p.original === originalSentence);

    if (pair) {
      // Create a new element for the improved sentence
      const improvedElement = document.createElement('span');
      improvedElement.textContent = pair.improved;
      improvedElement.className = 'highlight-wrapper'; // Keep the wrapper for styling
      improvedElement.dataset.text = pair.improved;

      // Replace the original element with the improved one
      element.parentNode.replaceChild(improvedElement, element);
    }
  });

  return tempDiv.innerHTML;
}

function addHoverSync() {
  const rightContent = document.querySelector('.split-right .diff-content');
  const rightSentences = rightContent.querySelectorAll('.highlight-wrapper');

  // Assign unique IDs
  rightSentences.forEach((el, i) => {
    const id = `sentence-${i}`;
    el.dataset.syncId = id;
  });

  // Add event listeners
  const allSentences = rightContent.querySelectorAll('[data-sync-id]');
  allSentences.forEach(el => {
    el.addEventListener('mouseenter', () => {
      const id = el.dataset.syncId;
      const iframe = document.getElementById('original-side');
      iframe.contentWindow.postMessage({ type: 'hover', id }, '*');
      const matchingElements = rightContent.querySelectorAll(`[data-sync-id="${id}"]`);
      matchingElements.forEach(match => {
        match.style.backgroundColor = 'rgba(255, 255, 0, 0.3)'; // Highlight color
      });
    });

    el.addEventListener('mouseleave', () => {
      const id = el.dataset.syncId;
      const iframe = document.getElementById('original-side');
      iframe.contentWindow.postMessage({ type: 'unhover', id }, '*');
      const matchingElements = rightContent.querySelectorAll(`[data-sync-id="${id}"]`);
      matchingElements.forEach(match => {
        match.style.backgroundColor = ''; // Remove highlight
      });
    });
  });
}

// Generate line-by-line diff between original and improved text


function generateLineDiff(originalText, improvedText) {
  const originalSentences = originalText.match(/[^.!?]+[.!?]*/g) || [];
  const improvedSentences = improvedText.match(/[^.!?]+[.!?]*/g) || [];
  const diff = [];

  let i = 0;
  let j = 0;

  while (i < originalSentences.length || j < improvedSentences.length) {
    const originalSentence = originalSentences[i];
    const improvedSentence = improvedSentences[j];

    if (originalSentence === improvedSentence) {
      diff.push({ type: 'unchanged', original: originalSentence, improved: improvedSentence });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let k = j + 1; k < improvedSentences.length; k++) {
        if (originalSentences[i] === improvedSentences[k]) {
          for (let l = j; l < k; l++) {
            diff.push({ type: 'added', original: '', improved: improvedSentences[l] });
          }
          diff.push({ type: 'unchanged', original: originalSentences[i], improved: improvedSentences[k] });
          i++;
          j = k + 1;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        for (let k = i + 1; k < originalSentences.length; k++) {
          if (originalSentences[k] === improvedSentences[j]) {
            for (let l = i; l < k; l++) {
              diff.push({ type: 'removed', original: originalSentences[l], improved: '' });
            }
            diff.push({ type: 'unchanged', original: originalSentences[k], improved: improvedSentences[j] });
            j++;
            i = k + 1;
            foundMatch = true;
            break;
          }
        }
      }

      if (!foundMatch) {
        if (originalSentence !== undefined) {
          diff.push({ type: 'removed', original: originalSentence, improved: '' });
          i++;
        }
        if (improvedSentence !== undefined) {
          diff.push({ type: 'added', original: '', improved: improvedSentence });
          j++;
        }
      }
    }
  }

  return diff;
}

// Export functions for potential external use
window.FixMyMail = {
  sendToFixAPI,
  parseAndRenderDiffs,
  renderFullTextDiff,
  getTaggedTextFromStorage,
  extractTaggedSentences
};