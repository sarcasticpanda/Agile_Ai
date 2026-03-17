import React from 'react';

export const Avatar = ({ src, alt, fallback, size = 'md', className = '' }) => {
  const sizes = {
    xs: 'h-6 w-6 text-xs',
    sm: 'h-8 w-8 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-12 w-12 text-lg',
    xl: 'h-16 w-16 text-xl',
  };

  const baseClasses = `inline-flex items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold overflow-hidden shrink-0 ${sizes[size]} ${className}`;

  if (src) {
    return (
      <div className={baseClasses}>
        <img src={src} alt={alt || 'Avatar'} className="h-full w-full object-cover" />
      </div>
    );
  }

  // fallback uses initials
  const initials = fallback
    ? fallback.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <div className={baseClasses}>
      {initials}
    </div>
  );
};
