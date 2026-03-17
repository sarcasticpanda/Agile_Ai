import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import useUiStore from '../../store/uiStore';

export const PageShell = ({ children, title }) => {
  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Navbar title={title} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
