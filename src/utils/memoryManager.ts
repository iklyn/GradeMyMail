// Memory management and leak prevention utilities

// Memory leak detector configuration
export interface MemoryLeakConfig {
  enableDetection: boolean;
  checkInterval: number; // ms
  memoryThreshold: number; // MB
  maxRetainedObjects: number;
  enableObjectTracking: boolean;
  enableEventListenerTracking: boolean;
}

// Memory leak detection result
export interface MemoryLeakDetection {
  timestamp: number;
  memoryUsage: {
    used: number;
    total: number;
    limit: number;
    percentage: number;
  };
  leaks: Array<{
    type: 'event-listener' | 'timer' | 'object-retention' | 'dom-reference';
    description: string;
    count: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  recommendations: string[];
}

// Cleanup registry for tracking resources
class CleanupRegistry {
  private cleanupFunctions: Map<string, () => void> = new Map();
  private timers: Set<number> = new Set();
  private intervals: Set<number> = new Set();
  private eventListeners: Map<EventTarget, Array<{ event: string; handler: EventListener; options?: any }>> = new Map();
  private observers: Set<MutationObserver | IntersectionObserver | ResizeObserver> = new Set();
  private abortControllers: Set<AbortController> = new Set();

  // Register a cleanup function
  register(id: string, cleanup: () => void): void {
    this.cleanupFunctions.set(id, cleanup);
  }

  // Unregister a cleanup function
  unregister(id: string): void {
    this.cleanupFunctions.delete(id);
  }

  // Register a timer
  registerTimer(timerId: number): void {
    this.timers.add(timerId);
  }

  // Register an interval
  registerInterval(intervalId: number): void {
    this.intervals.add(intervalId);
  }

  // Register an event listener
  registerEventListener(target: EventTarget, event: string, handler: EventListener, options?: any): void {
    if (!this.eventListeners.has(target)) {
      this.eventListeners.set(target, []);
    }
    this.eventListeners.get(target)!.push({ event, handler, options });
  }

  // Register an observer
  registerObserver(observer: MutationObserver | IntersectionObserver | ResizeObserver): void {
    this.observers.add(observer);
  }

  // Register an abort controller
  registerAbortController(controller: AbortController): void {
    this.abortControllers.add(controller);
  }

  // Clean up all registered resources
  cleanup(): void {
    // Run custom cleanup functions
    this.cleanupFunctions.forEach((cleanup, id) => {
      try {
        cleanup();
      } catch (error) {
        console.warn(`Cleanup function ${id} failed:`, error);
      }
    });
    this.cleanupFunctions.clear();

    // Clear timers
    this.timers.forEach(timerId => clearTimeout(timerId));
    this.timers.clear();

    // Clear intervals
    this.intervals.forEach(intervalId => clearInterval(intervalId));
    this.intervals.clear();

    // Remove event listeners
    this.eventListeners.forEach((listeners, target) => {
      listeners.forEach(({ event, handler, options }) => {
        try {
          target.removeEventListener(event, handler, options);
        } catch (error) {
          console.warn('Failed to remove event listener:', error);
        }
      });
    });
    this.eventListeners.clear();

    // Disconnect observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Failed to disconnect observer:', error);
      }
    });
    this.observers.clear();

    // Abort controllers
    this.abortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        console.warn('Failed to abort controller:', error);
      }
    });
    this.abortControllers.clear();
  }

  // Get current resource counts
  getResourceCounts(): {
    cleanupFunctions: number;
    timers: number;
    intervals: number;
    eventListeners: number;
    observers: number;
    abortControllers: number;
  } {
    return {
      cleanupFunctions: this.cleanupFunctions.size,
      timers: this.timers.size,
      intervals: this.intervals.size,
      eventListeners: Array.from(this.eventListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0),
      observers: this.observers.size,
      abortControllers: this.abortControllers.size,
    };
  }
}

// Memory leak detector
class MemoryLeakDetector {
  private config: MemoryLeakConfig;
  private detectionInterval?: number;
  private memoryHistory: Array<{ timestamp: number; usage: number }> = [];
  private objectCounts: Map<string, number> = new Map();
  private lastGCTime: number = 0;

  constructor(config: Partial<MemoryLeakConfig> = {}) {
    this.config = {
      enableDetection: true,
      checkInterval: 30000, // 30 seconds
      memoryThreshold: 100, // 100MB
      maxRetainedObjects: 10000,
      enableObjectTracking: false, // Disabled by default due to performance impact
      enableEventListenerTracking: true,
      ...config,
    };
  }

  // Start memory leak detection
  start(): void {
    if (!this.config.enableDetection) return;

    this.detectionInterval = window.setInterval(() => {
      this.checkForLeaks();
    }, this.config.checkInterval);

    // Initial check
    this.checkForLeaks();
  }

