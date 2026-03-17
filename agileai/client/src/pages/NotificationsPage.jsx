import React from 'react';
import { PageShell } from '../components/layout/PageShell';
import { useNotifications } from '../hooks/useNotifications';
import { Button } from '../components/ui/Button';
import { Bell, CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { formatTimeAgo } from '../utils/dateUtils';
import { FullPageSpinner } from '../components/ui/Spinner';

export const NotificationsPage = () => {
  const { notifications, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();

  if (isLoading) return <FullPageSpinner />;

  const getIcon = (type) => {
    switch(type) {
      case 'mention': return <Info className="text-blue-500" />;
      case 'assignment': return <CheckCircle2 className="text-emerald-500" />;
      case 'status_change': return <AlertCircle className="text-amber-500" />;
      default: return <Bell className="text-slate-500" />;
    }
  };

  return (
    <PageShell title="Notifications">
      <div className="flex justify-end mb-6">
        <Button variant="outline" onClick={() => markAllAsRead()} disabled={notifications.length === 0}>
           Mark All as Read
        </Button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Bell size={48} className="mb-4 opacity-50" />
            <p className="font-semibold text-slate-700">All caught up!</p>
            <p className="text-sm">You have no new notifications.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div 
                key={notif._id} 
                className={`flex items-start gap-4 p-5 transition-colors ${notif.read ? 'bg-white' : 'bg-indigo-50/50'}`}
              >
                <div className="pt-1">{getIcon(notif.type)}</div>
                <div className="flex-1">
                   <p className={`text-sm ${notif.read ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>
                     {notif.message}
                   </p>
                   <p className="text-xs text-slate-400 mt-1">{formatTimeAgo(notif.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                   {!notif.read && (
                     <Button variant="ghost" size="sm" onClick={() => markAsRead(notif._id)}>
                       Read
                     </Button>
                   )}
                   <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-600" onClick={() => deleteNotification(notif._id)}>
                     <X size={16} />
                   </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
};
