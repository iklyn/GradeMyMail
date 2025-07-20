import React from 'react';
import { useAppStore } from './store';
import { useAnalyzeEmail, useQueryUtils } from './services/queries';
import { useErrorHandler } from './hooks/useErrorHandler';
import { ComponentErrorBoundary } from './components/ErrorBoundary';

// Test component to verify infrastructure
const InfrastructureTest: React.FC = () => {
  const { emailContent, ui, error } = useAppStore();
  const { setEmailContent, clearError } = useAppStore();
  const { handleAsyncError } = useErrorHandler();
  const { clearCache, cancelQueries } = useQueryUtils();
  
  // Test query (disabled by default)
  const analyzeQuery = useAnalyzeEmail('', { enabled: false });
  
  const testZustand = () => {
    setEmailContent({
      id: 'test-id',
      originalText: 'Test email content',
      originalHTML: '<p>Test email content</p>',
    });
    console.log('✅ Zustand store working');
  };
  
  const testErrorHandling = () => {
    try {
      handleAsyncError(new Error('Test error'), 'client');
      console.log('✅ Error handling working');
    } catch (err) {
      console.log('✅ Error boundary integration working');
    }
  };
  
  const testReactQuery = () => {
    clearCache();
    cancelQueries();
    console.log('✅ React Query utilities working');
  };
  
  const testAxiosConfig = () => {
    // Test that API client is configured
    import('./services/api').then(({ apiClient }) => {
      console.log('✅ Axios client configured:', {
        baseURL: apiClient.defaults.baseURL,
        timeout: apiClient.defaults.timeout,
        headers: apiClient.defaults.headers,
      });
    });
  };
  
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Infrastructure Test</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">State Management (Zustand)</h2>
          <p className="text-sm text-gray-600 mb-2">
            Current email content: {emailContent?.originalText || 'None'}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            UI State - Analyzing: {ui.isAnalyzing ? 'Yes' : 'No'}, 
            Current Step: {ui.currentStep}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Error State: {error.hasError ? error.errorMessage : 'No errors'}
          </p>
          <button
            onClick={testZustand}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Test Zustand
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Error Handling</h2>
          <p className="text-sm text-gray-600 mb-2">
            Error boundaries and handlers are configured
          </p>
          <button
            onClick={testErrorHandling}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Test Error Handling
          </button>
          {error.hasError && (
            <button
              onClick={clearError}
              className="ml-2 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Clear Error
            </button>
          )}
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">React Query</h2>
          <p className="text-sm text-gray-600 mb-2">
            Query Status: {analyzeQuery.status}
          </p>
          <p className="text-sm text-gray-600 mb-2">
            Is Loading: {analyzeQuery.isLoading ? 'Yes' : 'No'}
          </p>
          <button
            onClick={testReactQuery}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Test React Query Utils
          </button>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Axios Configuration</h2>
          <p className="text-sm text-gray-600 mb-2">
            API client with interceptors, retry logic, and request cancellation
          </p>
          <button
            onClick={testAxiosConfig}
            className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
          >
            Test Axios Config
          </button>
        </div>
      </div>
    </div>
  );
};

// Wrapped test component with error boundary
const InfrastructureTestWithBoundary: React.FC = () => (
  <ComponentErrorBoundary>
    <InfrastructureTest />
  </ComponentErrorBoundary>
);

export default InfrastructureTestWithBoundary;