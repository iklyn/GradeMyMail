import React from 'react';

export interface NewsletterMetrics {
  overallGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  clarity: number;      // 0-100
  engagement: number;   // 0-100
  tone: number;         // 0-100
  wordCount?: number;
  readingTime?: number;
}

export interface MetricsDisplayProps {
  metrics: NewsletterMetrics;
  previousMetrics?: NewsletterMetrics;
  showComparison?: boolean;
  className?: string;
}

// Helper function to get grade color
const getGradeColor = (grade: string): string => {
  switch (grade) {
    case 'A': return 'text-green-600';
    case 'B': return 'text-blue-600';
    case 'C': return 'text-yellow-600';
    case 'D': return 'text-orange-600';
    case 'F': return 'text-red-600';
    default: return 'text-gray-600';
  }
};

// Helper function to get grade background color
const getGradeBgColor = (grade: string): string => {
  switch (grade) {
    case 'A': return 'bg-green-50 border-green-200';
    case 'B': return 'bg-blue-50 border-blue-200';
    case 'C': return 'bg-yellow-50 border-yellow-200';
    case 'D': return 'bg-orange-50 border-orange-200';
    case 'F': return 'bg-red-50 border-red-200';
    default: return 'bg-gray-50 border-gray-200';
  }
};

// Helper function to convert score to grade
const scoreToGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
};

// Helper function to get metric color based on score
const getMetricColor = (score: number): string => {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

// Progress bar component
const ProgressBar: React.FC<{ 
  score: number; 
  previousScore?: number; 
  showComparison?: boolean;
  color: string;
}> = ({ score, previousScore, showComparison, color }) => {
  const improvement = previousScore ? score - previousScore : 0;
  
  return (
    <div className="relative">
      <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
        />
      </div>
      
      {showComparison && previousScore !== undefined && improvement !== 0 && (
        <div className="absolute -top-6 right-0 text-xs font-medium">
          <span className={improvement > 0 ? 'text-green-600' : 'text-red-600'}>
            {improvement > 0 ? '+' : ''}{improvement.toFixed(0)}
          </span>
        </div>
      )}
    </div>
  );
};

// Individual metric component
const MetricItem: React.FC<{
  label: string;
  score: number;
  previousScore?: number;
  showComparison?: boolean;
  icon: string;
}> = ({ label, score, previousScore, showComparison, icon }) => {
  const colorClass = getMetricColor(score);
  const bgColorClass = score >= 80 ? 'bg-green-100' : score >= 60 ? 'bg-yellow-100' : 'bg-red-100';
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className={`text-lg font-semibold ${colorClass}`}>
            {score}
          </span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      
      <ProgressBar 
        score={score} 
        previousScore={previousScore}
        showComparison={showComparison}
        color={bgColorClass}
      />
    </div>
  );
};

const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  metrics,
  previousMetrics,
  showComparison = false,
  className = '',
}) => {
  const averageScore = Math.round((metrics.clarity + metrics.engagement + metrics.tone) / 3);
  const calculatedGrade = scoreToGrade(averageScore);
  const displayGrade = metrics.overallGrade || calculatedGrade;
  
  const previousAverageScore = previousMetrics 
    ? Math.round((previousMetrics.clarity + previousMetrics.engagement + previousMetrics.tone) / 3)
    : undefined;
  
  const gradeImprovement = previousMetrics && previousAverageScore 
    ? averageScore - previousAverageScore 
    : 0;

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 space-y-6 ${className}`}>
      {/* Overall Grade Section */}
      <div className="text-center">
        <div className="flex items-center justify-center space-x-4">
          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full border-2 ${getGradeBgColor(displayGrade)}`}>
            <span className={`text-2xl font-bold ${getGradeColor(displayGrade)}`}>
              {displayGrade}
            </span>
          </div>
          
          {showComparison && previousMetrics && gradeImprovement !== 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-gray-400">→</span>
              <div className="flex items-center space-x-1">
                <span className={gradeImprovement > 0 ? 'text-green-600' : 'text-red-600'}>
                  {gradeImprovement > 0 ? '↗' : '↘'}
                </span>
                <span className="text-sm font-medium text-gray-600">
                  {Math.abs(gradeImprovement)} pts
                </span>
              </div>
            </div>
          )}
        </div>
        
        <div className="mt-2">
          <div className="text-lg font-semibold text-gray-900">Overall Score</div>
          <div className="text-sm text-gray-500">{averageScore}/100</div>
        </div>
      </div>

      {/* Individual Metrics */}
      <div className="space-y-4">
        <MetricItem
          label="Clarity"
          score={metrics.clarity}
          previousScore={showComparison ? previousMetrics?.clarity : undefined}
          showComparison={showComparison}
          icon="🎯"
        />
        
        <MetricItem
          label="Engagement"
          score={metrics.engagement}
          previousScore={showComparison ? previousMetrics?.engagement : undefined}
          showComparison={showComparison}
          icon="⚡"
        />
        
        <MetricItem
          label="Tone"
          score={metrics.tone}
          previousScore={showComparison ? previousMetrics?.tone : undefined}
          showComparison={showComparison}
          icon="🎭"
        />
      </div>

      {/* Additional Stats */}
      {(metrics.wordCount || metrics.readingTime) && (
        <div className="pt-4 border-t border-gray-100">
          <div className="flex justify-center space-x-6 text-sm text-gray-500">
            {metrics.wordCount && (
              <div className="flex items-center space-x-1">
                <span>📝</span>
                <span>{metrics.wordCount} words</span>
              </div>
            )}
            {metrics.readingTime && (
              <div className="flex items-center space-x-1">
                <span>⏱️</span>
                <span>{metrics.readingTime} min read</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricsDisplay;