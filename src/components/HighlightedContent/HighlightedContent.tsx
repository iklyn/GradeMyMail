import React from 'react';
import './HighlightedContent.css';
import { extractHighlights, applyHighlightsToHTML, processTaggedContent } from '../../utils/highlightMapper';

interface HighlightedContentProps {
  content: string;
  originalHTML?: string; // Original HTML content to preserve formatting
  className?: string;
}

// Apple-inspired highlight styles for all rule-based system tags
const highlightStyles = {
  // High priority issues (red)
  spam_words: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)', // SF Red with 12% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 59, 48, 0.2)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  grammar_spelling: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)', // SF Red with 12% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 59, 48, 0.2)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  claim_without_evidence: {
    backgroundColor: 'rgba(255, 59, 48, 0.12)', // SF Red with 12% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 59, 48, 0.2)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  // Medium priority issues (yellow)
  hard_to_read: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)', // SF Yellow with 10% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 204, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  fluff: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)', // SF Yellow with 10% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 204, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  hedging: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)', // SF Yellow with 10% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 204, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  vague_date: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)', // SF Yellow with 10% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 204, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  vague_number: {
    backgroundColor: 'rgba(255, 204, 0, 0.1)', // SF Yellow with 10% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 204, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  // Low priority issues (blue)
  emoji_excess: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)', // SF Blue with 8% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(0, 122, 255, 0.12)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  // Informational (blue)
  cta: {
    backgroundColor: 'rgba(0, 122, 255, 0.08)', // SF Blue with 8% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(0, 122, 255, 0.12)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
} as const;

// Tooltip content for each highlight type
const tooltipContent = {
  // High priority issues
  spam_words: 'Contains spam-like language that may trigger email filters',
  grammar_spelling: 'Grammar or spelling issue detected',
  claim_without_evidence: 'Strong claim without supporting evidence',
  // Medium priority issues
  hard_to_read: 'This sentence is complex and may be hard to read',
  fluff: 'Contains unnecessary filler words or phrases',
  hedging: 'Uncertain language weakens your message',
  vague_date: 'Vague time reference may confuse readers',
  vague_number: 'Number lacks context or units',
  // Low priority issues
  emoji_excess: 'Too many emojis may appear unprofessional',
  // Informational
  cta: 'Call-to-action detected',
} as const;

export const HighlightedContent: React.FC<HighlightedContentProps> = ({
  content,
  originalHTML,
  className = '',
}) => {
  console.log('🎨 HighlightedContent Debug:');
  console.log('📝 Tagged content:', content.substring(0, 200) + '...');
  console.log('🏷️ Original HTML:', originalHTML?.substring(0, 200) + '...');

  // CLEAN TAG APPROACH: Process highlight tags with whitespace protection
  const createHighlightedContent = (): string => {
    console.log('🎯 Processing highlight tags with whitespace protection');
    
    let result = content;
    
    // Process each tag type individually (one tag per sentence approach)
    const tagTypes = ['spam_words', 'grammar_spelling', 'claim_without_evidence', 'hard_to_read', 'fluff', 'hedging', 'vague_date', 'vague_number', 'emoji_excess', 'cta'];
    
    tagTypes.forEach(tagType => {
      const regex = new RegExp(`<${tagType}>(.*?)<\/${tagType}>`, 'gs');
      
      result = result.replace(regex, (match, taggedText) => {
        console.log(`🎯 Processing ${tagType}: "${taggedText.substring(0, 50)}..."`);
        
        // HARD RULE: Do not highlight if content is only whitespace or empty
        const textContent = taggedText.replace(/<[^>]*>/g, '').trim();
        if (!textContent || textContent.length === 0) {
          console.warn(`⚠️ Skipping ${tagType} - no text content found`);
          return taggedText; // Return original without highlighting
        }
        
        // HARD RULE: Do not highlight if content is only HTML tags
        if (textContent.length < 3) {
          console.warn(`⚠️ Skipping ${tagType} - content too short: "${textContent}"`);
          return taggedText; // Return original without highlighting
        }
        
        const highlightType = tagType as keyof typeof highlightStyles;
        const style = highlightStyles[highlightType];
        const tooltip = tooltipContent[highlightType];
        
        if (!style || !tooltip) {
          console.warn(`⚠️ Unknown highlight type: ${tagType}`);
          return taggedText;
        }
        
        const styleString = Object.entries(style)
          .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
          })
          .join('; ');
        
        // Create highlight span with proper styling
        return `<span class="highlight-span highlight-${tagType}" style="${styleString}" title="${tooltip}">${taggedText}</span>`;
      });
    });
    
    console.log('✅ Final processed HTML:', result.substring(0, 200) + '...');
    return result;
  };

  const processedHTML = createHighlightedContent();

  return (
    <div 
      className={`highlighted-content ${className}`}
      style={{
        lineHeight: '1.7',
        fontSize: '18px', // Match editor font size exactly
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: 'inherit', // Use inherited color from parent (will be white in dark mode)
        wordBreak: 'break-word',
        padding: '32px', // Match editor padding exactly
      }}
      dangerouslySetInnerHTML={{ __html: processedHTML }}
    />
  );
};

export default HighlightedContent;