import React from 'react';

export interface CardProps {
  variant?: 'default' | 'compact' | 'spacious';
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  onClick,
}) => {
  const baseClasses = [
    'card',
    variant === 'compact' && 'card-compact',
    variant === 'spacious' && 'card-spacious',
    onClick && 'cursor-pointer',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={baseClasses}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;