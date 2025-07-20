import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';

// Types for Web Vitals metrics
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

// Performance thresholds based on Web Vitals recommendations
const THRESHOLDS = {
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

// Rate metric based on thresholds
function rateMetric(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// Send metrics to analytics service (placeholder for now)
function sendToAnalytics(metric: WebVitalsMetric) {
  // In a real application, you would send this to your analytics service
  console.log('Web Vitals Metric:', metric);
  
  // Store in localStorage for development debugging
  const metrics = JSON.parse(localStorage.getItem('webVitalsMetrics') || '[]');
  metrics.push({
    ...metric,
    timestamp: Date.now(),
    url: window.location.href,
  });
  
  // Keep only last 50 metrics
  if (metrics.length > 50) {
    metrics.splice(0, metrics.length - 50);
  }
  
  localStorage.setItem('webVitalsMetrics', JSON.stringify(metrics));
}

// Convert web-vitals Metric to our WebVitalsMetric format
function convertMetric(metric: Metric, name: string): WebVitalsMetric {
  return {
    name,
    value: metric.value,
    rating: rateMetric(name, metric.value),
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType || 'unknown',
  };
}

// Initialize Web Vitals monitoring
export function initWebVitals() {
  // Monitor Cumulative Layout Shift
  onCLS((metric) => {
    sendToAnalytics(convertMetric(metric, 'CLS'));
  });

  // Monitor Interaction to Next Paint (replaces FID)
  onINP((metric) => {
    sendToAnalytics(convertMetric(metric, 'INP'));
  });

  // Monitor First Contentful Paint
  onFCP((metric) => {
    sendToAnalytics(convertMetric(metric, 'FCP'));
  });

  // Monitor Largest Contentful Paint
  onLCP((metric) => {
    sendToAnalytics(convertMetric(metric, 'LCP'));
  });

  // Monitor Time to First Byte
  onTTFB((metric) => {
    sendToAnalytics(convertMetric(metric, 'TTFB'));
  });
}

// Get current Web Vitals metrics (for debugging)
export async function getCurrentMetrics(): Promise<Record<string, WebVitalsMetric>> {
  return new Promise((resolve) => {
    const metrics: Record<string, WebVitalsMetric> = {};
    let collected = 0;
    const totalMetrics = 5;

    const checkComplete = () => {
      collected++;
      if (collected >= totalMetrics) {
        resolve(metrics);
      }
    };

    // Get current metrics
    onCLS((metric) => {
      metrics.CLS = convertMetric(metric, 'CLS');
      checkComplete();
    }, { reportAllChanges: true });

    onINP((metric) => {
      metrics.INP = convertMetric(metric, 'INP');
      checkComplete();
    }, { reportAllChanges: true });

    onFCP((metric) => {
      metrics.FCP = convertMetric(metric, 'FCP');
      checkComplete();
    }, { reportAllChanges: true });

    onLCP((metric) => {
      metrics.LCP = convertMetric(metric, 'LCP');
      checkComplete();
    }, { reportAllChanges: true });

    onTTFB((metric) => {
      metrics.TTFB = convertMetric(metric, 'TTFB');
      checkComplete();
    }, { reportAllChanges: true });

    // Timeout after 2 seconds
    setTimeout(() => resolve(metrics), 2000);
  });
}

// Performance observer for custom metrics
export function observePerformance() {
  // Observe long tasks (> 50ms)
  if ('PerformanceObserver' in window) {
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 50) {
            console.warn('Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name,
            });
          }
        }
      });
      
      longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (e) {
      // Long task API not supported
    }
    
    // Observe navigation timing
    try {
      const navigationObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          console.log('Navigation timing:', {
            domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
            loadComplete: navEntry.loadEventEnd - navEntry.loadEventStart,
            totalTime: navEntry.loadEventEnd - navEntry.fetchStart,
          });
        }
      });
      
      navigationObserver.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      // Navigation timing API not supported
    }
  }
}