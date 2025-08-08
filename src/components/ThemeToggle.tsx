import React from 'react';
import { useTheme } from '../hooks/useTheme';
import { utils } from '../utils/designSystem';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className,
  showLabel = false,
  size = 'md'
}) => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value as 'light' | 'dark' | 'system');
  };

  return (
    <div className={utils.cn('flex items-center gap-2', className)}>
      {/* Quick toggle button */}
      <button
        onClick={toggleTheme}
        className={utils.cn(
          'inline-flex items-center justify-center rounded-lg',
          'bg-surface-secondary hover:bg-surface-elevated',
          'border border-border-primary hover:border-border-secondary',
          'text-text-secondary hover:text-text-primary',
          'transition-all duration-200 ease-smooth',
          'focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-2',
          sizeClasses[size]
        )}
        title={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
      >
        {resolvedTheme === 'light' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        )}
      </button>

      {/* Detailed theme selector */}
      {showLabel && (
        <div className="flex items-center gap-2">
          <label htmlFor="theme-select" className="text-sm font-medium text-text-secondary">
            Theme:
          </label>
          <select
            id="theme-select"
            value={theme}
            onChange={handleThemeChange}
            className={utils.cn(
              'px-3 py-1.5 text-sm rounded-md',
              'bg-surface-secondary border border-border-primary',
              'text-text-primary',
              'focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-border-focus',
              'transition-colors duration-200'
            )}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;