import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { NavigationManager, type NavigationState } from '../utils/navigationUtils';
import { type EmailData } from '../utils/stateTransfer';
import VirtualizedDiffViewer from '../components/VirtualizedDiff/VirtualizedDiffViewer';
import ToneSelector from '../components/ToneSelector/ToneSelector';
import { FixMyMailMetrics } from '../components/MetricsDisplay';
import type { NewsletterMetrics } from '../components/MetricsDisplay';

import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorDisplay } from '../components/ErrorDisplay';
import { StatePreservation } from '../utils/errorRecovery';
import { useAppStore } from '../store';
import { apiService } from '../services/api';
import { useLoading } from '../contexts/LoadingContext';

import Logo from '../components/ui/Logo';
import ThemeResponsiveLogo from '../components/ui/ThemeResponsiveLogo';
import { ThemeToggle } from '../components/ThemeToggle';
import type { ToneKey } from '../types/gmmeditor';
import './FixMyMail.css';

interface FixMyMailState {
  emailData: EmailData | null;
  improvedContent: string | null;
  gmmEditorData?: {
    rewritten: string;
    mappings: Array<{
      type: 'unchanged' | 'changed' | 'inserted' | 'deleted';
      old: string;
      new: string;
      wordDiff: Array<{
        added?: boolean;
        removed?: boolean;
        value: string;
      }> | null;
    }>;
    metadata?: any;
  } | null;
  originalMetrics: NewsletterMetrics | null;
  improvedMetrics: NewsletterMetrics | null; // Real analyzed metrics of improved content
  isAnalyzingImprovedContent: boolean;
  isLoading: boolean;
  error: string | null;
  loadingProgress: number;
  selectedTone: ToneKey;
  isRegenerating: boolean;
}

// Helper function to estimate original metrics from tagged content
const estimateOriginalMetrics = (emailData: EmailData): NewsletterMetrics => {
  const { originalText, taggedContent } = emailData;
  
  // Count words
  const wordCount = originalText.trim().split(/\s+/).filter(word => word.length > 0).length;
  const readingTime = Math.max(1, Math.round(wordCount / 200)); // 200 words per minute
  
  // Count issues in tagged content
  const fluffMatches = (taggedContent.match(/<fluff>/g) || []).length;
  const spamMatches = (taggedContent.match(/<spam_words>/g) || []).length;
  const readabilityMatches = (taggedContent.match(/<hard_to_read>/g) || []).length;
  
  // Estimate scores based on issue density (lower issues = higher scores)
  const totalSentences = Math.max(1, originalText.split(/[.!?]+/).filter(s => s.trim().length > 0).length);
  const fluffDensity = fluffMatches / totalSentences;
  const spamDensity = spamMatches / totalSentences;
  const readabilityDensity = readabilityMatches / totalSentences;
  
  // Calculate scores (0-100, where 100 is perfect)
  const clarity = Math.max(20, Math.round(100 - (readabilityDensity * 200))); // Penalize hard-to-read content
  const engagement = Math.max(20, Math.round(100 - (fluffDensity * 150))); // Penalize fluff
  const spamRisk = Math.min(80, Math.round(spamDensity * 300)); // Higher spam words = higher risk
  const tone = Math.max(30, Math.round(85 - (spamDensity * 100))); // Spam affects tone
  const audienceFit = Math.max(40, Math.round(80 - ((fluffDensity + readabilityDensity) * 100))); // General fit
  
  // Calculate overall grade
  const averageScore = Math.round((audienceFit + tone + clarity + engagement + (100 - spamRisk)) / 5);
  const overallGrade = averageScore >= 90 ? 'A' : averageScore >= 80 ? 'B' : averageScore >= 70 ? 'C' : averageScore >= 60 ? 'D' : 'F';
  
  return {
    overallGrade: overallGrade as 'A' | 'B' | 'C' | 'D' | 'F',
    audienceFit,
    tone,
    clarity,
    engagement,
    spamRisk,
    wordCount,
    readingTime,
    summary: [
      `${fluffMatches + spamMatches + readabilityMatches} issues detected`,
      `${wordCount} words, ${readingTime} min read`,
      'Analysis based on tagged content'
    ],
    improvements: []
  };
};

