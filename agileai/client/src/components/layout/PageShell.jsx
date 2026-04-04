import React from 'react';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useLocation } from 'react-router-dom';
import useUiStore from '../../store/uiStore';

export const PageShell = ({ children, title }) => {
  const location = useLocation();
  const isPMRoutes = location.pathname.startsWith('/pm');

  // If inside PM Routes (PMLayout), it already has a Sidebar and Topbar.
  // We just render the content container.
  if (isPMRoutes) {
    return (
      <div className="flex-1 overflow-y-auto p-6 text-slate-900 dark:text-slate-100 font-sans">
        <div className="max-w-[1600px] mx-auto h-full">
          {children}
        </div>
      </div>
    );
  }

  // Standard Shell for Developers / Admin
  return (
    <div className="flex h-screen w-full bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Navbar title={title} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <div className="max-w-[1600px] mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

