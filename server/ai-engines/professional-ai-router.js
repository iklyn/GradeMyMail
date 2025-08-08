// Professional AI Router with multiple engine support
// Enterprise-grade solution with fallback strategies and health monitoring

import { TransformersAIEngine } from './transformers-engine-fixed.js';
import { ONNXAIEngine } from './onnx-engine-fixed.js';
import axios from 'axios';

class ProfessionalAIRouter {
  constructor(config = {}) {
    this.config = {
      primaryEngine: 'transformers', // 'transformers', 'onnx', 'openai'
      fallbackEngines: ['onnx', 'openai'],
      healthCheckInterval: 30000,
      failoverThreshold: 3,
      openaiApiKey: process.env.OPENAI_API_KEY,
      ...config,
    };

    this.engines = new Map();
    this.engineHealth = new Map();
    this.healthCheckInterval = null;
    this.isInitialized = false;

    this.initializeEngines();
  }

  async initializeEngines() {
    console.log('🚀 Initializing Professional AI Router...');

    try {
      // Initialize Transformers.js engine
      console.log('📦 Setting up Transformers.js engine...');
      const transformersEngine = new TransformersAIEngine({
        modelName: 'microsoft/DialoGPT-medium',
        cacheDir: './models/transformers-cache',
      });
      this.engines.set('transformers', transformersEngine);
      this.engineHealth.set('transformers', {
        healthy: false,
        consecutiveFailures: 0,
        lastCheck: 0,
        responseTime: 0,
      });

      // Initialize ONNX engine
      console.log('📦 Setting up ONNX Runtime engine...');
      const onnxEngine = new ONNXAIEngine({
        modelPath: './models/onnx/newsletter-model.onnx',
        providers: ['CPUExecutionProvider'],
      });
      this.engines.set('onnx', onnxEngine);
      this.engineHealth.set('onnx', {
        healthy: false,
        consecutiveFailures: 0,
        lastCheck: 0,
        responseTime: 0,
      });

      // Initialize OpenAI client (always available as ultimate fallback)
      this.engines.set('openai', {
        client: axios.create({
          baseURL: 'https://api.openai.com/v1',
          headers: {
            'Authorization': `Bearer ${this.config.openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }),
        analyzeNewsletter: this.openaiAnalyze.bind(this),
        improveNewsletter: this.openaiImprove.bind(this),
        healthCheck: this.openaiHealthCheck.bind(this),
        getModelInfo: () => ({ engine: 'OpenAI', model: 'gpt-4o-mini' }),
      });
      this.engineHealth.set('openai', {
        healthy: true, // Assume OpenAI is healthy by default
        consecutiveFailures: 0,
        lastCheck: Date.now(),
        responseTime: 0,
      });

      // Start health monitoring
      this.startHealthMonitoring();

      // Initialize engines in background
      this.initializeEnginesAsync();

      this.isInitialized = true;
      console.log('✅ Professional AI Router initialized');

    } catch (error) {
      console.error('❌ Failed to initialize Professional AI Router:', error);
      throw error;
    }
  }

  async initializeEnginesAsync() {
    // Initialize engines in parallel for faster startup
    const initPromises = [];

    if (this.engines.has('transformers')) {
      initPromises.push(
        this.engines.get('transformers').initialize()
          .then(() => {
            this.engineHealth.get('transformers').healthy = true;
            console.log('✅ Transformers.js engine ready');
          })
          .catch(error => {
            console.warn('⚠️ Transformers.js engine failed to initialize:', error.message);
          })
      );
    }

    if (this.engines.has('onnx')) {
      initPromises.push(
        this.engines.get('onnx').initialize()
          .then(() => {
            this.engineHealth.get('onnx').healthy = true;
            console.log('✅ ONNX Runtime engine ready');
          })
          .catch(error => {
            console.warn('⚠️ ONNX Runtime engine failed to initialize:', error.message);
          })
      );
    }

    await Promise.allSettled(initPromises);
    console.log('🎉 All AI engines initialization completed');
  }

  startHealthMonitoring() {
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval);

    console.log('💓 Health monitoring started');
  }

  async performHealthChecks() {
    const healthPromises = [];

    for (const [engineName, engine] of this.engines.entries()) {
      if (engine.healthCheck) {
        healthPromises.push(
          this.checkEngineHealth(engineName, engine)
        );
      }
    }

    await Promise.allSettled(healthPromises);
  }

  async checkEngineHealth(engineName, engine) {
    const health = this.engineHealth.get(engineName);
    const startTime = Date.now();

    try {
      const result = await engine.healthCheck();
      const responseTime = Date.now() - startTime;

      if (result.healthy) {
        health.healthy = true;
        health.consecutiveFailures = 0;
        health.responseTime = responseTime;
        console.log(`✅ ${engineName} health check passed (${responseTime}ms)`);
      } else {
        throw new Error(result.reason || 'Health check failed');
      }
    } catch (error) {
      health.healthy = false;
      health.consecutiveFailures++;
      health.responseTime = Date.now() - startTime;
      
      console.warn(`⚠️ ${engineName} health check failed (${health.consecutiveFailures} consecutive):`, error.message);
    }

    health.lastCheck = Date.now();
  }

  getHealthyEngine(preferredEngine = null) {
    // Try preferred engine first
    if (preferredEngine && this.engines.has(preferredEngine)) {
      const health = this.engineHealth.get(preferredEngine);
      if (health.healthy && health.consecutiveFailures < this.config.failoverThreshold) {
        return { name: preferredEngine, engine: this.engines.get(preferredEngine) };
      }
    }

    // Try primary engine
    const primaryHealth = this.engineHealth.get(this.config.primaryEngine);
    if (primaryHealth?.healthy && primaryHealth.consecutiveFailures < this.config.failoverThreshold) {
      return { 
        name: this.config.primaryEngine, 
        engine: this.engines.get(this.config.primaryEngine) 
      };
    }

    // Try fallback engines
    for (const engineName of this.config.fallbackEngines) {
      const health = this.engineHealth.get(engineName);
      if (health?.healthy && health.consecutiveFailures < this.config.failoverThreshold) {
        return { name: engineName, engine: this.engines.get(engineName) };
      }
    }

    // Ultimate fallback to OpenAI if available
    if (this.engines.has('openai') && this.config.openaiApiKey) {
      return { name: 'openai', engine: this.engines.get('openai') };
    }

    throw new Error('No healthy AI engines available');
  }

  async analyzeNewsletter(content, preferredEngine = null) {
    console.log(`📧 Analyzing newsletter content (${content.length} characters)`);

    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { name, engine } = this.getHealthyEngine(preferredEngine);
        console.log(`🤖 Using ${name} engine for analysis (attempt ${attempt + 1})`);

        const startTime = Date.now();
        const result = await engine.analyzeNewsletter(content);
        const duration = Date.now() - startTime;

        console.log(`✅ Analysis completed with ${name} in ${duration}ms`);
        
        // Update health on success
        const health = this.engineHealth.get(name);
        health.consecutiveFailures = 0;
        health.responseTime = duration;

        return {
          content: result,
          metadata: {
            engine: name,
            duration,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
          }
        };

      } catch (error) {
        lastError = error;
        console.warn(`❌ Analysis attempt ${attempt + 1} failed:`, error.message);
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`All analysis attempts failed. Last error: ${lastError.message}`);
  }

  async improveNewsletter(taggedContent, preferredEngine = null) {
    console.log(`🔧 Improving newsletter content (${taggedContent.length} characters)`);

    const maxRetries = 3;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const { name, engine } = this.getHealthyEngine(preferredEngine);
        console.log(`🤖 Using ${name} engine for improvement (attempt ${attempt + 1})`);

        const startTime = Date.now();
        const result = await engine.improveNewsletter(taggedContent);
        const duration = Date.now() - startTime;

        console.log(`✅ Improvement completed with ${name} in ${duration}ms`);
        
        // Update health on success
        const health = this.engineHealth.get(name);
        health.consecutiveFailures = 0;
        health.responseTime = duration;

        return {
          content: result,
          metadata: {
            engine: name,
            duration,
            attempt: attempt + 1,
            timestamp: new Date().toISOString(),
          }
        };

      } catch (error) {
        lastError = error;
        console.warn(`❌ Improvement attempt ${attempt + 1} failed:`, error.message);
        
        // Wait before retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw new Error(`All improvement attempts failed. Last error: ${lastError.message}`);
  }

  // OpenAI implementation methods
  async openaiAnalyze(content) {
    const systemPrompt = `You are a professional newsletter editor. Analyze the provided newsletter content and identify issues in three categories:

1. CLARITY: Hard to read sentences, complex words, unclear messaging
2. ENGAGEMENT: Weak hooks, poor CTAs, boring language  
3. TONE: Inconsistent voice, inappropriate formality, spam-like language

Tag problematic text with XML tags:
- <hard_to_read>text</hard_to_read> for clarity issues
- <spam_words>text</spam_words> for engagement problems  
- <fluff>text</fluff> for tone inconsistencies

Return only the original text with appropriate tags added.`;

    const response = await this.engines.get('openai').client.post('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: content }
      ],
      temperature: 0.3,
      max_tokens: 2048,
    });

    return response.data.choices[0].message.content.trim();
  }

  async openaiImprove(taggedContent) {
    const systemPrompt = `You are a professional newsletter editor. Improve the provided tagged newsletter content.

For each tagged element, provide improvements in this format:
<old_draft>original text</old_draft><optimized_draft>improved text</optimized_draft>

Focus on:
- Replacing fluff words with more professional alternatives
- Making spam words more professional
- Breaking down hard-to-read sentences into clearer, shorter ones

Provide only the improvements in the specified format.`;

    const response = await this.engines.get('openai').client.post('/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: taggedContent }
      ],
      temperature: 0.4,
      max_tokens: 2048,
    });

    return response.data.choices[0].message.content.trim();
  }

  async openaiHealthCheck() {
    try {
      const response = await this.engines.get('openai').client.get('/models');
      return {
        healthy: response.status === 200,
        responseTime: 0, // Will be calculated by caller
      };
    } catch (error) {
      return {
        healthy: false,
        reason: error.message,
      };
    }
  }

  getEngineStatus() {
    const status = {};
    
    for (const [name, health] of this.engineHealth.entries()) {
      const engine = this.engines.get(name);
      status[name] = {
        ...health,
        info: engine.getModelInfo ? engine.getModelInfo() : { engine: name },
      };
    }

    return {
      primary: this.config.primaryEngine,
      fallbacks: this.config.fallbackEngines,
      engines: status,
      initialized: this.isInitialized,
    };
  }

  async shutdown() {
    console.log('🛑 Shutting down Professional AI Router...');

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Shutdown all engines
    const shutdownPromises = [];
    for (const [name, engine] of this.engines.entries()) {
      if (engine.shutdown) {
        shutdownPromises.push(
          engine.shutdown().catch(error => 
            console.warn(`⚠️ Error shutting down ${name}:`, error.message)
          )
        );
      }
    }

    await Promise.allSettled(shutdownPromises);
    
    this.engines.clear();
    this.engineHealth.clear();
    this.isInitialized = false;

    console.log('✅ Professional AI Router shutdown complete');
  }
}

export { ProfessionalAIRouter };