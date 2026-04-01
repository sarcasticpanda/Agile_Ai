import React, { useState, useEffect } from 'react';
import { 
  Users, UserPlus, Search, Filter, Mail, CheckCircle2, 
  MapPin, Clock, MoreVertical, Shield, AlertCircle
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { getMyRoster, getFreePool, claimDeveloper, releaseDeveloper } from '../../api/team.api';
import DeveloperProfileModal from '../../components/modals/DeveloperProfileModal';

export const PmTeamPage = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('my-team');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [myTeam, setMyTeam] = useState([]);
  const [talentPool, setTalentPool] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeveloper, setSelectedDeveloper] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const [rosterRes, poolRes] = await Promise.all([
        getMyRoster(),
        getFreePool()
      ]);
      if (rosterRes.data.success) setMyTeam(rosterRes.data.data);
      if (poolRes.data.success) setTalentPool(poolRes.data.data);
    } catch (err) {
      console.error("Failed to fetch team data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (id) => {
    try {
      await claimDeveloper(id, {}); // Passing empty object for missing projectId inside UI config yet
      fetchTeamData();
    } catch (err) {
      console.error("Failed to claim developer", err);
    }
  };

  const handleRelease = async (id) => {
    try {
      await releaseDeveloper(id);
      fetchTeamData();
      alert('Developer released successfully');
    } catch (err) {
      console.error("Failed to release developer", err);
      alert('Failed to release developer');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  };

  // Filter Logic
  const filterList = (list) => {
    if (!searchQuery) return list;
    return list.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredMyTeam = filterList(myTeam);
  const filteredTalentPool = filterList(talentPool);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-inter" onClick={() => setActiveMenuId(null)}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Team & Talent</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your active team or allocate new developer resources.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-2">
            <Filter size={18} />
            Filters
          </button>
          <button className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg shadow-primary/20">
            <UserPlus size={18} />
            Invite Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 dark:border-border-dark">
        <button 
          onClick={() => setActiveTab('my-team')}
          className={`pb-4 text-sm font-semibold transition-colors relative ${activeTab === 'my-team' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          My Active Team
          <span className="ml-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 py-0.5 px-2 rounded-full text-xs">{myTeam.length}</span>
          {activeTab === 'my-team' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTab('talent-pool')}
          className={`pb-4 text-sm font-semibold transition-colors relative ${activeTab === 'talent-pool' ? 'text-primary' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
          Global Talent Pool
          <span className="ml-2 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 py-0.5 px-2 rounded-full text-xs">{talentPool.length}</span>
          {activeTab === 'talent-pool' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary rounded-t-full"></div>}
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder={`Search in ${activeTab === 'my-team' ? 'My Team' : 'Talent Pool'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all text-slate-800 dark:text-slate-200"
        />
      </div>

      {/* Content Area */}
      {activeTab === 'my-team' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMyTeam.map(member => (
            <div 
              key={member._id || member.id} 
              className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl p-6 hover:shadow-lg transition-all group relative cursor-pointer"
              onClick={() => setSelectedDeveloper(member)}
            >
              <div 
                className="absolute top-4 right-4 text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setActiveMenuId(activeMenuId === member._id ? null : member._id);
                }}
              >
                <MoreVertical size={18} />
              </div>
              
              {activeMenuId === member._id && (
                <div 
                  className="absolute top-10 right-4 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-lg shadow-xl z-50 py-1 w-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    onClick={() => { handleRelease(member._id); setActiveMenuId(null); }}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Request Release
                  </button>
                </div>
              )}
              
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {getInitials(member.name)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{member.name}</h3>
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                    <Shield size={14} />
                    {member.role || 'Developer'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mt-6 bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-1">Status</span>
                  <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400 capitalize">
                    <CheckCircle2 size={14} />
                    {member.status || 'Active'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-zinc-900/50 border-b border-slate-200 dark:border-border-dark">
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Developer</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Role & Skills</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">Availability</th>
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTalentPool.map(talent => (
                <tr key={talent._id || talent.id} className="border-b border-slate-100 dark:border-border-dark/50 hover:bg-slate-50 dark:hover:bg-zinc-900/20 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                        {getInitials(talent.name)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white">{talent.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} /> {talent.email || `${talent.name?.toLowerCase()?.split(' ')[0]}@company.com`}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-medium text-slate-700 dark:text-slate-300 mb-1.5 capitalize">{talent.role || 'Developer'}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {(talent.skills || ['Full stack', 'Agile']).map(skill => (
                        <span key={skill} className="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 rounded text-xs">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-xs font-semibold">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                      Available
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <button 
                      onClick={() => handleClaim(talent._id || talent.id)}
                      className="inline-flex items-center justify-center bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      Assign
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDeveloper && (
        <DeveloperProfileModal 
          isOpen={!!selectedDeveloper} 
          onClose={() => setSelectedDeveloper(null)} 
          developer={selectedDeveloper} 
        />
      )}
    </div>
  );
};