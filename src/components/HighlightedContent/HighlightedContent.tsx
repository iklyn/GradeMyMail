import React from 'react';
import './HighlightedContent.css';
import { extractHighlights, applyHighlightsToHTML, processTaggedContent } from '../../utils/highlightMapper';

interface HighlightedContentProps {
  content: string;
  originalHTML?: string; // Original HTML content to preserve formatting
  className?: string;
}

// Apple-inspired highlight styles
const highlightStyles = {
  hard_to_read: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)', // SF Red with 8% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 59, 48, 0.12)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  fluff: {
    backgroundColor: 'rgba(0, 122, 255, 0.06)', // SF Blue with 6% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(0, 122, 255, 0.12)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
  spam_words: {
    backgroundColor: 'rgba(255, 149, 0, 0.08)', // SF Orange with 8% opacity
    borderRadius: '4px',
    padding: '2px 4px',
    margin: '0 1px',
    border: '1px solid rgba(255, 149, 0, 0.15)',
    transition: 'all 0.2s ease',
    display: 'inline',
    boxDecorationBreak: 'clone',
    WebkitBoxDecorationBreak: 'clone',
  },
} as const;

// Tooltip content for each highlight type
const tooltipContent = {
  hard_to_read: 'This sentence is hard to read (clarity issue)',
  fluff: 'This word adds unnecessary fluff (clarity issue)',
  spam_words: 'This word may seem spammy (engagement issue)',
} as const;

export const HighlightedContent: React.FC<HighlightedContentProps> = ({
  content,
  originalHTML,
  className = '',
}) => {
  console.log('🎨 HighlightedContent Debug:');
  console.log('📝 Tagged content:', content.substring(0, 200) + '...');
  console.log('🏷️ Original HTML:', originalHTML?.substring(0, 200) + '...');

  // SIMPLE APPROACH: Content is already properly tagged HTML
  const createHighlightedContent = (): string => {
    console.log('🎯 Processing tagged HTML content directly');
    
    // Simply replace highlight tags with styled spans
    let result = content;
    
    result = result.replace(
      /<(hard_to_read|fluff|spam_words)>(.*?)<\/\1>/gs,
      (match, tagType, taggedText) => {
        console.log(`🎯 Found highlight: ${tagType} -> "${taggedText.substring(0, 50)}..."`);
        
        const highlightType = tagType as keyof typeof highlightStyles;
        const style = highlightStyles[highlightType];
        const tooltip = tooltipContent[highlightType];
        
        const styleString = Object.entries(style)
          .map(([key, value]) => {
            const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
            return `${cssKey}: ${value}`;
          })
          .join('; ');
        
        return `<span class="highlight-span" style="${styleString}" title="${tooltip}">${taggedText}</span>`;
      }
    );
    
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