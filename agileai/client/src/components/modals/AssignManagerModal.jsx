import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Shield, User, Users, ArrowRight } from 'lucide-react';

export const AssignManagerModal = ({ isOpen, onClose, developer, pmsList, devsList, onAssign, assigningStatus }) => {
  const [selectedPmId, setSelectedPmId] = useState(null);

  useEffect(() => {
    if (developer?.managedBy) {
      setSelectedPmId(developer.managedBy);
    } else {
      setSelectedPmId(null);
    }
  }, [developer, isOpen]);

  if (!developer) return null;

  const currentManager = developer.managedBy ? pmsList.find(p => p._id === developer.managedBy) : null;
  const targetManager = selectedPmId ? pmsList.find(p => p._id === selectedPmId) : null;
  
  // Devs belonging to the selected PM
  const pmRoster = selectedPmId ? devsList.filter(d => d.managedBy === selectedPmId) : [];

  const handleConfirm = () => {
    onAssign(developer._id, selectedPmId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Assign Project Manager" size="lg">
      <div className="p-2 space-y-6">
        
        {/* Header info */}
        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <User size={18} className="text-primary" />
            Developer: {developer.name}
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            Currently Assigned To: {' '}
            {currentManager ? (
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">{currentManager.name} ({currentManager.email})</span>
            ) : (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Free Pool (Unassigned)</span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-64">
          
          {/* Left Column: PMs */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-semibold text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              Select Manager
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              <button
                onClick={() => setSelectedPmId(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedPmId === null ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold border border-emerald-200 dark:border-emerald-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
              >
                ● Free Pool (Unassign)
              </button>
              {pmsList.map(pm => (
                <button
                  key={pm._id}
                  onClick={() => setSelectedPmId(pm._id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${selectedPmId === pm._id ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-transparent'}`}
                >
                  <span className="truncate">{pm.name}</span>
                  {developer.managedBy === pm._id && <span className="text-[10px] uppercase font-bold tracking-widest opacity-50">Current</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Roster Preview */}
          <div className="flex flex-col border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 font-semibold text-xs text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <span>{targetManager ? `${targetManager.name}'s Roster` : 'Free Pool'}</span>
              <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full text-[10px]">{targetManager ? pmRoster.length : devsList.filter(d => !d.managedBy).length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/50 custom-scrollbar">
              {targetManager ? (
                pmRoster.length > 0 ? (
                  <ul className="space-y-2">
                    {pmRoster.map(dev => (
                      <li key={dev._id} className={`text-xs px-3 py-2 rounded border bg-white dark:bg-slate-800 flex items-center gap-2 ${dev._id === developer._id ? 'border-indigo-500 shadow-sm' : 'border-slate-200 dark:border-slate-700'}`}>
                        <div className={`w-2 h-2 rounded-full ${dev._id === developer._id ? 'bg-indigo-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></div>
                        <span className={dev._id === developer._id ? 'font-bold text-indigo-700 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}>{dev.name}</span>
                      </li>
                    ))}
                    {developer.managedBy !== selectedPmId && (
                      <li className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mt-2 flex items-center gap-1 justify-center py-2 px-3 border border-dashed border-indigo-200 rounded bg-indigo-50 dark:bg-indigo-900/10">
                        <Plus size={12} /> {developer.name} will be added
                      </li>
                    )}
                  </ul>
                ) : (
                  <div className="text-center text-slate-400 text-xs py-10">No developers currently assigned to this manager.</div>
                )
              ) : (
                <div className="text-center text-slate-500 text-xs py-10 font-medium">
                   Shows {devsList.filter(d => !d.managedBy).length} unassigned unmanaged developers.
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleConfirm} 
            disabled={assigningStatus || selectedPmId === developer?.managedBy}
            className="w-40 flex justify-center"
          >
            {assigningStatus ? 'Updating...' : 'Assign Manager'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

const Plus = ({size}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>;
