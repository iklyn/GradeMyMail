import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  const inputClasses = [
    'input',
    error && 'border-clarity',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className="stack-sm">
      {label && (
        <label className="text-small font-medium">
          {label}
        </label>
      )}
      
      <input
        className={inputClasses}
        {...props}
      />
      
      {error && (
        <p className="text-caption" style={{ color: 'var(--color-clarity)' }}>
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;