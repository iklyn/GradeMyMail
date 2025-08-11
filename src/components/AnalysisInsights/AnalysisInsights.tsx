import React from 'react';
import { NewsletterMetrics } from '../MetricsDisplay/MetricsDisplay';

export interface AnalysisInsightsProps {
  metrics: NewsletterMetrics;
  className?: string;
}

// Helper function to get readability grade interpretation
const getReadabilityInterpretation = (grade?: number): { label: string; color: string; description: string } => {
  if (!grade) return { label: 'Unknown', color: 'text-gray-500 dark:text-[#8E8E93]', description: 'Readability not available' };
  
  if (grade <= 6) return { 
    label: 'Elementary', 
    color: 'text-green-600 dark:text-[#30D158]', 
    description: 'Very easy to read' 
  };
  if (grade <= 9) return { 
    label: 'Middle School', 
    color: 'text-blue-600 dark:text-[#007AFF]', 
    description: 'Easy to read' 
  };
  if (grade <= 12) return { 
    label: 'High School', 
    color: 'text-yellow-600 dark:text-[#FFD60A]', 
    description: 'Moderately easy' 
  };
  if (grade <= 16) return { 
    label: 'College', 
    color: 'text-orange-600 dark:text-[#FF9F0A]', 
    description: 'Difficult to read' 
  };
  return { 
    label: 'Graduate', 
    color: 'text-red-600 dark:text-[#FF453A]', 
    description: 'Very difficult' 
  };
};

// Helper function to get link density interpretation
const getLinkDensityInterpretation = (density?: number): { status: string; color: string; description: string } => {
  if (!density) return { status: 'Unknown', color: 'text-gray-500 dark:text-[#8E8E93]', description: 'Link density not available' };
  
  if (density <= 2) return { 
    status: 'Optimal', 
    color: 'text-green-600 dark:text-[#30D158]', 
    description: 'Good balance of links' 
  };
  if (density <= 4) return { 
    status: 'Moderate', 
    color: 'text-yellow-600 dark:text-[#FFD60A]', 
    description: 'Acceptable link density' 
  };
  return { 
    status: 'High', 
    color: 'text-red-600 dark:text-[#FF453A]', 
    description: 'May appear spammy' 
  };
};

const AnalysisInsights: React.FC<AnalysisInsightsProps> = ({
  metrics,
  className = '',
}) => {
  const [currentSentence, setCurrentSentence] = React.useState(0);
  const [displayedText, setDisplayedText] = React.useState('');
  const [isTyping, setIsTyping] = React.useState(false);
  
  // Debug: Log what we're receiving
  React.useEffect(() => {
    console.log('📊 AnalysisInsights received metrics:', {
      summary: metrics.summary,
      improvements: metrics.improvements,
      hasValidSummary: metrics.summary && metrics.summary.length > 0,
      hasValidImprovements: metrics.improvements && metrics.improvements.length > 0
    });
  }, [metrics]);
  
  // Check if we have valid AI insights (not fallback messages)
  const hasValidSummary = metrics.summary && metrics.summary.length > 0 && 
    !metrics.summary.some(item => item.includes('limited AI functionality') || item.includes('temporarily unavailable'));
  
  const hasValidImprovements = metrics.improvements && metrics.improvements.length > 0 && 
    !metrics.improvements.some(item => item.includes('limited AI functionality') || item.includes('temporarily unavailable'));

  // For now, let's show the fallback content too so you can see something
  const allContent = [
    ...(metrics.summary || []),
    ...(metrics.improvements || [])
  ];

  // Progressive typing effect
  React.useEffect(() => {
    if (allContent.length === 0 || currentSentence >= allContent.length) return;

    const text = allContent[currentSentence];
    setDisplayedText('');
    setIsTyping(true);

    let index = 0;
    const timer = setInterval(() => {
      if (index <= text.length) {
        setDisplayedText(text.slice(0, index));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(timer);
        // Wait 1 second before starting next sentence
        setTimeout(() => {
          setCurrentSentence(prev => prev + 1);
        }, 1000);
      }
    }, 30); // 30ms per character

    return () => clearInterval(timer);
  }, [currentSentence, allContent]);

  // Reset when metrics change
  React.useEffect(() => {
    setCurrentSentence(0);
    setDisplayedText('');
  }, [metrics]);

  return (
    <div className={`${className}`}>
      <div className="text-center max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Analysis & Next Steps</h2>
        </div>
        
        {/* Progressive Content */}
        {allContent.length > 0 ? (
          <div className="space-y-6">
            {/* Temporary notice about AI status */}
            {!hasValidSummary && !hasValidImprovements && (
              <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-xl">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  ⚠️ Showing fallback content - Configure GROQ_API_KEY in .env.development for real AI insights
                </p>
              </div>
            )}
            
            {/* Show all completed sentences */}
            {allContent.slice(0, currentSentence).map((text, index) => (
              <p key={index} className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {text}
              </p>
            ))}
            
            {/* Show currently typing sentence */}
            {currentSentence < allContent.length && (
              <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                {displayedText}
                {isTyping && <span className="animate-pulse text-gray-400 ml-1">|</span>}
              </p>
            )}
          </div>
        ) : (
          <div className="py-12">
            <p className="text-lg text-gray-500 dark:text-gray-400">No analysis content available</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Configure GROQ_API_KEY to enable AI analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalysisInsights;