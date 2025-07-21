import React, { useRef, useState, useCallback } from 'react';
import RichTextEditor, { type RichTextEditorRef } from './RichTextEditor';
import { HighlightOverlay } from './HighlightOverlay';
import { HighlightLegend } from './HighlightLegend';
import { SkeletonLoader, ProgressIndicator } from './LoadingStates';
import { NotificationProvider, useNotifications } from './Notifications';
import { useHighlighting } from '../hooks/useHighlighting';
import type { HighlightRange } from '../types/highlighting';

const SAMPLE_CONTENT = `
<p>Hey there! I hope this email finds you well and in good spirits today.</p>

<p>I wanted to reach out to you regarding our AMAZING new product that will absolutely REVOLUTIONIZE your life! This incredible opportunity won't last long, so you need to ACT NOW before it's too late!</p>

<p>Our state-of-the-art, cutting-edge solution leverages synergistic methodologies to optimize your workflow paradigms through innovative disruption of traditional processes, thereby facilitating enhanced productivity metrics across all organizational touchpoints.</p>

<p>Don't miss out on this once-in-a-lifetime chance to transform your business! Click here NOW to get started with our FREE trial (limited time only)!</p>

<p>Best regards,<br>The Team</p>
`;

const HighlightingDemoContent: React.FC = () => {
  const editorRef = useRef<RichTextEditorRef>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { addNotification } = useNotifications();
  
  const [selectedRange, setSelectedRange] = useState<HighlightRange | null>(null);
  const [hoveredRange, setHoveredRange] = useState<HighlightRange | null>(null);
  const [enableDebugMode, setEnableDebugMode] = useState(false);

  // Initialize highlighting system
  const {
    ranges,
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

  // Handle highlight interactions with notifications
  const handleHighlightClick = useCallback((range: HighlightRange) => {
    setSelectedRange(range);
    addNotification({
      type: 'info',
      title: 'Highlight Selected',
      message: `Selected ${range.type.replace('_', ' ')} highlight: "${range.text.substring(0, 50)}${range.text.length > 50 ? '...' : ''}"`,
      duration: 3000,
    });
  }, [addNotification]);

  const handleHighlightHover = useCallback((range: HighlightRange | null) => {
    setHoveredRange(range);
  }, []);

  // Load sample content with feedback
  const loadSampleContent = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.setContent(SAMPLE_CONTENT);
      addNotification({
        type: 'success',
        title: 'Sample Content Loaded',
        message: 'Email content loaded successfully. Analysis will begin automatically.',
        duration: 3000,
      });
    }
  }, [addNotification]);

  // Clear all content with feedback
  const clearContent = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.clear();
    }
    clearHighlights();
    setSelectedRange(null);
    setHoveredRange(null);
    addNotification({
      type: 'info',
      title: 'Content Cleared',
      message: 'All content and highlights have been cleared.',
      duration: 2000,
    });
  }, [clearHighlights, addNotification]);

  // Show error notifications
  React.useEffect(() => {
    if (error) {
      addNotification({
        type: 'error',
        title: 'Analysis Error',
        message: error.message,
        duration: 5000,
        action: {
          label: 'Retry',
          onClick: () => {
            if (editorRef.current) {
              const content = editorRef.current.getContent();
              updateContent(content.html, content.text);
            }
          },
        },
      });
    }
  }, [error, addNotification, updateContent]);

  // Calculate analysis progress
  const getAnalysisProgress = () => {
    if (!isAnalyzing) return 100;
    // Simulate progress based on time elapsed
    return Math.min(90, (Date.now() % 3000) / 3000 * 100);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Enhanced Highlighting System
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time email analysis with visual feedback and notifications
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={loadSampleContent}
          className="
            px-4 py-2 bg-blue-600 text-white rounded-lg
            hover:bg-blue-700 transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
            transform hover:scale-105 active:scale-95
          "
        >
          Load Sample Content
        </button>
        
        <button
          onClick={clearContent}
          className="
            px-4 py-2 bg-gray-600 text-white rounded-lg
            hover:bg-gray-700 transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2
            transform hover:scale-105 active:scale-95
          "
        >
          Clear Content
        </button>
        
        <button
          onClick={toggleLegend}
          className="
            px-4 py-2 bg-green-600 text-white rounded-lg
            hover:bg-green-700 transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2
            transform hover:scale-105 active:scale-95
          "
        >
          {showLegend ? 'Hide' : 'Show'} Legend
        </button>
        
        <button
          onClick={() => setEnableDebugMode(!enableDebugMode)}
          className={`
            px-4 py-2 rounded-lg transition-all duration-150
            focus:outline-none focus:ring-2 focus:ring-offset-2
            transform hover:scale-105 active:scale-95
            ${enableDebugMode 
              ? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500 text-white' 
              : 'bg-gray-200 hover:bg-gray-300 focus:ring-gray-500 text-gray-700'
            }
          `}
        >
          Debug Mode
        </button>
      </div>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <ProgressIndicator
            progress={getAnalysisProgress()}
            label="Analyzing content..."
            color="blue"
            showPercentage={true}
            animated={true}
          />
        </div>
      )}

      {/* Enhanced Stats with animations */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isAnalyzing ? (
          // Show skeleton loaders during analysis
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <SkeletonLoader variant="rectangular" height="2rem" className="mb-2" />
              <SkeletonLoader variant="text" width="60%" />
            </div>
          ))
        ) : (
          <>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 transition-all duration-500">
                {stats.totalHighlights}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Highlights</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400 transition-all duration-500">
                {stats.highlightsByType.fluff || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Fluff</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 transition-all duration-500">
                {stats.highlightsByType.spam_words || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Spam Words</div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:scale-105 hover:shadow-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 transition-all duration-500">
                {stats.highlightsByType.hard_to_read || 0}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Hard to Read</div>
            </div>
          </>
        )}
      </div>

      {/* Status with enhanced feedback */}
      <div className="flex items-center justify-center space-x-4">
        {isAnalyzing && (
          <div className="flex items-center space-x-3 text-blue-600 dark:text-blue-400">
            <ProgressIndicator
              progress={getAnalysisProgress()}
              variant="circular"
              size="sm"
              color="blue"
            />
            <span className="text-sm font-medium">Analyzing content...</span>
          </div>
        )}
        
        {error && (
          <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 animate-pulse">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Error: {error.message}</span>
          </div>
        )}

        {!isAnalyzing && !error && ranges.length > 0 && (
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">Analysis complete - {ranges.length} issues found</span>
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
            transition-all duration-300
            hover:shadow-lg
          "
        >
          {isAnalyzing && (
            <div className="absolute inset-0 bg-blue-50/50 dark:bg-blue-900/20 z-10 flex items-center justify-center">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
                <ProgressIndicator
                  progress={getAnalysisProgress()}
                  variant="dots"
                  color="blue"
                  label="Analyzing..."
                />
              </div>
            </div>
          )}
          
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
            visible={ranges.length > 0 && !isAnalyzing}
            onHighlightClick={handleHighlightClick}
            onHighlightHover={handleHighlightHover}
            enableDebugMode={enableDebugMode}
          />
        </div>
      </div>

      {/* Enhanced Legend */}
      <HighlightLegend
        visible={showLegend}
        position="top-right"
        animated={true}
        onClose={() => toggleLegend()}
      />

      {/* Enhanced Selected/Hovered highlight info */}
      {(selectedRange || hoveredRange) && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg transform transition-all duration-300 animate-in slide-in-from-bottom-2">
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <span className="text-2xl">
              {selectedRange ? '🎯' : '👁️'}
            </span>
            <span>
              {selectedRange ? 'Selected' : 'Hovered'} Highlight
            </span>
          </h3>
          
          {(selectedRange || hoveredRange) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Type:</span>
                  <div className="mt-1">
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-medium
                      ${(selectedRange || hoveredRange)?.type === 'fluff' ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200' : ''}
                      ${(selectedRange || hoveredRange)?.type === 'spam_words' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                      ${(selectedRange || hoveredRange)?.type === 'hard_to_read' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}
                    `}>
                      {(selectedRange || hoveredRange)?.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Severity:</span>
                  <div className="mt-1">
                    <span className={`
                      px-3 py-1 rounded-full text-sm font-medium
                      ${(selectedRange || hoveredRange)?.severity === 'low' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : ''}
                      ${(selectedRange || hoveredRange)?.severity === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' : ''}
                      ${(selectedRange || hoveredRange)?.severity === 'high' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' : ''}
                    `}>
                      {(selectedRange || hoveredRange)?.severity}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Text:</span>
                  <p className="mt-1 text-sm italic bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    "{(selectedRange || hoveredRange)?.text}"
                  </p>
                </div>
                
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Position:</span>
                  <p className="mt-1 text-sm font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded">
                    {(selectedRange || hoveredRange)?.start} - {(selectedRange || hoveredRange)?.end}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Debug info */}
      {enableDebugMode && (
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm animate-in slide-in-from-bottom-4">
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

export const HighlightingDemo: React.FC = () => {
  return (
    <NotificationProvider>
      <HighlightingDemoContent />
    </NotificationProvider>
  );
};

export default HighlightingDemo;