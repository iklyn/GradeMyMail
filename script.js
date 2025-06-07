let timeout = null;
console.log("âœ… Script.js loaded properly.");

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

// Handle paste events to strip formatting
inputArea.addEventListener('paste', (e) => {
  e.preventDefault(); // Prevent default paste behavior
  
  // Get plain text from clipboard
  const paste = (e.clipboardData || window.clipboardData).getData('text/plain');
  
  // Insert plain text at cursor position
  insertTextAtCursor(paste);
  
  console.log('ðŸ“‹ Pasted plain text (formatting stripped)');
  
  // Trigger the analysis after paste
  clearTimeout(timeout);
  clearAllHighlights();
  highlightedSentences.clear();
  
  const fixButton = document.getElementById('fixMyMailButton');
  if (fixButton) {
    fixButton.style.display = 'none';
  }
  
  timeout = setTimeout(sendMessage, 1000);
});

// Function to insert text at cursor position
function insertTextAtCursor(text) {
  const selection = window.getSelection();
  
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    // Create a text node with the plain text
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    
    // Move cursor to end of inserted text
    range.setStartAfter(textNode);
    range.setEndAfter(textNode);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    // If no selection, append to end
    inputArea.appendChild(document.createTextNode(text));
  }
}

// Handle keyboard input to also strip formatting
inputArea.addEventListener('input', (e) => {
  console.log('âœï¸ User typed or pasted something...');
  
  // Strip any HTML tags that might have been inserted
  const currentText = inputArea.innerText;
  if (inputArea.innerHTML !== currentText) {
    inputArea.textContent = currentText;
    // Move cursor to end
    moveCursorToEnd();
  }
  
  clearTimeout(timeout);
  clearAllHighlights();
  highlightedSentences.clear();

  const fixButton = document.getElementById('fixMyMailButton');
  if (fixButton) {
    fixButton.style.display = 'none';
  }

  timeout = setTimeout(sendMessage, 1000);
});

// Function to move cursor to end
function moveCursorToEnd() {
  const range = document.createRange();
  const selection = window.getSelection();
  range.selectNodeContents(inputArea);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function initializeOverlayContainer() {
  let overlayContainer = document.getElementById('highlight-overlay-container');
  if (overlayContainer) {
    overlayContainer.remove();
  }

  overlayContainer = document.createElement('div');
  overlayContainer.id = 'highlight-overlay-container';
  overlayContainer.style.position = 'absolute';
  overlayContainer.style.top = '0';
  overlayContainer.style.left = '0';
  overlayContainer.style.width = '100%';
  overlayContainer.style.height = '100%';
  overlayContainer.style.pointerEvents = 'none';
  overlayContainer.style.zIndex = '0';
  
  // Insert the overlay container as the first child of inputArea
  inputArea.insertBefore(overlayContainer, inputArea.firstChild);

  console.log('âœ… Overlay container initialized', overlayContainer);
}

function clearAllHighlights() {
  const container = document.getElementById('highlight-overlay-container');
  if (container) {
    container.innerHTML = '';
  }
}

let lastTaggedAIResponse = '';

async function sendMessage() {
  console.log('ðŸ“¤ Sending text to server...');
  const userInput = inputArea.innerText.trim();

  if (!userInput || userInput === PLACEHOLDER_TEXT) return;

  try {
    const response = await fetch('http://127.0.0.1:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userInput })
    });

    if (!response.ok) {
      console.error('âŒ Server returned an error');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    console.log('ðŸ“¦ Streaming started...');

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('✅ Streaming finished.');
        break;
      }
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      console.log('📥 Received chunk:', chunk);
    }
    lastTaggedAIResponse = fullText; // <-- Save the tagged AI response

    const allSentences = { easy: [], medium: [], hard: [] };
    const newSentences = parseTaggedSentences(fullText, allSentences);

    if (newSentences.length > 0) {
      let highlightQueue = newSentences;
      let isHighlighting = false;

      if (!isHighlighting) {
        isHighlighting = true;
        processHighlightQueue(userInput, highlightQueue);
      }
    }
  } catch (error) {
    console.error('âŒ Error while streaming:', error);
  }
}

