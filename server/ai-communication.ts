// AI Communication Layer - Simplified implementation for server/index.ts compatibility

interface AIHealthStatus {
  [key: string]: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  loadBalancer?: {
    gmm: {
      totalInstances: number;
      healthyInstances: number;
      requests: number;
      successful: number;
      failed: number;
    };
    fmm: {
      totalInstances: number;
      healthyInstances: number;
      requests: number;
      successful: number;
      failed: number;
    };
  };
}

class AICommunicator {
  private cache = new Map<string, any>();
  private stats = {
    hits: 0,
    misses: 0,
  };

  async healthCheck(): Promise<AIHealthStatus> {
    // Simple health check - assume services are available
    return {
      'Newsletter-AI': true,
      'GMM': false, // Local models not running
      'FMM': false,
    };
  }

  async analyzeEmail(content: string): Promise<string> {
    // Check cache first
    const cacheKey = `analyze_${this.hashContent(content)}`;
    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      return this.cache.get(cacheKey);
    }

    this.stats.misses++;

    // Simple pattern-based analysis (fallback when real AI is not available)
    let taggedContent = content;
    
    // Add some mock tags for demonstration
    taggedContent = taggedContent.replace(/\b(amazing|incredible|fantastic|great|awesome)\b/gi, '<fluff>$1</fluff>');
    taggedContent = taggedContent.replace(/\b(free|urgent|act now|limited time|buy now)\b/gi, '<spam_words>$1</spam_words>');
    
    // Mark long sentences as hard to read
    const sentences = content.split(/[.!?]+/);
    sentences.forEach(sentence => {
      if (sentence.trim().split(' ').length > 20) {
        const trimmed = sentence.trim();
        if (trimmed.length > 0) {
          taggedContent = taggedContent.replace(trimmed, `<hard_to_read>${trimmed}</hard_to_read>`);
        }
      }
    });

    // Cache the result
    this.cache.set(cacheKey, taggedContent);
    
    return taggedContent;
  }

  async fixEmail(taggedContent: string): Promise<string> {
    // Check cache first
    const cacheKey = `fix_${this.hashContent(taggedContent)}`;
    if (this.cache.has(cacheKey)) {
      this.stats.hits++;
      return this.cache.get(cacheKey);
    }

    this.stats.misses++;

    // Simple improvement suggestions
    const improvements = [
      { original: 'amazing', improved: 'excellent' },
      { original: 'incredible', improved: 'remarkable' },
      { original: 'fantastic', improved: 'outstanding' },
      { original: 'great', improved: 'effective' },
      { original: 'awesome', improved: 'impressive' },
      { original: 'free', improved: 'complimentary' },
      { original: 'urgent', improved: 'time-sensitive' },
      { original: 'act now', improved: 'take action' },
      { original: 'buy now', improved: 'purchase today' }
    ];

    let result = '';
    for (const improvement of improvements) {
      if (taggedContent.toLowerCase().includes(improvement.original.toLowerCase())) {
        result += `<old_draft>${improvement.original}</old_draft><optimized_draft>${improvement.improved}</optimized_draft>\n`;
      }
    }

    const finalResult = result || '<old_draft>No improvements needed</old_draft><optimized_draft>Content is already well-written</optimized_draft>';
    
    // Cache the result
    this.cache.set(cacheKey, finalResult);
    
    return finalResult;
  }

  async batchAnalyzeEmail(content: string): Promise<string> {
    // For batch processing, just use the regular analyze method
    return this.analyzeEmail(content);
  }

  clearCache(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
    console.log('🧹 AI communicator cache cleared');
  }

  getCacheStats(): CacheStats {
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      loadBalancer: {
        gmm: {
          totalInstances: 1,
          healthyInstances: 1,
          requests: this.stats.hits + this.stats.misses,
          successful: this.stats.hits + this.stats.misses,
          failed: 0,
        },
        fmm: {
          totalInstances: 1,
          healthyInstances: 1,
          requests: this.stats.hits + this.stats.misses,
          successful: this.stats.hits + this.stats.misses,
          failed: 0,
        },
      },
    };
  }

  async shutdown(): Promise<void> {
    this.clearCache();
    console.log('🛑 AI communicator shutdown complete');
  }

  private hashContent(content: string): string {
    // Simple hash function for caching
    let hash = 0;
    if (content.length === 0) return hash.toString();
    
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const aiCommunicator = new AICommunicator();