  // Stop memory leak detection
  stop(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = undefined;
    }
  }

  // Check for memory leaks
  private checkForLeaks(): void {
    const detection = this.detectLeaks();
    
    if (detection.leaks.length > 0) {
      console.warn('Memory leaks detected:', detection);
      
      // Trigger garbage collection if available
      this.suggestGarbageCollection();
    }

    // Store detection result
    localStorage.setItem('memoryLeakDetection', JSON.stringify(detection));
  }

  // Detect memory leaks
  detectLeaks(): MemoryLeakDetection {
    const memoryUsage = this.getMemoryUsage();
    const leaks: MemoryLeakDetection['leaks'] = [];
    const recommendations: string[] = [];

    // Update memory history
    this.memoryHistory.push({
      timestamp: Date.now(),
      usage: memoryUsage.used,
    });

    // Keep only last 10 measurements
    if (this.memoryHistory.length > 10) {
      this.memoryHistory.shift();
    }

    // Check for memory growth trend
    if (this.memoryHistory.length >= 3) {
      const trend = this.analyzeMemoryTrend();
      if (trend.isIncreasing && trend.rate > 5) { // 5MB/check increase
        leaks.push({
          type: 'object-retention',
          description: `Memory usage increasing by ${trend.rate.toFixed(1)}MB per check`,
          count: 1,
          severity: trend.rate > 20 ? 'high' : 'medium',
        });
        recommendations.push('Memory usage is consistently increasing. Check for object retention and cleanup.');
      }
    }

    // Check absolute memory usage
    if (memoryUsage.used > this.config.memoryThreshold * 1024 * 1024) {
      leaks.push({
        type: 'object-retention',
        description: `High memory usage: ${(memoryUsage.used / 1024 / 1024).toFixed(1)}MB`,
        count: 1,
        severity: memoryUsage.percentage > 80 ? 'high' : 'medium',
      });
      recommendations.push('High memory usage detected. Consider optimizing data structures and clearing unused objects.');
    }

    // Check for excessive DOM nodes
    const domNodeCount = document.querySelectorAll('*').length;
    if (domNodeCount > 5000) {
      leaks.push({
        type: 'dom-reference',
        description: `Excessive DOM nodes: ${domNodeCount}`,
        count: domNodeCount,
        severity: domNodeCount > 10000 ? 'high' : 'medium',
      });
      recommendations.push('High DOM node count detected. Check for unnecessary DOM elements and cleanup.');
    }

    // Check for potential timer leaks
    const timerCount = this.estimateActiveTimers();
    if (timerCount > 50) {
      leaks.push({
        type: 'timer',
        description: `Potentially excessive timers: ~${timerCount}`,
        count: timerCount,
        severity: timerCount > 100 ? 'high' : 'medium',
      });
      recommendations.push('High number of active timers detected. Ensure timers are properly cleared.');
    }

    return {
      timestamp: Date.now(),
      memoryUsage,
      leaks,
      recommendations,
    };
  }

  // Get current memory usage
  private getMemoryUsage(): MemoryLeakDetection['memoryUsage'] {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }

    return {
      used: 0,
      total: 0,
      limit: 0,
      percentage: 0,
    };
  }

  // Analyze memory usage trend
  private analyzeMemoryTrend(): { isIncreasing: boolean; rate: number } {
    if (this.memoryHistory.length < 3) {
      return { isIncreasing: false, rate: 0 };
    }

    const recent = this.memoryHistory.slice(-3);
    const increases = recent.slice(1).every((point, index) => 
      point.usage > recent[index].usage
    );

    if (increases) {
      const totalIncrease = recent[recent.length - 1].usage - recent[0].usage;
      const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
      const rate = (totalIncrease / (1024 * 1024)) / (timeSpan / this.config.checkInterval);
      
      return { isIncreasing: true, rate };
    }

    return { isIncreasing: false, rate: 0 };
  }

  // Estimate active timers (rough approximation)
  private estimateActiveTimers(): number {
    // This is a rough estimation based on common patterns
    // In a real implementation, you might track timers more precisely
    const scripts = document.querySelectorAll('script').length;
    const components = document.querySelectorAll('[data-reactroot], [data-react-component]').length;
    
    // Rough estimate: 2-3 timers per component on average
    return Math.max(scripts + components * 2, 10);
  }

  // Suggest garbage collection
  private suggestGarbageCollection(): void {
    const now = Date.now();
    
    // Don't suggest GC too frequently
    if (now - this.lastGCTime < 60000) return; // 1 minute cooldown
    
    if ('gc' in window && typeof (window as any).gc === 'function') {
      console.log('Triggering manual garbage collection...');
      (window as any).gc();
      this.lastGCTime = now;
    } else {
      console.log('Manual garbage collection not available. Consider enabling --expose-gc flag in development.');
    }
  }
}

