import React from 'react';

export const Card = ({
  children,
  className = '',
  padding = 'default',
  hover = false,
  ...props
}) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8'
  };

  return (
    <div
      className={`
        bg-white border border-slate-200/80 rounded-xl shadow-sm
        ${hover ? 'transition-all duration-200 hover:shadow-md hover:border-slate-300' : ''}
        ${paddings[padding] || paddings.default}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, action, className = '' }) => (
  <div className={`flex items-start justify-between pb-4 border-b border-slate-100 ${className}`}>
    <div>
      {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

export default Card;
