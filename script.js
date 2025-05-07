let timeout = null;
console.log("✅ Script.js loaded properly.");

const inputArea = document.getElementById('inputArea');
const PLACEHOLDER_TEXT = "type something, what are you waiting for?";

// Track which sentences we've already highlighted to avoid duplicates
const highlightedSentences = new Set();

// Initialize overlay container on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeOverlayContainer();
});

// Re-initialize overlay container when window resizes
window.addEventListener('resize', () => {
  initializeOverlayContainer();
});

inputArea.addEventListener('input', () => {
  console.log('✍️ User typed or pasted something...');
  clearTimeout(timeout);
  
  // Clear all previous highlights when text changes
  clearAllHighlights();
  highlightedSentences.clear();
  
  // Hide FixMyMail button when editing
  const fixButton = document.getElementById('fixMyMailButton');
  if (fixButton) {
    fixButton.style.display = 'none';
  }
  
  timeout = setTimeout(sendMessage, 1000); 
});

function initializeOverlayContainer() {
  let overlayContainer = document.getElementById('highlight-overlay-container');
  if (overlayContainer) {
    document.body.removeChild(overlayContainer);
  }
  
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'highlight-overlay-container';
  overlayContainer.style.position = 'absolute';
  overlayContainer.style.top = inputArea.getBoundingClientRect().top + window.scrollY + 'px';
  overlayContainer.style.left = inputArea.getBoundingClientRect().left + window.scrollX + 'px';
  overlayContainer.style.width = inputArea.offsetWidth + 'px';
  overlayContainer.style.height = inputArea.offsetHeight + 'px';
  overlayContainer.style.pointerEvents = 'none';
  overlayContainer.style.zIndex = '0';
  document.body.appendChild(overlayContainer);
  
  console.log('✅ Overlay container initialized', overlayContainer);
}

function clearAllHighlights() {
  const container = document.getElementById('highlight-overlay-container');
  if (container) {
    container.innerHTML = '';
  }
}

async function sendMessage() {
  console.log('📤 Sending text to server...');
  const userInput = inputArea.innerText.trim();

  if (!userInput || userInput === PLACEHOLDER_TEXT) return;

  try {
    const response = await fetch('http://127.0.0.1:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userInput })
    });

    if (!response.ok) {
      console.error('❌ Server returned an error');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullChunk = "";
    
    // Store all identified sentences here as we receive them
    const allSentences = {
      easy: [],
      medium: [],
      hard: []
    };

    console.log('📦 Streaming started...');

    // For progressive highlighting
    let highlightQueue = [];
    let isHighlighting = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('✅ Streaming finished.');
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      fullChunk += chunk;

      console.log('📥 Received chunk:', chunk);

      // Parse any new sentences from the chunk
      const newSentences = parseNewSentences(fullChunk, allSentences);
      
      // Add any new sentences to our highlight queue
      if (newSentences.length > 0) {
        highlightQueue = highlightQueue.concat(newSentences);
        
        // Start the progressive highlighting if not already running
        if (!isHighlighting) {
          isHighlighting = true;
          processHighlightQueue(userInput, highlightQueue);
        }
      }
    }
  } catch (error) {
    console.error('❌ Error while streaming:', error);
  }
}

// Parse new sentences that haven't been processed yet
function parseNewSentences(fullChunk, allSentences) {
  const contentOnly = extractContent(fullChunk);
  if (!contentOnly) return [];
  
  const newSentences = [];
  const regex = /<(Fluff|Spam_words|Hard_to_read)>\s*(.*?)\s*<\/\1>/g;
  let match;

  while ((match = regex.exec(contentOnly)) !== null) {
    let typeKey;
    if (match[1] === 'Fluff') typeKey = 'easy';
    else if (match[1] === 'Spam_words') typeKey = 'medium';
    else if (match[1] === 'Hard_to_read') typeKey = 'hard';

    const sentence = match[2].trim();

    if (sentence && !isSentenceProcessed(sentence, allSentences)) {
      allSentences[typeKey].push(sentence);
      
      // Add to queue of sentences to highlight
      newSentences.push({
        type: typeKey, // FIXED: was using undefined 'type' variable
        sentence: sentence
      });
      
      console.log(`🎯 Found sentence to highlight (${typeKey}): "${sentence}"`);
    }
  }
  
  return newSentences;
}

