import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { Settings, User, Bell, Shield, Palette, Database, Save } from 'lucide-react';
import useAuthStore from '../store/authStore';

export const SettingsPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('general');

  const tabs = [
    { id: 'general', name: 'General', icon: Settings },
    { id: 'profile', name: 'Profile Settings', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'appearance', name: 'Appearance', icon: Palette },
    { id: 'data', name: 'Data Management', icon: Database },
  ];

  return (
    <PageShell title="Settings">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Tabs */}
        <aside className="w-full lg:w-64 space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-lg shadow-primary/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <tab.icon size={18} />
              {tab.name}
            </button>
          ))}
        </aside>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-card-dark rounded-2xl border border-border-light dark:border-border-dark p-8 shadow-sm">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              {tabs.find(t => t.id === activeTab)?.name} Settings
            </h2>

            <form className="space-y-6">
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Workspace Name</label>
                    <input 
                      type="text" 
                      defaultValue="Personal Workspace"
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Language</label>
                    <select className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white">
                      <option>English (US)</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
                      {user?.name?.[0] || 'U'}
                    </div>
                    <button type="button" className="text-sm font-semibold text-primary hover:underline">Change Avatar</button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Email Display Name</label>
                    <input 
                      type="text" 
                      defaultValue={user?.name}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Color Theme</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl border border-primary bg-primary/5 flex items-center justify-between cursor-pointer">
                        <span className="text-sm font-semibold text-primary">System Default</span>
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                           <CheckCircle2 size={12} className="text-white" />
                        </div>
                      </div>
                      <div className="p-4 rounded-xl border border-border-light dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">High Contrast</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-4 border-t border-slate-100 dark:border-zinc-800">
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">Compact Mode</p>
                      <p className="text-xs text-slate-500">Reduce padding across the interface</p>
                    </div>
                    <div className="w-10 h-5 bg-slate-200 dark:bg-zinc-800 rounded-full relative">
                      <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">Current Password</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-slate-700 dark:text-slate-300">New Password</label>
                    <input type="password" placeholder="••••••••" className="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg outline-none" />
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30">
                    <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                      Two-factor authentication is recommended for admin accounts.
                    </p>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 dark:border-zinc-800 flex justify-end">
                <button 
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-primary/20"
                >
                  <Save size={18} />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </PageShell>
  );
};
// Helper
const CheckCircle2 = ({ size, className }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

