import React from 'react';

interface MinimalLoadingPopupProps {
  isVisible: boolean;
  message?: string;
}

export const MinimalLoadingPopup: React.FC<MinimalLoadingPopupProps> = ({ 
  isVisible, 
  message = 'Analyzing...' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 max-w-sm mx-4">
        <div className="text-center">
          {/* Beautiful animated dots */}
          <div className="flex justify-center space-x-2 mb-6">
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse"></div>
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          
          {/* Message */}
          <p className="text-gray-600 text-sm font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

// Alternative with spinning animation
export const MinimalSpinnerPopup: React.FC<MinimalLoadingPopupProps> = ({ 
  isVisible, 
  message = 'Analyzing...' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 max-w-sm mx-4">
        <div className="text-center">
          {/* Elegant spinner */}
          <div className="w-8 h-8 mx-auto mb-6">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
          </div>
          
          {/* Message */}
          <p className="text-gray-600 text-sm font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};

// Pulsing circle animation
export const MinimalPulsePopup: React.FC<MinimalLoadingPopupProps> = ({ 
  isVisible, 
  message = 'Analyzing...' 
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 max-w-sm mx-4 animate-scale-in">
        <div className="text-center">
          {/* Pulsing circles */}
          <div className="relative w-12 h-12 mx-auto mb-6">
            <div className="absolute inset-0 w-12 h-12 bg-gray-300 rounded-full animate-ping opacity-20"></div>
            <div className="absolute inset-2 w-8 h-8 bg-gray-400 rounded-full animate-ping opacity-40" style={{ animationDelay: '0.2s' }}></div>
            <div className="absolute inset-4 w-4 h-4 bg-gray-600 rounded-full animate-pulse"></div>
          </div>
          
          {/* Message */}
          <p className="text-gray-600 text-sm font-medium">
            {message}
          </p>
        </div>
      </div>
    </div>
  );
};