import { useAppStore } from '../store';

// Error logging function
const logError = (error: Error, errorInfo: { componentStack: string }) => {
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Handler caught an error:', error);
    console.error('Error Info:', errorInfo);
  }
  
  // In production, you would send this to your error tracking service
  // Example: Sentry, LogRocket, Bugsnag, etc.
  // errorTrackingService.captureException(error, { extra: errorInfo });
};

// Hook to trigger error boundary from components
export const useErrorHandler = () => {
  const { setError } = useAppStore();
  
  return {
    handleError: (error: Error, type: 'network' | 'validation' | 'ai' | 'client' | 'server' = 'client') => {
      setError({
        hasError: true,
        errorMessage: error.message,
        errorType: type,
        lastError: error,
      });
      
      // Re-throw to trigger error boundary
      throw error;
    },
    
    handleAsyncError: (error: Error, type: 'network' | 'validation' | 'ai' | 'client' | 'server' = 'client') => {
      setError({
        hasError: true,
        errorMessage: error.message,
        errorType: type,
        lastError: error,
      });
      
      // Don't re-throw for async errors, just log them
      logError(error, { componentStack: '' });
    },
  };
};