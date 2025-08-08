import { Agent } from 'http';
import axios, { AxiosInstance } from 'axios';
import { withRetry, RETRY_CONFIGS, circuitBreakers } from './retry-logic.js';
import { AIModelError, NetworkError, TimeoutError } from './error-handler.js';
import { metricsCollector, logPerformance } from './monitoring.js';
import { AIModelLoadBalancer } from './load-balancer.js';
import { MultiLevelCache } from './caching-system.js';

// Types for AI model communication
interface OllamaRequest {
  model: string;
  prompt: string;
  stream: boolean;
}

interface OllamaResponse {
  response: string;
  done: boolean;
}

interface CacheEntry {
  data: string;
  timestamp: number;
  ttl: number;
}

interface BatchRequest {
  id: string;
  content: string;
  resolve: (result: string) => void;
  reject: (error: Error) => void;
}

// Configuration for AI models
const AI_CONFIG = {
  GMM_MODEL: 'GMM',
  FMM_MODEL: 'FMM',
  GMM_PORT: 11434,
  FMM_PORT: 11435,
  TIMEOUT: 30000, // 30 seconds
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  BATCH_SIZE: 5,
  BATCH_TIMEOUT: 1000, // 1 second
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
};

class AIModelCommunicator {
  private gmmClient: AxiosInstance;
  private fmmClient: AxiosInstance;
  private cache: Map<string, CacheEntry> = new Map();
  private batchQueue: BatchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private connectionPool: Agent;
  private gmmLoadBalancer: AIModelLoadBalancer;
  private fmmLoadBalancer: AIModelLoadBalancer;
  private multiLevelCache: MultiLevelCache;

