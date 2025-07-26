import { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { aiCommunicator } from './ai-communication.js';
import { retryManager, circuitBreakers } from './retry-logic.js';

// Performance metrics interface
export interface PerformanceMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  endpoints: Record<string, {
    count: number;
    averageTime: number;
    errors: number;
    lastAccessed: Date;
  }>;
  errors: {
    total: number;
    byType: Record<string, number>;
    byEndpoint: Record<string, number>;
    recentErrors: Array<{
      timestamp: Date;
      type: string;
      message: string;
      endpoint: string;
    }>;
  };
  system: {
    uptime: number;
    memory: NodeJS.MemoryUsage;
    cpu: number;
    timestamp: Date;
  };
  ai: {
    requests: number;
    failures: number;
    averageResponseTime: number;
    cacheHitRate: number;
    modelsHealth: Record<string, boolean>;
  };
}

// Request timing interface
interface RequestTiming {
  startTime: number;
  endTime?: number;
  duration?: number;
}

// Metrics collector class
class MetricsCollector {
  private metrics: PerformanceMetrics;
  private requestTimings = new Map<string, RequestTiming>();
  private responseTimes: number[] = [];
  private maxResponseTimeHistory = 1000; // Keep last 1000 response times
  private cpuUsage = 0;

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startCPUMonitoring();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      },
      endpoints: {},
      errors: {
        total: 0,
        byType: {},
        byEndpoint: {},
        recentErrors: []
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: 0,
        timestamp: new Date()
      },
      ai: {
        requests: 0,
        failures: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        modelsHealth: {}
      }
    };
  }

  private startCPUMonitoring(): void {
    let startUsage = process.cpuUsage();
    
    setInterval(() => {
      const currentUsage = process.cpuUsage(startUsage);
      const totalUsage = currentUsage.user + currentUsage.system;
      this.cpuUsage = totalUsage / 1000000; // Convert to milliseconds
      startUsage = process.cpuUsage();
    }, 5000); // Update every 5 seconds
  }

  // Start request timing
  startRequest(requestId: string): void {
    this.requestTimings.set(requestId, {
      startTime: performance.now()
    });
  }

  // End request timing and record metrics
  endRequest(requestId: string, req: Request, success: boolean, error?: any): void {
    const timing = this.requestTimings.get(requestId);
    if (!timing) return;

    const endTime = performance.now();
    const duration = endTime - timing.startTime;
    
    timing.endTime = endTime;
    timing.duration = duration;

    // Update general metrics
    this.metrics.requests.total++;
    if (success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }

    // Update response times
    this.responseTimes.push(duration);
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }

    // Calculate percentiles
    this.updateResponseTimePercentiles();

    // Update endpoint-specific metrics
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    if (!this.metrics.endpoints[endpoint]) {
      this.metrics.endpoints[endpoint] = {
        count: 0,
        averageTime: 0,
        errors: 0,
        lastAccessed: new Date()
      };
    }

    const endpointMetrics = this.metrics.endpoints[endpoint];
    endpointMetrics.count++;
    endpointMetrics.averageTime = (endpointMetrics.averageTime * (endpointMetrics.count - 1) + duration) / endpointMetrics.count;
    endpointMetrics.lastAccessed = new Date();

    if (!success && error) {
      endpointMetrics.errors++;
      this.recordError(error, endpoint);
    }

    // Clean up timing data
    this.requestTimings.delete(requestId);
  }

  private updateResponseTimePercentiles(): void {
    if (this.responseTimes.length === 0) return;

    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const total = sorted.reduce((sum, time) => sum + time, 0);
    
    this.metrics.requests.averageResponseTime = total / sorted.length;
    this.metrics.requests.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    this.metrics.requests.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];
  }

  // Record error metrics
  recordError(error: any, endpoint: string): void {
    this.metrics.errors.total++;
    
    const errorType = error.type || error.name || 'Unknown';
    this.metrics.errors.byType[errorType] = (this.metrics.errors.byType[errorType] || 0) + 1;
    this.metrics.errors.byEndpoint[endpoint] = (this.metrics.errors.byEndpoint[endpoint] || 0) + 1;

    // Add to recent errors (keep last 50)
    this.metrics.errors.recentErrors.push({
      timestamp: new Date(),
      type: errorType,
      message: error.message || 'Unknown error',
      endpoint
    });

    if (this.metrics.errors.recentErrors.length > 50) {
      this.metrics.errors.recentErrors.shift();
    }
  }

  // Record AI-specific metrics
  recordAIRequest(success: boolean, responseTime: number): void {
    this.metrics.ai.requests++;
    if (!success) {
      this.metrics.ai.failures++;
    }

    // Update average response time
    const totalRequests = this.metrics.ai.requests;
    this.metrics.ai.averageResponseTime = 
      (this.metrics.ai.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
  }

  // Update system metrics
  updateSystemMetrics(): void {
    this.metrics.system = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: this.cpuUsage,
      timestamp: new Date()
    };
  }

  // Update AI metrics
  async updateAIMetrics(): Promise<void> {
    try {
      const cacheStats = aiCommunicator.getCacheStats();
      const healthCheck = await aiCommunicator.healthCheck();
      
      this.metrics.ai.cacheHitRate = cacheStats.hitRate;
      this.metrics.ai.modelsHealth = healthCheck;
    } catch (error) {
      console.error('Failed to update AI metrics:', error);
    }
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    this.updateSystemMetrics();
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.responseTimes = [];
    this.requestTimings.clear();
  }

  // Get health status
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: Record<string, { status: boolean; message: string; responseTime?: number }>;
    timestamp: Date;
  } {
    const checks: Record<string, { status: boolean; message: string; responseTime?: number }> = {};
    
    // Check response time
    const avgResponseTime = this.metrics.requests.averageResponseTime;
    checks.responseTime = {
      status: avgResponseTime < 2000, // Less than 2 seconds
      message: avgResponseTime < 2000 ? 'Response time is healthy' : 'Response time is slow',
      responseTime: avgResponseTime
    };

    // Check error rate
    const errorRate = this.metrics.requests.total > 0 ? 
      (this.metrics.requests.failed / this.metrics.requests.total) * 100 : 0;
    checks.errorRate = {
      status: errorRate < 5, // Less than 5% error rate
      message: errorRate < 5 ? 'Error rate is healthy' : `Error rate is high: ${errorRate.toFixed(2)}%`
    };

    // Check memory usage
    const memoryUsage = (this.metrics.system.memory.heapUsed / this.metrics.system.memory.heapTotal) * 100;
    checks.memory = {
      status: memoryUsage < 80, // Less than 80% memory usage
      message: memoryUsage < 80 ? 'Memory usage is healthy' : `Memory usage is high: ${memoryUsage.toFixed(2)}%`
    };

    // Check AI models
    const aiHealthy = Object.values(this.metrics.ai.modelsHealth).some(healthy => healthy);
    checks.aiModels = {
      status: aiHealthy,
      message: aiHealthy ? 'AI models are responding' : 'AI models are not responding'
    };

    // Check circuit breakers
    const circuitBreakerStates = Object.entries(circuitBreakers).map(([name, breaker]) => {
      const state = breaker.getState();
      return { name, state: state.state, failures: state.failures };
    });
    
    const openCircuitBreakers = circuitBreakerStates.filter(cb => cb.state === 'OPEN');
    checks.circuitBreakers = {
      status: openCircuitBreakers.length === 0,
      message: openCircuitBreakers.length === 0 ? 
        'All circuit breakers are closed' : 
        `Open circuit breakers: ${openCircuitBreakers.map(cb => cb.name).join(', ')}`
    };

    // Determine overall status
    const allHealthy = Object.values(checks).every(check => check.status);
    const someHealthy = Object.values(checks).some(check => check.status);
    
    const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy';

    return {
      status,
      checks,
      timestamp: new Date()
    };
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();

// Middleware for request timing and metrics collection
export function metricsMiddleware(req: Request, res: Response, next: Function): void {
  const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}`;
  
  // Start timing
  metricsCollector.startRequest(requestId);
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const success = res.statusCode < 400;
    metricsCollector.endRequest(requestId, req, success);
    return originalSend.call(this, data);
  };

  // Handle errors
  res.on('error', (error) => {
    metricsCollector.endRequest(requestId, req, false, error);
  });

  next();
}

// Health check endpoint handler
export async function healthCheckHandler(req: Request, res: Response): Promise<void> {
  try {
    const healthStatus = metricsCollector.getHealthStatus();
    const metrics = metricsCollector.getMetrics();
    const retryStats = retryManager.getStats();
    
    // Update AI metrics
    await metricsCollector.updateAIMetrics();
    
    // Get detailed system information
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem(),
      loadAverage: require('os').loadavg(),
    };
    
    // Calculate resource utilization
    const memoryUsage = process.memoryUsage();
    const resourceUtilization = {
      cpuUsage: metrics.system.cpu,
      memoryUsage: {
        rss: memoryUsage.rss / 1024 / 1024, // MB
        heapTotal: memoryUsage.heapTotal / 1024 / 1024, // MB
        heapUsed: memoryUsage.heapUsed / 1024 / 1024, // MB
        external: memoryUsage.external / 1024 / 1024, // MB
        percentUsed: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      systemMemoryUsage: {
        total: systemInfo.totalMemory / 1024 / 1024, // MB
        free: systemInfo.freeMemory / 1024 / 1024, // MB
        percentUsed: ((systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory) * 100
      }
    };
    
    // Get detailed circuit breaker information
    const circuitBreakerDetails = Object.entries(circuitBreakers).reduce((acc, [name, breaker]) => {
      const state = breaker.getState();
      acc[name] = {
        ...state,
        status: state.state === 'CLOSED' ? 'healthy' : 
                state.state === 'HALF_OPEN' ? 'recovering' : 'unhealthy',
        lastFailureTime: state.lastFailureTime ? 
                         new Date(state.lastFailureTime).toISOString() : null,
        timeSinceLastFailure: state.lastFailureTime ? 
                             Date.now() - state.lastFailureTime.getTime() : null
      };
      return acc;
    }, {} as Record<string, any>);
    
    // Get detailed retry information
    const detailedRetryStats = retryManager.getDetailedStats();
    
    const response = {
      status: healthStatus.status,
      timestamp: new Date().toISOString(),
      uptime: {
        seconds: process.uptime(),
        formatted: formatUptime(process.uptime())
      },
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      systemInfo,
      resourceUtilization,
      healthChecks: healthStatus.checks,
      metrics: {
        requests: {
          ...metrics.requests,
          requestsPerMinute: calculateRequestsPerMinute(metrics),
          requestsPerSecond: calculateRequestsPerSecond(metrics)
        },
        errors: {
          total: metrics.errors.total,
          rate: metrics.requests.total > 0 ? 
            (metrics.errors.total / metrics.requests.total) * 100 : 0,
          byType: metrics.errors.byType,
          byEndpoint: metrics.errors.byEndpoint,
          recent: metrics.errors.recentErrors.slice(0, 5) // Show only 5 most recent errors
        },
        endpoints: getTopEndpoints(metrics.endpoints),
        system: metrics.system,
        ai: {
          ...metrics.ai,
          responseTimeMs: metrics.ai.averageResponseTime,
          successRate: metrics.ai.requests > 0 ? 
            ((metrics.ai.requests - metrics.ai.failures) / metrics.ai.requests) * 100 : 0
        },
        retry: {
          summary: {
            totalAttempts: retryStats.totalAttempts,
            successfulRetries: retryStats.successfulRetries,
            failedRetries: retryStats.failedRetries,
            successRate: detailedRetryStats.successRate * 100,
            averageRetryDelay: retryStats.averageRetryDelay
          },
          details: {
            mostCommonErrorTypes: detailedRetryStats.mostCommonErrorTypes,
            mostRetriedOperations: detailedRetryStats.mostRetriedOperations,
            successRateByErrorType: detailedRetryStats.stats.successRateByErrorType
          }
        },
        circuitBreakers: circuitBreakerDetails
      }
    };

    const statusCode = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'degraded' ? 200 : 503;
    
    // Set cache control headers to prevent caching of health check
    res.set({
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.status(statusCode).json(response);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      message: 'Health check failed',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Helper function to format uptime
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

// Helper function to calculate requests per minute
function calculateRequestsPerMinute(metrics: PerformanceMetrics): number {
  const uptime = process.uptime();
  if (uptime < 60) return metrics.requests.total; // If less than a minute, return total
  return Math.round((metrics.requests.total / uptime) * 60);
}

// Helper function to calculate requests per second
function calculateRequestsPerSecond(metrics: PerformanceMetrics): number {
  const uptime = process.uptime();
  return Math.round((metrics.requests.total / uptime) * 100) / 100; // Round to 2 decimal places
}

// Helper function to get top endpoints by request count
function getTopEndpoints(endpoints: Record<string, { count: number; averageTime: number; errors: number; lastAccessed: Date }>): Array<{ endpoint: string; count: number; averageTime: number; errors: number; errorRate: number }> {
  return Object.entries(endpoints)
    .map(([endpoint, data]) => ({
      endpoint,
      count: data.count,
      averageTime: data.averageTime,
      errors: data.errors,
      errorRate: data.count > 0 ? (data.errors / data.count) * 100 : 0
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 endpoints
}

// Metrics endpoint handler
export function metricsHandler(req: Request, res: Response): void {
  try {
    const metrics = metricsCollector.getMetrics();
    const retryStats = retryManager.getStats();
    
    const response = {
      timestamp: new Date().toISOString(),
      metrics,
      retry: retryStats,
      circuitBreakers: Object.entries(circuitBreakers).reduce((acc, [name, breaker]) => {
        acc[name] = breaker.getState();
        return acc;
      }, {} as Record<string, any>)
    };
    
    res.json(response);
  } catch (error) {
    console.error('Metrics collection failed:', error);
    res.status(500).json({
      error: 'Failed to collect metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
}

// Performance logging utility
export function logPerformance(operation: string, duration: number, success: boolean, metadata?: Record<string, any>): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    operation,
    duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
    success,
    metadata
  };

  if (duration > 5000) { // Log slow operations (>5s)
    console.warn('🐌 Slow operation detected:', JSON.stringify(logEntry, null, 2));
  } else if (!success) {
    console.error('❌ Operation failed:', JSON.stringify(logEntry, null, 2));
  } else if (process.env.NODE_ENV === 'development') {
    console.log('⚡ Performance log:', JSON.stringify(logEntry, null, 2));
  }
}

// Periodic metrics update
setInterval(async () => {
  try {
    await metricsCollector.updateAIMetrics();
  } catch (error) {
    console.error('Failed to update periodic metrics:', error);
  }
}, 30000); // Update every 30 seconds