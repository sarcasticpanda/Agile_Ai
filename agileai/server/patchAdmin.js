const fs = require('fs');
let code = fs.readFileSync('../client/src/pages/AdminPage.jsx', 'utf8');

const oldMetric = `        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Users</p>
            <h3 className="text-2xl font-bold text-slate-900">{activeUsers}</h3>
          </div>
        </div>`;

const newMetric = `        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Users</p>
            <h3 className="text-2xl font-bold text-slate-900">{activeUsers}</h3>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-yellow-100 flex items-center justify-center text-yellow-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Pending Approvals</p>
            <h3 className="text-2xl font-bold text-slate-900">{pendingUsers}</h3>
          </div>
        </div>`;

code = code.replace(oldMetric, newMetric);

const oldHeader = `<th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Admin Actions</th>`;

const newHeader = `<th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Assigned PM</th>
                <th className="px-6 py-4 text-right">Admin Actions</th>`;

code = code.replace(oldHeader, newHeader);

const oldRowBody = `<td className="px-6 py-4">
                    <Badge variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Active' : 'Suspended'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={u._id === user?._id || actionLoading[u._id + 'status']}
                      onClick={() => handleToggleStatus(u._id, u.isActive)}     
                    >
                      {actionLoading[u._id + 'status'] ? '...' : (u.isActive ? 'Suspend' : 'Activate')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 h-7 text-xs px-2 hover:bg-red-50" 
                      disabled={u._id === user?._id || actionLoading[u._id + 'delete']}
                      onClick={() => handleDelete(u._id, u.name)}
                      title="Remove user"
                    >
                      {actionLoading[u._id + 'delete'] ? '...' : <UserX size={14} />}
                    </Button>
                  </td>`;

const newRowBody = `<td className="px-6 py-4">
                    <select
                      className="bg-slate-50 border border-slate-200 text-xs rounded p-1 font-semibold uppercase text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      value={u.status || 'pending'}
                      disabled={u._id === user?._id || actionLoading[u._id + 'status']}
                      onChange={(e) => handleStatusChange(u._id, e.target.value)} 
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'developer' ? (
                      <select
                        className="bg-slate-50 border border-slate-200 text-xs rounded p-1 font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer disabled:opacity-50 max-w-[120px]"
                        value={u.managerId || ''}
                        disabled={actionLoading[u._id + 'manager']}
                        onChange={(e) => handleManagerChange(u._id, e.target.value)} 
                      >
                        <option value="">-- Unassigned --</option>
                        {pms.map(pm => (
                          <option key={pm._id} value={pm._id}>{pm.name}</option>
                        ))}
                      </select>
                    ) : (
                       <span className="text-xs text-slate-400">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 h-7 text-xs px-2 hover:bg-red-50" 
                      disabled={u._id === user?._id || actionLoading[u._id + 'delete']}
                      onClick={() => handleDelete(u._id, u.name)}
                      title="Remove user"
                    >
                      {actionLoading[u._id + 'delete'] ? '...' : <UserX size={14} />}
                    </Button>
                  </td>`;

code = code.replace(oldRowBody, newRowBody);

code = code.replace('grid-cols-1 gap-6 md:grid-cols-3', 'grid-cols-1 gap-6 md:grid-cols-4');

fs.writeFileSync('../client/src/pages/AdminPage.jsx', code);
console.log("Updated AdminPage.jsx");