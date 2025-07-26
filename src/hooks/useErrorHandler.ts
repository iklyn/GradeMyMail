import { useCallback, useRef } from 'react';
import { useAppStore, ErrorType, ErrorSeverity, StructuredError, RecoveryAction } from '../store';
import { apiService } from '../services/api';

// Error classification utility
const classifyError = (error: any): { type: ErrorType; severity: ErrorSeverity } => {
  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ERR_NETWORK') {
    return { type: 'network', severity: 'high' };
  }
  
  // Timeout errors
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return { type: 'timeout', severity: 'medium' };
  }
  
  // AI model errors
  if (error.message?.includes('AI') || error.message?.includes('model') || error.message?.includes('Ollama')) {
    return { type: 'ai', severity: 'high' };
  }
  
  // Storage errors
  if (error.message?.includes('storage') || error.message?.includes('localStorage') || error.message?.includes('sessionStorage')) {
    return { type: 'storage', severity: 'medium' };
  }
  
  // Rate limit errors
  if (error.status === 429 || error.message?.includes('rate limit') || error.message?.includes('too many requests')) {
    return { type: 'rate_limit', severity: 'medium' };
  }
  
  // HTTP status based classification
  if (error.status) {
    if (error.status >= 400 && error.status < 500) {
      return { type: 'client', severity: 'medium' };
    }
    if (error.status >= 500) {
      return { type: 'server', severity: 'high' };
    }
  }
  
  // Validation errors
  if (error.name === 'ValidationError' || error.message?.includes('validation')) {
    return { type: 'validation', severity: 'low' };
  }
  
  // Default classification
  return { type: 'client', severity: 'medium' };
};

// Generate user-friendly messages
const generateUserMessage = (type: ErrorType, originalMessage: string): string => {
  switch (type) {
    case 'network':
      return 'Unable to connect to the server. Please check your internet connection and try again.';
    case 'timeout':
      return 'The request took too long to complete. Please try again with shorter content.';
    case 'ai':
      return 'The AI analysis service is temporarily unavailable. Please try again in a few moments.';
    case 'storage':
      return 'Unable to save your data locally. Please check your browser settings and try again.';
    case 'rate_limit':
      return 'You have made too many requests. Please wait a moment before trying again.';
    case 'validation':
      return 'The provided data is invalid. Please check your input and try again.';
    case 'server':
      return 'The server encountered an error. Please try again later.';
    case 'client':
    default:
      return originalMessage || 'An unexpected error occurred. Please try again.';
  }
};

// Generate recovery suggestions
const generateSuggestions = (type: ErrorType, retryCount: number): string[] => {
  const baseSuggestions: Record<ErrorType, string[]> = {
    network: [
      'Check your internet connection',
      'Try refreshing the page',
      'Disable VPN or proxy if enabled',
      'Contact support if the problem persists'
    ],
    timeout: [
      'Try with shorter content',
      'Check your internet connection speed',
      'Try again in a few moments',
      'Break large content into smaller parts'
    ],
    ai: [
      'Wait a few minutes and try again',
      'Check if the AI service is running',
      'Try with simpler content',
      'Contact support if the issue persists'
    ],
    storage: [
      'Clear your browser cache',
      'Check available storage space',
      'Try in an incognito/private window',
      'Enable cookies and local storage'
    ],
    rate_limit: [
      'Wait before making additional requests',
      'Reduce the frequency of your requests',
      'Try again in a few minutes',
      'Consider upgrading your plan'
    ],
    validation: [
      'Check your input data format',
      'Ensure all required fields are provided',
      'Verify data types match expected values',
      'Remove any special characters'
    ],
    server: [
      'Try the operation again in a few minutes',
      'Check system status page for outages',
      'Contact support if the problem persists',
      'Try with different content'
    ],
    client: [
      'Refresh the page and try again',
      'Clear your browser cache',
      'Try in a different browser',
      'Contact support for assistance'
    ]
  };
  
  const suggestions = baseSuggestions[type] || baseSuggestions.client;
  
  // Add retry-specific suggestions
  if (retryCount > 0) {
    suggestions.unshift(`This is retry attempt ${retryCount + 1}`);
  }
  
  if (retryCount >= 3) {
    suggestions.push('Consider contacting support as this issue is persistent');
  }
  
  return suggestions;
};

// Generate recovery actions
const generateRecoveryActions = (
  type: ErrorType, 
  error: any,
  retryCallback?: () => Promise<void>,
  fallbackCallback?: () => void
): RecoveryAction[] => {
  const actions: RecoveryAction[] = [];
  
  // Retry action for retryable errors
  if (['network', 'timeout', 'ai', 'server'].includes(type) && retryCallback) {
    actions.push({
      id: 'retry',
      label: 'Try Again',
      description: 'Retry the failed operation',
      action: retryCallback,
      primary: true
    });
  }
  
  // Refresh page action
  actions.push({
    id: 'refresh',
    label: 'Refresh Page',
    description: 'Reload the page to reset the application state',
    action: () => window.location.reload()
  });
  
  // Fallback mode for certain errors
  if (['ai', 'server'].includes(type) && fallbackCallback) {
    actions.push({
      id: 'fallback',
      label: 'Use Offline Mode',
      description: 'Continue with limited functionality',
      action: fallbackCallback
    });
  }
  
  // Clear data action for storage errors
  if (type === 'storage') {
    actions.push({
      id: 'clear-storage',
      label: 'Clear Storage',
      description: 'Clear browser storage and restart',
      action: () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
      }
    });
  }
  
  // Go back action
  actions.push({
    id: 'go-back',
    label: 'Go Back',
    description: 'Return to the previous page',
    action: () => window.history.back()
  });
  
  return actions;
};

