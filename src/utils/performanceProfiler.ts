import { getPerformanceMonitor, type PerformanceMetrics } from './webVitals';

// Performance profiling configuration
export interface ProfilerConfig {
  enableComponentProfiling: boolean;
  enableRenderProfiling: boolean;
  enableMemoryProfiling: boolean;
  enableNetworkProfiling: boolean;
  sampleRate: number; // 0-1, percentage of operations to profile
  maxSamples: number;
  reportThreshold: number; // ms
}

// Performance sample data
export interface PerformanceSample {
  id: string;
  name: string;
  type: 'component' | 'render' | 'network' | 'memory' | 'custom';
  startTime: number;
  endTime: number;
  duration: number;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

// Performance report
export interface PerformanceReport {
  timestamp: number;
  url: string;
  samples: PerformanceSample[];
  metrics: PerformanceMetrics;
  summary: {
    totalSamples: number;
    averageDuration: number;
    slowestOperations: PerformanceSample[];
    memoryLeaks: Array<{
      component: string;
      leakSize: number;
      timestamp: number;
    }>;
    recommendations: string[];
  };
}

// Performance profiler class
class PerformanceProfiler {
  private config: ProfilerConfig;
  private samples: PerformanceSample[] = [];
  private activeSamples: Map<string, { startTime: number; metadata?: Record<string, any> }> = new Map();
  private componentRenderCounts: Map<string, number> = new Map();
  private memoryBaseline: number = 0;
  private networkRequests: Map<string, { startTime: number; url: string }> = new Map();

  constructor(config: Partial<ProfilerConfig> = {}) {
    this.config = {
      enableComponentProfiling: true,
      enableRenderProfiling: true,
      enableMemoryProfiling: true,
      enableNetworkProfiling: true,
      sampleRate: 0.1, // Profile 10% of operations
      maxSamples: 1000,
      reportThreshold: 16, // 16ms (60fps threshold)
      ...config,
    };

    this.initMemoryBaseline();
    this.setupNetworkProfiling();
  }

  // Initialize memory baseline
  private initMemoryBaseline(): void {
    if ('memory' in performance) {
      this.memoryBaseline = (performance as any).memory.usedJSHeapSize;
    }
  }

