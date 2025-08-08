import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { exec } from 'child_process';
import axios from 'axios';

const execAsync = promisify(exec);

interface ModelConfig {
  name: string;
  port: number;
  modelFile: string;
  process?: ChildProcess;
}

interface StartupConfig {
  models: ModelConfig[];
  maxStartupTime: number;
  healthCheckInterval: number;
  restartOnFailure: boolean;
}

class ModelStartupManager {
  private config: StartupConfig;
  private runningModels: Map<string, ChildProcess> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: StartupConfig) {
    this.config = config;
  }

  /**
   * Start all configured models
   */
  async startAllModels(): Promise<void> {
    console.log('🚀 Starting AI models...');
    
    // Check if Ollama is installed
    await this.ensureOllamaInstalled();
    
    // Start each model
    const startPromises = this.config.models.map(model => this.startModel(model));
    
    try {
      await Promise.all(startPromises);
      console.log('✅ All AI models started successfully');
      
      // Start health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      console.error('❌ Failed to start some AI models:', error);
      throw error;
    }
  }

  /**
   * Start a single model
   */
  private async startModel(model: ModelConfig): Promise<void> {
    console.log(`🔄 Starting ${model.name} on port ${model.port}...`);
    
    try {
      // Check if model is already running
      if (await this.isModelRunning(model.port)) {
        console.log(`✅ ${model.name} is already running on port ${model.port}`);
        return;
      }

      // Pull the model if it doesn't exist
      await this.pullModelIfNeeded(model.name);

      // Start the model server
      const childProcess = spawn('ollama', ['serve'], {
        env: {
          ...process.env,
          OLLAMA_HOST: `0.0.0.0:${model.port}`,
          OLLAMA_MODELS: model.modelFile,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
      });

      // Handle process events
      childProcess.stdout?.on('data', (data) => {
        console.log(`[${model.name}] ${data.toString().trim()}`);
      });

      childProcess.stderr?.on('data', (data) => {
        console.error(`[${model.name}] ${data.toString().trim()}`);
      });

      childProcess.on('exit', (code) => {
        console.log(`[${model.name}] Process exited with code ${code}`);
        this.runningModels.delete(model.name);
        
        if (this.config.restartOnFailure && code !== 0) {
          console.log(`🔄 Restarting ${model.name}...`);
          setTimeout(() => this.startModel(model), 5000);
        }
      });

      // Store the process
      this.runningModels.set(model.name, childProcess);

      // Wait for the model to be ready
      await this.waitForModelReady(model.port, model.name);
      
      console.log(`✅ ${model.name} started successfully on port ${model.port}`);
    } catch (error) {
      console.error(`❌ Failed to start ${model.name}:`, error);
      throw error;
    }
  }

  /**
   * Check if Ollama is installed
   */
  private async ensureOllamaInstalled(): Promise<void> {
    try {
      await execAsync('ollama --version');
      console.log('✅ Ollama is installed');
    } catch (error) {
      console.error('❌ Ollama is not installed or not in PATH');
      console.log('📥 Please install Ollama from: https://ollama.ai/download');
      throw new Error('Ollama is not installed');
    }
  }

  /**
   * Pull model if it doesn't exist locally
   */
  private async pullModelIfNeeded(modelName: string): Promise<void> {
    try {
      // Check if model exists locally
      const { stdout } = await execAsync('ollama list');
      
      if (!stdout.includes(modelName)) {
        console.log(`📥 Pulling ${modelName} model (this may take several minutes for first download)...`);
        
        // For Llama 3.2, provide progress feedback
        if (modelName.includes('llama3.2')) {
          console.log('⏳ Llama 3.2 is a large model (~2GB). Please be patient...');
        }
        
        await execAsync(`ollama pull ${modelName}`, { timeout: 600000 }); // 10 minute timeout
        console.log(`✅ ${modelName} model pulled successfully`);
      } else {
        console.log(`✅ ${modelName} model already exists locally`);
      }
    } catch (error) {
      console.error(`❌ Failed to pull ${modelName} model:`, error);
      
      // Provide helpful error message for common issues
      if ((error as any).message?.includes('timeout')) {
        console.log('💡 Tip: Llama 3.2 download timed out. Try running "ollama pull llama3.2" manually first.');
      }
      
      throw error;
    }
  }

  /**
   * Check if a model is running on a specific port
   */
  private async isModelRunning(port: number): Promise<boolean> {
    try {
      const response = await axios.get(`http://localhost:${port}/api/tags`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Wait for a model to be ready
   */
  private async waitForModelReady(port: number, modelName: string): Promise<void> {
    const maxAttempts = 30; // 30 seconds
    const interval = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (await this.isModelRunning(port)) {
          return;
        }
      } catch {
        // Continue waiting
      }
      
      console.log(`⏳ Waiting for ${modelName} to be ready... (${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`${modelName} failed to start within ${maxAttempts} seconds`);
  }

  /**
   * Start health monitoring for all models
   */
  private startHealthMonitoring(): void {
    this.config.models.forEach(model => {
      const interval = setInterval(async () => {
        const isHealthy = await this.isModelRunning(model.port);
        
        if (!isHealthy) {
          console.warn(`⚠️ ${model.name} health check failed`);
          
          if (this.config.restartOnFailure) {
            console.log(`🔄 Restarting ${model.name}...`);
            await this.startModel(model);
          }
        }
      }, this.config.healthCheckInterval);
      
      this.healthCheckIntervals.set(model.name, interval);
    });
  }

  /**
   * Stop all models
   */
  async stopAllModels(): Promise<void> {
    console.log('🛑 Stopping all AI models...');
    
    // Clear health check intervals
    this.healthCheckIntervals.forEach(interval => clearInterval(interval));
    this.healthCheckIntervals.clear();
    
    // Stop all processes
    const stopPromises = Array.from(this.runningModels.entries()).map(([name, childProcess]) => {
      return new Promise<void>((resolve) => {
        console.log(`🛑 Stopping ${name}...`);
        
        childProcess.on('exit', () => {
          console.log(`✅ ${name} stopped`);
          resolve();
        });
        
        // Try graceful shutdown first
        childProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!childProcess.killed) {
            childProcess.kill('SIGKILL');
          }
        }, 5000);
      });
    });
    
    await Promise.all(stopPromises);
    this.runningModels.clear();
    
    console.log('✅ All AI models stopped');
  }

  /**
   * Get status of all models
   */
  async getModelsStatus(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const model of this.config.models) {
      status[model.name] = await this.isModelRunning(model.port);
    }
    
    // For backward compatibility, also provide GMM/FMM status
    // Both point to the same Newsletter-AI model
    if (status['Newsletter-AI'] !== undefined) {
      status['GMM'] = status['Newsletter-AI'];
      status['FMM'] = status['Newsletter-AI'];
    }
    
    return status;
  }

  /**
   * Restart a specific model
   */
  async restartModel(modelName: string): Promise<void> {
    const model = this.config.models.find(m => m.name === modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not found in configuration`);
    }

    // Stop the model if running
    const childProcess = this.runningModels.get(modelName);
    if (childProcess) {
      childProcess.kill('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Start the model
    await this.startModel(model);
  }
}

// Default configuration for Newsletter Grading System with Llama 3.2
const DEFAULT_CONFIG: StartupConfig = {
  models: [
    {
      name: 'Newsletter-AI',
      port: 11434,
      modelFile: 'llama3.2', // Updated to use Llama 3.2 for newsletter analysis
    },
  ],
  maxStartupTime: 120000, // 2 minutes for Llama 3.2 download if needed
  healthCheckInterval: 30000, // 30 seconds
  restartOnFailure: true,
};

// Create and export the manager instance
export const modelStartupManager = new ModelStartupManager(DEFAULT_CONFIG);

// Initialize Professional AI Router
export const professionalAI = new ProfessionalAIRouter({
  primaryEngine: 'transformers',
  fallbackEngines: ['onnx', 'openai'],
  openaiApiKey: process.env.OPENAI_API_KEY,
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  await modelStartupManager.stopAllModels();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  await modelStartupManager.stopAllModels();
  process.exit(0);
});

export default ModelStartupManager;