// Global instances
let cleanupRegistry: CleanupRegistry | null = null;
let memoryLeakDetector: MemoryLeakDetector | null = null;

// Initialize memory management
export function initMemoryManager(config?: Partial<MemoryLeakConfig>): {
  registry: CleanupRegistry;
  detector: MemoryLeakDetector;
} {
  // Cleanup existing instances
  if (cleanupRegistry) {
    cleanupRegistry.cleanup();
  }
  if (memoryLeakDetector) {
    memoryLeakDetector.stop();
  }

  cleanupRegistry = new CleanupRegistry();
  memoryLeakDetector = new MemoryLeakDetector(config);
  
  memoryLeakDetector.start();

  // Setup page unload cleanup
  const cleanup = () => {
    cleanupRegistry?.cleanup();
    memoryLeakDetector?.stop();
  };

  window.addEventListener('beforeunload', cleanup);
  window.addEventListener('pagehide', cleanup);

  // Register the cleanup for the cleanup registry itself
  cleanupRegistry.register('memory-manager', () => {
    window.removeEventListener('beforeunload', cleanup);
    window.removeEventListener('pagehide', cleanup);
  });

  return {
    registry: cleanupRegistry,
    detector: memoryLeakDetector,
  };
}

// Get current memory manager instances
export function getMemoryManager(): {
  registry: CleanupRegistry | null;
  detector: MemoryLeakDetector | null;
} {
  return {
    registry: cleanupRegistry,
    detector: memoryLeakDetector,
  };
}

// Cleanup memory manager
export function cleanupMemoryManager(): void {
  if (cleanupRegistry) {
    cleanupRegistry.cleanup();
    cleanupRegistry = null;
  }
  
  if (memoryLeakDetector) {
    memoryLeakDetector.stop();
    memoryLeakDetector = null;
  }
}

// Enhanced timer functions with automatic cleanup
export function createTimer(callback: () => void, delay: number): number {
  const timerId = window.setTimeout(callback, delay);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerTimer(timerId);
  }
  
  return timerId;
}

export function createInterval(callback: () => void, delay: number): number {
  const intervalId = window.setInterval(callback, delay);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerInterval(intervalId);
  }
  
  return intervalId;
}

// Enhanced event listener with automatic cleanup
export function addEventListener(
  target: EventTarget,
  event: string,
  handler: EventListener,
  options?: AddEventListenerOptions
): void {
  target.addEventListener(event, handler, options);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerEventListener(target, event, handler, options);
  }
}

// Enhanced observer creation with automatic cleanup
export function createMutationObserver(callback: MutationCallback): MutationObserver {
  const observer = new MutationObserver(callback);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerObserver(observer);
  }
  
  return observer;
}

export function createIntersectionObserver(callback: IntersectionObserverCallback, options?: IntersectionObserverInit): IntersectionObserver {
  const observer = new IntersectionObserver(callback, options);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerObserver(observer);
  }
  
  return observer;
}

export function createResizeObserver(callback: ResizeObserverCallback): ResizeObserver {
  const observer = new ResizeObserver(callback);
  
  if (cleanupRegistry) {
    cleanupRegistry.registerObserver(observer);
  }
  
  return observer;
}

// Enhanced AbortController with automatic cleanup
export function createAbortController(): AbortController {
  const controller = new AbortController();
  
  if (cleanupRegistry) {
    cleanupRegistry.registerAbortController(controller);
  }
  
  return controller;
}

// React hook for automatic cleanup
export function useCleanup(cleanup: () => void, deps?: any[]): void {
  React.useEffect(() => {
    const id = `react-cleanup-${Date.now()}-${Math.random()}`;
    
    if (cleanupRegistry) {
      cleanupRegistry.register(id, cleanup);
    }

    return () => {
      if (cleanupRegistry) {
        cleanupRegistry.unregister(id);
      }
      cleanup();
    };
  }, deps);
}

// Memory usage monitoring hook
export function useMemoryMonitoring(): {
  memoryUsage: MemoryLeakDetection['memoryUsage'];
  leaks: MemoryLeakDetection['leaks'];
  recommendations: string[];
} {
  const [detection, setDetection] = React.useState<MemoryLeakDetection>({
    timestamp: Date.now(),
    memoryUsage: { used: 0, total: 0, limit: 0, percentage: 0 },
    leaks: [],
    recommendations: [],
  });

  React.useEffect(() => {
    const updateDetection = () => {
      if (memoryLeakDetector) {
        const newDetection = memoryLeakDetector.detectLeaks();
        setDetection(newDetection);
      }
    };

    // Update immediately
    updateDetection();

    // Update every 10 seconds
    const interval = setInterval(updateDetection, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    memoryUsage: detection.memoryUsage,
    leaks: detection.leaks,
    recommendations: detection.recommendations,
  };
}