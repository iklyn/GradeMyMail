import React from 'react';
import MetricsDisplay, { type NewsletterMetrics } from './MetricsDisplay';
import type { GMMeditorMetadata } from '../../types/gmmeditor';

export interface FixMyMailMetricsProps {
  originalMetrics?: NewsletterMetrics;
  improvedMetrics?: NewsletterMetrics; // Should be actual analyzed metrics of improved content
  gmmEditorMetadata?: GMMeditorMetadata;
  isUsingActualGradeMyMailData?: boolean; // Indicates if using actual Grade My Mail metrics
  isUsingActualImprovedAnalysis?: boolean; // Indicates if improved metrics are from real analysis
  className?: string;
}

// NOTE: This function should NOT be used for calculating actual improvements.
// Instead, we should analyze the improved content using the same Grade My Mail system.
// This is kept as a fallback only when real analysis is unavailable.
const calculateEstimatedMetrics = (
  originalMetrics: NewsletterMetrics,
  gmmEditorMetadata: GMMeditorMetadata
): NewsletterMetrics => {
  console.warn('⚠️ Using estimated metrics instead of real analysis - this should be avoided');
  
  // This is just an estimate and should be replaced with actual analysis
  const lengthRatio = gmmEditorMetadata.rewrittenLength / gmmEditorMetadata.originalLength;
  
  // Conservative estimates - don't assume major improvements
  const clarityImprovement = Math.min(100, originalMetrics.clarity * 1.05); // Only 5% improvement
  const engagementImprovement = Math.min(100, originalMetrics.engagement * 1.03); // Only 3% improvement
  const toneImprovement = Math.min(100, originalMetrics.tone * 1.02); // Only 2% improvement
  const audienceFitImprovement = Math.min(100, originalMetrics.audienceFit * 1.01); // Only 1% improvement
  const spamRiskReduction = Math.max(0, originalMetrics.spamRisk * 0.95); // Only 5% spam risk reduction
  
  // Calculate new overall grade
  const averageScore = Math.round((audienceFitImprovement + toneImprovement + clarityImprovement + engagementImprovement + (100 - spamRiskReduction)) / 5);
  const newGrade = averageScore >= 90 ? 'A' : averageScore >= 80 ? 'B' : averageScore >= 70 ? 'C' : averageScore >= 60 ? 'D' : 'F';
  
  // Estimate reading time based on new word count
  const estimatedWordCount = Math.round(originalMetrics.wordCount * lengthRatio);
  const estimatedReadingTime = Math.max(1, Math.round(estimatedWordCount / 200)); // 200 words per minute
  
  return {
    overallGrade: newGrade as 'A' | 'B' | 'C' | 'D' | 'F',
    audienceFit: Math.round(audienceFitImprovement),
    tone: Math.round(toneImprovement),
    clarity: Math.round(clarityImprovement),
    engagement: Math.round(engagementImprovement),
    spamRisk: Math.round(spamRiskReduction),
    wordCount: estimatedWordCount,
    readingTime: estimatedReadingTime,
    summary: [
      '⚠️ Estimated improvements (not analyzed)',
      `Tone optimized for ${gmmEditorMetadata.toneUsed} style`,
      'Conservative improvement estimates',
      'Real analysis recommended'
    ],
    improvements: [
      'Potential clarity improvements',
      'Possible tone optimization',
      'Estimated readability changes',
      'Conservative improvement estimates'
    ]
  };
};

