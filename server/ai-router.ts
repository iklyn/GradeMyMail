import axios, { AxiosInstance } from 'axios';
import { withRetry, RETRY_CONFIGS } from './retry-logic.js';
import { AIModelError, NetworkError, TimeoutError } from './error-handler.js';
import { readFileSync } from 'fs';
import { join } from 'path';

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

interface OpenAIRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature: number;
  max_tokens: number;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface ModelHealth {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  responseTime: number;
}

interface AIRouterConfig {
  primaryModel: 'llama3.2';
  fallbackModel: 'gpt-4o-mini';
  healthCheckInterval: number;
  fallbackThreshold: number;
  loadBalancing: boolean;
  ollamaPort: number;
  openaiApiKey?: string;
}

class HybridAIRouter {
  private config: AIRouterConfig;
  private ollamaClient: AxiosInstance;
  private openaiClient: AxiosInstance;
  private modelHealth: Map<string, ModelHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private systemPrompts: Map<string, string> = new Map();

  constructor(config: AIRouterConfig) {
    this.config = config;
    
    // Initialize Ollama client
    this.ollamaClient = axios.create({
      baseURL: `http://localhost:${config.ollamaPort}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Initialize OpenAI client
    this.openaiClient = axios.create({
      baseURL: 'https://api.openai.com/v1',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openaiApiKey || process.env.OPENAI_API_KEY}`,
      },
    });

    // Load system prompts
    this.loadSystemPrompts();

    // Initialize model health tracking
    this.initializeHealthTracking();