const FixMyMail: React.FC = () => {
  const { dataId } = useParams<{ dataId: string }>();
  const navigate = useNavigate();
  // const location = useLocation();
  
  // Ref to track if component is still mounted
  const isMountedRef = useRef(true);
  
  const [state, setState] = useState<FixMyMailState>({
    emailData: null,
    improvedContent: null,
    gmmEditorData: null,
    originalMetrics: null,
    improvedMetrics: null,
    isAnalyzingImprovedContent: false,
    isLoading: true,
    error: null,
    loadingProgress: 0,
    selectedTone: 'friendly',
    isRegenerating: false,
  });

  const [showAnalytics, setShowAnalytics] = useState(true);

  const [navigationState, setNavigationState] = useState<NavigationState>({
    isLoading: false,
    error: null,
    progress: 0,
  });

  // Enhanced error handling
  const { 
    handleAsyncError, 
    clearError, 
    // errorState,
    // retryWithBackoff,
    enableFallbackMode
  } = useErrorHandler();
  
  const { error: storeErrorState } = useAppStore();

  // Loading state management
  const { startLoading, updateProgress, stopLoading } = useLoading();

  // Enhanced data hydration and validation
  useEffect(() => {
    console.log('🚀 [DEBUG] FixMyMail useEffect triggered');
    console.log('📋 [DEBUG] DataId:', dataId);
    
    const loadEmailData = async () => {
      if (!dataId) {
        console.error('❌ [DEBUG] No dataId provided');
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

      console.log('🔄 [DEBUG] Starting email data load process...');
      try {
        setState(prev => ({ ...prev, loadingProgress: 10 }));

        console.log('📥 [DEBUG] Loading email data from NavigationManager...');
        // Load email data with progress tracking
        const emailData = await NavigationManager.loadEmailDataForFixMyMail(
          dataId,
          (navState) => {
            console.log('📊 [DEBUG] Navigation state update:', navState);
            setState(prev => ({ 
              ...prev, 
              loadingProgress: Math.max(prev.loadingProgress, navState.progress * 0.6) 
            }));
          }
        );

        console.log('📋 [DEBUG] Email data load result:', !!emailData);
        
        if (!emailData) {
          console.error('❌ [DEBUG] Email data not found for dataId:', dataId);
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

        console.log('✅ [DEBUG] Email data loaded successfully:', {
          dataId,
          originalTextLength: emailData.originalText.length,
          taggedContentLength: emailData.taggedContent.length,
          hasOriginalHTML: !!emailData.originalHTML,
          originalTextPreview: emailData.originalText.substring(0, 200) + '...',
          hasTagsInOriginal: /<(fluff|spam_words|hard_to_read)>/.test(emailData.originalText)
        });

        console.log('📝 [DEBUG] Setting email data in state...');
        // Use actual Grade My Mail metrics if available, otherwise estimate from tagged content
        const originalMetrics = emailData.gradeMyMailMetrics || estimateOriginalMetrics(emailData);
        console.log('📊 [DEBUG] Using original metrics:', {
          source: emailData.gradeMyMailMetrics ? 'Grade My Mail' : 'Estimated',
          metrics: originalMetrics
        });
        
        setState(prev => ({ ...prev, emailData, originalMetrics, loadingProgress: 60 }));

        console.log('🔧 [DEBUG] Starting content improvement generation...');
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
    
    // Cleanup function
    return () => {
      console.log('🧹 [DEBUG] FixMyMail component unmounting');
      isMountedRef.current = false;
    };
  }, [dataId, handleAsyncError]);

  // Function to analyze improved content using the same Grade My Mail system
  const analyzeImprovedContent = async (improvedContent: string) => {
    console.log('🔍 [DEBUG] analyzeImprovedContent started');
    console.log('📝 [DEBUG] Content to analyze:', {
      length: improvedContent.length,
      preview: improvedContent.substring(0, 200) + '...',
      hasContent: !!improvedContent.trim()
    });
    
    try {
      setState(prev => ({ ...prev, isAnalyzingImprovedContent: true }));
      
      // Validate content before analysis
      if (!improvedContent || improvedContent.trim().length < 10) {
        throw new Error('Improved content is too short or empty for analysis');
      }
      
      console.log('📊 [DEBUG] Analyzing improved content with Grade My Mail system...');
      console.log('🔗 [DEBUG] Calling apiService.analyzeNewsletter...');
      
      // Use the same analysis system as Grade My Mail
      let analysisResponse;
      try {
        analysisResponse = await apiService.analyzeNewsletter(improvedContent);
      } catch (unifiedError) {
        console.warn('⚠️ [DEBUG] Unified analysis failed, trying simple scoreNewsletter...', unifiedError);
        try {
          // Fallback to the simpler scoring endpoint
          analysisResponse = await apiService.scoreNewsletter(improvedContent);
        } catch (scoreError) {
          console.error('❌ [DEBUG] Both analysis methods failed:', { unifiedError, scoreError });
          
          // TEMPORARY: Mock successful analysis for testing UI
          if (process.env.NODE_ENV === 'development') {
            console.warn('🔧 [DEBUG] Using mock analysis for development testing');
            analysisResponse = {
              metrics: {
                overallGrade: 'B' as const,
                audienceFit: 78,
                tone: 82,
                clarity: 85,
                engagement: 80,
                spamRisk: 25,
                wordCount: Math.round(improvedContent.split(/\s+/).length),
                readingTime: Math.max(1, Math.round(improvedContent.split(/\s+/).length / 200)),
                summary: ['Mock analysis - real analysis failed'],
                improvements: ['Mock improvement data']
              }
            };
          } else {
            throw scoreError; // Re-throw in production
          }
        }
      }
      
      console.log('✅ [DEBUG] Improved content analysis completed successfully');
      console.log('📈 [DEBUG] Analysis response structure:', {
        hasResponse: !!analysisResponse,
        hasMetrics: !!analysisResponse?.metrics,
        responseKeys: analysisResponse ? Object.keys(analysisResponse) : [],
        metricsKeys: analysisResponse?.metrics ? Object.keys(analysisResponse.metrics) : []
      });
      
      if (!analysisResponse || !analysisResponse.metrics) {
        throw new Error('Analysis response is missing metrics data');
      }
      
      console.log('📊 [DEBUG] Metrics details:', {
        overallGrade: analysisResponse.metrics.overallGrade,
        scores: {
          audienceFit: analysisResponse.metrics.audienceFit,
          tone: analysisResponse.metrics.tone,
          clarity: analysisResponse.metrics.clarity,
          engagement: analysisResponse.metrics.engagement,
          spamRisk: analysisResponse.metrics.spamRisk
        }
      });
      
      // Store the real analyzed metrics
      setState(prev => ({
        ...prev,
        improvedMetrics: analysisResponse.metrics,
        isAnalyzingImprovedContent: false,
      }));
      
      console.log('🎉 [DEBUG] Real analysis completed and stored successfully');
      
    } catch (error) {
      console.error('❌ [DEBUG] Failed to analyze improved content:', error);
      console.error('❌ [DEBUG] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      // Don't fail the entire process if analysis fails, just log the error
      setState(prev => ({ 
        ...prev, 
        isAnalyzingImprovedContent: false,
        improvedMetrics: null // Will fall back to estimates
      }));
      
      console.warn('⚠️ [DEBUG] Analysis failed - will use estimated metrics instead of real analysis');
      console.warn('⚠️ [DEBUG] This means users will see the "Estimated (NOT ANALYZED)" warning');
    }
  };

  const generateImprovedContent = async (emailData: EmailData) => {
    console.log('🚀 [DEBUG] generateImprovedContent started');
    console.log('📊 [DEBUG] Email data:', {
      id: emailData.id,
      originalTextLength: emailData.originalText.length,
      taggedContentLength: emailData.taggedContent.length,
      hasOriginalHTML: !!emailData.originalHTML
    });

    try {
      console.log('🔄 [DEBUG] Starting loading screen...');
      // Start loading screen for improvement generation
      startLoading('analysis', 'Generating improved alternatives...');
      updateProgress(20);
      setState(prev => ({ ...prev, loadingProgress: 70 }));

      console.log('🔍 [DEBUG] Validating tagged content...');
      // Validate that tagged content has valid tags
      const tagRegex = /<(fluff|spam_words|hard_to_read)>.*?<\/\1>/g;
      const hasValidTags = tagRegex.test(emailData.taggedContent);
      console.log('🏷️ [DEBUG] Tag validation result:', hasValidTags);
      
      if (!hasValidTags) {
        console.warn('⚠️ [DEBUG] No valid tags found in content:', emailData.taggedContent.substring(0, 200) + '...');
        stopLoading();
        const error = new Error('No issues found to improve. The email content appears to be already optimized.');
        handleAsyncError(error, { 
          operation: 'generate-improvements',
          noTaggedContent: true,
          taggedContentLength: emailData.taggedContent.length
        });
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      console.log('✅ [DEBUG] Valid tags found, proceeding with improvement generation');

      updateProgress(60);
      setState(prev => ({ ...prev, loadingProgress: 80 }));

      console.log('🔧 [DEBUG] Calling apiService.fixEmail...');
      console.log('📝 [DEBUG] Tagged content preview:', emailData.taggedContent.substring(0, 200) + '...');
      
      // Call the fix API with the full tagged content (not just extracted sentences)
      const result = await apiService.fixEmail(emailData.taggedContent);
      
      console.log('✅ [DEBUG] API call completed successfully');
      console.log('📤 [DEBUG] API response structure:', {
        hasMessage: !!result.message,
        hasContent: !!result.message?.content,
        contentLength: result.message?.content?.length || 0,
        hasGMMeditorData: !!result.gmmEditor,
        mappingsCount: result.gmmEditor?.mappings?.length || 0
      });
      
      updateProgress(80);
      setState(prev => ({ ...prev, loadingProgress: 90 }));

      console.log('📋 [DEBUG] Setting improved content in state...');
      
      // Store both the improved content and the rich GMMeditor data
      updateProgress(100);
      setState(prev => ({
        ...prev,
        improvedContent: result.message.content,
        gmmEditorData: result.gmmEditor, // Store the rich mapping data
        isLoading: false,
        loadingProgress: 100,
      }));

      console.log('✅ [DEBUG] State updated successfully, stopping loading...');
      
      // Loading screen will auto-close
      setTimeout(() => {
        console.log('🛑 [DEBUG] Stopping loading screen...');
        stopLoading();
      }, 500);

      // CRITICAL: Analyze the improved content to get real metrics
      console.log('🔍 [DEBUG] Starting analysis of improved content...');
      await analyzeImprovedContent(result.message.content);

      console.log('🎉 [DEBUG] generateImprovedContent completed successfully');

    } catch (error) {
      console.error('❌ [DEBUG] generateImprovedContent error occurred:', error);
      console.error('❌ [DEBUG] Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      console.log('🛑 [DEBUG] Stopping loading due to error...');
      stopLoading(); // Stop loading on error
      
      // Check if it's a rate limiting error
      const isRateLimitError = error instanceof Error && 
        (error.message.includes('Too many') || error.message.includes('wait') || error.message.includes('seconds'));
      
      const errorMessage = isRateLimitError 
        ? error.message 
        : `Failed to generate improvements: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      console.log('📝 [DEBUG] Error message:', errorMessage);
      
      handleAsyncError(
        error instanceof Error ? error : new Error(errorMessage),
        { 
          operation: 'generate-improvements',
          emailDataId: emailData.id,
          taggedContentLength: emailData.taggedContent.length,
          isRateLimitError
        },
        // Only retry if it's not a rate limiting error
        !isRateLimitError ? async () => {
          console.log('🔄 [DEBUG] Retrying generateImprovedContent...');
          // Retry generating improvements
          await generateImprovedContent(emailData);
        } : undefined,
        () => {
          console.log('🔄 [DEBUG] Using fallback mode...');
          // Fallback - show original content only
          setState(prev => ({
            ...prev,
            improvedContent: emailData.originalText,
            gmmEditorData: null,
            isLoading: false,
            loadingProgress: 100,
          }));
          enableFallbackMode(true);
        }
      );
      
      console.log('📝 [DEBUG] Setting error state...');
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
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
      // Content copied successfully
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
            // Content copied using fallback method
          } catch (fallbackError) {
            console.error('Fallback copy also failed:', fallbackError);
          }
        }
      );
    }
  }, [state.improvedContent, handleAsyncError]);

  const handleToneChange = useCallback(async (newTone: ToneKey) => {
    if (!state.emailData || state.isRegenerating) return;

    console.log('🎨 [DEBUG] Tone change requested:', newTone);
    
    setState(prev => ({ 
      ...prev, 
      selectedTone: newTone,
      isRegenerating: true,
      error: null
    }));

    try {
      console.log('🔄 [DEBUG] Starting content regeneration with new tone...');
      startLoading('analysis', `Regenerating with ${newTone} tone...`);
      updateProgress(20);

      // Call the fix API with the new tone
      const result = await apiService.fixEmail(state.emailData.taggedContent, {
        tone: newTone
      });
      
      console.log('✅ [DEBUG] Content regenerated successfully with new tone');
      
      updateProgress(80);
      
      setState(prev => ({
        ...prev,
        improvedContent: result.message.content,
        gmmEditorData: result.gmmEditor,
        isRegenerating: false,
      }));

      updateProgress(100);
      
      setTimeout(() => {
        stopLoading();
      }, 500);

    } catch (error) {
      console.error('❌ [DEBUG] Tone change regeneration error:', error);
      
      stopLoading();
      
      // Check if it's a rate limiting error
      const isRateLimitError = error instanceof Error && 
        (error.message.includes('Too many') || error.message.includes('wait') || error.message.includes('seconds'));
      
      const errorMessage = isRateLimitError 
        ? error.message 
        : `Failed to regenerate with ${newTone} tone: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      handleAsyncError(
        error instanceof Error ? error : new Error(errorMessage),
        { 
          operation: 'regenerate-with-tone',
          tone: newTone,
          emailDataId: state.emailData.id,
          isRateLimitError
        },
        // Only retry if it's not a rate limiting error
        !isRateLimitError ? async () => {
          // Retry with the new tone
          await handleToneChange(newTone);
        } : undefined
      );
      
      setState(prev => ({
        ...prev,
        isRegenerating: false,
        error: errorMessage,
      }));
    }
  }, [state.emailData, state.isRegenerating, handleAsyncError, startLoading, updateProgress, stopLoading]);

  // Render loading state
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1C1C1E] flex items-center justify-center relative overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-purple-50/30 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10 animate-pulse" />
        
        <div className="bg-white/95 dark:bg-[#2C2C2E]/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 p-8 max-w-md w-full mx-4 relative z-10">
          <div className="text-center">
            {/* Enhanced loading animation */}
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#e5e5ea] dark:border-[#3A3A3C] rounded-full"></div>
              <div className="absolute inset-0 border-4 border-transparent border-t-[#1d1d1f] dark:border-t-[#03FF40] rounded-full animate-spin"></div>
              <div className="absolute inset-2 border-2 border-transparent border-t-[#1d1d1f]/50 dark:border-t-[#03FF40]/50 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            </div>
            
            <h2 className="text-xl font-semibold text-[#1d1d1f] dark:text-[#FFFFFF] mb-2 animate-pulse">
              Loading FixMyMail
            </h2>
            <p className="text-sm text-[#6d6d70] dark:text-[#EBEBF5] mb-6 animate-pulse">
              Preparing your email improvements...
            </p>
            
            {/* Enhanced progress bar */}
            <div className="w-full bg-[#e5e5ea] dark:bg-[#3A3A3C] rounded-full h-3 mb-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-[#1d1d1f] via-gray-700 to-[#1d1d1f] dark:from-[#03FF40] dark:via-[#00e639] dark:to-[#03FF40] h-full rounded-full transition-all duration-500 ease-out relative"
                style={{ width: `${state.loadingProgress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
              </div>
            </div>
            
            <p className="text-sm font-medium text-[#1d1d1f] dark:text-[#FFFFFF] animate-pulse">
              {state.loadingProgress}% complete
            </p>
            
            {/* Loading steps indicator */}
            <div className="flex justify-center space-x-2 mt-4">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    state.loadingProgress >= step * 25
                      ? 'bg-[#1d1d1f] dark:bg-[#03FF40] scale-110'
                      : 'bg-[#e5e5ea] dark:bg-[#3A3A3C]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render error state with enhanced error display
  if (state.error) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#1C1C1E] flex items-center justify-center">
        <div className="bg-white dark:bg-[#2C2C2E] rounded-xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] border border-[#d1d1d6] dark:border-white/5 p-8 max-w-lg w-full mx-4">
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
              <h2 className="text-lg font-medium text-[#1d1d1f] dark:text-[#FFFFFF] mb-2">Unable to Load FixMyMail</h2>
              <p className="text-sm text-[#6d6d70] dark:text-[#EBEBF5] mb-6">{state.error}</p>
            </div>
          )}
          
          <div className="flex flex-col space-y-3">
            <button
              onClick={handleBackToGradeMyMail}
              disabled={navigationState.isLoading}
              className="bg-[#1d1d1f] hover:bg-[#86868b] dark:bg-[#03FF40] dark:hover:bg-[#00e639] disabled:bg-[#86868b] text-white dark:text-black px-6 py-2 rounded-xl font-medium transition-colors duration-200"
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

  // Helper function to clean HTML tags and analysis tags while preserving formatting
  const cleanHtmlTags = (html: string): string => {
    return html
      // Remove analysis tags first (fluff, spam_words, hard_to_read)
      .replace(/<(fluff|spam_words|hard_to_read)>/gi, '')
      .replace(/<\/(fluff|spam_words|hard_to_read)>/gi, '')
      // Convert block elements to line breaks
      .replace(/<\/?(p|div|h[1-6]|li|blockquote)[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/?(ul|ol)[^>]*>/gi, '\n')
      // Remove remaining HTML tags
      .replace(/<[^>]*>/g, '')
      // Clean up HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up excessive whitespace while preserving intentional line breaks
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive line breaks
      .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
      .replace(/\n /g, '\n') // Remove spaces at start of lines
      .replace(/ \n/g, '\n') // Remove spaces at end of lines
      .trim();
  };

  // Main FixMyMail interface - Clean Apple-inspired design matching GradeMyMail
  return (
    <div className="min-h-screen bg-white dark:bg-[#1C1C1E] transition-colors duration-300">
      {/* Clean Header matching GradeMyMail */}
      <header className="relative">
        <div className="flex items-center justify-center py-16 px-6">
          {/* Pick & Partner Logo - Left Side */}
          <div className="absolute left-20 animate-slide-in-left">
            <Logo size="lg-xl" showText={false} />
          </div>

          {/* Theme-Responsive GradeMyMail Logo - Center */}
          <div className="text-center animate-fade-in-up">
            <ThemeResponsiveLogo
              size="hero"
              clickable={true}
              showFallbackText={true}
            />
          </div>

          {/* Theme Toggle - Right Side */}
          <div className="absolute right-20 animate-slide-in-right">
            <ThemeToggle size="md" />
          </div>
        </div>
        
        {/* Loading State - elegant */}
        {navigationState.isLoading && (
          <div className="premium-loading-bar">
            <div className="loading-progress"></div>
          </div>
        )}
      </header>

      {/* Back Button - Positioned below header */}
      <div className="max-w-6xl mx-auto px-6 mb-8">
        <button
          onClick={handleBackToGradeMyMail}
          disabled={navigationState.isLoading}
          className="premium-back-button"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Analysis
        </button>
      </div>

      {/* Clean Main Content */}
      <main className="premium-main-content">
        <div className="max-w-6xl mx-auto px-6 pb-16">
          {state.emailData && state.improvedContent && (
            <div className="space-y-6">
              {/* Tone Selector Controls */}
              <div className="bg-white dark:bg-[#2C2C2E] border border-[#d1d1d6] dark:border-white/5 rounded-xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 transition-all duration-400 hover:shadow-md dark:hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)] animate-fade-in-up">
                <div className="flex items-center justify-between">
                  <div className="flex-1 max-w-xs">
                    <ToneSelector
                      selectedTone={state.selectedTone}
                      onToneChange={handleToneChange}
                      disabled={state.isRegenerating}
                      className="w-full"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {state.isRegenerating && (
                      <div className="flex items-center text-sm text-[#6d6d70] dark:text-[#EBEBF5]">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#007aff] dark:border-[#0a84ff] mr-2"></div>
                        Regenerating...
                      </div>
                    )}
                    
                    <div className="text-sm text-[#6d6d70] dark:text-[#EBEBF5]">
                      {state.gmmEditorData?.mappings ? 
                        `${state.gmmEditorData.mappings.filter(m => m.type === 'changed' || m.type === 'inserted').length} improvements applied` : 
                        'Content improved'
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Diff Viewer */}
              <div className="bg-white dark:bg-[#2C2C2E] border border-[#d1d1d6] dark:border-white/5 rounded-xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-400 hover:shadow-md dark:hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)] hover:-translate-y-1 animate-fade-in-up">
                <VirtualizedDiffViewer
                  originalContent={(() => {
                    const cleaned = cleanHtmlTags(state.emailData.originalText);
                    console.log('🔍 [DEBUG] Original content after cleaning:', {
                      raw: state.emailData.originalText.substring(0, 200),
                      cleaned: cleaned.substring(0, 200),
                      hasTags: /<(fluff|spam_words|hard_to_read)>/.test(state.emailData.originalText),
                      hasTagsAfterCleaning: /<(fluff|spam_words|hard_to_read)>/.test(cleaned)
                    });
                    return cleaned;
                  })()}
                  modifiedContent={state.improvedContent}
                  gmmEditorData={state.gmmEditorData}
                  height={window.innerHeight - 400}
                  className="premium-diff-container"
                />
              </div>

              {/* Analytics Toggle Button - Outside diff viewer */}
              {state.originalMetrics && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowAnalytics(!showAnalytics)}
                    className="bg-[#FF9500] hover:bg-[#FF8C00] dark:bg-[#FF9F0A] dark:hover:bg-[#FF8C00] text-white rounded-xl px-4 py-2 shadow-lg dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-xl dark:hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)] transition-all duration-300 hover:scale-105 group flex items-center space-x-2"
                    title={showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform duration-300 ${showAnalytics ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-sm font-medium">
                      {showAnalytics ? 'Hide Analytics' : 'Show Analytics'}
                    </span>
                  </button>
                </div>
              )}

              {/* Collapsible Analytics Section */}
              {state.originalMetrics && (
                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${
                  showAnalytics 
                    ? 'max-h-[2000px] opacity-100 transform translate-y-0' 
                    : 'max-h-0 opacity-0 transform -translate-y-4'
                }`}>
                  <div className="bg-white dark:bg-[#2C2C2E] border border-[#d1d1d6] dark:border-white/5 rounded-xl shadow-sm dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)] p-6 transition-all duration-400 hover:shadow-md dark:hover:shadow-[0_6px_24px_rgba(0,0,0,0.5)] animate-fade-in-up">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF]">
                        📊 Content Analytics
                      </h3>
                      <button
                        onClick={() => setShowAnalytics(false)}
                        className="text-[#6d6d70] dark:text-[#8E8E93] hover:text-[#1d1d1f] dark:hover:text-[#FFFFFF] transition-colors duration-200"
                        title="Hide Analytics"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <FixMyMailMetrics
                      originalMetrics={state.originalMetrics}
                      improvedMetrics={state.improvedMetrics}
                      gmmEditorMetadata={state.gmmEditorData?.metadata}
                      isUsingActualGradeMyMailData={!!state.emailData?.gradeMyMailMetrics}
                      isUsingActualImprovedAnalysis={!!state.improvedMetrics}
                    />
                    
                    {/* Show analysis status */}
                    {state.isAnalyzingImprovedContent && (
                      <div className="mt-4 flex items-center justify-center text-sm text-[#6d6d70] dark:text-[#EBEBF5]">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FF9500] mr-2"></div>
                        Analyzing improved content for real metrics...
                      </div>
                    )}
                    
                    {/* Debug info - remove this in production */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="mt-4 p-3 bg-gray-100 dark:bg-[#3A3A3C] rounded-lg text-xs">
                        <div className="font-medium mb-2">Debug Info:</div>
                        <div>Has improved content: {!!state.improvedContent ? 'Yes' : 'No'}</div>
                        <div>Has real improved metrics: {!!state.improvedMetrics ? 'Yes' : 'No'}</div>
                        <div>Is analyzing: {state.isAnalyzingImprovedContent ? 'Yes' : 'No'}</div>
                        <div>Content length: {state.improvedContent?.length || 0}</div>
                        {!state.improvedMetrics && state.improvedContent && (
                          <div className="text-red-600 dark:text-red-400 mt-1">
                            ⚠️ Analysis failed - check browser console for details
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default FixMyMail;