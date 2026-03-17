import React from 'react';
import { Loader2 } from 'lucide-react';

export const Spinner = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  };

  return (
    <Loader2 className={`animate-spin text-indigo-600 ${sizes[size]} ${className}`} />
  );
};

export const FullPageSpinner = () => (
  <div className="flex h-screen w-full items-center justify-center bg-slate-50/50 backdrop-blur-sm">
    <Spinner size="lg" />
  </div>
);
