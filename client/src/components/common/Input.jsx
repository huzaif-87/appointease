import React, { forwardRef } from 'react';

export const Input = forwardRef(({
  label,
  id,
  type = 'text',
  error,
  helperText,
  disabled = false,
  className = '',
  required = false,
  icon: Icon,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1"
        >
          {label}
          {required && <span className="text-rose-500 ml-1">*</span>}
        </label>
      )}

      <div className="relative rounded-lg shadow-sm">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          className={`
            block w-full rounded-lg border text-sm transition-colors
            ${Icon ? 'pl-9' : 'pl-3.5'} pr-3.5 py-2
            ${error
              ? 'border-rose-300 text-rose-900 placeholder-rose-300 focus:border-rose-500 focus:ring-rose-500'
              : 'border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:ring-teal-500'
            }
            focus:outline-none focus:ring-2 focus:ring-opacity-20
            disabled:bg-slate-50 disabled:text-slate-500 disabled:border-slate-200 disabled:cursor-not-allowed
            ${className}
          `}
          {...props}
        />
      </div>

      {error && (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p className="mt-1 text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
