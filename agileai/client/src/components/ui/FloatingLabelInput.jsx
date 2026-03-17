import React from 'react';

export const FloatingLabelInput = React.forwardRef(({ label, error, id, type = 'text', ...props }, ref) => {
  return (
    <div className="floating-label-group">
      <input
        id={id}
        ref={ref}
        type={type}
        placeholder=" "
        className={`block w-full px-4 py-3 text-slate-900 bg-white dark:bg-zinc-900 border ${
          error ? 'border-red-500' : 'border-slate-200 dark:border-zinc-800'
        } rounded-lg focus:ring-primary focus:border-primary peer transition-all dark:text-white outline-none`}
        {...props}
      />
      <label
        htmlFor={id}
        className="absolute left-4 top-3 text-slate-400 pointer-events-none transition-all duration-200 peer-focus:text-xs peer-focus:-top-2 peer-focus:left-3 peer-focus:bg-white dark:peer-focus:bg-[#18181B] peer-focus:px-1 peer-focus:text-primary peer-[:not(:placeholder-shown)]:text-xs peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:bg-white dark:peer-[:not(:placeholder-shown)]:bg-[#18181B] peer-[:not(:placeholder-shown)]:px-1"
      >
        {label}
      </label>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
});

FloatingLabelInput.displayName = 'FloatingLabelInput';
