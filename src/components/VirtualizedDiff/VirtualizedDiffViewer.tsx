import React, { useMemo, useState } from 'react';
import type { DiffViewerProps, DiffMapping, WordDiff } from '../../types/diff';
import './DiffViewer.css';

const VirtualizedDiffViewer: React.FC<DiffViewerProps> = ({
  originalContent,
  modifiedContent,
  gmmEditorData,
  height = 600,
  className = ''
}) => {
  const [copiedState, setCopiedState] = useState<'idle' | 'copying' | 'copied'>('idle');

  // Debug logging
  console.log('🔍 VirtualizedDiffViewer received:', {
    originalContentLength: originalContent.length,
    modifiedContentLength: modifiedContent.length,
    hasGMMeditorData: !!gmmEditorData,
    mappingsCount: gmmEditorData?.mappings?.length || 0
  });

  // Use GMMeditor mappings if available, otherwise fallback to the old parsing
  const improvedText = useMemo(() => {
    if (gmmEditorData?.mappings && gmmEditorData.mappings.length > 0) {
      // Use the rich GMMeditor data
      console.log('✅ Using GMMeditor mappings for improved text');
      return gmmEditorData.rewritten;
    }
    
    // Fallback to the modified content if no mappings
    console.log('⚠️ No GMMeditor mappings available, using modified content');
    return modifiedContent.replace(/<\/?[^>]+(>|$)/g, '').trim() || 'No improvements available';
  }, [gmmEditorData, modifiedContent]);

  // Copy improved content to clipboard with enhanced UX
  const handleCopyImproved = async () => {
    if (copiedState !== 'idle') return;
    
    setCopiedState('copying');
    
    try {
      await navigator.clipboard.writeText(improvedText);
      setCopiedState('copied');
      
      // Reset after 2 seconds
      setTimeout(() => setCopiedState('idle'), 2000);
    } catch (error) {
      console.error('Failed to copy improved content:', error);
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = improvedText;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopiedState('copied');
      setTimeout(() => setCopiedState('idle'), 2000);
    }
  };

  const getCopyButtonContent = () => {
    switch (copiedState) {
      case 'copying':
        return (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </>
        );
      case 'copied':
        return (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </>
        );
      default:
        return (
          <>
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </>
        );
    }
  };

  return (
    <div className={`premium-diff-viewer ${className}`}>
      {/* Premium Header */}
      <div className="premium-header">
        <div className="header-section original-header">
          <h2 className="section-title">Original</h2>
          <div className="section-subtitle">Your current content</div>
        </div>
        
        <div className="header-divider"></div>
        
        <div className="header-section improved-header">
          <div className="improved-title-section">
            <h2 className="section-title">Improved</h2>
            <div className="section-subtitle">
              {gmmEditorData?.mappings ? 
                `${gmmEditorData.mappings.filter(m => m.type === 'changed').length} improvements applied` : 
                'Enhanced version'
              }
            </div>
          </div>
          
          <button
            onClick={handleCopyImproved}
            disabled={copiedState !== 'idle'}
            className={`copy-button ${copiedState}`}
            title="Copy improved content to clipboard"
          >
            {getCopyButtonContent()}
          </button>
        </div>
      </div>

      {/* Premium Content Area */}
      <div className="premium-content" style={{ height: height - 80 }}>
        {/* Original Content */}
        <div className="content-pane original-pane">
          <div className="content-wrapper">
            <div className="premium-text original-text" style={{ whiteSpace: 'pre-wrap' }}>
              {originalContent}
            </div>
          </div>
        </div>

        {/* Content Divider */}
        <div className="content-divider"></div>

        {/* Improved Content */}
        <div className="content-pane improved-pane">
          <div className="content-wrapper">
            {gmmEditorData?.mappings && gmmEditorData.mappings.length > 0 ? (
              <PremiumImprovedContent 
                originalText={originalContent}
                mappings={gmmEditorData.mappings}
              />
            ) : (
              <div className="premium-text improved-text" style={{ whiteSpace: 'pre-wrap' }}>
                {improvedText}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Enhanced component for improved content with word-level highlighting
const PremiumImprovedContent: React.FC<{
  originalText: string;
  mappings: DiffMapping[];
}> = ({ originalText, mappings }) => {
  const renderedContent = useMemo(() => {
    return mappings.map((mapping, index) => {
      const animationDelay = index * 0.05; // Stagger animations
      
      switch (mapping.type) {
        case 'unchanged':
          return (
            <span 
              key={`unchanged-${index}`}
              className="diff-unchanged"
              style={{ animationDelay: `${animationDelay}s` }}
            >
              {mapping.new}
            </span>
          );
          
        case 'changed':
          return (
            <span 
              key={`changed-${index}`}
              className="diff-changed"
              style={{ animationDelay: `${animationDelay}s` }}
              title={`Changed: "${mapping.old}" → "${mapping.new}"`}
            >
              {mapping.wordDiff ? (
                <WordLevelDiff wordDiff={mapping.wordDiff} />
              ) : (
                mapping.new
              )}
            </span>
          );
          
        case 'inserted':
          return (
            <span 
              key={`inserted-${index}`}
              className="diff-inserted"
              style={{ animationDelay: `${animationDelay}s` }}
              title="New content added"
            >
              {mapping.new}
            </span>
          );
          
        case 'deleted':
          // Don't render deleted content in the improved view
          return null;
          
        default:
          return null;
      }
    }).filter(Boolean);
  }, [mappings]);

  return (
    <div className="premium-text improved-text enhanced-diff-content">
      {renderedContent}
    </div>
  );
};

// Component for rendering word-level differences
const WordLevelDiff: React.FC<{ wordDiff: WordDiff[] }> = ({ wordDiff }) => {
  return (
    <>
      {wordDiff.map((word, index) => {
        if (word.removed) {
          // Don't render removed words in the improved view
          return null;
        }
        
        if (word.added) {
          return (
            <span 
              key={`word-added-${index}`}
              className="word-added"
              title="New word"
            >
              {word.value}
            </span>
          );
        }
        
        return (
          <span 
            key={`word-unchanged-${index}`}
            className="word-unchanged"
          >
            {word.value}
          </span>
        );
      })}
    </>
  );
};

// Component for rendering original content with deletions highlighted
const PremiumOriginalContent: React.FC<{
  originalText: string;
  mappings: DiffMapping[];
}> = ({ originalText, mappings }) => {
  const renderedContent = useMemo(() => {
    return mappings.map((mapping, index) => {
      const animationDelay = index * 0.05;
      
      switch (mapping.type) {
        case 'unchanged':
          return (
            <span 
              key={`orig-unchanged-${index}`}
              className="diff-unchanged"
              style={{ animationDelay: `${animationDelay}s` }}
            >
              {mapping.old}
            </span>
          );
          
        case 'changed':
          return (
            <span 
              key={`orig-changed-${index}`}
              className="diff-original-changed"
              style={{ animationDelay: `${animationDelay}s` }}
              title={`Will be changed to: "${mapping.new}"`}
            >
              {mapping.wordDiff ? (
                <OriginalWordLevelDiff wordDiff={mapping.wordDiff} />
              ) : (
                mapping.old
              )}
            </span>
          );
          
        case 'deleted':
          return (
            <span 
              key={`orig-deleted-${index}`}
              className="diff-deleted"
              style={{ animationDelay: `${animationDelay}s` }}
              title="This content will be removed"
            >
              {mapping.old}
            </span>
          );
          
        case 'inserted':
          // Don't render inserted content in the original view
          return null;
          
        default:
          return null;
      }
    }).filter(Boolean);
  }, [mappings]);

  return (
    <div className="premium-text original-text enhanced-diff-content">
      {renderedContent}
    </div>
  );
};

// Component for rendering word-level differences in original content
const OriginalWordLevelDiff: React.FC<{ wordDiff: WordDiff[] }> = ({ wordDiff }) => {
  return (
    <>
      {wordDiff.map((word, index) => {
        if (word.added) {
          // Don't render added words in the original view
          return null;
        }
        
        if (word.removed) {
          return (
            <span 
              key={`orig-word-removed-${index}`}
              className="word-removed"
              title="This word will be removed"
            >
              {word.value}
            </span>
          );
        }
        
        return (
          <span 
            key={`orig-word-unchanged-${index}`}
            className="word-unchanged"
          >
            {word.value}
          </span>
        );
      })}
    </>
  );
};

export default VirtualizedDiffViewer;