function parseTaggedSentences(rawText, allSentences) {
  const newSentences = [];
  const regex = /<(fluff|spam_words|hard_to_read)>\s*(.*?)\s*<\/\1>/gi;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const tag = match[1].toLowerCase();
    const sentence = match[2].trim();

    let typeKey;
    if (tag === 'fluff') typeKey = 'easy';
    else if (tag === 'spam_words') typeKey = 'medium';
    else if (tag === 'hard_to_read') typeKey = 'hard';

    if (sentence && !isSentenceProcessed(sentence, allSentences)) {
      allSentences[typeKey].push(sentence);
      newSentences.push({ type: typeKey, sentence: sentence });
      console.log(`ðŸŽ¯ Parsed <${tag}> sentence: "${sentence}"`);
    }
  }

  return newSentences;
}

function isSentenceProcessed(sentence, allSentences) {
  return allSentences.easy.includes(sentence) ||
         allSentences.medium.includes(sentence) ||
         allSentences.hard.includes(sentence);
}

async function processHighlightQueue(originalText, queue) {
  while (queue.length > 0) {
    const item = queue.shift();
    const sentenceKey = `${item.type}:${item.sentence}`;
    if (highlightedSentences.has(sentenceKey)) continue;

    highlightedSentences.add(sentenceKey);

    let highlightClass;
    if (item.type === 'easy') highlightClass = 'highlight-good';
    else if (item.type === 'medium') highlightClass = 'highlight-warning';
    else if (item.type === 'hard') highlightClass = 'highlight-danger';

    await highlightWithSmoothEffect(originalText, item.sentence, highlightClass);
    showLegendIfHidden();
    await sleep(200);
  }

  console.log('âœ… Progressive highlighting completed');
  showFixMyMailButton();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function highlightWithSmoothEffect(originalText, sentence, highlightClass) {
  const match = findSentenceMatch(originalText, sentence);
  if (!match || match.score < 0.5) {
    console.log(`âŒ No good match found for: "${sentence}"`);
    return;
  }

  console.log(`Found match for "${sentence}" -> "${match.text}" (score: ${match.score})`);
  const sentenceElement = createSentenceHighlight(match.text, highlightClass);
  if (!sentenceElement) {
    console.log(`âŒ Could not create highlight element for: "${match.text}"`);
    return;
  }

  await animateHighlight(sentenceElement);
}

function createSentenceHighlight(text, highlightClass) {
  let overlayContainer = document.getElementById('highlight-overlay-container');
  if (!overlayContainer) {
    initializeOverlayContainer();
    overlayContainer = document.getElementById('highlight-overlay-container');
  }

  const instances = findAllTextInstances(inputArea, text);
  if (!instances.length) {
    console.log(`âŒ No instances found for text: "${text}"`);
    return null;
  }

  const elements = [];
  for (const range of instances) {
    const rects = range.getClientRects();
    if (!rects.length) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'highlight-wrapper';
    wrapper.style.position = 'absolute';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '0';
    wrapper.dataset.text = text;
    overlayContainer.appendChild(wrapper);

    for (let i = 0; i < rects.length; i++) {
      const rect = rects[i];
      
      // Calculate position relative to inputArea, not viewport
      const inputRect = inputArea.getBoundingClientRect();
      const relativeTop = rect.top - inputRect.top + inputArea.scrollTop;
      const relativeLeft = rect.left - inputRect.left + inputArea.scrollLeft;
      
      const highlight = document.createElement('div');
      highlight.className = `highlight ${highlightClass}`;
      highlight.style.position = 'absolute';
      highlight.style.top = `${relativeTop}px`;
      highlight.style.left = `${relativeLeft}px`;
      highlight.style.width = '0px';
      highlight.style.height = `${rect.height}px`;
      highlight.style.borderRadius = '2px';
      highlight.style.pointerEvents = 'none';
      highlight.style.zIndex = '0';
      highlight.dataset.fullWidth = rect.width;

      wrapper.appendChild(highlight);
    }

    elements.push(wrapper);
  }

  return elements;
}

function findAllTextInstances(container, text) {
  const ranges = [];
  const textNodes = Array.from(getTextNodes(container));

  for (const node of textNodes) {
    let nodeText = node.nodeValue;
    let startIndex = 0;
    let index;

    while ((index = nodeText.indexOf(text, startIndex)) >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + text.length);
      ranges.push(range);
      startIndex = index + 1;
    }
  }

  return ranges;
}

