import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { PmsLaunchProvider, usePmsLaunch } from './PmsLaunchContext';

const auth = vi.hoisted(() => ({ user: { username: 'manager', employeeId: 'EMP001', mustChangePassword: false } as any, activeRole: 'hr_manager', loading: false, allowed: true }));
const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('./AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../store/useAuthStore', () => ({ useAuthStore: (select: any) => select({ hasPermission: () => auth.allowed }) }));
vi.mock('../services/apiClient', () => ({ apiClient: api }));
const origin = 'http://localhost:47163';
let child: any;
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllEnvs(); auth.user = { username: 'manager', employeeId: 'EMP001', mustChangePassword: false }; auth.activeRole = 'hr_manager'; auth.allowed = true; auth.loading = false; api.post.mockReset(); });
function Launch() {
  const { launch, launchError } = usePmsLaunch(); const navigate = useNavigate();
  return <><button onClick={launch}>Launch PMS</button><button onClick={() => navigate('/hr')}>HR</button><p>{launchError}</p></>;
}
function Shell() { return <PmsLaunchProvider><MemoryRouter><Routes><Route path="/" element={<Launch />} /><Route path="/hr" element={<h1>HR module</h1>} /></Routes></MemoryRouter></PmsLaunchProvider>; }
function setup() {
  vi.stubEnv('VITE_PROJECT_MANAGEMENT_URL', origin);
  child = { closed: false, postMessage: vi.fn() };
  vi.spyOn(window, 'open').mockReturnValue(child);
  api.post.mockResolvedValue({ data: { success: true, data: { token: 'fictional-signed-token' } } });
  return render(<Shell />);
}
async function ready(challenge: string, source = child, from = origin) {
  await act(async () => { window.dispatchEvent(new MessageEvent('message', { origin: from, source, data: { version: 1, type: 'pms:ready', challenge } })); });
}
it('retains the bound listener across Launchpad unmount and obtains a fresh token for recovery', async () => {
  setup(); fireEvent.click(screen.getByText('Launch PMS')); await ready('a'.repeat(64));
  await waitFor(() => expect(child.postMessage).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByText('HR')); expect(screen.getByText('HR module')).toBeTruthy();
  await ready('b'.repeat(64)); await waitFor(() => expect(child.postMessage).toHaveBeenCalledTimes(2));
  expect(api.post).toHaveBeenCalledTimes(2);
  expect(child.postMessage.mock.calls[1][0].challenge).toBe('b'.repeat(64));
  await ready('c'.repeat(64), {} as Window); await ready('c'.repeat(64), child, 'https://untrusted.example');
  expect(api.post).toHaveBeenCalledTimes(2);
});
it.each(['logout', 'username', 'employee', 'role', 'permission', 'password', 'loading'] as const)('cancels retained handoff on %s change', async change => {
  const view = setup(); fireEvent.click(screen.getByText('Launch PMS')); await ready('a'.repeat(64));
  await waitFor(() => expect(child.postMessage).toHaveBeenCalledTimes(1));
  if (change === 'logout') auth.user = null;
  if (change === 'username') auth.user = { ...auth.user, username: 'another-account' };
  if (change === 'employee') auth.user = { ...auth.user, employeeId: 'EMP002' };
  if (change === 'role') auth.activeRole = 'employee';
  if (change === 'permission') auth.allowed = false;
  if (change === 'password') auth.user = { ...auth.user, mustChangePassword: true };
  if (change === 'loading') auth.loading = true;
  view.rerender(<Shell />); await ready('b'.repeat(64));
  expect(child.postMessage).toHaveBeenCalledTimes(1); expect(api.post).toHaveBeenCalledTimes(1);
});
it.each(['logout', 'permission', 'password', 'loading'] as const)('never opens a new child while blocked by %s', change => {
  setup();
  if (change === 'logout') auth.user = null;
  if (change === 'permission') auth.allowed = false;
  if (change === 'password') auth.user = { ...auth.user, mustChangePassword: true };
  if (change === 'loading') auth.loading = true;
  cleanup(); render(<Shell />);
  fireEvent.click(screen.getByText('Launch PMS'));
  expect(window.open).not.toHaveBeenCalled(); expect(api.post).not.toHaveBeenCalled();
});
it('aborts a pending token when EMS signs out, without transmitting its late result', async () => {
  const view = setup(); let finish!: (data: any) => void;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByText('Launch PMS')); await ready('a'.repeat(64));
  const signal = api.post.mock.calls[0][2].signal;
  auth.user = null; view.rerender(<Shell />); expect(signal.aborted).toBe(true);
  await act(async () => finish({ data: { success: true, data: { token: 'fictional-late-token' } } }));
  expect(child.postMessage).not.toHaveBeenCalled();
});
it('keeps the binding through a same-identity auth heartbeat', async () => {
  const view = setup(); fireEvent.click(screen.getByText('Launch PMS')); await ready('a'.repeat(64));
  auth.user = { ...auth.user }; view.rerender(<Shell />); await ready('b'.repeat(64));
  await waitFor(() => expect(child.postMessage).toHaveBeenCalledTimes(2));
});
it('aborts pending token delivery when the provider unmounts', async () => {
  const view = setup(); let finish!: (data: any) => void;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByText('Launch PMS')); await ready('a'.repeat(64));
  const signal = api.post.mock.calls[0][2].signal;
  view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => finish({ data: { success: true, data: { token: 'fictional-late-token' } } }));
  expect(child.postMessage).not.toHaveBeenCalled();
});