// Error logging function with structured data
const logError = (error: StructuredError, context?: Record<string, any>) => {
  const logData = {
    id: error.id,
    type: error.type,
    severity: error.severity,
    message: error.technicalMessage,
    timestamp: error.timestamp.toISOString(),
    context: { ...error.context, ...context },
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  // In development, log to console
  if (process.env.NODE_ENV === 'development') {
    console.group(`🚨 Error [${error.severity.toUpperCase()}]: ${error.type}`);
    console.error('Error Details:', logData);
    console.error('Original Error:', error);
    console.groupEnd();
  }
  
  // In production, send to error tracking service
  // Example: Sentry, LogRocket, Bugsnag, etc.
  // errorTrackingService.captureException(error, { extra: logData });
};

// Enhanced error handler hook
export const useErrorHandler = () => {
  const { 
    addError, 
    removeError, 
    clearAllErrors, 
    incrementRetryCount, 
    resetRetryCount,
    setRecovering,
    setFallbackMode,
    preserveState,
    restoreState,
    error: errorState
  } = useAppStore();
  
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  // Handle errors with full classification and recovery
  const handleError = useCallback((
    error: any,
    context?: Record<string, any>,
    retryCallback?: () => Promise<void>,
    fallbackCallback?: () => void
  ) => {
    const { type, severity } = classifyError(error);
    const userMessage = generateUserMessage(type, error.message);
    const suggestions = generateSuggestions(type, errorState.retryCount);
    const recoveryActions = generateRecoveryActions(type, error, retryCallback, fallbackCallback);
    
    const structuredError: Omit<StructuredError, 'id' | 'timestamp'> = {
      type,
      severity,
      message: error.message || 'Unknown error',
      userMessage,
      technicalMessage: error.stack || error.message || 'Unknown error',
      retryable: ['network', 'timeout', 'ai', 'server'].includes(type),
      suggestions,
      context: {
        originalError: error.name,
        stack: error.stack,
        ...context
      },
      recoveryActions
    };
    
    addError(structuredError);
    logError({ ...structuredError, id: '', timestamp: new Date() }, context);
    
    return structuredError;
  }, [addError, errorState.retryCount]);
  
  // Handle async errors without throwing
  const handleAsyncError = useCallback((
    error: any,
    context?: Record<string, any>,
    retryCallback?: () => Promise<void>,
    fallbackCallback?: () => void
  ) => {
    return handleError(error, context, retryCallback, fallbackCallback);
  }, [handleError]);
  
  // Retry with exponential backoff
  const retryWithBackoff = useCallback(async (
    operation: () => Promise<void>,
    errorId: string,
    maxRetries = 3
  ) => {
    if (errorState.retryCount >= maxRetries) {
      return false;
    }
    
    incrementRetryCount();
    setRecovering(true, 0);
    
    // Calculate delay with exponential backoff
    const delay = Math.min(1000 * Math.pow(2, errorState.retryCount), 10000);
    
    try {
      // Show progress during delay
      const progressInterval = setInterval(() => {
        setRecovering(true, Math.min(((Date.now() - startTime) / delay) * 100, 100));
      }, 100);
      
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, delay));
      clearInterval(progressInterval);
      
      setRecovering(true, 100);
      await operation();
      
      // Success - clear error and reset retry count
      removeError(errorId);
      resetRetryCount();
      setRecovering(false, 0);
      
      return true;
    } catch (retryError) {
      setRecovering(false, 0);
      handleAsyncError(retryError, { isRetry: true, originalErrorId: errorId });
      return false;
    }
  }, [errorState.retryCount, incrementRetryCount, setRecovering, removeError, resetRetryCount, handleAsyncError]);
  
  // Enable fallback mode with graceful degradation
  const enableFallbackMode = useCallback((preserveCurrentState = true) => {
    if (preserveCurrentState) {
      const currentState = {
        emailContent: useAppStore.getState().emailContent,
        ui: useAppStore.getState().ui
      };
      preserveState(currentState);
    }
    
    setFallbackMode(true);
    clearAllErrors();
  }, [setFallbackMode, preserveState, clearAllErrors]);
  
  // Disable fallback mode and restore state
  const disableFallbackMode = useCallback(() => {
    const preserved = restoreState();
    setFallbackMode(false);
    
    return preserved;
  }, [setFallbackMode, restoreState]);
  
  // Clear specific error
  const clearError = useCallback((errorId: string) => {
    removeError(errorId);
    
    // Clear any pending retry timeouts
    const timeout = retryTimeouts.current.get(errorId);
    if (timeout) {
      clearTimeout(timeout);
      retryTimeouts.current.delete(errorId);
    }
  }, [removeError]);
  
  // Clear all errors
  const clearAllErrorsHandler = useCallback(() => {
    clearAllErrors();
    resetRetryCount();
    setRecovering(false, 0);
    
    // Clear all retry timeouts
    retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
    retryTimeouts.current.clear();
  }, [clearAllErrors, resetRetryCount, setRecovering]);
  
  // Check if system is healthy
  const checkSystemHealth = useCallback(async () => {
    try {
      const isHealthy = await apiService.checkAPIHealth?.();
      return isHealthy ?? true;
    } catch {
      return false;
    }
  }, []);
  
  return {
    handleError,
    handleAsyncError,
    retryWithBackoff,
    enableFallbackMode,
    disableFallbackMode,
    clearError,
    clearAllErrors: clearAllErrorsHandler,
    checkSystemHealth,
    errorState
  };
};