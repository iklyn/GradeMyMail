import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor/RichTextEditor';
import { useRealTimeAnalysis } from '../hooks/useRealTimeAnalysis';
import { NavigationManager, NavigationState } from '../utils/navigationUtils';
import { EmailData } from '../utils/stateTransfer';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorDisplay, ErrorToast } from '../components/ErrorDisplay';
import { StatePreservation } from '../utils/errorRecovery';
import { useAppStore } from '../store';

const GradeMyMail: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isLoading: false,
    error: null,
    progress: 0,
  });

  // Enhanced error handling
  const { 
    handleAsyncError, 
    clearError, 
    errorState,
    checkSystemHealth,
    enableFallbackMode
  } = useErrorHandler();
  
  const { error: storeErrorState } = useAppStore();

  // Use the real-time analysis hook
  const { 
    analysisResult, 
    isAnalyzing, 
    error: analysisError,
    hasTaggedContent 
  } = useRealTimeAnalysis(content);

  // Check for recovery data on mount
  useEffect(() => {
    const recovery = StatePreservation.restoreState();
    if (recovery.success && recovery.data) {
      try {
        if (recovery.data.emailContent) {
          setContent(recovery.data.emailContent.originalText || '');
          setHtmlContent(recovery.data.emailContent.originalHTML || '');
        }
        
        // Show recovery notification
        console.log(`State recovered from: ${recovery.reason}`);
        StatePreservation.clearRecoveryData();
      } catch (error) {
        console.error('Failed to restore state:', error);
        StatePreservation.clearRecoveryData();
      }
    }
  }, []);

  // Handle analysis errors
  useEffect(() => {
    if (analysisError) {
      handleAsyncError(
        new Error(analysisError),
        { 
          operation: 'real-time-analysis',
          contentLength: content.length 
        },
        async () => {
          // Retry callback - this would trigger re-analysis
          console.log('Retrying analysis...');
        },
        () => {
          // Fallback callback - enable basic mode
          enableFallbackMode(true);
        }
      );
    }
  }, [analysisError, handleAsyncError, content.length, enableFallbackMode]);

  const handleContentChange = useCallback((newContent: string, newHtmlContent: string) => {
    setContent(newContent);
    setHtmlContent(newHtmlContent);
  }, []);

  const handleFixMyMailClick = useCallback(async () => {
    if (!hasTaggedContent || !analysisResult?.taggedContent) {
      return;
    }

    try {
      // Preserve state before navigation
      StatePreservation.preserveState('navigation-to-fixmymail', {
        fromPage: 'GradeMyMail',
        hasAnalysis: true
      });

      const emailData: Omit<EmailData, 'id' | 'timestamp'> = {
        originalText: content,
        originalHTML: htmlContent,
        taggedContent: analysisResult.taggedContent,
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
          // Retry navigation
          await handleFixMyMailClick();
        }
      );
    }
  }, [navigate, content, htmlContent, analysisResult, hasTaggedContent, handleAsyncError]);

  const isFromFixMyMail = location.state?.fromFixMyMail;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GradeMyMail</h1>
              <p className="text-sm text-gray-600 mt-1">
                Analyze your email content for issues and improvements
              </p>
            </div>
            
            {/* FixMyMail Button */}
            {hasTaggedContent && !navigationState.isLoading && (
              <button
                onClick={handleFixMyMailClick}
                disabled={isAnalyzing || navigationState.isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <span>FixMyMail</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Loading State */}
      {navigationState.isLoading && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700">
                Preparing data for FixMyMail... ({navigationState.progress}%)
              </span>
            </div>
            <div className="mt-2 w-full bg-blue-200 rounded-full h-1">
              <div 
                className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                style={{ width: `${navigationState.progress}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {storeErrorState.currentError && (
        <div className="max-w-4xl mx-auto px-6 py-4">
          <ErrorDisplay
            error={storeErrorState.currentError}
            onDismiss={clearError}
            onRetry={async (errorId) => {
              const error = storeErrorState.errors.find(e => e.id === errorId);
              if (error?.recoveryActions) {
                const retryAction = error.recoveryActions.find(a => a.id === 'retry');
                if (retryAction) {
                  await retryAction.action();
                }
              }
            }}
            compact={true}
          />
        </div>
      )}

      {/* Navigation Error */}
      {navigationState.error && (
        <div className="bg-red-50 border-b border-red-200">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-red-700">{navigationState.error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Mode Indicator */}
      {storeErrorState.fallbackMode && (
        <div className="bg-yellow-50 border-b border-yellow-200">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-yellow-700">
                Running in safe mode with limited functionality
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Welcome Back Message */}
      {isFromFixMyMail && (
        <div className="bg-green-50 border-b border-green-200">
          <div className="max-w-4xl mx-auto px-6 py-3">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-green-700">Welcome back! Ready to analyze another email?</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Content
              </label>
              <p className="text-xs text-gray-500 mb-4">
                Paste or type your email content below. The system will analyze it in real-time and highlight potential issues.
              </p>
            </div>

            {/* Rich Text Editor */}
            <RichTextEditor
              initialContent=""
              onChange={handleContentChange}
              placeholder="Start typing your email content here..."
              className="min-h-[400px]"
            />

            {/* Analysis Status */}
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                {isAnalyzing && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm">Analyzing...</span>
                  </div>
                )}
                
                {analysisError && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Analysis failed: {analysisError}</span>
                  </div>
                )}

                {hasTaggedContent && !isAnalyzing && (
                  <div className="flex items-center space-x-2 text-green-600">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm">Analysis complete - Issues found</span>
                  </div>
                )}
              </div>

              {/* Word Count */}
              <div className="text-sm text-gray-500">
                {content.split(/\s+/).filter(word => word.length > 0).length} words
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">How it works</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>1. <strong>Type or paste</strong> your email content in the editor above</p>
            <p>2. <strong>Watch for highlights</strong> as the system identifies potential issues in real-time</p>
            <p>3. <strong>Click "FixMyMail"</strong> when analysis is complete to get improved suggestions</p>
          </div>
        </div>
      </main>

      {/* Error Toasts */}
      {storeErrorState.errors.map((error) => (
        <ErrorToast
          key={error.id}
          error={error}
          onDismiss={clearError}
          onRetry={async (errorId) => {
            const errorToRetry = storeErrorState.errors.find(e => e.id === errorId);
            if (errorToRetry?.recoveryActions) {
              const retryAction = errorToRetry.recoveryActions.find(a => a.id === 'retry');
              if (retryAction) {
                await retryAction.action();
              }
            }
          }}
        />
      ))}
    </div>
  );
};

export default GradeMyMail;