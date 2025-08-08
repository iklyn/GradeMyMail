import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor/RichTextEditor';
import { HighlightOverlay } from '../components/HighlightOverlay/HighlightOverlay';
import { NavigationManager, type NavigationState } from '../utils/navigationUtils';
import { type EmailData } from '../utils/stateTransfer';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { StatePreservation } from '../utils/errorRecovery';
import { MinimalPulsePopup } from '../components/LoadingScreen/MinimalLoadingPopup';
// import { apiService } from '../services/api'; // Temporarily disabled for UI testing

// Helper function to extract issues from tagged content
const extractIssuesFromTaggedContent = (content: string) => {
  const issues: Record<string, number> = {};
  const issueTypes = ['fluff', 'spam_words', 'hard_to_read'];
  
  issueTypes.forEach(type => {
    const regex = new RegExp(`<${type}>(.*?)</${type}>`, 'g');
    const matches = [...content.matchAll(regex)];
    if (matches.length > 0) {
      issues[type] = matches.length;
    }
  });
  
  return issues;
};

// Component to display analysis results summary - Minimal version
const AnalysisResultsSummary: React.FC<{ taggedContent: string }> = ({ taggedContent }) => {
  const issueTypes = {
    fluff: { label: 'Clarity', color: 'text-red-600' },
    spam_words: { label: 'Engagement', color: 'text-yellow-600' },
    hard_to_read: { label: 'Tone', color: 'text-green-600' },
  };

  const extractIssues = (content: string) => {
    const issues: Array<{ type: keyof typeof issueTypes; count: number }> = [];
    
    Object.keys(issueTypes).forEach(type => {
      const regex = new RegExp(`<${type}>(.*?)</${type}>`, 'g');
      const matches = [...content.matchAll(regex)];
      
      if (matches.length > 0) {
        issues.push({
          type: type as keyof typeof issueTypes,
          count: matches.length
        });
      }
    });
    
    return issues;
  };

  const issues = extractIssues(taggedContent);

  if (issues.length === 0) {
    return (
      <div className="text-center text-gray-500 text-sm">
        No issues found
      </div>
    );
  }

  return (
    <div className="text-center space-y-2">
      {issues.map(issue => (
        <div key={issue.type} className={`${issueTypes[issue.type].color} text-sm`}>
          {issue.count} {issueTypes[issue.type].label.toLowerCase()} {issue.count === 1 ? 'issue' : 'issues'}
        </div>
      ))}
    </div>
  );
};

