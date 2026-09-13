import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Loading...', size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center ${className}`}>
      <Loader2 className={`${sizeClasses[size] || sizeClasses.md} animate-spin text-teal-600 mb-3`} />
      <p className="text-sm font-medium text-slate-600">{message}</p>
    </div>
  );
};

export default LoadingState;
