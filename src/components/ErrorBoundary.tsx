import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, type FallbackProps } from 'react-error-boundary';
// import { useAppStore } from '../store';

// Error fallback component for general errors
const ErrorFallback: React.FC<FallbackProps> = ({ error, resetErrorBoundary }) => {
  const handleReset = () => {
    resetErrorBoundary();
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="mb-4">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg
              className="h-6 w-6 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
        </div>
        
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Something went wrong
        </h2>
        
        <p className="text-sm text-gray-600 mb-6">
          We encountered an unexpected error. Don't worry, your work is safe.
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Error details (development only)
            </summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-32">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleReset}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            Try Again
          </button>
          
          <button
            onClick={handleReload}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            Reload Page
          </button>
        </div>
        
        <p className="mt-4 text-xs text-gray-500">
          If this problem persists, please refresh the page or contact support.
        </p>
      </div>
    </div>
  );
};

// Minimal error fallback for smaller components
const MinimalErrorFallback: React.FC<FallbackProps> = ({ resetErrorBoundary }) => {
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Component Error
          </h3>
          <p className="mt-1 text-sm text-red-700">
            This component encountered an error and couldn't render properly.
          </p>
        </div>
        <div className="ml-3">
          <button
            onClick={resetErrorBoundary}
            className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
};

// Network error fallback
const NetworkErrorFallback: React.FC<FallbackProps & { onRetry?: () => void }> = ({ 
  resetErrorBoundary,
  onRetry 
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    }
    resetErrorBoundary();
  };

  return (
    <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Connection Problem
          </h3>
          <p className="mt-1 text-sm text-yellow-700">
            We're having trouble connecting to our servers. Please check your internet connection and try again.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleRetry}
          className="bg-yellow-100 text-yellow-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
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