async function animateHighlight(wrappers) {
  if (!wrappers || !wrappers.length) return;

  const duration = 600;
  const stepTime = 16;
  const steps = duration / stepTime;

  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    for (const wrapper of wrappers) {
      const highlights = wrapper.querySelectorAll('.highlight');
      for (const highlight of highlights) {
        const fullWidth = parseFloat(highlight.dataset.fullWidth);
        highlight.style.width = `${fullWidth * progress}px`;
      }
    }
    await sleep(stepTime);
  }

  for (const wrapper of wrappers) {
    const highlights = wrapper.querySelectorAll('.highlight');
    for (const highlight of highlights) {
      const fullWidth = parseFloat(highlight.dataset.fullWidth);
      highlight.style.width = `${fullWidth}px`;
    }
  }
}

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

function findSentenceMatch(originalText, sentence) {
  const sentenceWords = getWords(sentence);
  if (sentenceWords.length < 2) return null;

  const paragraphs = originalText.split(/(?:[.!?]\s+|\n+)/g);
  let bestMatch = null;
  let bestScore = 0;

  paragraphs.forEach(paragraph => {
    const paragraphWords = getWords(paragraph);
    let matchCount = 0;
    sentenceWords.forEach(word => {
      if (word.length > 3 && paragraphWords.includes(word)) {
        matchCount++;
      }
    });

    const score = matchCount / sentenceWords.length;
    if (score > bestScore && score > 0.5) {
      bestScore = score;
      bestMatch = {
        text: paragraph,
        score: score
      };
    }
  });

  return bestMatch;
}

// Extract only the tagged sentences from AI response for FixMyMail
function extractTaggedContentOnly(rawText) {
  const taggedLines = [];
  const regex = /<(fluff|spam_words|hard_to_read)>\s*(.*?)\s*<\/\1>/gi;
  let match;

  while ((match = regex.exec(rawText)) !== null) {
    const tag = match[1].toLowerCase();
    const sentence = match[2].trim();
    
    if (sentence) {
      // Reconstruct the full tagged line
      taggedLines.push(`<${tag}>${sentence}</${tag}>`);
      console.log(`📌 Extracted tagged line: <${tag}>${sentence}</${tag}>`);
    }
  }

  return taggedLines.join('\n\n');
}

function getWords(text) {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"\[\]]/g, "")
    .split(/\s+/)
    .filter(word => word.length > 0);
}
function showFixMyMailButton() {
  const fixButton = document.getElementById('fixMyMailButton');
  if (fixButton) {
    fixButton.style.display = 'flex';
    fixButton.onclick = function () {
      // Extract ONLY the tagged sentences from the AI response
      const taggedContentOnly = extractTaggedContentOnly(lastTaggedAIResponse);
      
      if (!taggedContentOnly.trim()) {
        console.error('❌ No tagged content found to save');
        alert('No tagged content found. Please try analyzing your text again.');
        return;
      }
      
      try {
        localStorage.setItem('taggedText', taggedContentOnly);
        console.log('💾 Saved ONLY tagged content to localStorage:', taggedContentOnly);
      } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
        // Fallback to sessionStorage
        try {
          sessionStorage.setItem('taggedText', taggedContentOnly);
          console.log('💾 Saved ONLY tagged content to sessionStorage as fallback');
        } catch (fallbackError) {
          console.error('❌ Error saving to sessionStorage:', fallbackError);
          alert('Error saving data. Please try again.');
          return;
        }
      }
      
      window.location.href = 'fix.html';
    };
  }
}

function showLegendIfHidden() {
  const legend = document.getElementById('legend');
  if (legend && !legend.classList.contains('visible')) {
    legend.classList.add('visible');
  }
}