const GradeMyMail: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isLoading: false,
    error: null,
    progress: 0,
  });
  
  // Ref for the editor container to enable highlighting
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced error handling
  const { handleAsyncError, enableFallbackMode } = useErrorHandler();

  // Check for recovery data on mount
  useEffect(() => {
    const recovery = StatePreservation.restoreState();
    if (recovery.success && recovery.data) {
      try {
        if (recovery.data.emailContent) {
          setContent(recovery.data.emailContent.originalText || '');
          setHtmlContent(recovery.data.emailContent.originalHTML || '');
        }
        
        console.log(`State recovered from: ${recovery.reason}`);
        StatePreservation.clearRecoveryData();
      } catch (error) {
        console.error('Failed to restore state:', error);
        StatePreservation.clearRecoveryData();
      }
    }
  }, []);

  // Manual analysis function
  const handleAnalyzeClick = useCallback(async () => {
    if (!content || content.trim().length < 10) {
      return;
    }

    setIsAnalyzing(true);
    try {
      // Simulate API call with delay to show loading animation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock response for demonstration
      const mockResponse = {
        message: {
          content: `<fluff>I hope this email finds you well</fluff> and <spam_words>amazing opportunity</spam_words> for <hard_to_read>synergistic solutions</hard_to_read>.`
        }
      };
      
      setAnalysisResult(mockResponse);
      setHasContentChanged(false); // Reset the changed flag after analysis
    } catch (error) {
      handleAsyncError(
        error instanceof Error ? error : new Error('Analysis failed'),
        { 
          operation: 'manual-analysis',
          contentLength: content.length 
        },
        async () => {
          await handleAnalyzeClick();
        },
        () => {
          enableFallbackMode(true);
        }
      );
    } finally {
      setIsAnalyzing(false);
    }
  }, [content, htmlContent, handleAsyncError, enableFallbackMode]);

  const handleContentChange = useCallback((newContent: string, newHtmlContent: string) => {
    setContent(newContent);
    setHtmlContent(newHtmlContent);
    
    // Mark content as changed if there's an existing analysis
    if (analysisResult) {
      setHasContentChanged(true);
    }
  }, [analysisResult]);

  const handleSampleEmailClick = useCallback(() => {
    const sampleEmail = `Subject: Quarterly Sales Meeting

Hi team,

I hope this email finds you well. I wanted to reach out to you regarding our upcoming quarterly sales meeting that we need to schedule for next month.

As you probably already know, we really need to discuss our performance metrics and maybe talk about some strategies that might help us improve our numbers going forward.

I was thinking we could potentially meet sometime next week, but I'm not entirely sure about everyone's availability. Could you please let me know when you might be free?

Also, we should probably discuss the new product launch and how it's been performing in the market so far.

Looking forward to hearing from you soon.

Best regards,
John`;
    setContent(sampleEmail);
    setHtmlContent(sampleEmail);
  }, []);

  const handleFixMyMailClick = useCallback(async () => {
    if (!analysisResult?.message?.content) {
      return;
    }

    try {
      StatePreservation.preserveState('navigation-to-fixmymail', {
        fromPage: 'GradeMyMail',
        hasAnalysis: true
      });

      const emailData: Omit<EmailData, 'id' | 'timestamp'> = {
        originalText: content,
        originalHTML: htmlContent,
        taggedContent: analysisResult.message.content || '',
        metadata: {
          wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
          emailType: 'general',
        },
      };

      await NavigationManager.navigateToFixMyMail(
        navigate,
        emailData,
        setNavigationState
      );

    } catch (error) {
      handleAsyncError(
        error instanceof Error ? error : new Error('Navigation failed'),
        { 
          operation: 'navigate-to-fixmymail',
          hasContent: !!content,
          hasAnalysis: !!analysisResult
        },
        async () => {
          await handleFixMyMailClick();
        }
      );
    }
  }, [navigate, content, htmlContent, analysisResult, handleAsyncError]);

  return (
    <div className="min-h-screen bg-white">
      {/* Minimal Loading Popup */}
      <MinimalPulsePopup isVisible={isAnalyzing} message="Analyzing your email..." />

      {/* Minimal Header */}
      <header className="relative">
        <div className="text-center py-16">
          <h1 className="text-5xl font-light text-gray-900 tracking-tight">
            GradeMyMail
          </h1>
        </div>
      </header>

      {/* Main Content - Minimal Layout */}
      <main className="max-w-4xl mx-auto px-6 pb-16">
        {/* Editor Section - Clean and Spacious */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div 
            ref={editorContainerRef}
            className="relative p-8"
          >
            <RichTextEditor
              initialValue={content}
              onChange={handleContentChange}
              placeholder="type something"
              className=""
              enableAutoSave={false}
              enableSpellCheck={false}
              enableGrammarCheck={false}
              showValidation={false}
            />
            
            {/* Highlight Overlay - Only show when content hasn't changed */}
            {editorContainerRef.current && analysisResult?.message?.content && !hasContentChanged && (
              <HighlightOverlay
                taggedContent={analysisResult.message.content}
                textContent={content}
                containerRef={editorContainerRef}
                visible={!isAnalyzing}
                enableDebugMode={false}
                onHighlightClick={(range) => {
                  console.log('Highlight clicked:', range);
                }}
                onHighlightHover={(range) => {
                  if (range) {
                    console.log('Highlight hovered:', range);
                  }
                }}
                config={{
                  colors: {
                    fluff: {
                      background: 'rgba(255, 107, 107, 0.15)',
                      border: 'rgba(255, 107, 107, 0.3)',
                      opacity: 0.8,
                    },
                    spam_words: {
                      background: 'rgba(255, 217, 61, 0.15)',
                      border: 'rgba(255, 217, 61, 0.3)',
                      opacity: 0.8,
                    },
                    hard_to_read: {
                      background: 'rgba(107, 207, 127, 0.15)',
                      border: 'rgba(107, 207, 127, 0.3)',
                      opacity: 0.8,
                    },
                  },
                  animationDuration: 300,
                  animationDelay: 50,
                }}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center mt-8 space-y-4">
          {/* Analyze Button - Show when there's content AND (no analysis OR content has changed) */}
          {content && content.trim().length > 10 && (!analysisResult || hasContentChanged) && (
            <button
              onClick={handleAnalyzeClick}
              disabled={isAnalyzing}
              className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>
          )}

          {/* Improve Button - Only after analysis and content hasn't changed */}
          {analysisResult?.message?.content && !hasContentChanged && !navigationState.isLoading && (
            <button
              onClick={handleFixMyMailClick}
              disabled={isAnalyzing || navigationState.isLoading}
              className="bg-[#ff4500] hover:bg-[#e03e00] text-white px-8 py-3 rounded-lg font-medium transition-all duration-200 transform hover:scale-105"
            >
              Improve
            </button>
          )}
        </div>

        {/* Sample Button - Only when empty */}
        {!content && (
          <div className="text-center mt-8">
            <button
              onClick={handleSampleEmailClick}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors duration-200"
            >
              Try sample
            </button>
          </div>
        )}

        {/* Analysis Results - Minimal Display - Only show when content hasn't changed */}
        {analysisResult?.message?.content && !hasContentChanged && !isAnalyzing && (
          <div className="mt-12">
            <AnalysisResultsSummary taggedContent={analysisResult.message.content} />
          </div>
        )}
      </main>
    </div>
  );
};

export default GradeMyMail;