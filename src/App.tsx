import { useState } from 'react';
import reactLogo from '@assets/react.svg';
import viteLogo from '/vite.svg';
import { formatDate } from '@utils/index';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="flex gap-8 mb-8">
        <a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
          <img
            src={viteLogo}
            className="h-24 w-24 hover:drop-shadow-lg transition-all duration-300 hover:scale-110"
            alt="Vite logo"
          />
        </a>
        <a href="https://react.dev" target="_blank" rel="noopener noreferrer">
          <img
            src={reactLogo}
            className="h-24 w-24 hover:drop-shadow-lg transition-all duration-300 hover:scale-110 animate-spin"
            style={{ animationDuration: '20s' }}
            alt="React logo"
          />
        </a>
      </div>

      <h1 className="text-4xl font-bold text-gray-900 mb-8">
        Email Analysis System
      </h1>

      <div className="card max-w-md">
        <button
          className="btn-primary mb-4"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
        <p className="text-gray-600 text-center">
          Edit{' '}
          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
            src/App.tsx
          </code>{' '}
          and save to test HMR
        </p>
      </div>

      <p className="text-gray-500 text-sm mt-8 text-center max-w-md">
        Modern React project with Vite, TypeScript, Tailwind CSS, and
        industry-standard tooling
      </p>

      <div className="mt-4 text-xs text-gray-400 text-center">
        Project initialized: {formatDate(new Date())}
        {/* Test comment for Husky hook verification */}
      </div>
    </div>
  );
}

export default App;
