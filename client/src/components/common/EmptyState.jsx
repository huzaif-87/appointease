import React from 'react';
import { CalendarX } from 'lucide-react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = CalendarX,
  title = 'No records found',
  description = 'There are no items to display at this moment.',
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div className={`p-8 text-center flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-semibold text-slate-900 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4">{description}</p>
      {actionLabel && onAction && (
        <Button size="sm" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
