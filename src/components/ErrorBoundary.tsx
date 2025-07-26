import React, { useCallback } from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { useAppStore } from '../store';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorDisplay } from './ErrorDisplay';
import { StatePreservation } from '../utils/errorRecovery';

// Enhanced error fallback component with recovery features
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const { handleError, enableFallbackMode, checkSystemHealth } = useErrorHandler();
  const { preserveState, restoreState } = useAppStore();

  // Convert boundary error to structured error
  const structuredError = React.useMemo(() => {
    return handleError(error, { 
      componentStack: 'Error Boundary',
      boundaryError: true 
    });
  }, [error, handleError]);

  const handleReset = useCallback(async () => {
    try {
      // Check system health before reset
      const isHealthy = await checkSystemHealth();
      if (!isHealthy) {
        enableFallbackMode(true);
      }
      
      resetErrorBoundary();
    } catch (resetError) {
      console.error('Reset failed:', resetError);
      window.location.reload();
    }
  }, [resetErrorBoundary, checkSystemHealth, enableFallbackMode]);

  const handleFallbackMode = useCallback(() => {
    enableFallbackMode(true);
    resetErrorBoundary();
  }, [enableFallbackMode, resetErrorBoundary]);

  const handleReload = useCallback(() => {
    // Preserve current state before reload
    const currentState = {
      emailContent: useAppStore.getState().emailContent,
      ui: useAppStore.getState().ui
    };
    
    try {
      localStorage.setItem('email-analysis-recovery', JSON.stringify({
        state: currentState,
        timestamp: Date.now(),
        reason: 'error-boundary-reload'
      }));
    } catch (storageError) {
      console.warn('Could not preserve state before reload:', storageError);
    }
    
    window.location.reload();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-6">
        <ErrorDisplay
          error={structuredError}
          onRetry={async () => {
            await handleReset();
          }}
          className="mb-6"
        />
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleReset}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Try Again
            </button>
            
            <button
              onClick={handleFallbackMode}
              className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
            >
              Safe Mode
            </button>
          </div>
          
          <button
            onClick={handleReload}
            className="w-full bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Reload Page
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">What happened?</h3>
          <p className="text-xs text-blue-700 mb-3">
            The application encountered an unexpected error. Your work has been automatically saved and can be recovered.
          </p>
          <div className="text-xs text-blue-600 space-y-1">
            <p>• <strong>Try Again:</strong> Attempt to recover and continue normally</p>
            <p>• <strong>Safe Mode:</strong> Continue with limited functionality</p>
            <p>• <strong>Reload Page:</strong> Fresh start with state recovery</p>
          </div>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 font-medium">
              Technical Details (Development)
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
              <div className="mb-2">
                <strong>Error:</strong> {error.name}
              </div>
              <div className="mb-2">
                <strong>Message:</strong> {error.message}
              </div>
              <div>
                <strong>Stack:</strong>
                <pre className="mt-1 whitespace-pre-wrap text-red-600 max-h-32 overflow-auto">
                  {error.stack}
                </pre>
              </div>
            </div>
          </details>
        )}
      </div>
    </div>
  );
};

// Enhanced minimal error fallback for smaller components
const MinimalErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const { handleError } = useErrorHandler();

  const structuredError = React.useMemo(() => {
    return handleError(error, { 
      componentStack: 'Component Error Boundary',
      boundaryError: true,
      minimal: true
    });
  }, [error, handleError]);

  return (
    <ErrorDisplay
      error={structuredError}
      onRetry={async () => {
        resetErrorBoundary();
      }}
      compact={true}
      className="my-2"
    />
  );
};

// Enhanced network error fallback
const NetworkErrorFallback: React.FC<FallbackProps & { onRetry?: () => void }> = ({ 
  error,
  resetErrorBoundary,
  onRetry 
}) => {
  const { handleError, checkSystemHealth } = useErrorHandler();

  const structuredError = React.useMemo(() => {
    return handleError(error, { 
      componentStack: 'Network Error Boundary',
      boundaryError: true,
      networkError: true
    });
  }, [error, handleError]);

  const handleRetry = useCallback(async () => {
    try {
      // Check system health before retry
      const isHealthy = await checkSystemHealth();
      if (!isHealthy) {
        throw new Error('System health check failed');
      }
      
      if (onRetry) {
        await onRetry();
      }
      resetErrorBoundary();
    } catch (retryError) {
      console.error('Network retry failed:', retryError);
      // Let the error boundary handle the retry failure
    }
  }, [onRetry, resetErrorBoundary, checkSystemHealth]);

  return (
    <ErrorDisplay
      error={structuredError}
      onRetry={handleRetry}
      className="m-4"
    />
  );
};

// Error logging function
const logError = (error: Error, errorInfo: React.ErrorInfo) => {
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
  }
  
  // In production, you would send this to your error tracking service
  // Example: Sentry, LogRocket, Bugsnag, etc.
  // errorTrackingService.captureException(error, { extra: errorInfo });
};

// Main error boundary wrapper
interface AppErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const AppErrorBoundary: React.FC<AppErrorBoundaryProps> = ({
  children,
  fallback = ErrorFallback,
  onError = logError,
}) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback}
      onError={onError}
      onReset={() => {
        // Clear any error state and reset the app
        // Store integration can be added later
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
};

// Component-level error boundary for smaller sections
interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<FallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const ComponentErrorBoundary: React.FC<ComponentErrorBoundaryProps> = ({
  children,
  fallback = MinimalErrorFallback,
  onError = logError,
}) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={fallback}
      onError={onError}
    >
      {children}
    </ReactErrorBoundary>
  );
};

// Network-specific error boundary
interface NetworkErrorBoundaryProps {
  children: React.ReactNode;
  onRetry?: () => void;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const NetworkErrorBoundary: React.FC<NetworkErrorBoundaryProps> = ({
  children,
  onRetry,
  onError = logError,
}) => {
  return (
    <ReactErrorBoundary
      FallbackComponent={(props) => <NetworkErrorFallback {...props} onRetry={onRetry} />}
      onError={onError}
    >
      {children}
    </ReactErrorBoundary>
  );
};

export default AppErrorBoundary;