  constructor() {
    // Create HTTP agent with connection pooling and keep-alive
    this.connectionPool = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000, // 30 seconds
      maxSockets: 20, // Increased for load balancing
      maxFreeSockets: 10, // Increased for load balancing
      timeout: AI_CONFIG.TIMEOUT,
    });

    // Create Axios instances with optimized configuration
    this.gmmClient = this.createAxiosInstance(AI_CONFIG.GMM_PORT);
    this.fmmClient = this.createAxiosInstance(AI_CONFIG.FMM_PORT);

    // Initialize load balancers
    this.gmmLoadBalancer = new AIModelLoadBalancer({
      strategy: 'least-connections',
      healthCheckInterval: 30000,
      maxRetries: 3,
    });

    this.fmmLoadBalancer = new AIModelLoadBalancer({
      strategy: 'least-connections',
      healthCheckInterval: 30000,
      maxRetries: 3,
    });

    // Initialize multi-level cache
    this.multiLevelCache = new MultiLevelCache({
      maxSize: 100 * 1024 * 1024, // 100MB
      maxItems: 10000,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      strategy: 'lru',
    });

    // Add default model instances
    this.setupDefaultInstances();

    // Start cache cleanup interval
    this.startCacheCleanup();
  }

  private createAxiosInstance(port: number): AxiosInstance {
    const instance = axios.create({
      baseURL: `http://localhost:${port}`,
      timeout: AI_CONFIG.TIMEOUT,
      httpAgent: this.connectionPool,
      headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
      },
      // Retry configuration
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });

    // Add request interceptor for logging
    instance.interceptors.request.use(
      (config) => {
        console.log(`🤖 AI Request: ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
        return config;
      },
      (error) => {
        console.error('🚨 AI Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging and error handling
    instance.interceptors.response.use(
      (response) => {
        console.log(`✅ AI Response: ${response.status} (${response.config.baseURL})`);
        return response;
      },
      (error) => {
        console.error(`❌ AI Response Error: ${error.response?.status || 'Network'} (${error.config?.baseURL})`);
        return Promise.reject(error);
      }
    );

    return instance;
  }

  private setupDefaultInstances(): void {
    // Add default GMM instances
    this.gmmLoadBalancer.addInstance('gmm-1', 'localhost', AI_CONFIG.GMM_PORT, 1);
    
    // Add default FMM instances  
    this.fmmLoadBalancer.addInstance('fmm-1', 'localhost', AI_CONFIG.FMM_PORT, 1);

    // In production, you would add multiple instances:
    // this.gmmLoadBalancer.addInstance('gmm-2', 'ai-server-2', AI_CONFIG.GMM_PORT, 1);
    // this.gmmLoadBalancer.addInstance('gmm-3', 'ai-server-3', AI_CONFIG.GMM_PORT, 2); // Higher weight
    
    console.log('🔄 Set up default AI model instances for load balancing');
  }

  // Add new model instance to load balancer
  addModelInstance(model: 'GMM' | 'FMM', id: string, host: string, port: number, weight: number = 1): void {
    try {
      if (model === 'GMM') {
        this.gmmLoadBalancer.addInstance(id, host, port, weight);
      } else {
        this.fmmLoadBalancer.addInstance(id, host, port, weight);
      }
      console.log(`➕ Added ${model} instance: ${id} (${host}:${port})`);
    } catch (error) {
      console.error(`❌ Failed to add ${model} instance ${id}:`, error);
    }
  }

  // Remove model instance from load balancer
  removeModelInstance(model: 'GMM' | 'FMM', id: string): void {
    try {
      if (model === 'GMM') {
        this.gmmLoadBalancer.removeInstance(id);
      } else {
        this.fmmLoadBalancer.removeInstance(id);
      }
      console.log(`➖ Removed ${model} instance: ${id}`);
    } catch (error) {
      console.error(`❌ Failed to remove ${model} instance ${id}:`, error);
    }
  }

  private startCacheCleanup(): void {
    // Clean up expired cache entries every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.cache.delete(key);
        }
      }
    }, 60000); // 1 minute
  }

  private getCacheKey(content: string, model: string): string {
    // Create a simple hash for cache key
    let hash = 0;
    const str = `${model}:${content}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private getFromCache(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    console.log(`💾 Cache hit for key: ${key.substring(0, 10)}...`);
    return entry.data;
  }

  private setCache(key: string, data: string, ttl: number = AI_CONFIG.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
    console.log(`💾 Cached result for key: ${key.substring(0, 10)}... (TTL: ${ttl}ms)`);
  }

  private async makeOllamaRequest(
    client: AxiosInstance,
    model: string,
    prompt: string
  ): Promise<string> {
    const request: OllamaRequest = {
      model,
      prompt,
      stream: false,
    };

    const startTime = performance.now();
    let success = false;

    try {
      const result = await circuitBreakers.aiModel.execute(async () => {
        return await withRetry(async () => {
          const response = await client.post<OllamaResponse>('/api/generate', request);
          
          if (response.status !== 200) {
            throw new AIModelError(`Ollama API returned status ${response.status}`, {
              status: response.status,
              model,
              endpoint: client.defaults.baseURL
            });
          }

          if (!response.data.response) {
            throw new AIModelError('Empty response from Ollama API', {
              model,
              endpoint: client.defaults.baseURL
            });
          }

          return response.data.response.trim();
        }, RETRY_CONFIGS.AI_MODEL);
      });

      success = true;
      return result;
    } catch (error: any) {
      // Classify and throw appropriate error
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new NetworkError(`Failed to connect to AI model: ${error.message}`, {
          code: error.code,
          model,
          endpoint: client.defaults.baseURL
        });
      }
      
      if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
        throw new TimeoutError(`AI model request timed out: ${error.message}`, {
          model,
          endpoint: client.defaults.baseURL,
          timeout: AI_CONFIG.TIMEOUT
        });
      }

      if (error instanceof AIModelError || error instanceof NetworkError || error instanceof TimeoutError) {
        throw error;
      }

      throw new AIModelError(`AI model communication failed: ${error.message}`, {
        originalError: error.name,
        model,
        endpoint: client.defaults.baseURL
      });
    } finally {
      const duration = performance.now() - startTime;
      metricsCollector.recordAIRequest(success, duration);
      logPerformance(`AI_${model}`, duration, success, { model, promptLength: prompt.length });
    }
  }

  async analyzeEmail(content: string): Promise<string> {
    const cacheKey = this.getCacheKey(content, AI_CONFIG.GMM_MODEL);
    
    // Check multi-level cache first
    const cachedResult = await this.multiLevelCache.get<string>(content, 'gmm');
    if (cachedResult) {
      metricsCollector.recordCacheHit();
      console.log(`💾 Multi-level cache hit for GMM analysis`);
      return cachedResult;
    }
    
    // Check legacy cache
    const legacyCachedResult = this.getFromCache(cacheKey);
    if (legacyCachedResult) {
      // Promote to multi-level cache
      await this.multiLevelCache.set(content, legacyCachedResult, { 
        namespace: 'gmm', 
        ttl: AI_CONFIG.CACHE_TTL,
        tags: ['analysis', 'gmm']
      });
      metricsCollector.recordCacheHit();
      return legacyCachedResult;
    }

    metricsCollector.recordCacheMiss();
    console.log(`📧 Analyzing email content (${content.length} characters)`);
    
    const prompt = `Analyze the following email content and tag problematic elements:

Email content:
${content}

Please identify and tag:
- Fluff words (amazing, incredible, fantastic) with <fluff></fluff>
- Spam words (free, urgent, act now, limited time) with <spam_words></spam_words>
- Hard to read sentences (3+ consecutive sentences) with <hard_to_read></hard_to_read>

Return the tagged content:`;

    try {
      // Use load balancer for the request
      const result = await this.gmmLoadBalancer.makeRequest<{ response: string }>(
        '/api/generate',
        {
          model: AI_CONFIG.GMM_MODEL,
          prompt,
          stream: false,
        }
      );
      
      const analysisResult = result.response.trim();
      
      // Cache in both systems
      this.setCache(cacheKey, analysisResult);
      await this.multiLevelCache.set(content, analysisResult, { 
        namespace: 'gmm', 
        ttl: AI_CONFIG.CACHE_TTL,
        tags: ['analysis', 'gmm'],
        layer: 'L2' // Store analysis results in L2 cache
      });
      
      return analysisResult;
    } catch (error) {
      console.error('📧 Email analysis failed:', error);
      throw error;
    }
  }

  async fixEmail(taggedContent: string): Promise<string> {
    const cacheKey = this.getCacheKey(taggedContent, AI_CONFIG.FMM_MODEL);
    
    // Check multi-level cache first
    const cachedResult = await this.multiLevelCache.get<string>(taggedContent, 'fmm');
    if (cachedResult) {
      metricsCollector.recordCacheHit();
      console.log(`💾 Multi-level cache hit for FMM fix`);
      return cachedResult;
    }
    
    // Check legacy cache
    const legacyCachedResult = this.getFromCache(cacheKey);
    if (legacyCachedResult) {
      // Promote to multi-level cache
      await this.multiLevelCache.set(taggedContent, legacyCachedResult, { 
        namespace: 'fmm', 
        ttl: AI_CONFIG.CACHE_TTL,
        tags: ['fix', 'fmm']
      });
      metricsCollector.recordCacheHit();
      return legacyCachedResult;
    }

    metricsCollector.recordCacheMiss();
    console.log(`🔧 Fixing tagged content (${taggedContent.length} characters)`);
    
    const prompt = `Fix the following tagged email content by providing improvements:

Tagged content:
${taggedContent}

For each tagged element, provide improvements in this format:
<old_draft>original text</old_draft><optimized_draft>improved text</optimized_draft>

Focus on:
- Replacing fluff words with more professional alternatives
- Making spam words more professional
- Breaking down hard-to-read sentences into clearer, shorter ones

Provide the improvements:`;

    try {
      // Use load balancer for the request
      const result = await this.fmmLoadBalancer.makeRequest<{ response: string }>(
        '/api/generate',
        {
          model: AI_CONFIG.FMM_MODEL,
          prompt,
          stream: false,
        }
      );
      
      const fixResult = result.response.trim();
      
      // Cache in both systems
      this.setCache(cacheKey, fixResult);
      await this.multiLevelCache.set(taggedContent, fixResult, { 
        namespace: 'fmm', 
        ttl: AI_CONFIG.CACHE_TTL,
        tags: ['fix', 'fmm'],
        layer: 'L2' // Store fix results in L2 cache
      });
      
      return fixResult;
    } catch (error) {
      console.error('🔧 Email fix failed:', error);
      throw error;
    }
  }

  // Batch processing for multiple requests
  private processBatch(): void {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, AI_CONFIG.BATCH_SIZE);
    console.log(`📦 Processing batch of ${batch.length} requests`);

    // Process batch requests concurrently
    batch.forEach(async (request) => {
      try {
        const result = await this.analyzeEmail(request.content);
        request.resolve(result);
      } catch (error) {
        request.reject(error as Error);
      }
    });
  }

  async batchAnalyzeEmail(content: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request: BatchRequest = {
        id: Math.random().toString(36).substring(7),
        content,
        resolve,
        reject,
      };

      this.batchQueue.push(request);

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
          this.batchTimer = null;
        }, AI_CONFIG.BATCH_TIMEOUT);
      }

      // Process immediately if batch is full
      if (this.batchQueue.length >= AI_CONFIG.BATCH_SIZE) {
        if (this.batchTimer) {
          clearTimeout(this.batchTimer);
          this.batchTimer = null;
        }
        this.processBatch();
      }
    });
  }

  // Health check for AI models
  async healthCheck(): Promise<{ gmm: boolean; fmm: boolean }> {
    const results = { gmm: false, fmm: false };

    try {
      // Check GMM instances through load balancer
      const gmmStats = this.gmmLoadBalancer.getStats();
      results.gmm = gmmStats.healthyInstances > 0;
      
      if (results.gmm) {
        console.log(`✅ GMM models are healthy (${gmmStats.healthyInstances}/${gmmStats.totalInstances} instances)`);
      } else {
        console.error(`❌ No healthy GMM instances (0/${gmmStats.totalInstances})`);
      }
    } catch (error) {
      console.error('❌ GMM health check failed:', (error as Error).message);
    }

    try {
      // Check FMM instances through load balancer
      const fmmStats = this.fmmLoadBalancer.getStats();
      results.fmm = fmmStats.healthyInstances > 0;
      
      if (results.fmm) {
        console.log(`✅ FMM models are healthy (${fmmStats.healthyInstances}/${fmmStats.totalInstances} instances)`);
      } else {
        console.error(`❌ No healthy FMM instances (0/${fmmStats.totalInstances})`);
      }
    } catch (error) {
      console.error('❌ FMM health check failed:', (error as Error).message);
    }

    return results;
  }

  // Get cache statistics
  getCacheStats(): { 
    size: number; 
    hitRate: number;
    multiLevel: any;
    loadBalancer: {
      gmm: any;
      fmm: any;
    };
  } {
    const multiLevelStats = this.multiLevelCache.getStats();
    
    return {
      size: this.cache.size,
      hitRate: multiLevelStats.hitRate,
      multiLevel: multiLevelStats,
      loadBalancer: {
        gmm: this.gmmLoadBalancer.getStats(),
        fmm: this.fmmLoadBalancer.getStats(),
      },
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Cache cleared');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down AI communicator...');
    
    // Clear any pending batch timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Process any remaining batch requests
    if (this.batchQueue.length > 0) {
      console.log(`📦 Processing final batch of ${this.batchQueue.length} requests`);
      this.processBatch();
    }

    // Shutdown load balancers
    await Promise.all([
      this.gmmLoadBalancer.shutdown(),
      this.fmmLoadBalancer.shutdown(),
    ]);

    // Shutdown multi-level cache
    await this.multiLevelCache.shutdown();

    // Clear legacy cache
    this.clearCache();

    // Destroy connection pool
    this.connectionPool.destroy();
    
    console.log('✅ AI communicator shutdown complete');
  }
}

// Create singleton instance
const aiCommunicator = new AIModelCommunicator();

// Export the singleton instance and types
export { aiCommunicator, AI_CONFIG };
export type { OllamaRequest, OllamaResponse, CacheEntry, BatchRequest };