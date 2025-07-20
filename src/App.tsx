import { useState } from 'react';
import SimpleDemo from './components/SimpleDemo';
import SecurityDemo from './components/SecurityDemo';
import RealTimeAnalysisDemo from './components/RealTimeAnalysisDemo';

function App() {
  const [currentDemo, setCurrentDemo] = useState<'simple' | 'security' | 'analysis'>('analysis');

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setCurrentDemo('simple')}
              className={`px-4 py-2 rounded-md ${
                currentDemo === 'simple'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Simple Demo
            </button>
            <button
              onClick={() => setCurrentDemo('security')}
              className={`px-4 py-2 rounded-md ${
                currentDemo === 'security'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Security Demo
            </button>
            <button
              onClick={() => setCurrentDemo('analysis')}
              className={`px-4 py-2 rounded-md ${
                currentDemo === 'analysis'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Real-Time Analysis
            </button>
          </div>
        </div>
      </nav>
      
      {currentDemo === 'simple' && <SimpleDemo />}
      {currentDemo === 'security' && <SecurityDemo />}
      {currentDemo === 'analysis' && <RealTimeAnalysisDemo />}
    </div>
  );
}

export default App;