    // Start health monitoring
    this.startHealthMonitoring();
  }

  private loadSystemPrompts(): void {
    try {
      // Load GradeMyMail system prompt
      const gmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_GM.txt'), 'utf-8');
      this.systemPrompts.set('grademymail', gmPrompt);
      console.log('✅ Loaded GradeMyMail system prompt');

      // Load FixMyMail system prompt  
      const fmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_FM.txt'), 'utf-8');
      this.systemPrompts.set('fixmymail', fmPrompt);
      console.log('✅ Loaded FixMyMail system prompt');
    } catch (error) {
      console.error('❌ Failed to load system prompts:', error);
      // Set default prompts as fallback
      this.setDefaultPrompts();
    }
  }

  private setDefaultPrompts(): void {
    this.systemPrompts.set('grademymail', `
You are a professional newsletter editor. Analyze the provided newsletter content and identify issues in three categories:

1. CLARITY: Hard to read sentences, complex words, unclear messaging
2. ENGAGEMENT: Weak hooks, poor CTAs, boring language  
3. TONE: Inconsistent voice, inappropriate formality, spam-like language

Tag problematic text with XML tags:
- <hard_to_read>text</hard_to_read> for clarity issues
- <spam_words>text</spam_words> for engagement problems  
- <fluff>text</fluff> for tone inconsistencies

Return only the original text with appropriate tags added.
    `.trim());

    this.systemPrompts.set('fixmymail', `
You are a professional newsletter editor. Improve the provided tagged newsletter content.

For each tagged element, provide improvements in this format:
<old_draft>original text</old_draft><optimized_draft>improved text</optimized_draft>

Focus on:
- Replacing fluff words with more professional alternatives
- Making spam words more professional
- Breaking down hard-to-read sentences into clearer, shorter ones

Provide only the improvements in the specified format.
    `.trim());

    console.log('⚠️ Using default system prompts as fallback');
  }

  private initializeHealthTracking(): void {
    // Initialize health tracking for both models
    this.modelHealth.set('llama3.2', {
      isHealthy: false,
      lastCheck: 0,
      consecutiveFailures: 0,
      responseTime: 0,
    });

    this.modelHealth.set('gpt-4o-mini', {
      isHealthy: true, // Assume OpenAI is healthy by default
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      responseTime: 0,
    });
  }

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkModelHealth();
    }, this.config.healthCheckInterval);

    // Initial health check
    this.checkModelHealth();
  }

  private async checkModelHealth(): Promise<void> {
    // Check Llama 3.2 health
    await this.checkLlamaHealth();
    
    // Check OpenAI health (less frequent, as it's usually reliable)
    if (Date.now() - (this.modelHealth.get('gpt-4o-mini')?.lastCheck || 0) > 60000) {
      await this.checkOpenAIHealth();
    }
  }

  private async checkLlamaHealth(): Promise<void> {
    const startTime = Date.now();
    const health = this.modelHealth.get('llama3.2')!;

    try {
      const response = await this.ollamaClient.get('/api/tags', { timeout: 5000 });
      
      if (response.status === 200) {
        health.isHealthy = true;
        health.consecutiveFailures = 0;
        health.responseTime = Date.now() - startTime;
        console.log(`✅ Llama 3.2 health check passed (${health.responseTime}ms)`);
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      health.isHealthy = false;
      health.consecutiveFailures++;
      health.responseTime = Date.now() - startTime;
      console.warn(`⚠️ Llama 3.2 health check failed (attempt ${health.consecutiveFailures}):`, (error as Error).message);
    }

    health.lastCheck = Date.now();
    this.modelHealth.set('llama3.2', health);
  }

  private async checkOpenAIHealth(): Promise<void> {
    const startTime = Date.now();
    const health = this.modelHealth.get('gpt-4o-mini')!;

    try {
      // Simple test request to OpenAI
      const response = await this.openaiClient.get('/models', { timeout: 5000 });
      
      if (response.status === 200) {
        health.isHealthy = true;
        health.consecutiveFailures = 0;
        health.responseTime = Date.now() - startTime;
        console.log(`✅ OpenAI health check passed (${health.responseTime}ms)`);
      } else {
        throw new Error(`Unexpected status: ${response.status}`);
      }
    } catch (error) {
      health.isHealthy = false;
      health.consecutiveFailures++;
      health.responseTime = Date.now() - startTime;
      console.warn(`⚠️ OpenAI health check failed (attempt ${health.consecutiveFailures}):`, (error as Error).message);
    }

    health.lastCheck = Date.now();
    this.modelHealth.set('gpt-4o-mini', health);
  }

  private shouldUseFallback(): boolean {
    const llamaHealth = this.modelHealth.get('llama3.2');
    
    if (!llamaHealth) return true;
    
    // Use fallback if Llama is unhealthy or has too many consecutive failures
    return !llamaHealth.isHealthy || llamaHealth.consecutiveFailures >= this.config.fallbackThreshold;
  }

  private async makeOllamaRequest(prompt: string, systemPrompt: string): Promise<string> {
    const fullPrompt = `${systemPrompt}\n\nNow here's the input:\n${prompt}`;
    
    const request: OllamaRequest = {
      model: 'llama3.2',
      prompt: fullPrompt,
      stream: false,
    };

    const startTime = performance.now();

    try {
      const response = await withRetry(async () => {
        const result = await this.ollamaClient.post<OllamaResponse>('/api/generate', request);
        
        if (result.status !== 200) {
          throw new AIModelError(`Ollama API returned status ${result.status}`, {
            status: result.status,
            model: 'llama3.2',
          });
        }

        if (!result.data.response) {
          throw new AIModelError('Empty response from Ollama API', {
            model: 'llama3.2',
          });
        }

        return result.data.response.trim();
      }, RETRY_CONFIGS.AI_MODEL);

      // Update health on success
      const health = this.modelHealth.get('llama3.2')!;
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      health.responseTime = performance.now() - startTime;
      this.modelHealth.set('llama3.2', health);

      return response;
    } catch (error: any) {
      // Update health on failure
      const health = this.modelHealth.get('llama3.2')!;
      health.isHealthy = false;
      health.consecutiveFailures++;
      this.modelHealth.set('llama3.2', health);

      throw error;
    }
  }

  private async makeOpenAIRequest(prompt: string, systemPrompt: string): Promise<string> {
    const request: OpenAIRequest = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1024,
    };

    const startTime = performance.now();

    try {
      const response = await withRetry(async () => {
        const result = await this.openaiClient.post<OpenAIResponse>('/chat/completions', request);
        
        if (result.status !== 200) {
          throw new AIModelError(`OpenAI API returned status ${result.status}`, {
            status: result.status,
            model: 'gpt-4o-mini',
          });
        }

        if (!result.data.choices?.[0]?.message?.content) {
          throw new AIModelError('Empty response from OpenAI API', {
            model: 'gpt-4o-mini',
          });
        }

        return result.data.choices[0].message.content.trim();
      }, RETRY_CONFIGS.AI_MODEL);

      // Update health on success
      const health = this.modelHealth.get('gpt-4o-mini')!;
      health.isHealthy = true;
      health.consecutiveFailures = 0;
      health.responseTime = performance.now() - startTime;
      this.modelHealth.set('gpt-4o-mini', health);

      return response;
    } catch (error: any) {
      // Update health on failure
      const health = this.modelHealth.get('gpt-4o-mini')!;
      health.isHealthy = false;
      health.consecutiveFailures++;
      this.modelHealth.set('gpt-4o-mini', health);

      throw error;
    }
  }

  async analyzeNewsletter(content: string): Promise<string> {
    const systemPrompt = this.systemPrompts.get('grademymail')!;
    
    console.log(`📧 Analyzing newsletter content (${content.length} characters)`);

    // Try local model first if healthy
    if (!this.shouldUseFallback()) {
      try {
        console.log('🤖 Using Llama 3.2 for analysis');
        const result = await this.makeOllamaRequest(content, systemPrompt);
        console.log('✅ Llama 3.2 analysis completed');
        return result;
      } catch (error) {
        console.warn('🔄 Llama 3.2 failed, falling back to OpenAI:', (error as Error).message);
      }
    }

    // Fallback to OpenAI
    console.log('☁️ Using OpenAI GPT-4o-mini for analysis');
    const result = await this.makeOpenAIRequest(content, systemPrompt);
    console.log('✅ OpenAI analysis completed');
    return result;
  }

  async improveNewsletter(taggedContent: string): Promise<string> {
    const systemPrompt = this.systemPrompts.get('fixmymail')!;
    
    console.log(`🔧 Improving newsletter content (${taggedContent.length} characters)`);

    // Try local model first if healthy
    if (!this.shouldUseFallback()) {
      try {
        console.log('🤖 Using Llama 3.2 for improvement');
        const result = await this.makeOllamaRequest(taggedContent, systemPrompt);
        console.log('✅ Llama 3.2 improvement completed');
        return result;
      } catch (error) {
        console.warn('🔄 Llama 3.2 failed, falling back to OpenAI:', (error as Error).message);
      }
    }

    // Fallback to OpenAI
    console.log('☁️ Using OpenAI GPT-4o-mini for improvement');
    const result = await this.makeOpenAIRequest(taggedContent, systemPrompt);
    console.log('✅ OpenAI improvement completed');
    return result;
  }

  getModelStatus(): { 
    llama: ModelHealth; 
    openai: ModelHealth; 
    currentPrimary: string;
    usingFallback: boolean;
  } {
    return {
      llama: this.modelHealth.get('llama3.2')!,
      openai: this.modelHealth.get('gpt-4o-mini')!,
      currentPrimary: this.shouldUseFallback() ? 'gpt-4o-mini' : 'llama3.2',
      usingFallback: this.shouldUseFallback(),
    };
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down hybrid AI router...');
    
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    console.log('✅ Hybrid AI router shutdown complete');
  }
}

// Default configuration
const DEFAULT_CONFIG: AIRouterConfig = {
  primaryModel: 'llama3.2',
  fallbackModel: 'gpt-4o-mini',
  healthCheckInterval: 30000, // 30 seconds
  fallbackThreshold: 3, // failures before fallback
  loadBalancing: true,
  ollamaPort: 11434,
  openaiApiKey: process.env.OPENAI_API_KEY,
};

// Create and export the router instance
export const hybridAIRouter = new HybridAIRouter(DEFAULT_CONFIG);

export { HybridAIRouter };
export type { AIRouterConfig, ModelHealth };