const FixMyMailMetrics: React.FC<FixMyMailMetricsProps> = ({
  originalMetrics,
  improvedMetrics,
  gmmEditorMetadata,
  isUsingActualGradeMyMailData = false,
  isUsingActualImprovedAnalysis = false,
  className = '',
}) => {
  // Prioritize actual analyzed improved metrics over estimates
  const calculatedImprovedMetrics = improvedMetrics || 
    (originalMetrics && gmmEditorMetadata 
      ? calculateEstimatedMetrics(originalMetrics, gmmEditorMetadata)
      : null);

  // If we don't have original metrics, show just the improved metrics
  if (!originalMetrics) {
    return calculatedImprovedMetrics ? (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] mb-2">
            Improved Content Metrics
          </h3>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
            Content quality after AI improvements
          </p>
        </div>
        <MetricsDisplay metrics={calculatedImprovedMetrics} />
      </div>
    ) : null;
  }

  // Show before/after comparison if we have both sets of metrics
  if (!calculatedImprovedMetrics) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] mb-2">
            Original Content Metrics
          </h3>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
            Content quality before improvements
          </p>
        </div>
        <MetricsDisplay metrics={originalMetrics} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-[#FFFFFF] mb-2">
          Content Improvement Analysis
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
          Before and after comparison of your content quality
        </p>
        {/* Show data source indicators */}
        <div className="mt-2 space-y-1">
          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
            isUsingActualGradeMyMailData 
              ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300'
          }`}>
            <span className="mr-1">{isUsingActualGradeMyMailData ? '✓' : '⚠'}</span>
            {isUsingActualGradeMyMailData 
              ? 'Original: Grade My Mail analysis'
              : 'Original: Estimated metrics'
            }
          </div>
          
          {calculatedImprovedMetrics && (
            <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs ml-2 ${
              isUsingActualImprovedAnalysis 
                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}>
              <span className="mr-1">{isUsingActualImprovedAnalysis ? '✓' : '⚠'}</span>
              {isUsingActualImprovedAnalysis 
                ? 'Improved: Real analysis'
                : 'Improved: Estimated (NOT ANALYZED)'
              }
            </div>
          )}
        </div>
      </div>

      {/* Processing Metadata */}
      {gmmEditorMetadata && (
        <div className="bg-gray-50 dark:bg-[#3A3A3C] rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-[#EBEBF5] mb-3">
            Processing Details
          </h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#8E8E93]">🤖</span>
              <span className="text-gray-600 dark:text-[#EBEBF5]">
                Model: {gmmEditorMetadata.model}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#8E8E93]">⏱️</span>
              <span className="text-gray-600 dark:text-[#EBEBF5]">
                Processing: {(gmmEditorMetadata.processingTime / 1000).toFixed(1)}s
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#8E8E93]">🎭</span>
              <span className="text-gray-600 dark:text-[#EBEBF5]">
                Tone: {gmmEditorMetadata.toneUsed}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 dark:text-[#8E8E93]">📝</span>
              <span className="text-gray-600 dark:text-[#EBEBF5]">
                Length: {gmmEditorMetadata.originalLength} → {gmmEditorMetadata.rewrittenLength}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Before/After Metrics Comparison */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Before Metrics */}
        <div className="space-y-3">
          <div className="text-center">
            <h4 className="text-md font-medium text-gray-700 dark:text-[#EBEBF5] mb-1">
              Before
            </h4>
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
              Original content quality
            </p>
          </div>
          <MetricsDisplay 
            metrics={originalMetrics} 
            className="border-l-4 border-gray-300 dark:border-gray-600 pl-4"
          />
        </div>

        {/* After Metrics */}
        <div className="space-y-3">
          <div className="text-center">
            <h4 className="text-md font-medium text-gray-700 dark:text-[#EBEBF5] mb-1">
              After
            </h4>
            <p className="text-xs text-gray-500 dark:text-[#8E8E93]">
              Improved content quality
            </p>
          </div>
          <MetricsDisplay 
            metrics={calculatedImprovedMetrics}
            previousMetrics={originalMetrics}
            showComparison={true}
            className="border-l-4 border-green-400 dark:border-[#30D158] pl-4"
          />
        </div>
      </div>

      {/* Improvement Summary */}
      {calculatedImprovedMetrics.improvements && calculatedImprovedMetrics.improvements.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-[#30D158]/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-green-800 dark:text-[#30D158] mb-3 flex items-center">
            <span className="mr-2">✨</span>
            Key Improvements Applied
          </h4>
          <ul className="space-y-1">
            {calculatedImprovedMetrics.improvements.map((improvement, index) => (
              <li key={index} className="text-xs text-green-700 dark:text-green-300 flex items-start">
                <span className="mr-2 mt-0.5">•</span>
                <span>{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FixMyMailMetrics;