// Check if we've already processed this sentence
function isSentenceProcessed(sentence, allSentences) {
  return allSentences.easy.includes(sentence) || 
         allSentences.medium.includes(sentence) || 
         allSentences.hard.includes(sentence);
}

// Process the queue of sentences to highlight progressively
async function processHighlightQueue(originalText, queue) {
  // Process sentences in the queue
  while (queue.length > 0) {
    const item = queue.shift();
    
    const sentenceKey = `${item.type}:${item.sentence}`;
    if (highlightedSentences.has(sentenceKey)) {
      continue;
    }
    
    highlightedSentences.add(sentenceKey);
    
    let highlightClass;
    if (item.type === 'easy') highlightClass = 'highlight-good';
    else if (item.type === 'medium') highlightClass = 'highlight-warning';
    else if (item.type === 'hard') highlightClass = 'highlight-danger';
    
    await highlightWithSmoothEffect(originalText, item.sentence, highlightClass);
    await sleep(200);
  }

  // ✅ After highlighting finishes
  if (queue.length === 0) {
    console.log('✅ Progressive highlighting completed');
    showFixMyMailButton(); 
    return true;
  }
}

// Sleep helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Highlight a sentence with a smooth effect without changing the text
async function highlightWithSmoothEffect(originalText, sentence, highlightClass) {
  const match = findSentenceMatch(originalText, sentence);
  if (!match || match.score < 0.5) {
    console.log(`❌ No good match found for: "${sentence}"`);
    return;
  }
  
  console.log(`Found match for "${sentence}" -> "${match.text}" (score: ${match.score})`);
  
  // Create a background highlight for the entire sentence at once
  // instead of line by line
  const sentenceElement = createSentenceHighlight(match.text, highlightClass);
  if (!sentenceElement) {
    console.log(`❌ Could not create highlight element for: "${match.text}"`);
    return;
  }
  
  // Animate the highlight with easing
  await animateHighlight(sentenceElement);
}

// Find exact text in DOM and create a single highlight for the whole sentence
function createSentenceHighlight(text, highlightClass) {
  // Get overlay container or create it
  let overlayContainer = document.getElementById('highlight-overlay-container');
  if (!overlayContainer) {
    initializeOverlayContainer();
    overlayContainer = document.getElementById('highlight-overlay-container');
  }
  
  // Find all instances of this text in the DOM
  const instances = findAllTextInstances(inputArea, text);
  if (!instances.length) {
    console.log(`❌ No instances found for text: "${text}"`);
    return null;
  }
  
  // Create highlights for all instances (usually just one)
  const elements = [];
  
  for (const range of instances) {
    // Get all client rects for this range - these are the line segments
    const rects = range.getClientRects();
    if (!rects.length) continue;
    
    // Create a single wrapper for all lines of this sentence
    const wrapper = document.createElement('div');
    wrapper.className = 'highlight-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '0'; // Position behind text
    overlayContainer.appendChild(wrapper);
    
    // For each line segment, create a highlight element
    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      
      const highlight = document.createElement('div');
      highlight.className = `highlight ${highlightClass}`;
      highlight.style.position = 'absolute';
      highlight.style.top = `${rect.top + window.scrollY - inputArea.getBoundingClientRect().top}px`;
      highlight.style.left = `${rect.left + window.scrollX - inputArea.getBoundingClientRect().left}px`;
      highlight.style.width = '0px'; // Start with width 0
      highlight.style.height = `${rect.height}px`;
      highlight.style.borderRadius = '2px';
      highlight.style.pointerEvents = 'none';
      highlight.style.opacity = '0.5'; // More transparent like Image 2
      highlight.style.zIndex = '0'; // Position behind text
      highlight.dataset.fullWidth = rect.width;
      
      wrapper.appendChild(highlight);
    }
    
    elements.push(wrapper);
  }
  
  return elements;
}

