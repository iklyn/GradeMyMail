import DOMPurify from 'dompurify';

// Configuration for DOMPurify to allow rich text formatting while preventing XSS
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img',
    'div', 'span'
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'alt', 'src', 'width', 'height',
    'class', 'id', 'style',
    'target', 'rel'
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
  FORBID_SCRIPT: true,
  FORBID_TAGS: ['script', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
  SANITIZE_DOM: true,
  WHOLE_DOCUMENT: false,
  FORCE_BODY: false
};

// Strict configuration for paste content (more restrictive)
const PASTE_SANITIZE_CONFIG = {
  ...SANITIZE_CONFIG,
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'a'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  // Remove potentially dangerous styling
  FORBID_ATTR: [
    ...SANITIZE_CONFIG.FORBID_ATTR,
    'style', 'class', 'id'
  ]
};

/**
 * Sanitizes HTML content to prevent XSS attacks while preserving formatting
 */
export function sanitizeHTML(html: string, strict = false): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const config = strict ? PASTE_SANITIZE_CONFIG : SANITIZE_CONFIG;
  return DOMPurify.sanitize(html, config);
}

/**
 * Sanitizes content specifically for paste operations
 * More restrictive to prevent malicious content from external sources
 */
export function sanitizePastedContent(html: string): string {
  return sanitizeHTML(html, true);
}

/**
 * Validates content length and structure
 */
export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    characterCount: number;
    wordCount: number;
    htmlSize: number;
  };
}

export const CONTENT_LIMITS = {
  MAX_CHARACTERS: 50000, // 50k characters
  MAX_WORDS: 10000, // 10k words
  MAX_HTML_SIZE: 100000, // 100kb HTML
  WARN_CHARACTERS: 40000, // Warning at 40k characters
  WARN_WORDS: 8000, // Warning at 8k words
  WARN_HTML_SIZE: 80000 // Warning at 80kb HTML
};

/**
 * Validates content against length and security constraints
 */
export function validateContent(html: string, plainText: string): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Calculate stats
  const characterCount = plainText.length;
  const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
  const htmlSize = new Blob([html]).size;
  
  // Check hard limits
  if (characterCount > CONTENT_LIMITS.MAX_CHARACTERS) {
    errors.push(`Content exceeds maximum character limit (${CONTENT_LIMITS.MAX_CHARACTERS.toLocaleString()})`);
  }
  
  if (wordCount > CONTENT_LIMITS.MAX_WORDS) {
    errors.push(`Content exceeds maximum word limit (${CONTENT_LIMITS.MAX_WORDS.toLocaleString()})`);
  }
  
  if (htmlSize > CONTENT_LIMITS.MAX_HTML_SIZE) {
    errors.push(`Content size exceeds maximum limit (${(CONTENT_LIMITS.MAX_HTML_SIZE / 1024).toFixed(0)}KB)`);
  }
  
  // Check warning thresholds
  if (characterCount > CONTENT_LIMITS.WARN_CHARACTERS && characterCount <= CONTENT_LIMITS.MAX_CHARACTERS) {
    warnings.push(`Content is approaching character limit (${characterCount.toLocaleString()}/${CONTENT_LIMITS.MAX_CHARACTERS.toLocaleString()})`);
  }
  
  if (wordCount > CONTENT_LIMITS.WARN_WORDS && wordCount <= CONTENT_LIMITS.MAX_WORDS) {
    warnings.push(`Content is approaching word limit (${wordCount.toLocaleString()}/${CONTENT_LIMITS.MAX_WORDS.toLocaleString()})`);
  }
  
  if (htmlSize > CONTENT_LIMITS.WARN_HTML_SIZE && htmlSize <= CONTENT_LIMITS.MAX_HTML_SIZE) {
    warnings.push(`Content size is approaching limit (${(htmlSize / 1024).toFixed(0)}KB/${(CONTENT_LIMITS.MAX_HTML_SIZE / 1024).toFixed(0)}KB)`);
  }
  
  // Basic security checks
  if (html.includes('<script') || html.includes('javascript:')) {
    errors.push('Content contains potentially dangerous scripts');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats: {
      characterCount,
      wordCount,
      htmlSize
    }
  };
}

/**
 * Extracts and cleans text from HTML while preserving basic structure
 */
export function extractCleanText(html: string): string {
  // Create a temporary DOM element to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = sanitizeHTML(html);
  
  // Get text content and normalize whitespace
  return tempDiv.textContent || tempDiv.innerText || '';
}

/**
 * Checks if content appears to be potentially malicious
 */
export function detectSuspiciousContent(html: string): string[] {
  const suspiciousPatterns = [
    /javascript:/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick, onload, etc.
    /<script/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /<form/gi,
    /expression\s*\(/gi, // CSS expressions
    /url\s*\(\s*javascript:/gi
  ];
  
  const detectedIssues: string[] = [];
  
  suspiciousPatterns.forEach((pattern, index) => {
    if (pattern.test(html)) {
      const issueNames = [
        'JavaScript URLs',
        'Data URLs with HTML',
        'VBScript URLs',
        'Event handlers',
        'Script tags',
        'Iframe tags',
        'Object tags',
        'Embed tags',
        'Form tags',
        'CSS expressions',
        'JavaScript in CSS URLs'
      ];
      detectedIssues.push(issueNames[index]);
    }
  });
  
  return detectedIssues;
}