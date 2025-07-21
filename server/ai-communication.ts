import { Agent } from 'http';
import axios, { AxiosInstance } from 'axios';

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
  GMM_MODEL: 'grademymail',
  FMM_MODEL: 'fixmymail',
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

  constructor() {
    // Create HTTP agent with connection pooling and keep-alive
    this.connectionPool = new Agent({
      keepAlive: true,
      keepAliveMsecs: 30000, // 30 seconds
      maxSockets: 10, // Maximum concurrent connections per host
      maxFreeSockets: 5, // Maximum idle connections per host
      timeout: AI_CONFIG.TIMEOUT,
      freeSocketTimeout: 15000, // 15 seconds before closing idle connections
    });

    // Create Axios instances with optimized configuration
    this.gmmClient = this.createAxiosInstance(AI_CONFIG.GMM_PORT);
    this.fmmClient = this.createAxiosInstance(AI_CONFIG.FMM_PORT);

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
    prompt: string,
    retries: number = AI_CONFIG.MAX_RETRIES
  ): Promise<string> {
    const request: OllamaRequest = {
      model,
      prompt,
      stream: false,
    };

    try {
      const response = await client.post<OllamaResponse>('/api/generate', request);
      
      if (response.status !== 200) {
        throw new Error(`Ollama API returned status ${response.status}`);
      }

      if (!response.data.response) {
        throw new Error('Empty response from Ollama API');
      }

      return response.data.response.trim();
    } catch (error: any) {
      console.error(`🚨 Ollama request failed (${retries} retries left):`, error.message);
      
      if (retries > 0) {
        // Exponential backoff
        const delay = AI_CONFIG.RETRY_DELAY * (AI_CONFIG.MAX_RETRIES - retries + 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeOllamaRequest(client, model, prompt, retries - 1);
      }
      
      throw new Error(`AI model communication failed: ${error.message}`);
    }
  }

  async analyzeEmail(content: string): Promise<string> {
    const cacheKey = this.getCacheKey(content, AI_CONFIG.GMM_MODEL);
    
    // Check cache first
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

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
      const result = await this.makeOllamaRequest(this.gmmClient, AI_CONFIG.GMM_MODEL, prompt);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      console.error('📧 Email analysis failed:', error);
      throw error;
    }
  }

  async fixEmail(taggedContent: string): Promise<string> {
    const cacheKey = this.getCacheKey(taggedContent, AI_CONFIG.FMM_MODEL);
    
    // Check cache first
    const cachedResult = this.getFromCache(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

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
      const result = await this.makeOllamaRequest(this.fmmClient, AI_CONFIG.FMM_MODEL, prompt);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
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
      await this.gmmClient.get('/api/tags', { timeout: 5000 });
      results.gmm = true;
      console.log('✅ GMM model is healthy');
    } catch (error) {
      console.error('❌ GMM model health check failed:', (error as Error).message);
    }

    try {
      await this.fmmClient.get('/api/tags', { timeout: 5000 });
      results.fmm = true;
      console.log('✅ FMM model is healthy');
    } catch (error) {
      console.error('❌ FMM model health check failed:', (error as Error).message);
    }

    return results;
  }

  // Get cache statistics
  getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // Would need to track hits/misses for accurate rate
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

    // Clear cache
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