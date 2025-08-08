import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalysisLoadingScreenProps {
  isVisible: boolean;
  analysisType: 'grading' | 'fixing' | 'processing';
  progress?: number;
  currentStep?: string;
  onComplete?: () => void;
}

const analysisSteps = {
  grading: [
    { step: 'Parsing content structure', icon: '📝' },
    { step: 'Analyzing readability', icon: '👁️' },
    { step: 'Detecting spam indicators', icon: '🚫' },
    { step: 'Identifying fluff content', icon: '✂️' },
    { step: 'Generating highlights', icon: '🎨' }
  ],
  fixing: [
    { step: 'Processing tagged content', icon: '🏷️' },
    { step: 'Generating improvements', icon: '✨' },
    { step: 'Optimizing sentence structure', icon: '🔧' },
    { step: 'Enhancing clarity', icon: '💡' },
    { step: 'Finalizing suggestions', icon: '✅' }
  ],
  processing: [
    { step: 'Loading content', icon: '📄' },
    { step: 'Preparing analysis', icon: '⚙️' },
    { step: 'Initializing models', icon: '🤖' },
    { step: 'Processing request', icon: '⚡' },
    { step: 'Completing operation', icon: '🎯' }
  ]
};

const analysisMessages = {
  grading: [
    "Analyzing your email for clarity and engagement...",
    "Scanning for common writing issues...",
    "Evaluating readability and tone...",
    "Identifying areas for improvement..."
  ],
  fixing: [
    "Crafting improved alternatives...",
    "Optimizing sentence structure...",
    "Enhancing clarity and flow...",
    "Polishing your content..."
  ],
  processing: [
    "Processing your request...",
    "Preparing your content...",
    "Almost ready...",
    "Finalizing results..."
  ]
};

export const AnalysisLoadingScreen: React.FC<AnalysisLoadingScreenProps> = ({
  isVisible,
  analysisType,
  progress = 0,
  currentStep,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

  const steps = analysisSteps[analysisType];
  const messages = analysisMessages[analysisType];

  useEffect(() => {
    if (!isVisible) return;

    // Auto-advance steps based on progress
    const stepProgress = Math.floor((progress / 100) * steps.length);
    setCurrentStepIndex(Math.min(stepProgress, steps.length - 1));

    // Rotate messages
    const messageInterval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, [isVisible, progress, steps.length, messages.length]);

  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }
  }, [progress, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="analysis-loading-title"
          aria-describedby="analysis-loading-description"
        >
          <div className="max-w-lg w-full mx-4">
            {/* Main Content Card */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center"
            >
              {/* Animated Icon */}
              <motion.div
                className="mb-6"
                animate={{ 
                  rotate: [0, 5, -5, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ 
                  duration: 3,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-3xl shadow-lg">
                  {analysisType === 'grading' ? '📊' : analysisType === 'fixing' ? '🔧' : '⚡'}
                </div>
              </motion.div>

              {/* Progress Ring */}
              <div className="relative w-32 h-32 mx-auto mb-6">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <motion.circle
                    cx="60"
                    cy="60"
                    r="50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="text-blue-500"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: progress / 100 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{
                      strokeDasharray: '314.16',
                      strokeDashoffset: '314.16'
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    {Math.round(progress)}%
                  </span>
                </div>
              </div>

              {/* Current Message */}
              <motion.div
                key={currentMessageIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mb-6"
              >
                <h2
                  id="analysis-loading-title"
                  className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
                >
                  {currentStep || messages[currentMessageIndex]}
                </h2>
              </motion.div>

              {/* Step Indicators */}
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ 
                      opacity: index <= currentStepIndex ? 1 : 0.4,
                      x: 0
                    }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                      index === currentStepIndex
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                        : index < currentStepIndex
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-gray-50 dark:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex-shrink-0 text-lg">
                      {index < currentStepIndex ? '✅' : 
                       index === currentStepIndex ? (
                         <motion.span
                           animate={{ rotate: 360 }}
                           transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                         >
                           ⚡
                         </motion.span>
                       ) : step.icon}
                    </div>
                    <span className={`text-sm font-medium ${
                      index <= currentStepIndex
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {step.step}
                    </span>
                    {index === currentStepIndex && (
                      <motion.div
                        className="ml-auto"
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      >
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Screen Reader Announcements */}
            <div
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
              id="analysis-loading-description"
            >
              {currentStep || messages[currentMessageIndex]} - {Math.round(progress)}% complete.
              Currently on step: {steps[currentStepIndex]?.step}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnalysisLoadingScreen;