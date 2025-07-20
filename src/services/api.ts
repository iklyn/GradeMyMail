import axios, { type AxiosInstance, type AxiosResponse, type AxiosError } from 'axios';

// API response interfaces
export interface AnalyzeResponse {
  message: {
    content: string; // Tagged content with XML-style markers
  };
}

export interface FixResponse {
  message: {
    content: string; // Improved pairs in old_draft/optimized_draft format
  };
}

export interface StoreResponse {
  id: string; // UUID for temporary storage
}

export interface LoadResponse {
  payload: {
    fullOriginalText: string;
    fullOriginalHTML: string;
    taggedContent: string;
  };
}

// Error types for classification
export type APIErrorType = 'network' | 'validation' | 'ai' | 'client' | 'server';

export class APIError extends Error {
  public type: APIErrorType;
  public status?: number;
  public originalError?: Error;

  constructor(message: string, type: APIErrorType, status?: number, originalError?: Error) {
    super(message);
    this.name = 'APIError';
    this.type = type;
    this.status = status;
    this.originalError = originalError;
  }
}

// Retry configuration
interface RetryConfig {
  retries: number;
  retryDelay: number;
  retryCondition: (error: AxiosError) => boolean;
}

const defaultRetryConfig: RetryConfig = {
  retries: 3,
  retryDelay: 1000, // Base delay in ms
  retryCondition: (error: AxiosError) => {
    // Retry on network errors or 5xx server errors
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  },
};

// Request cancellation manager
class RequestCancellationManager {
  private controllers = new Map<string, AbortController>();

  createController(key: string): AbortController {
    // Cancel existing request with the same key
    this.cancelRequest(key);
    
    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller;
  }

  cancelRequest(key: string): void {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  cancelAllRequests(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.controllers.clear();
  }

  cleanup(key: string): void {
    this.controllers.delete(key);
  }
}

// Create request cancellation manager instance
export const requestManager = new RequestCancellationManager();

// Exponential backoff delay calculation
const calculateRetryDelay = (retryCount: number, baseDelay: number): number => {
  return Math.min(baseDelay * Math.pow(2, retryCount), 10000); // Max 10 seconds
};

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));

// Retry logic implementation
const withRetry = async <T>(
  fn: () => Promise<T>,
  config: RetryConfig = defaultRetryConfig
): Promise<T> => {
  let lastError: AxiosError | undefined;
  
  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as AxiosError;
      
      // Don't retry if it's the last attempt or retry condition is not met
      if (attempt === config.retries || !config.retryCondition(lastError)) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = calculateRetryDelay(attempt, config.retryDelay);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error('Unknown error occurred during retry');
};

// Create axios instance with base configuration
const createAPIClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api',
    timeout: 30000, // 30 seconds timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor
  client.interceptors.request.use(
    (config) => {
      // Add timestamp to prevent caching
      config.params = {
        ...config.params,
        _t: Date.now(),
      };
      
      // Log request in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
      }
      
      return config;
    },
    (error) => {
      console.error('❌ Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log successful response in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ API Response: ${response.status} ${response.config.url}`);
      }
      
      return response;
    },
    (error: AxiosError) => {
      // Log error in development
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ API Error: ${error.response?.status} ${error.config?.url}`, error.message);
      }
      
      // Transform axios error to our custom APIError
      const apiError = transformAxiosError(error);
      return Promise.reject(apiError);
    }
  );

  return client;
};

// Transform axios error to APIError
const transformAxiosError = (error: AxiosError): APIError => {
  if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
    return new APIError('Request timeout. Please try again.', 'network', undefined, error);
  }
  
  if (error.code === 'ERR_NETWORK' || !error.response) {
    return new APIError('Network error. Please check your connection.', 'network', undefined, error);
  }
  
  const status = error.response.status;
  const message = (error.response.data as { message?: string })?.message || error.message;
  
  if (status >= 400 && status < 500) {
    if (status === 400) {
      return new APIError(message || 'Invalid request data.', 'validation', status, error);
    }
    return new APIError(message || 'Client error occurred.', 'client', status, error);
  }
  
  if (status >= 500) {
    return new APIError(message || 'Server error occurred.', 'server', status, error);
  }
  
  return new APIError(message || 'An unexpected error occurred.', 'client', status, error);
};

// Create API client instance
export const apiClient = createAPIClient();

// API service functions
export const apiService = {
  // Analyze email content
  async analyzeEmail(content: string, requestKey = 'analyze'): Promise<AnalyzeResponse> {
    const controller = requestManager.createController(requestKey);
    
    try {
      const response = await withRetry(
        () => apiClient.post<AnalyzeResponse>(
          '/analyze',
          { message: content },
          { signal: controller.signal }
        )
      );
      
      requestManager.cleanup(requestKey);
      return response.data;
    } catch (error) {
      requestManager.cleanup(requestKey);
      throw error;
    }
  },

  // Fix tagged content
  async fixEmail(taggedContent: string, requestKey = 'fix'): Promise<FixResponse> {
    const controller = requestManager.createController(requestKey);
    
    try {
      const response = await withRetry(
        () => apiClient.post<FixResponse>(
          '/fix',
          { message: taggedContent },
          { signal: controller.signal }
        )
      );
      
      requestManager.cleanup(requestKey);
      return response.data;
    } catch (error) {
      requestManager.cleanup(requestKey);
      throw error;
    }
  },

  // Store temporary data
  async storeData(payload: {
    fullOriginalText: string;
    fullOriginalHTML: string;
    taggedContent: string;
  }, requestKey = 'store'): Promise<StoreResponse> {
    const controller = requestManager.createController(requestKey);
    
    try {
      const response = await withRetry(
        () => apiClient.post<StoreResponse>(
          '/store',
          { payload },
          { signal: controller.signal }
        )
      );
      
      requestManager.cleanup(requestKey);
      return response.data;
    } catch (error) {
      requestManager.cleanup(requestKey);
      throw error;
    }
  },

  // Load stored data
  async loadData(id: string, requestKey = 'load'): Promise<LoadResponse> {
    const controller = requestManager.createController(requestKey);
    
    try {
      const response = await withRetry(
        () => apiClient.get<LoadResponse>(
          `/load?id=${id}`,
          { signal: controller.signal }
        )
      );
      
      requestManager.cleanup(requestKey);
      return response.data;
    } catch (error) {
      requestManager.cleanup(requestKey);
      throw error;
    }
  },

  // Cancel specific request
  cancelRequest: (key: string) => requestManager.cancelRequest(key),
  
  // Cancel all requests
  cancelAllRequests: () => requestManager.cancelAllRequests(),
};

// Health check utility
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
};