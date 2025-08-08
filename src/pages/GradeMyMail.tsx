import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import RichTextEditor from '../components/RichTextEditor/RichTextEditor';
import { HighlightedContent } from '../components/HighlightedContent';
import { NavigationManager, type NavigationState } from '../utils/navigationUtils';
import { type EmailData } from '../utils/stateTransfer';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { StatePreservation } from '../utils/errorRecovery';
import { MinimalPulsePopup } from '../components/LoadingScreen/MinimalLoadingPopup';
import { InstructionsPopup } from '../components/InstructionsPopup';
import Logo from '../components/ui/Logo';
import { MetricsDisplay, type NewsletterMetrics } from '../components/MetricsDisplay';
import { calculateNewsletterMetrics } from '../utils/metricsCalculator';
import { apiService } from '../services/api';





const GradeMyMail: React.FC = () => {
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [hasContentChanged, setHasContentChanged] = useState(false);
  const [metrics, setMetrics] = useState<NewsletterMetrics | null>(null);
  const [navigationState, setNavigationState] = useState<NavigationState>({
    isLoading: false,
    error: null,
    progress: 0,
  });
  const [aiModelStatus, setAiModelStatus] = useState<{
    currentModel: string;
    isHealthy: boolean;
    usingFallback: boolean;
    lastChecked: Date | null;
  }>({
    currentModel: 'unknown',
    isHealthy: true,
    usingFallback: false,
    lastChecked: null,
  });
  
  // Container ref for the editor
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced error handling
  const { handleAsyncError, enableFallbackMode } = useErrorHandler();

  // Check AI model status periodically (skip in test environment)
  useEffect(() => {
    // Skip API calls in test environment
    if (process.env.NODE_ENV === 'test' || typeof window === 'undefined') {
      return;
    }

    const checkModelStatus = async () => {
      try {
        console.log('🔍 Checking AI model status...');
        const status = await apiService.getModelsStatus();
        console.log('📊 Received model status:', status);
        
        const isHealthy = status.status === 'healthy';
        const currentModel = status.hybrid?.currentPrimary || 'unknown';
        const usingFallback = status.hybrid?.usingFallback || false;
        
        console.log(`✅ Model status: ${isHealthy ? 'healthy' : 'degraded'}, current: ${currentModel}, fallback: ${usingFallback}`);
        
        setAiModelStatus({
          currentModel,
          isHealthy,
          usingFallback,
          lastChecked: new Date(),
        });
      } catch (error) {
        console.warn('❌ Failed to check AI model status:', error);
        setAiModelStatus(prev => ({
          ...prev,
          isHealthy: false,
          lastChecked: new Date(),
        }));
      }
    };

    // Check immediately
    checkModelStatus();

    // Check every 30 seconds
    const interval = setInterval(checkModelStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Check for recovery data on mount
  useEffect(() => {
    const recovery = StatePreservation.restoreState();
    if (recovery.success && recovery.data) {
      try {
        if (recovery.data.emailContent) {
          setContent(recovery.data.emailContent.originalText || '');
          setHtmlContent(recovery.data.emailContent.originalHTML || '');
        }
        
        StatePreservation.clearRecoveryData();
      } catch (error) {
        console.error('Failed to restore state:', error);
        StatePreservation.clearRecoveryData();
      }
    }
  }, []);

  // Intelligent fallback analysis when AI systems fail
  const createIntelligentFallbackAnalysis = useCallback((content: string): string => {
    let taggedContent = content;
    
    // Fluff words detection (common filler words)
    const fluffPatterns = [
      /\b(amazing|incredible|fantastic|awesome|great|wonderful|excellent|outstanding|remarkable|extraordinary)\b/gi,
      /\b(I hope this email finds you well|I hope you're doing well|I trust this finds you well)\b/gi,
      /\b(just wanted to|just checking in|just following up|just a quick)\b/gi,
      /\b(obviously|clearly|definitely|absolutely|certainly|undoubtedly)\b/gi,
      /\b(very|really|quite|extremely|incredibly|tremendously)\b/gi
    ];
    
    fluffPatterns.forEach(pattern => {
      taggedContent = taggedContent.replace(pattern, '<fluff>$&</fluff>');
    });
    
    // Spam words detection (marketing/sales language)
    const spamPatterns = [
      /\b(free|urgent|act now|limited time|don't miss|exclusive|special offer|once in a lifetime)\b/gi,
      /\b(guaranteed|risk-free|no obligation|instant|immediate|fast|quick|easy)\b/gi,
      /\b(buy now|order now|click here|call now|sign up now|subscribe now)\b/gi,
      /\b(discount|sale|offer|deal|promotion|bonus|gift|prize)\b/gi,
      /\b(money back|refund|cash|earn|profit|income|opportunity)\b/gi
    ];
    
    spamPatterns.forEach(pattern => {
      taggedContent = taggedContent.replace(pattern, '<spam_words>$&</spam_words>');
    });
    
    // Hard to read detection (complex sentences and jargon)
    const hardToReadPatterns = [
      /\b(synergistic|paradigm|leverage|optimize|maximize|utilize|facilitate|implement|strategize)\b/gi,
      /\b(solutions|methodology|framework|infrastructure|architecture|ecosystem|platform)\b/gi,
      /\b(innovative|cutting-edge|state-of-the-art|next-generation|revolutionary|disruptive)\b/gi,
      /\b(comprehensive|holistic|integrated|scalable|robust|dynamic|agile|streamlined)\b/gi
    ];
    
    hardToReadPatterns.forEach(pattern => {
      taggedContent = taggedContent.replace(pattern, '<hard_to_read>$&</hard_to_read>');
    });
    
    // Detect overly long sentences (potential readability issues)
    const sentences = taggedContent.split(/[.!?]+/);
    sentences.forEach((sentence, index) => {
      const words = sentence.trim().split(/\s+/);
      if (words.length > 25) { // Sentences longer than 25 words
        const longSentence = sentence.trim();
        if (longSentence && !longSentence.includes('<hard_to_read>')) {
          taggedContent = taggedContent.replace(longSentence, `<hard_to_read>${longSentence}</hard_to_read>`);
        }
      }
    });
    
    return taggedContent;
  }, []);

  // Smart content validation
  const validateContentForAnalysis = useCallback((content: string): { isValid: boolean; reason?: string } => {
    const trimmedContent = content.trim();
    
    // Check minimum length
    if (trimmedContent.length < 10) {
      return { isValid: false, reason: 'Content too short (minimum 10 characters)' };
    }
    
    // Check maximum length
    if (trimmedContent.length > 50000) {
      return { isValid: false, reason: 'Content too long (maximum 50,000 characters)' };
    }
    
    // Check if content looks like email/newsletter content
    const wordCount = trimmedContent.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount < 5) {
      return { isValid: false, reason: 'Content too short (minimum 5 words)' };
    }
    
    // Check for suspicious patterns that might indicate non-email content
    const codePatterns = [
      /function\s*\(/,
      /class\s+\w+/,
      /import\s+.*from/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/
    ];
    
    const hasCodePatterns = codePatterns.some(pattern => pattern.test(trimmedContent));
    if (hasCodePatterns) {
      return { isValid: false, reason: 'Content appears to be code rather than email text' };
    }
    
    return { isValid: true };
  }, []);

  // Manual analysis function with hybrid AI routing
  const handleAnalyzeClick = useCallback(async () => {
    // Smart content validation
    const validation = validateContentForAnalysis(content);
    if (!validation.isValid) {
      console.warn('❌ Content validation failed:', validation.reason);
      return;
    }

    setIsAnalyzing(true);
    
    try {
      console.log('🔍 Starting newsletter analysis with hybrid AI system...');
      console.log(`📊 Content stats: ${content.length} chars, ${content.split(/\s+/).length} words`);
      
      // Update AI model status before analysis
      const modelStatus = await apiService.getModelsStatus();
      setAiModelStatus({
        currentModel: modelStatus.hybrid?.currentPrimary || 'unknown',
        isHealthy: modelStatus.status === 'healthy',
        usingFallback: modelStatus.hybrid?.usingFallback || false,
        lastChecked: new Date(),
      });
      
      // Use the newsletter-specific hybrid AI router with custom prompts
      const response = await apiService.analyzeNewsletter(content, 'newsletter-analysis');
      
      console.log('✅ Analysis completed successfully');
      console.log(`🤖 Used model: ${modelStatus.hybrid?.currentPrimary || 'unknown'}`);
      
      // LOG THE EXACT AI OUTPUT FOR DEBUGGING
      console.log('🔍 === RAW AI OUTPUT ===');
      console.log('📄 Full Response Object:', response);
      console.log('📝 Tagged Content (AI Output):', response.message.content);
      console.log('📊 Response Metadata:', response.metadata || 'No metadata');
      console.log('🔍 === END AI OUTPUT ===');
      
      setAnalysisResult(response);
      
      // Calculate metrics from the tagged content
      const calculatedMetrics = calculateNewsletterMetrics(
        response.message.content,
        content
      );
      setMetrics(calculatedMetrics);
      
      setHasContentChanged(false); // Reset the changed flag after analysis
      
      // Update model status after successful analysis
      setAiModelStatus(prev => ({
        ...prev,
        isHealthy: true,
        lastChecked: new Date(),
      }));
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      
      // Update model status to indicate failure
      setAiModelStatus(prev => ({
        ...prev,
        isHealthy: false,
        lastChecked: new Date(),
      }));
      
      handleAsyncError(
        error instanceof Error ? error : new Error('Analysis failed'),
        { 
          operation: 'manual-analysis',
          contentLength: content.length,
          errorType: error instanceof Error ? error.name : 'Unknown',
          currentModel: aiModelStatus.currentModel,
          usingFallback: aiModelStatus.usingFallback
        },
        async () => {
          // Retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000));
          await handleAnalyzeClick();
        },
        () => {
          enableFallbackMode(true);
          console.log('🔄 All AI systems failed, using intelligent fallback analysis...');
          
          // Provide intelligent fallback response when all AI systems fail
          const fallbackResponse = {
            message: {
              content: createIntelligentFallbackAnalysis(content)
            }
          };
          
          setAnalysisResult(fallbackResponse);
          const fallbackMetrics = calculateNewsletterMetrics(
            fallbackResponse.message.content,
            content
          );
          setMetrics(fallbackMetrics);
          setHasContentChanged(false);
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
      // Reset metrics when content changes
      setMetrics(null);
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
      
      {/* Instructions Popup */}
      <InstructionsPopup />

      {/* Minimal Header */}
      <header className="relative">
        <div className="flex items-center justify-center py-16 px-6">
          {/* Logo aligned with title */}
          <div className="absolute left-6 animate-slide-in-left">
            <Logo size="lg" showText={false} />
          </div>
          
          {/* Centered title */}
          <h1 className="text-5xl font-light text-gray-900 tracking-tight animate-fade-in-up transition-all duration-300 hover:scale-105 cursor-default select-none">
            GradeMyMail
          </h1>
        </div>
      </header>

      {/* Main Content - Minimal Layout */}
      <main className="max-w-4xl mx-auto px-6 pb-16">
        {/* Editor Section - Clean and Spacious */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden transition-all duration-400 hover:shadow-md hover:-translate-y-1 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
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
            
            {/* Analysis Results - Show highlighted content when analysis is complete */}
            {analysisResult?.message?.content && !hasContentChanged && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 p-4 overflow-auto">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Analysis Results</h3>
                  <button
                    onClick={() => setAnalysisResult(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                    title="Close analysis"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <HighlightedContent 
                  content={analysisResult.message.content}
                  originalHTML={htmlContent}
                  className="text-sm"
                />
              </div>
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
              className="bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 text-white px-8 py-3 rounded-lg font-medium transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl disabled:transform-none disabled:shadow-none animate-fade-in-up relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
            >
              <span className="relative z-10">
                {isAnalyzing ? 'Analyzing...' : 'Analyze'}
              </span>
              {!isAnalyzing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out"></div>
              )}
            </button>
          )}

          {/* Improve Button - Only after analysis and content hasn't changed */}
          {analysisResult?.message?.content && !hasContentChanged && !navigationState.isLoading && (
            <button
              onClick={handleFixMyMailClick}
              disabled={isAnalyzing || navigationState.isLoading}
              className="bg-[#ff4500] hover:bg-[#e03e00] text-white px-8 py-3 rounded-lg font-medium transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) transform hover:scale-105 hover:-translate-y-1 hover:shadow-xl animate-fade-in-up relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#ff4500] focus:ring-offset-2"
              style={{ animationDelay: '0.2s' }}
            >
              <span className="relative z-10">Improve</span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out"></div>
            </button>
          )}
        </div>

        {/* Sample Button - Only when empty */}
        {!content && (
          <div className="text-center mt-8 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <button
              onClick={handleSampleEmailClick}
              className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) hover:scale-110 hover:-translate-y-0.5 relative focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 rounded-md px-2 py-1"
            >
              <span className="relative z-10">Try sample</span>
              <div className="absolute inset-0 bg-gray-100 rounded-md opacity-0 hover:opacity-100 transition-opacity duration-300 -z-10 scale-110"></div>
            </button>
          </div>
        )}

        {/* AI Model Status Indicator - Subtle and non-intrusive */}
        {aiModelStatus.lastChecked && (
          <div className="mt-8 text-center animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="inline-flex items-center space-x-2 text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
              <div className={`w-2 h-2 rounded-full ${aiModelStatus.isHealthy ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
              <span>
                {aiModelStatus.usingFallback ? 'Fallback AI' : 
                 aiModelStatus.currentModel === 'llama3.2' ? 'Local AI' : 
                 aiModelStatus.currentModel === 'gpt-4o-mini' ? 'Cloud AI' : 
                 'Hybrid AI'} 
                {!aiModelStatus.isHealthy && ' (Degraded)'}
              </span>
            </div>
          </div>
        )}

        {/* Metrics Display - Only show when content hasn't changed */}
        {metrics && !hasContentChanged && !isAnalyzing && (
          <div className="mt-12 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="max-w-md mx-auto">
              <MetricsDisplay 
                metrics={metrics}
                className="shadow-lg"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default GradeMyMail;