import { useState, useEffect } from 'react';
import { getCurrentMetrics, type WebVitalsMetric } from '../utils/webVitals';

interface PerformanceMonitorProps {
  isVisible?: boolean;
}

export function PerformanceMonitor({ isVisible = false }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<Record<string, WebVitalsMetric>>({});
  const [isOpen, setIsOpen] = useState(isVisible);

  useEffect(() => {
    const updateMetrics = async () => {
      const currentMetrics = await getCurrentMetrics();
      setMetrics(currentMetrics);
    };

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);
    updateMetrics(); // Initial load

    return () => clearInterval(interval);
  }, []);

  if (!isOpen && process.env.NODE_ENV === 'production') {
    return null;
  }

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good':
        return 'text-green-600 bg-green-50';
      case 'needs-improvement':
        return 'text-yellow-600 bg-yellow-50';
      case 'poor':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatValue = (name: string, value: number) => {
    if (name === 'CLS') {
      return value.toFixed(3);
    }
    return Math.round(value);
  };

  const getMetricDescription = (name: string) => {
    const descriptions = {
      CLS: 'Cumulative Layout Shift - Visual stability',
      INP: 'Interaction to Next Paint - Interactivity (ms)',
      FCP: 'First Contentful Paint - Loading (ms)',
      LCP: 'Largest Contentful Paint - Loading (ms)',
      TTFB: 'Time to First Byte - Server response (ms)',
    };
    return descriptions[name as keyof typeof descriptions] || name;
  };

  return (
    <>
      {/* Toggle button for development */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white p-2 rounded-full shadow-lg hover:bg-blue-700 transition-colors"
          title="Toggle Performance Monitor"
        >
          📊
        </button>
      )}

      {/* Performance metrics panel */}
      {isOpen && (
        <div className="fixed bottom-16 right-4 z-40 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-80 max-h-96 overflow-y-auto">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">Web Vitals</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3">
            {Object.entries(metrics).map(([name, metric]) => (
              <div key={name} className="border-b border-gray-100 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-800">{name}</div>
                    <div className="text-xs text-gray-500">
                      {getMetricDescription(name)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-lg">
                      {formatValue(name, metric.value)}
                      {name !== 'CLS' && 'ms'}
                    </div>
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${getRatingColor(
                        metric.rating
                      )}`}
                    >
                      {metric.rating}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {Object.keys(metrics).length === 0 && (
            <div className="text-center text-gray-500 py-4">
              Collecting metrics...
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => {
                const storedMetrics = localStorage.getItem('webVitalsMetrics');
                if (storedMetrics) {
                  console.log('All Web Vitals Metrics:', JSON.parse(storedMetrics));
                }
              }}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              View all metrics in console
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PerformanceMonitor;