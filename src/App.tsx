import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import GradeMyMail from './pages/GradeMyMail';
import FixMyMail from './pages/FixMyMail';
import SimpleDemo from './components/SimpleDemo';
import SecurityDemo from './components/SecurityDemo';
import RealTimeAnalysisDemo from './components/RealTimeAnalysisDemo';
import VirtualizedDiffDemo from './components/VirtualizedDiffDemo';
import HoverSynchronizationTest from './components/HoverSynchronizationTest';
import ContentReconstructionDemo from './components/ContentReconstructionDemo';

// Demo navigation component
const DemoNavigation: React.FC = () => {
  const location = useLocation();
  const [currentDemo, setCurrentDemo] = useState<'simple' | 'security' | 'analysis' | 'diff' | 'hover' | 'reconstruction'>('reconstruction');

  // Only show demo navigation on demo routes
  if (location.pathname === '/' || location.pathname.startsWith('/fixmymail')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex space-x-4">
              <Link
                to="/"
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors duration-200"
              >
                ← Back to GradeMyMail
              </Link>
            </div>
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
              <button
                onClick={() => setCurrentDemo('diff')}
                className={`px-4 py-2 rounded-md ${
                  currentDemo === 'diff'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Virtualized Diff
              </button>
              <button
                onClick={() => setCurrentDemo('hover')}
                className={`px-4 py-2 rounded-md ${
                  currentDemo === 'hover'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Hover Sync Test
              </button>
              <button
                onClick={() => setCurrentDemo('reconstruction')}
                className={`px-4 py-2 rounded-md ${
                  currentDemo === 'reconstruction'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Content Reconstruction
              </button>
            </div>
          </div>
        </div>
      </nav>
      
      {currentDemo === 'simple' && <SimpleDemo />}
      {currentDemo === 'security' && <SecurityDemo />}
      {currentDemo === 'analysis' && <RealTimeAnalysisDemo />}
      {currentDemo === 'diff' && <VirtualizedDiffDemo />}
      {currentDemo === 'hover' && <HoverSynchronizationTest />}
      {currentDemo === 'reconstruction' && <ContentReconstructionDemo />}
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Main application routes */}
        <Route path="/" element={<GradeMyMail />} />
        <Route path="/fixmymail/:dataId" element={<FixMyMail />} />
        
        {/* Demo routes */}
        <Route path="/demos/*" element={<DemoNavigation />} />
      </Routes>
    </Router>
  );
}

export default App;
