import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { NavigationManager, NavigationState } from '../utils/navigationUtils';
import { EmailData } from '../utils/stateTransfer';
import VirtualizedDiffViewer from '../components/VirtualizedDiff/VirtualizedDiffViewer';
import { contentReconstruction } from '../utils/contentReconstruction';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorDisplay, ErrorToast } from '../components/ErrorDisplay';
import { StatePreservation } from '../utils/errorRecovery';
import { useAppStore } from '../store';
import { apiService } from '../services/api';

interface FixMyMailState {
  emailData: EmailData | null;
  improvedContent: string | null;
  isLoading: boolean;
  error: string | null;
  loadingProgress: number;
}

const FixMyMail: React.FC = () => {
  const { dataId } = useParams<{ dataId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [state, setState] = useState<FixMyMailState>({
    emailData: null,
    improvedContent: null,
    isLoading: true,
    error: null,
    loadingProgress: 0,
  });

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
    retryWithBackoff,
    enableFallbackMode
  } = useErrorHandler();
  
  const { error: storeErrorState } = useAppStore();

  // Enhanced data hydration and validation
  useEffect(() => {
    const loadEmailData = async () => {
      if (!dataId) {
        const error = new Error('No data ID provided. Please return to GradeMyMail and try again.');
        handleAsyncError(error, { 
          operation: 'load-email-data',
          missingDataId: true 
        });
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      try {
        setState(prev => ({ ...prev, loadingProgress: 10 }));

        // Load email data with progress tracking
        const emailData = await NavigationManager.loadEmailDataForFixMyMail(
          dataId,
          (navState) => {
            setState(prev => ({ 
              ...prev, 
              loadingProgress: Math.max(prev.loadingProgress, navState.progress * 0.6) 
            }));
          }
        );

        if (!emailData) {
          const error = new Error('Failed to load email data. The data may have expired or been corrupted.');
          handleAsyncError(error, { 
            operation: 'load-email-data',
            dataId,
            dataNotFound: true 
          });
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          return;
        }

        setState(prev => ({ ...prev, emailData, loadingProgress: 60 }));

        // Generate improved content
        await generateImprovedContent(emailData);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load email data';
        handleAsyncError(
          error instanceof Error ? error : new Error(errorMessage),
          { 
            operation: 'load-email-data',
            dataId 
          },
          async () => {
            // Retry loading data
            await loadEmailData();
          }
        );
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    };

    loadEmailData();
  }, [dataId, handleAsyncError]);

  const generateImprovedContent = async (emailData: EmailData) => {
    try {
      setState(prev => ({ ...prev, loadingProgress: 70 }));

      // Extract tagged sentences for improvement
      const taggedSentences = extractTaggedSentences(emailData.taggedContent);
      
      if (taggedSentences.length === 0) {
        const error = new Error('No issues found to improve. The email content appears to be already optimized.');
        handleAsyncError(error, { 
          operation: 'generate-improvements',
          noTaggedSentences: true,
          taggedContentLength: emailData.taggedContent.length
        });
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      setState(prev => ({ ...prev, loadingProgress: 80 }));

      // Call the fix API with enhanced error handling
      const result = await apiService.fixEmail(taggedSentences.join(' '));
      setState(prev => ({ ...prev, loadingProgress: 90 }));

      // Reconstruct the improved content
      const improvedContent = contentReconstruction(
        emailData.originalText,
        emailData.taggedContent,
        result.message.content
      );

      setState(prev => ({
        ...prev,
        improvedContent,
        isLoading: false,
        loadingProgress: 100,
      }));

    } catch (error) {
      const errorMessage = `Failed to generate improvements: ${error instanceof Error ? error.message : 'Unknown error'}`;
      handleAsyncError(
        error instanceof Error ? error : new Error(errorMessage),
        { 
          operation: 'generate-improvements',
          emailDataId: emailData.id,
          taggedContentLength: emailData.taggedContent.length
        },
        async () => {
          // Retry generating improvements
          await generateImprovedContent(emailData);
        },
        () => {
          // Fallback - show original content only
          setState(prev => ({
            ...prev,
            improvedContent: emailData.originalText,
            isLoading: false,
            loadingProgress: 100,
          }));
          enableFallbackMode(true);
        }
      );
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  };

  const extractTaggedSentences = (taggedContent: string): string[] => {
    const tagRegex = /<(fluff|spam_words|hard_to_read)>(.*?)<\/\1>/g;
    const sentences: string[] = [];
    let match;

    while ((match = tagRegex.exec(taggedContent)) !== null) {
      sentences.push(match[2].trim());
    }

    return sentences;
  };

  const handleBackToGradeMyMail = useCallback(async () => {
    try {
      // Preserve state before navigation
      StatePreservation.preserveState('navigation-to-grademymail', {
        fromPage: 'FixMyMail',
        hadImprovedContent: !!state.improvedContent
      });

      await NavigationManager.navigateToGradeMyMail(
        navigate,
        dataId,
        setNavigationState
      );
    } catch (error) {
      handleAsyncError(
        error instanceof Error ? error : new Error('Navigation failed'),
        { 
          operation: 'navigate-to-grademymail',
          dataId,
          fromFixMyMail: true
        },
        async () => {
          // Retry navigation
          await handleBackToGradeMyMail();
        }
      );
    }
  }, [navigate, dataId, state.improvedContent, handleAsyncError]);

  const handleCopyImprovedContent = useCallback(async () => {
    if (!state.improvedContent) return;

    try {
      await navigator.clipboard.writeText(state.improvedContent);
      console.log('Content copied to clipboard');
      // Could add a success toast notification here
    } catch (error) {
      handleAsyncError(
        error instanceof Error ? error : new Error('Failed to copy content'),
        { 
          operation: 'copy-content',
          contentLength: state.improvedContent.length,
          clipboardAPI: 'navigator.clipboard' in window
        },
        async () => {
          // Retry copy
          await handleCopyImprovedContent();
        },
        () => {
          // Fallback - create a text area and select
          try {
            const textArea = document.createElement('textarea');
            textArea.value = state.improvedContent || '';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            console.log('Content copied using fallback method');
          } catch (fallbackError) {
            console.error('Fallback copy also failed:', fallbackError);
          }
        }
      );
    }
  }, [state.improvedContent, handleAsyncError]);

  // Render loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">Loading FixMyMail</h2>
            <p className="text-sm text-gray-600 mb-4">
              Preparing your email improvements...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${state.loadingProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-2">{state.loadingProgress}% complete</p>
          </div>
        </div>
      </div>
    );
  }

  // Render error state with enhanced error display
  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-sm border p-8 max-w-lg w-full mx-4">
          {storeErrorState.currentError ? (
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
              className="mb-6"
            />
          ) : (
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Unable to Load FixMyMail</h2>
              <p className="text-sm text-gray-600 mb-6">{state.error}</p>
            </div>
          )}
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleBackToGradeMyMail}
              disabled={navigationState.isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
            >
              {navigationState.isLoading ? 'Loading...' : 'Back to GradeMyMail'}
            </button>
            
            {storeErrorState.fallbackMode && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-800">
                  Running in safe mode. Some features may be limited.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main FixMyMail interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBackToGradeMyMail}
                disabled={navigationState.isLoading}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 disabled:text-gray-400 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-sm font-medium">Back to GradeMyMail</span>
              </button>
              <div className="h-4 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">FixMyMail</h1>
                <p className="text-sm text-gray-600">Compare original and improved versions</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCopyImprovedContent}
                disabled={!state.improvedContent}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>Copy Improved</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Loading State */}
      {navigationState.isLoading && (
        <div className="bg-blue-50 border-b border-blue-200">
          <div className="max-w-7xl mx-auto px-6 py-3">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span className="text-sm text-blue-700">
                Returning to GradeMyMail... ({navigationState.progress}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {state.emailData && state.improvedContent && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <VirtualizedDiffViewer
              originalContent={state.emailData.originalText}
              improvedContent={state.improvedContent}
              className="h-[calc(100vh-200px)]"
            />
          </div>
        )}

        {/* Metadata */}
        {state.emailData && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Email Analysis Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Word Count:</span>
                <span className="ml-2 text-gray-600">{state.emailData.metadata?.wordCount || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Email Type:</span>
                <span className="ml-2 text-gray-600 capitalize">{state.emailData.metadata?.emailType || 'General'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Analyzed:</span>
                <span className="ml-2 text-gray-600">
                  {new Date(state.emailData.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Error Display */}
      {storeErrorState.currentError && (
        <div className="max-w-7xl mx-auto px-6 py-4">
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

export default FixMyMail;