  // Setup network request profiling
  private setupNetworkProfiling(): void {
    if (!this.config.enableNetworkProfiling) return;

    // Intercept fetch requests
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const requestId = this.generateId();
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      this.startSample(requestId, 'network', { url, method: 'fetch' });
      
      try {
        const response = await originalFetch(...args);
        this.endSample(requestId, { 
          status: response.status, 
          size: response.headers.get('content-length') || 'unknown' 
        });
        return response;
      } catch (error) {
        this.endSample(requestId, { error: error instanceof Error ? error.message : 'Unknown error' });
        throw error;
      }
    };

    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
      (this as any)._profileId = this.generateId?.() || Math.random().toString(36);
      (this as any)._profileUrl = url.toString();
      (this as any)._profileMethod = method;
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args: any[]) {
      const profileId = (this as any)._profileId;
      const url = (this as any)._profileUrl;
      const method = (this as any)._profileMethod;

      if (profileId) {
        this.startSample?.(profileId, 'network', { url, method: 'xhr' });

        this.addEventListener('loadend', () => {
          this.endSample?.(profileId, { 
            status: this.status, 
            size: this.getResponseHeader('content-length') || 'unknown' 
          });
        });
      }

      return originalXHRSend.call(this, ...args);
    };
  }

  // Generate unique ID
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Check if operation should be sampled
  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  // Start performance sample
  startSample(id: string, type: PerformanceSample['type'], metadata?: Record<string, any>): void {
    if (!this.shouldSample()) return;

    const startTime = performance.now();
    this.activeSamples.set(id, { startTime, metadata });

    // Track component renders
    if (type === 'component' && metadata?.componentName) {
      const count = this.componentRenderCounts.get(metadata.componentName) || 0;
      this.componentRenderCounts.set(metadata.componentName, count + 1);
    }
  }

  // End performance sample
  endSample(id: string, additionalMetadata?: Record<string, any>): void {
    const activeSample = this.activeSamples.get(id);
    if (!activeSample) return;

    const endTime = performance.now();
    const duration = endTime - activeSample.startTime;

    const sample: PerformanceSample = {
      id,
      name: additionalMetadata?.name || id,
      type: additionalMetadata?.type || 'custom',
      startTime: activeSample.startTime,
      endTime,
      duration,
      metadata: { ...activeSample.metadata, ...additionalMetadata },
    };

    // Add stack trace for slow operations
    if (duration > this.config.reportThreshold) {
      sample.stackTrace = new Error().stack;
    }

    this.samples.push(sample);
    this.activeSamples.delete(id);

    // Maintain sample limit
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }

    // Log slow operations
    if (duration > this.config.reportThreshold) {
      console.warn(`Slow operation detected: ${sample.name} took ${duration.toFixed(2)}ms`, sample);
    }
  }

  // Profile a function execution
  profile<T>(name: string, fn: () => T, type: PerformanceSample['type'] = 'custom', metadata?: Record<string, any>): T {
    const id = this.generateId();
    this.startSample(id, type, { name, ...metadata });

    try {
      const result = fn();
      
      // Handle promises
      if (result instanceof Promise) {
        return result.finally(() => {
          this.endSample(id);
        }) as unknown as T;
      }

      this.endSample(id);
      return result;
    } catch (error) {
      this.endSample(id, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Profile async function execution
  async profileAsync<T>(name: string, fn: () => Promise<T>, type: PerformanceSample['type'] = 'custom', metadata?: Record<string, any>): Promise<T> {
    const id = this.generateId();
    this.startSample(id, type, { name, ...metadata });

    try {
      const result = await fn();
      this.endSample(id);
      return result;
    } catch (error) {
      this.endSample(id, { error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    }
  }

  // Get memory usage delta
  getMemoryDelta(): number {
    if (!('memory' in performance)) return 0;
    
    const currentMemory = (performance as any).memory.usedJSHeapSize;
    return currentMemory - this.memoryBaseline;
  }

  // Detect potential memory leaks
  detectMemoryLeaks(): Array<{ component: string; leakSize: number; timestamp: number }> {
    const leaks: Array<{ component: string; leakSize: number; timestamp: number }> = [];
    const memoryDelta = this.getMemoryDelta();

    // Check for components with excessive render counts
    this.componentRenderCounts.forEach((count, componentName) => {
      if (count > 100) { // Threshold for excessive renders
        leaks.push({
          component: componentName,
          leakSize: memoryDelta / this.componentRenderCounts.size, // Rough estimate
          timestamp: Date.now(),
        });
      }
    });

    return leaks;
  }

  // Generate performance recommendations
  generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const slowSamples = this.samples.filter(s => s.duration > this.config.reportThreshold);

    // Check for slow components
    const slowComponents = slowSamples.filter(s => s.type === 'component');
    if (slowComponents.length > 0) {
      recommendations.push(`Optimize ${slowComponents.length} slow components. Consider memoization or code splitting.`);
    }

    // Check for slow network requests
    const slowNetwork = slowSamples.filter(s => s.type === 'network');
    if (slowNetwork.length > 0) {
      recommendations.push(`${slowNetwork.length} slow network requests detected. Consider caching or request optimization.`);
    }

    // Check for excessive renders
    const excessiveRenders = Array.from(this.componentRenderCounts.entries())
      .filter(([, count]) => count > 50);
    if (excessiveRenders.length > 0) {
      recommendations.push(`${excessiveRenders.length} components have excessive renders. Check for unnecessary re-renders.`);
    }

    // Check memory usage
    const memoryDelta = this.getMemoryDelta();
    if (memoryDelta > 50 * 1024 * 1024) { // 50MB
      recommendations.push('High memory usage detected. Check for memory leaks and optimize data structures.');
    }

    return recommendations;
  }

  // Generate comprehensive performance report
  async generateReport(): Promise<PerformanceReport> {
    const performanceMonitor = getPerformanceMonitor();
    const metrics = performanceMonitor ? await performanceMonitor.generatePerformanceReport() : {
      webVitals: {},
      memory: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0, percentage: 0 },
      timing: { domContentLoaded: 0, loadComplete: 0, totalTime: 0 },
      resources: { totalResources: 0, totalSize: 0, slowResources: [] },
      longTasks: [],
    };

    const slowestOperations = [...this.samples]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    const report: PerformanceReport = {
      timestamp: Date.now(),
      url: window.location.href,
      samples: [...this.samples],
      metrics,
      summary: {
        totalSamples: this.samples.length,
        averageDuration: this.samples.reduce((sum, s) => sum + s.duration, 0) / this.samples.length || 0,
        slowestOperations,
        memoryLeaks: this.detectMemoryLeaks(),
        recommendations: this.generateRecommendations(),
      },
    };

    // Store report for debugging
    localStorage.setItem('performanceProfilerReport', JSON.stringify(report));

    return report;
  }

  // Clear all samples and reset counters
  clear(): void {
    this.samples = [];
    this.activeSamples.clear();
    this.componentRenderCounts.clear();
    this.networkRequests.clear();
    this.initMemoryBaseline();
  }

  // Get current profiler status
  getStatus(): {
    activeSamples: number;
    totalSamples: number;
    memoryDelta: number;
    topComponents: Array<{ name: string; renders: number }>;
  } {
    const topComponents = Array.from(this.componentRenderCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, renders]) => ({ name, renders }));

    return {
      activeSamples: this.activeSamples.size,
      totalSamples: this.samples.length,
      memoryDelta: this.getMemoryDelta(),
      topComponents,
    };
  }
}

