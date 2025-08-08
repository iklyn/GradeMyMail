import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingScreenProps {
  isVisible: boolean;
  type?: 'analysis' | 'improvement' | 'general' | 'navigation';
  progress?: number;
  onComplete?: () => void;
}

const emailTips = [
  "Keep your subject line under 50 characters for better open rates",
  "Use active voice to make your emails more engaging",
  "Break up long paragraphs into shorter, scannable chunks",
  "Include a clear call-to-action in every email",
  "Personalize your greeting to build stronger connections",
  "Avoid spam trigger words like 'FREE' and 'URGENT'",
  "Use bullet points to highlight key information",
  "Keep your tone consistent with your brand voice",
  "Test your emails on mobile devices before sending",
  "Include your contact information in every email"
];

const analysisMessages = [
  "Analyzing your email content...",
  "Identifying areas for improvement...",
  "Checking for clarity and engagement...",
  "Scanning for common email issues..."
];

const improvementMessages = [
  "Generating improved alternatives...",
  "Crafting better sentences...",
  "Optimizing for engagement...",
  "Polishing your content..."
];

const generalMessages = [
  "Processing your request...",
  "Loading your content...",
  "Preparing your workspace...",
  "Almost ready..."
];

const navigationMessages = [
  "Navigating to your destination...",
  "Preparing your content...",
  "Loading your workspace...",
  "Almost there..."
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  isVisible,
  type = 'general',
  progress = 0,
  onComplete
}) => {
  const [currentTip, setCurrentTip] = useState(0);
  const [currentMessage, setCurrentMessage] = useState(0);

  const messages = type === 'analysis' ? analysisMessages 
    : type === 'improvement' ? improvementMessages 
    : type === 'navigation' ? navigationMessages
    : generalMessages;

  useEffect(() => {
    if (!isVisible) return;

    const tipInterval = setInterval(() => {
      setCurrentTip((prev) => (prev + 1) % emailTips.length);
    }, 3000);

    const messageInterval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % messages.length);
    }, 2000);

    return () => {
      clearInterval(tipInterval);
      clearInterval(messageInterval);
    };
  }, [isVisible, messages.length]);

  useEffect(() => {
    if (progress >= 100 && onComplete) {
      const timer = setTimeout(onComplete, 500);
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
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="loading-title"
          aria-describedby="loading-description"
        >
          <div className="max-w-md w-full mx-4 text-center">
            {/* Loading Animation */}
            <motion.div
              className="mb-8"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div className="relative w-24 h-24 mx-auto mb-6">
                <motion.div
                  className="absolute inset-0 border-4 border-blue-200 dark:border-blue-800 rounded-full"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute inset-2 border-4 border-blue-500 border-t-transparent rounded-full"
                  initial={{ rotate: 0 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute inset-4 bg-blue-500 rounded-full flex items-center justify-center"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </motion.div>
              </div>

              {/* Progress Bar */}
              {progress > 0 && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
                  <motion.div
                    className="bg-blue-500 h-2 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              )}
            </motion.div>

            {/* Loading Message */}
            <motion.div
              key={currentMessage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <h2
                id="loading-title"
                className="text-xl font-semibold text-gray-900 dark:text-white mb-2"
              >
                {messages[currentMessage]}
              </h2>
              {progress > 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {progress}% complete
                </p>
              )}
            </motion.div>

            {/* Rotating Tips */}
            <motion.div
              className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-5 h-5 text-blue-500 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                    Email Writing Tip
                  </h3>
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={currentTip}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-blue-800 dark:text-blue-200"
                      id="loading-description"
                    >
                      {emailTips[currentTip]}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>

            {/* Screen Reader Announcements */}
            <div
              className="sr-only"
              aria-live="polite"
              aria-atomic="true"
            >
              {messages[currentMessage]}
              {progress > 0 && ` ${progress}% complete`}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LoadingScreen;