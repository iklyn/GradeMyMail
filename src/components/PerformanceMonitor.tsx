import { useState, useEffect } from 'react';
import { getCurrentMetrics, type WebVitalsMetric, getPerformanceMonitor } from '../utils/webVitals';
import { getPerformanceProfiler, type PerformanceReport } from '../utils/performanceProfiler';
import { useMemoryMonitoring } from '../utils/memoryManager';

interface PerformanceMonitorProps {
  isVisible?: boolean;
}

export function PerformanceMonitor({ isVisible = false }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<Record<string, WebVitalsMetric>>({});
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [isOpen, setIsOpen] = useState(isVisible);
  const [activeTab, setActiveTab] = useState<'vitals' | 'profiler' | 'memory'>('vitals');
  
  const memoryMonitoring = useMemoryMonitoring();

  useEffect(() => {
    const updateMetrics = async () => {
      const currentMetrics = await getCurrentMetrics();
      setMetrics(currentMetrics);
    };

    const updateProfilerReport = async () => {
      const profiler = getPerformanceProfiler();
      if (profiler) {
        const report = await profiler.generateReport();
        setPerformanceReport(report);
      }
    };

    // Update metrics every 5 seconds
    const interval = setInterval(() => {
      updateMetrics();
      updateProfilerReport();
    }, 5000);
    
    updateMetrics(); // Initial load
    updateProfilerReport();

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
        <div className="fixed bottom-16 right-4 z-40 bg-white border border-gray-200 rounded-lg shadow-lg w-96 max-h-[600px] overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Performance Monitor</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Tab navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { key: 'vitals', label: 'Web Vitals' },
              { key: 'profiler', label: 'Profiler' },
              { key: 'memory', label: 'Memory' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`flex-1 px-4 py-2 text-sm font-medium ${
                  activeTab === key
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 overflow-y-auto max-h-[500px]">
            {/* Web Vitals Tab */}
            {activeTab === 'vitals' && (
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

            {/* Profiler Tab */}
            {activeTab === 'profiler' && (
              <div className="space-y-4">
                {performanceReport ? (
                  <>
                    <div className="bg-gray-50 p-3 rounded">
                      <h4 className="font-medium text-gray-800 mb-2">Summary</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>Total Samples: {performanceReport.summary.totalSamples}</div>
                        <div>Average Duration: {performanceReport.summary.averageDuration.toFixed(2)}ms</div>
                        <div>Memory Leaks: {performanceReport.summary.memoryLeaks.length}</div>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Slowest Operations</h4>
                      <div className="space-y-2">
                        {performanceReport.summary.slowestOperations.slice(0, 5).map((sample, index) => (
                          <div key={sample.id} className="text-sm bg-red-50 p-2 rounded">
                            <div className="font-medium text-red-800">
                              {sample.name} ({sample.type})
                            </div>
                            <div className="text-red-600">
                              {sample.duration.toFixed(2)}ms
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {performanceReport.summary.recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Recommendations</h4>
                        <div className="space-y-1">
                          {performanceReport.summary.recommendations.map((rec, index) => (
                            <div key={index} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        console.log('Performance Report:', performanceReport);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      View full report in console
                    </button>
                  </>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    No profiler data available
                  </div>
                )}
              </div>
            )}

            {/* Memory Tab */}
            {activeTab === 'memory' && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded">
                  <h4 className="font-medium text-gray-800 mb-2">Memory Usage</h4>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div>Used: {(memoryMonitoring.memoryUsage.used / 1024 / 1024).toFixed(1)}MB</div>
                    <div>Total: {(memoryMonitoring.memoryUsage.total / 1024 / 1024).toFixed(1)}MB</div>
                    <div>Limit: {(memoryMonitoring.memoryUsage.limit / 1024 / 1024).toFixed(1)}MB</div>
                    <div>Usage: {memoryMonitoring.memoryUsage.percentage.toFixed(1)}%</div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          memoryMonitoring.memoryUsage.percentage > 80
                            ? 'bg-red-500'
                            : memoryMonitoring.memoryUsage.percentage > 60
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(memoryMonitoring.memoryUsage.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {memoryMonitoring.leaks.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Memory Leaks</h4>
                    <div className="space-y-2">
                      {memoryMonitoring.leaks.map((leak, index) => (
                        <div
                          key={index}
                          className={`text-sm p-2 rounded ${
                            leak.severity === 'high'
                              ? 'bg-red-50 text-red-800'
                              : leak.severity === 'medium'
                              ? 'bg-yellow-50 text-yellow-800'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          <div className="font-medium">{leak.type}</div>
                          <div>{leak.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {memoryMonitoring.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-800 mb-2">Recommendations</h4>
                    <div className="space-y-1">
                      {memoryMonitoring.recommendations.map((rec, index) => (
                        <div key={index} className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                          {rec}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    const detection = localStorage.getItem('memoryLeakDetection');
                    if (detection) {
                      console.log('Memory Leak Detection:', JSON.parse(detection));
                    }
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  View memory details in console
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default PerformanceMonitor;