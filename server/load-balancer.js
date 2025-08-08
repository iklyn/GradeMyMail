// Simple load balancer for AI model instances
// This provides basic round-robin load balancing with health checks

import axios from 'axios';

class AIModelLoadBalancer {
  constructor(config = {}) {
    this.config = {
      strategy: 'round-robin',
      healthCheckInterval: 30000,
      maxRetries: 3,
      ...config,
    };
    
    this.instances = new Map();
    this.currentIndex = 0;
    this.stats = {
      totalInstances: 0,
      healthyInstances: 0,
      requests: 0,
      successful: 0,
      failed: 0,
    };
  }

  addInstance(id, host, port, weight = 1) {
    const instance = {
      id,
      host,
      port,
      weight,
      healthy: true,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
      requests: 0,
      successful: 0,
      failed: 0,
    };
    
    this.instances.set(id, instance);
    this.updateStats();
    
    console.log(`➕ Added load balancer instance: ${id} (${host}:${port})`);
  }

  removeInstance(id) {
    if (this.instances.delete(id)) {
      this.updateStats();
      console.log(`➖ Removed load balancer instance: ${id}`);
    }
  }

  updateStats() {
    this.stats.totalInstances = this.instances.size;
    this.stats.healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.healthy).length;
  }

  getHealthyInstance() {
    const healthyInstances = Array.from(this.instances.values())
      .filter(instance => instance.healthy);
    
    if (healthyInstances.length === 0) {
      throw new Error('No healthy instances available');
    }

    // Simple round-robin selection
    const instance = healthyInstances[this.currentIndex % healthyInstances.length];
    this.currentIndex++;
    
    return instance;
  }

  async makeRequest(endpoint, data, options = {}) {
    const maxRetries = options.maxRetries || this.config.maxRetries;
    let lastError;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const instance = this.getHealthyInstance();
        const url = `http://${instance.host}:${instance.port}${endpoint}`;
        
        console.log(`🔄 Load balancer request to ${instance.id}: ${endpoint}`);
        
        const response = await axios.post(url, data, {
          timeout: 30000,
          ...options,
        });

        // Update success stats
        instance.successful++;
        instance.requests++;
        this.stats.successful++;
        this.stats.requests++;
        
        // Reset failure count on success
        instance.consecutiveFailures = 0;
        instance.healthy = true;
        
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Update failure stats
        const instance = Array.from(this.instances.values())[0]; // Fallback
        if (instance) {
          instance.failed++;
          instance.requests++;
          instance.consecutiveFailures++;
          
          // Mark as unhealthy after too many failures
          if (instance.consecutiveFailures >= 3) {
            instance.healthy = false;
            console.warn(`⚠️ Marking instance ${instance.id} as unhealthy`);
          }
        }
        
        this.stats.failed++;
        this.stats.requests++;
        
        console.warn(`❌ Load balancer request failed (attempt ${attempt + 1}/${maxRetries}):`, error.message);
      }
    }

    throw lastError || new Error('All load balancer attempts failed');
  }

  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  async shutdown() {
    console.log('🛑 Shutting down load balancer...');
    this.instances.clear();
    this.updateStats();
  }
}

export { AIModelLoadBalancer };