// Find all ranges that contain this text
function findAllTextInstances(container, text) {
  const ranges = [];
  const textNodes = Array.from(getTextNodes(container));
  
  for (const node of textNodes) {
    let nodeText = node.nodeValue;
    let startIndex = 0;
    let index;
    
    // Find all instances in this node
    while ((index = nodeText.indexOf(text, startIndex)) >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      ranges.push(range);
      startIndex = index + 1; // Look for next instance
    }
  }
  
  return ranges;
}

// Faster animation for highlighting
async function animateHighlight(wrappers) {
  if (!wrappers || !wrappers.length) return;
  
  // Much faster animation
  const duration = 600; // 600ms total duration
  const stepTime = 16; // ~60fps
  const steps = duration / stepTime;
  
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    
    // Update all wrappers
    for (const wrapper of wrappers) {
      const highlights = wrapper.querySelectorAll('.highlight');
      
      // Animate all highlight segments within this wrapper
      for (const highlight of highlights) {
        const fullWidth = parseFloat(highlight.dataset.fullWidth);
        highlight.style.width = `${fullWidth * progress}px`;
      }
    }
    
    await sleep(stepTime);
  }
  
  // Ensure we're at 100%
  for (const wrapper of wrappers) {
    const highlights = wrapper.querySelectorAll('.highlight');
    for (const highlight of highlights) {
      const fullWidth = parseFloat(highlight.dataset.fullWidth);
      highlight.style.width = `${fullWidth}px`;
    }
  }
}

function extractContent(fullChunk) {
  try {
    // First try to parse as JSON
    const json = JSON.parse(fullChunk);
    return json.choices?.[0]?.message?.content || null;
  } catch (err) {
    // If not JSON, just return the raw text
    console.log('Not JSON format, using raw text');
    return fullChunk;
  }
}

// Helper function to convert a sentence to a clean array of words
function getWords(text) {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"""]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 0);
}

// Find the best matching position in the original text
function findSentenceMatch(originalText, sentence) {
  // Get words from the sentence we're looking for
  const sentenceWords = getWords(sentence);
  
  // If sentence is too short, don't try to match
  if (sentenceWords.length < 2) return null;
  
  // Get paragraphs or sentences from original text
  const paragraphs = originalText.split(/(?:[.!?]\s+|\n+)/g);
  
  let bestMatch = null;
  let bestScore = 0;
  
  paragraphs.forEach(paragraph => {
    // Get words from this paragraph
    const paragraphWords = getWords(paragraph);
    
    // Calculate how many words match
    let matchCount = 0;
    sentenceWords.forEach(word => {
      if (word.length > 3 && paragraphWords.includes(word)) {
        matchCount++;
      }
    });
    
    // Calculate match score (percentage of words matching)
    const score = matchCount / sentenceWords.length;
    
    // If this is better than our previous best match
    if (score > bestScore && score > 0.5) { // At least 50% of words must match
      bestScore = score;
      bestMatch = {
        text: paragraph,
        score: score
      };
    }
  });
  
  return bestMatch;
}

// Helper function to get all text nodes in an element
function getTextNodes(element) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let node;
  while (node = walker.nextNode()) {
    textNodes.push(node);
  }
  
  return textNodes;
}

function cleanText(text) {
  return text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"""]/g, "") 
    .replace(/\s+/g, "") // Remove ALL spaces completely
    .toLowerCase()
    .trim();
}

// === Show FixMyMail button after highlighting completes ===
function showFixMyMailButton() {
  const fixButton = document.getElementById('fixMyMailButton');
  if (fixButton) {
    fixButton.style.display = 'flex'; // show button
    fixButton.onclick = function() {
      window.location.href = 'fix.html'; // redirect to FixMyMail page
    };
  }
}