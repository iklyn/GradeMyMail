// Professional Transformers.js implementation for local AI inference
// Used by companies like Hugging Face, Microsoft, and Google for production workloads

import { pipeline, env } from '@xenova/transformers';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configure Transformers.js for server-side usage
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.useBrowserCache = false;

class TransformersAIEngine {
  constructor(config = {}) {
    this.config = {
      modelName: 'microsoft/DialoGPT-medium', // Professional conversational model
      maxLength: 1024,
      temperature: 0.7,
      topP: 0.9,
      cacheDir: './models/cache',
      ...config,
    };
    
    this.pipeline = null;
    this.isInitialized = false;
    this.systemPrompts = new Map();
    this.loadSystemPrompts();
  }

  loadSystemPrompts() {
    try {
      const gmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_GM.txt'), 'utf-8');
      this.systemPrompts.set('grademymail', gmPrompt);
      
      const fmPrompt = readFileSync(join(process.cwd(), 'Systemprompts/SystemPrompt_FM.txt'), 'utf-8');
      this.systemPrompts.set('fixmymail', fmPrompt);
      
      console.log('✅ Transformers.js: System prompts loaded');
    } catch (error) {
      console.warn('⚠️ Transformers.js: Failed to load system prompts, using defaults');
      this.setDefaultPrompts();
    }
  }

  setDefaultPrompts() {
    this.systemPrompts.set('grademymail', 
      'You are a professional newsletter editor. Analyze content and tag issues with <hard_to_read>, <spam_words>, and <fluff> tags.'
    );
    this.systemPrompts.set('fixmymail', 
      'You are a professional newsletter editor. Improve tagged content using <old_draft> and <optimized_draft> format.'
    );
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🤖 Initializing Transformers.js pipeline...');
      console.log(`📦 Model: ${this.config.modelName}`);
      
      // Initialize text generation pipeline
      this.pipeline = await pipeline('text-generation', this.config.modelName, {
        cache_dir: this.config.cacheDir,
        local_files_only: false, // Allow downloading if not cached
        revision: 'main',
      });
      
      this.isInitialized = true;
      console.log('✅ Transformers.js pipeline initialized successfully');
      
      // Warm up the model with a test inference
      await this.warmUp();
      
    } catch (error) {
      console.error('❌ Failed to initialize Transformers.js pipeline:', error.message);
      throw new Error(`Transformers.js initialization failed: ${error.message}`);
    }
  }

  async warmUp() {
    try {
      console.log('🔥 Warming up Transformers.js model...');
      const startTime = Date.now();
      
      await this.pipeline('Hello', {
        max_length: 50,
        temperature: 0.7,
        do_sample: true,
        pad_token_id: 50256,
      });
      
      const warmupTime = Date.now() - startTime;
      console.log(`✅ Model warmed up in ${warmupTime}ms`);
    } catch (error) {
      console.warn('⚠️ Model warmup failed:', error.message);
    }
  }

  async generateText(prompt, systemPrompt = '', options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\nUser: ${prompt}\nAssistant:` : prompt;
    
    const config = {
      max_length: options.maxLength || this.config.maxLength,
      temperature: options.temperature || this.config.temperature,
      top_p: options.topP || this.config.topP,
      do_sample: true,
      pad_token_id: 50256,
      eos_token_id: 50256,
      ...options,
    };

    try {
      const startTime = Date.now();
      const result = await this.pipeline(fullPrompt, config);
      const inferenceTime = Date.now() - startTime;
      
      console.log(`🤖 Transformers.js inference completed in ${inferenceTime}ms`);
      
      // Extract generated text (remove the input prompt)
      const generatedText = result[0].generated_text.replace(fullPrompt, '').trim();
      return generatedText;
      
    } catch (error) {
      console.error('❌ Transformers.js generation failed:', error.message);
      throw new Error(`Text generation failed: ${error.message}`);
    }
  }

  async analyzeNewsletter(content) {
    const systemPrompt = this.systemPrompts.get('grademymail');
    
    console.log(`📧 Analyzing newsletter with Transformers.js (${content.length} chars)`);
    
    try {
      const result = await this.generateText(content, systemPrompt, {
        maxLength: 2048,
        temperature: 0.3, // Lower temperature for more consistent analysis
      });
      
      return result;
    } catch (error) {
      console.error('❌ Newsletter analysis failed:', error.message);
      throw error;
    }
  }

  async improveNewsletter(taggedContent) {
    const systemPrompt = this.systemPrompts.get('fixmymail');
    
    console.log(`🔧 Improving newsletter with Transformers.js (${taggedContent.length} chars)`);
    
    try {
      const result = await this.generateText(taggedContent, systemPrompt, {
        maxLength: 2048,
        temperature: 0.4, // Slightly higher for creative improvements
      });
      
      return result;
    } catch (error) {
      console.error('❌ Newsletter improvement failed:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.isInitialized) {
        return { healthy: false, reason: 'Not initialized' };
      }

      const startTime = Date.now();
      await this.pipeline('Health check', { max_length: 20 });
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        responseTime,
        model: this.config.modelName,
        initialized: this.isInitialized,
      };
    } catch (error) {
      return {
        healthy: false,
        reason: error.message,
        model: this.config.modelName,
        initialized: this.isInitialized,
      };
    }
  }

  getModelInfo() {
    return {
      engine: 'Transformers.js',
      model: this.config.modelName,
      initialized: this.isInitialized,
      cacheDir: this.config.cacheDir,
      capabilities: ['text-generation', 'newsletter-analysis', 'content-improvement'],
    };
  }

  async shutdown() {
    console.log('🛑 Shutting down Transformers.js engine...');
    this.pipeline = null;
    this.isInitialized = false;
    console.log('✅ Transformers.js engine shutdown complete');
  }
}

export { TransformersAIEngine };