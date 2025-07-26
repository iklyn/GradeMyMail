import React, { useRef, useState, useCallback } from 'react';
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor';
import { HighlightOverlay } from './HighlightOverlay';
import { HighlightLegend } from './HighlightLegend';
// import { SkeletonLoader, ProgressIndicator } from './LoadingStates';
// import { NotificationProvider, useNotifications } from './Notifications';
import { useHighlighting } from '../hooks/useHighlighting';
import type { HighlightRange } from '../types/highlighting';

const SAMPLE_CONTENT = `
<p>Hey there! I hope this email finds you well and in good spirits today.</p>

<p>I wanted to reach out to you regarding our AMAZING new product that will absolutely REVOLUTIONIZE your life! This incredible opportunity won't last long, so you need to ACT NOW before it's too late!</p>

<p>Our state-of-the-art, cutting-edge solution leverages synergistic methodologies to optimize your workflow paradigms through innovative disruption of traditional processes, thereby facilitating enhanced productivity metrics across all organizational touchpoints.</p>

<p>Don't miss out on this once-in-a-lifetime chance to transform your business! Click here NOW to get started with our FREE trial (limited time only)!</p>

<p>Best regards,<br>The Team</p>
`;

export const HighlightingDemo: React.FC = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [selectedRange, setSelectedRange] = useState<HighlightRange | null>(null);
  const [hoveredRange, setHoveredRange] = useState<HighlightRange | null>(null);
  const [enableDebugMode, setEnableDebugMode] = useState(false);

  // Initialize highlighting system
  const {
    ranges,
    taggedContent: _taggedContent,
    isAnalyzing,
    updateContent,
    clearHighlights,
    toggleLegend,
    showLegend,
    analysisState,
    error,
    stats,
  } = useHighlighting({
    enableAutoHighlighting: true,
    debounceMs: 1000,
    enableDebugMode,
    onHighlightClick: setSelectedRange,
    onHighlightHover: setHoveredRange,
  });

  // Handle editor content changes
  const handleEditorChange = useCallback((html: string, text: string) => {
    updateContent(html, text);
  }, [updateContent]);

  // Handle highlight interactions
  const handleHighlightClick = useCallback((range: HighlightRange) => {
    setSelectedRange(range);
    console.log('Highlight clicked:', range);
  }, []);

  const handleHighlightHover = useCallback((range: HighlightRange | null) => {
    setHoveredRange(range);
  }, []);

  // Load sample content
  const loadSampleContent = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.setContent(SAMPLE_CONTENT);
    }
  }, []);

  // Clear all content
  const clearContent = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.clear();
    }
    clearHighlights();
  }, [clearHighlights]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          High-Performance Highlighting System
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Canvas-based highlighting with 60fps animations and GPU acceleration
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={loadSampleContent}
          className="
            px-4 py-2 bg-blue-600 text-white rounded-lg
            hover:bg-blue-700 transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          "
        >
          Load Sample Content
        </button>
        
        <button
          onClick={clearContent}
          className="
            px-4 py-2 bg-gray-600 text-white rounded-lg
            hover:bg-gray-700 transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
          "
        >
          Clear Content
        </button>
        
        <button
          onClick={toggleLegend}
          className="
            px-4 py-2 bg-green-600 text-white rounded-lg
            hover:bg-green-700 transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
          "
        >
          {showLegend ? 'Hide' : 'Show'} Legend
        </button>
        
        <button
          onClick={() => setEnableDebugMode(!enableDebugMode)}
          className={`
            px-4 py-2 rounded-lg transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2
            ${enableDebugMode 
              ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-500 text-gray-700'
            }
          `}
        >
          Debug Mode
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats.totalHighlights}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Highlights</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {stats.highlightsByType.fluff || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Fluff</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.highlightsByType.spam_words || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Spam Words</div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.highlightsByType.hard_to_read || 0}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Hard to Read</div>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-center space-x-4">
        {isAnalyzing && (
          <div className="flex items-center space-x-2 text-blue-600 dark:text-blue-400">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
            <span className="text-sm">Analyzing content...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Error: {error.message}</span>
          </div>
        )}
      </div>

      {/* Editor with highlighting */}
      <div className="relative">
        <div
          ref={containerRef}
          className="
            relative bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700 
            rounded-lg overflow-hidden
          "
        >
          <RichTextEditor
            ref={editorRef}
            placeholder="Type or paste your email content here to see real-time highlighting..."
            onChange={handleEditorChange}
            className="min-h-96"
            enableAutoSave={false}
            showValidation={false}
          />
          
          {/* Highlight overlay */}
          <HighlightOverlay
            ranges={ranges}
            containerRef={containerRef}
            visible={ranges.length > 0}
            onHighlightClick={handleHighlightClick}
            onHighlightHover={handleHighlightHover}
            enableDebugMode={enableDebugMode}
          />
        </div>
      </div>

      {/* Legend */}
      <HighlightLegend
        visible={showLegend}
        position="top-right"
        animated={true}
        onClose={() => toggleLegend()}
      />

      {/* Selected/Hovered highlight info */}
      {(selectedRange || hoveredRange) && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-2">
            {selectedRange ? 'Selected' : 'Hovered'} Highlight
          </h3>
          
          {(selectedRange || hoveredRange) && (
            <div className="space-y-2">
              <div>
                <span className="font-medium">Type:</span>{' '}
                <span className={`
                  px-2 py-1 rounded text-xs font-medium
                  ${(selectedRange || hoveredRange)?.type === 'fluff' ? 'bg-cyan-100 text-cyan-800' : ''}
                  ${(selectedRange || hoveredRange)?.type === 'spam_words' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${(selectedRange || hoveredRange)?.type === 'hard_to_read' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {(selectedRange || hoveredRange)?.type.replace('_', ' ')}
                </span>
              </div>
              
              <div>
                <span className="font-medium">Text:</span>{' '}
                <span className="italic">"{(selectedRange || hoveredRange)?.text}"</span>
              </div>
              
              <div>
                <span className="font-medium">Position:</span>{' '}
                {(selectedRange || hoveredRange)?.start} - {(selectedRange || hoveredRange)?.end}
              </div>
              
              <div>
                <span className="font-medium">Severity:</span>{' '}
                <span className={`
                  px-2 py-1 rounded text-xs font-medium
                  ${(selectedRange || hoveredRange)?.severity === 'low' ? 'bg-green-100 text-green-800' : ''}
                  ${(selectedRange || hoveredRange)?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                  ${(selectedRange || hoveredRange)?.severity === 'high' ? 'bg-red-100 text-red-800' : ''}
                `}>
                  {(selectedRange || hoveredRange)?.severity}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug info */}
      {enableDebugMode && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
          <h3 className="text-lg font-semibold mb-2 text-white">Debug Information</h3>
          <pre className="whitespace-pre-wrap">
            {JSON.stringify({
              analysisState: {
                isAnalyzing: analysisState.isAnalyzing,
                hasResult: !!analysisState.result,
                hasError: !!analysisState.error,
                lastAnalyzedAt: analysisState.lastAnalyzedAt,
              },
              highlighting: {
                rangesCount: ranges.length,
                showLegend,
                selectedRange: selectedRange?.id,
                hoveredRange: hoveredRange?.id,
              },
              stats,
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default HighlightingDemo;