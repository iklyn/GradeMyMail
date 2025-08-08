import React, { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useLoadingState } from '../hooks/useLoadingState';
import type { LoadingType } from '../hooks/useLoadingState';
import { LoadingScreen } from '../components/LoadingScreen/LoadingScreen';
import { AnalysisLoadingScreen } from '../components/LoadingScreen/AnalysisLoadingScreen';

interface LoadingContextType {
  startLoading: (type: LoadingType, message?: string) => void;
  startAnalysisLoading: (analysisType: 'grading' | 'fixing' | 'processing', currentStep?: string) => void;
  updateProgress: (progress: number) => void;
  setMessage: (message: string) => void;
  stopLoading: () => void;
  simulateProgress: (duration?: number) => void;
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const {
    loadingState,
    startLoading,
    updateProgress,
    setMessage,
    stopLoading,
    simulateProgress
  } = useLoadingState();

  const [analysisState, setAnalysisState] = React.useState<{
    isVisible: boolean;
    type: 'grading' | 'fixing' | 'processing';
    currentStep?: string;
  }>({
    isVisible: false,
    type: 'processing'
  });

  const startAnalysisLoading = React.useCallback((
    analysisType: 'grading' | 'fixing' | 'processing',
    currentStep?: string
  ) => {
    setAnalysisState({
      isVisible: true,
      type: analysisType,
      currentStep
    });
    startLoading('analysis');
  }, [startLoading]);

  const handleStopLoading = React.useCallback(() => {
    stopLoading();
    setAnalysisState(prev => ({ ...prev, isVisible: false }));
  }, [stopLoading]);

  const contextValue: LoadingContextType = {
    startLoading,
    startAnalysisLoading,
    updateProgress,
    setMessage,
    stopLoading: handleStopLoading,
    simulateProgress,
    isLoading: loadingState.isLoading
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      
      {/* General Loading Screen */}
      <LoadingScreen
        isVisible={loadingState.isLoading && !analysisState.isVisible}
        type={loadingState.type}
        progress={loadingState.progress}
        onComplete={handleStopLoading}
      />

      {/* Analysis Loading Screen */}
      <AnalysisLoadingScreen
        isVisible={analysisState.isVisible}
        analysisType={analysisState.type}
        progress={loadingState.progress}
        currentStep={analysisState.currentStep}
        onComplete={handleStopLoading}
      />
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export default LoadingProvider;