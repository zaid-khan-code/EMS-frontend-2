import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useAuthStore } from '../store/useAuthStore';
import { apiClient } from '../services/apiClient';
import { createPmsLauncher } from '../services/pmsHandoff';

interface PmsLaunchState { launch: () => void; cancel: () => void; launching: boolean; launchError: string }
const PmsLaunchContext = createContext<PmsLaunchState | null>(null);

// Own the child-bound connection above routes; never persist a token or child binding.
export function PmsLaunchProvider({ children }: { children: ReactNode }) {
  const { user, activeRole, loading } = useAuth();
  const allowed = useAuthStore(state => state.hasPermission('project_management.access'));
  const [launchError, setLaunchError] = useState('');
  const [launching, setLaunching] = useState(false);
  const launcher = useMemo(() => createPmsLauncher({
    getToken: async signal => {
      const response = await apiClient.post('/auth/project-management/token', {}, { signal });
      if (response.data?.success !== true || typeof response.data?.data?.token !== 'string') throw new Error('Invalid identity response');
      return response.data.data.token;
    },
    onError: setLaunchError,
    onSettled: () => setLaunching(false)
  }), []);
  useEffect(() => {
    setLaunchError(''); setLaunching(false);
    return () => launcher.cancel();
  }, [launcher, user?.username, user?.employeeId, user?.mustChangePassword, activeRole, allowed, loading]);
  function launch() {
    if (!user || loading || user.mustChangePassword || !allowed || launching) return;
    setLaunchError(''); setLaunching(true);
    launcher.launch(import.meta.env.VITE_PROJECT_MANAGEMENT_URL?.trim() || '/project-management');
  }
  return <PmsLaunchContext.Provider value={{ launch, cancel: launcher.cancel, launching, launchError }}>{children}</PmsLaunchContext.Provider>;
}

export function usePmsLaunch() {
  const context = useContext(PmsLaunchContext);
  if (!context) throw new Error('PMS launch integration requires its provider.');
  return context;
}
