import { useState, useEffect } from 'react';
import * as tasksApi from '../api/tasks.api';

export const useDeveloperWorkload = (projectId, sprintId) => {
  const [workloads, setWorkloads] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!projectId || !sprintId) {
      setWorkloads({});
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchWorkload = async () => {
      try {
        const res = await tasksApi.getTasks({ projectId, sprintId: sprintId === 'backlog' ? null : sprintId });
        const tasks = res?.data || [];
        
        const loadMap = {};
        tasks.forEach(task => {
          if (task.status !== 'done' && task.assignee) {
            const devId = typeof task.assignee === 'string' ? task.assignee : task.assignee._id;
            loadMap[devId] = (loadMap[devId] || 0) + 1;
          }
        });
        
        if (isMounted) setWorkloads(loadMap);
      } catch (err) {
        console.error('Failed to fetch workload', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchWorkload();

    return () => { isMounted = false; };
  }, [projectId, sprintId]);

  return { workloads, loading };
};