// Global profiler instance
let performanceProfiler: PerformanceProfiler | null = null;

// Initialize performance profiler
export function initPerformanceProfiler(config?: Partial<ProfilerConfig>): PerformanceProfiler {
  if (performanceProfiler) {
    performanceProfiler.clear();
  }

  performanceProfiler = new PerformanceProfiler(config);
  return performanceProfiler;
}

// Get current profiler instance
export function getPerformanceProfiler(): PerformanceProfiler | null {
  return performanceProfiler;
}

// Cleanup profiler
export function cleanupPerformanceProfiler(): void {
  if (performanceProfiler) {
    performanceProfiler.clear();
    performanceProfiler = null;
  }
}

// Convenience functions for profiling
export function profileFunction<T>(name: string, fn: () => T, metadata?: Record<string, any>): T {
  const profiler = getPerformanceProfiler();
  if (!profiler) return fn();
  
  return profiler.profile(name, fn, 'custom', metadata);
}

export async function profileAsyncFunction<T>(name: string, fn: () => Promise<T>, metadata?: Record<string, any>): Promise<T> {
  const profiler = getPerformanceProfiler();
  if (!profiler) return fn();
  
  return profiler.profileAsync(name, fn, 'custom', metadata);
}

// React component profiling helpers
export function profileComponent(componentName: string) {
  return function<T extends React.ComponentType<any>>(Component: T): T {
    const ProfiledComponent = (props: any) => {
      const profiler = getPerformanceProfiler();
      
      if (!profiler) {
        return React.createElement(Component, props);
      }

      const id = `${componentName}-${Date.now()}`;
      profiler.startSample(id, 'component', { componentName });

      React.useEffect(() => {
        profiler.endSample(id);
      });

      return React.createElement(Component, props);
    };

    ProfiledComponent.displayName = `Profiled(${componentName})`;
    return ProfiledComponent as T;
  };
}