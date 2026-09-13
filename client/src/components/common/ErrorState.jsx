import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export const ErrorState = ({
  title = 'Something went wrong',
  message = 'Failed to load data. Please try again.',
  onRetry,
  className = ''
}) => {
  return (
    <div
      role="alert"
      className={`bg-rose-50/70 border border-rose-200 rounded-xl p-6 text-center flex flex-col items-center justify-center max-w-lg mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-rose-900 mb-1">{title}</h4>
      <p className="text-sm text-rose-700 mb-4 max-w-sm">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          icon={RotateCcw}
          className="border-rose-300 text-rose-800 hover:bg-rose-100/50"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
