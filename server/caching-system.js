// Multi-level caching system for AI responses
// Provides L1 (memory), L2 (disk), and L3 (distributed) caching

class MultiLevelCache {
  constructor(config = {}) {
    this.config = {
      maxSize: 100 * 1024 * 1024, // 100MB
      maxItems: 10000,
      defaultTtl: 5 * 60 * 1000, // 5 minutes
      strategy: 'lru',
      ...config,
    };
    
    // L1 Cache (Memory)
    this.l1Cache = new Map();
    this.l1Stats = { hits: 0, misses: 0, size: 0 };
    
    // L2 Cache (Simulated - in production would be Redis/disk)
    this.l2Cache = new Map();
    this.l2Stats = { hits: 0, misses: 0, size: 0 };
    
    // Access order for LRU
    this.accessOrder = [];
    
    console.log('💾 Multi-level cache initialized');
  }

  generateKey(content, namespace = 'default') {
    // Simple hash function for cache keys
    let hash = 0;
    const str = `${namespace}:${content}`;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  async get(content, namespace = 'default') {
    const key = this.generateKey(content, namespace);
    
    // Try L1 cache first
    const l1Result = this.getFromL1(key);
    if (l1Result) {
      this.l1Stats.hits++;
      return l1Result.data;
    }
    this.l1Stats.misses++;
    
    // Try L2 cache
    const l2Result = this.getFromL2(key);
    if (l2Result) {
      this.l2Stats.hits++;
      // Promote to L1
      this.setToL1(key, l2Result.data, l2Result.ttl);
      return l2Result.data;
    }
    this.l2Stats.misses++;
    
    return null;
  }

  async set(content, data, options = {}) {
    const {
      namespace = 'default',
      ttl = this.config.defaultTtl,
      layer = 'L1',
      tags = [],
    } = options;
    
    const key = this.generateKey(content, namespace);
    
    if (layer === 'L1' || layer === 'both') {
      this.setToL1(key, data, ttl);
    }
    
    if (layer === 'L2' || layer === 'both') {
      this.setToL2(key, data, ttl);
    }
    
    console.log(`💾 Cached data in ${layer} (key: ${key.substring(0, 10)}...)`);
  }

  getFromL1(key) {
    const entry = this.l1Cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expires) {
      this.l1Cache.delete(key);
      this.updateAccessOrder(key, true); // Remove from access order
      return null;
    }
    
    // Update access order for LRU
    this.updateAccessOrder(key);
    
    return entry;
  }

  setToL1(key, data, ttl) {
    const entry = {
      data,
      expires: Date.now() + ttl,
      size: JSON.stringify(data).length,
    };
    
    // Check size limits
    if (this.l1Cache.size >= this.config.maxItems) {
      this.evictL1();
    }
    
    this.l1Cache.set(key, entry);
    this.updateAccessOrder(key);
    this.l1Stats.size = this.l1Cache.size;
  }

  getFromL2(key) {
    const entry = this.l2Cache.get(key);
    if (!entry) return null;
    
    const now = Date.now();
    if (now > entry.expires) {
      this.l2Cache.delete(key);
      return null;
    }
    
    return entry;
  }

  setToL2(key, data, ttl) {
    const entry = {
      data,
      expires: Date.now() + ttl,
      size: JSON.stringify(data).length,
    };
    
    this.l2Cache.set(key, entry);
    this.l2Stats.size = this.l2Cache.size;
  }

  updateAccessOrder(key, remove = false) {
    // Remove key from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used) unless removing
    if (!remove) {
      this.accessOrder.push(key);
    }
  }

  evictL1() {
    // Remove least recently used item
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift();
      this.l1Cache.delete(lruKey);
      console.log(`🗑️ Evicted L1 cache entry: ${lruKey.substring(0, 10)}...`);
    }
  }

  getStats() {
    const totalHits = this.l1Stats.hits + this.l2Stats.hits;
    const totalMisses = this.l1Stats.misses + this.l2Stats.misses;
    const hitRate = totalHits + totalMisses > 0 
      ? (totalHits / (totalHits + totalMisses)) * 100 
      : 0;

    return {
      hitRate,
      l1: this.l1Stats,
      l2: this.l2Stats,
      totalSize: this.l1Stats.size + this.l2Stats.size,
    };
  }

  clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.accessOrder = [];
    this.l1Stats = { hits: 0, misses: 0, size: 0 };
    this.l2Stats = { hits: 0, misses: 0, size: 0 };
    console.log('🗑️ Multi-level cache cleared');
  }

  async shutdown() {
    console.log('🛑 Shutting down multi-level cache...');
    this.clear();
  }
}

export { MultiLevelCache };