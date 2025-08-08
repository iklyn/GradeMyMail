import { useState, useCallback, useRef, useEffect } from 'react';

export type LoadingType = 'analysis' | 'improvement' | 'general' | 'navigation';

interface LoadingState {
  isLoading: boolean;
  type: LoadingType;
  progress: number;
  message?: string;
}

interface UseLoadingStateReturn {
  loadingState: LoadingState;
  startLoading: (type: LoadingType, message?: string) => void;
  updateProgress: (progress: number) => void;
  setMessage: (message: string) => void;
  stopLoading: () => void;
  simulateProgress: (duration?: number) => void;
}

export const useLoadingState = (): UseLoadingStateReturn => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
    type: 'general',
    progress: 0,
    message: undefined
  });

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const startLoading = useCallback((type: LoadingType, message?: string) => {
    setLoadingState({
      isLoading: true,
      type,
      progress: 0,
      message
    });
  }, []);

  const updateProgress = useCallback((progress: number) => {
    setLoadingState(prev => ({
      ...prev,
      progress: Math.min(100, Math.max(0, progress))
    }));
  }, []);

  const setMessage = useCallback((message: string) => {
    setLoadingState(prev => ({
      ...prev,
      message
    }));
  }, []);

  const stopLoading = useCallback(() => {
    // Clear any running intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
      progressTimeoutRef.current = null;
    }

    setLoadingState({
      isLoading: false,
      type: 'general',
      progress: 0,
      message: undefined
    });
  }, []);

  const simulateProgress = useCallback((duration: number = 3000) => {
    // Clear any existing intervals
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    if (progressTimeoutRef.current) {
      clearTimeout(progressTimeoutRef.current);
    }

    let currentProgress = 0;
    const increment = 100 / (duration / 100); // Update every 100ms

    progressIntervalRef.current = setInterval(() => {
      currentProgress += increment;
      
      if (currentProgress >= 100) {
        updateProgress(100);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      } else {
        // Add some randomness to make it feel more natural
        const randomizedProgress = currentProgress + (Math.random() - 0.5) * 5;
        updateProgress(Math.min(95, Math.max(0, randomizedProgress)));
      }
    }, 100);

    // Ensure we reach 100% after the specified duration
    progressTimeoutRef.current = setTimeout(() => {
      updateProgress(100);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }, duration);
  }, [updateProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (progressTimeoutRef.current) {
        clearTimeout(progressTimeoutRef.current);
      }
    };
  }, []);

  return {
    loadingState,
    startLoading,
    updateProgress,
    setMessage,
    stopLoading,
    simulateProgress
  };
};

export default useLoadingState;