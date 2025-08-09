import React, { useState, useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';

export interface ThemeResponsiveLogoProps {
  /** Size variant for the logo */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Custom className for styling */
  className?: string;
  /** Whether the logo should be clickable for navigation */
  clickable?: boolean;
  /** Custom click handler */
  onClick?: () => void;
  /** Loading state for the logo */
  loading?: boolean;
  /** Fallback text to display if images fail to load */
  fallbackText?: string;
}

const ThemeResponsiveLogo: React.FC<ThemeResponsiveLogoProps> = ({
  size = 'lg',
  className = '',
  clickable = false,
  onClick,
  loading = false,
  fallbackText = 'GradeMyMail',
}) => {
  const { resolvedTheme } = useTheme();
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'h-8',
      image: 'h-8 w-auto',
      text: 'text-lg font-light',
    },
    md: {
      container: 'h-10',
      image: 'h-10 w-auto',
      text: 'text-xl font-light',
    },
    lg: {
      container: 'h-12',
      image: 'h-12 w-auto',
      text: 'text-5xl font-light',
    },
    xl: {
      container: 'h-16',
      image: 'h-16 w-auto',
      text: 'text-6xl font-light',
    },
  };

  const config = sizeConfig[size];

  // Determine which logo to use based on theme
  const logoSrc = resolvedTheme === 'dark' ? '/gmm1.png' : '/gmm2.png';
  
  // Debug logging
  React.useEffect(() => {
    console.log('ThemeResponsiveLogo - Theme:', resolvedTheme, 'Logo src:', logoSrc);
  }, [resolvedTheme, logoSrc]);

  const handleClick = useCallback(() => {
    if (!clickable || !onClick) return;
    onClick();
  }, [clickable, onClick]);

  const handleImageLoad = useCallback(() => {
    console.log('ThemeResponsiveLogo - Image loaded successfully:', logoSrc);
    setImageLoading(false);
    setImageError(false);
  }, [logoSrc]);

  const handleImageError = useCallback((e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    console.error('ThemeResponsiveLogo - Image failed to load:', logoSrc, e);
    setImageError(true);
    setImageLoading(false);
  }, [logoSrc]);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className={`${config.container} bg-gray-200 animate-pulse rounded-lg`} />
  );

  // Fallback text component
  const FallbackText = () => (
    <h1 className={`${config.text} text-gray-900 tracking-tight transition-all duration-300 hover:scale-105 cursor-default select-none`}>
      {fallbackText} (FALLBACK)
    </h1>
  );

  // Reset image error when theme changes (new image source)
  React.useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [logoSrc]);

  return (
    <div
      className={`
        flex items-center justify-center
        ${clickable ? 'cursor-pointer group' : 'cursor-default'}
        ${className}
      `}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
      aria-label={clickable ? 'Navigate to home page' : 'GradeMyMail logo'}
    >
      {/* Logo Image or Fallback */}
      <div className={`${config.container} flex items-center justify-center relative`}>
        {loading || imageLoading ? (
          <LoadingSkeleton />
        ) : imageError ? (
          <FallbackText />
        ) : (
          <>
            <img
              src={logoSrc}
              alt="GradeMyMail"
              className={`
                ${config.image} 
                object-contain
                transition-all duration-300
                ${clickable ? 'group-hover:scale-105' : 'hover:scale-105'}
                animate-fade-in-up
              `}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="eager"
            />
            {/* Hover effect overlay */}
            {clickable && (
              <div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg" />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ThemeResponsiveLogo;