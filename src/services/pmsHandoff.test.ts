import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPmsLauncher } from './pmsHandoff';
function fixture() {
  const listeners = new Set<(event: MessageEvent) => void>();
  const child = { postMessage: vi.fn(), closed: false };
  const host = { open: vi.fn(() => child), addEventListener: (_: string, fn: (event: MessageEvent) => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: (event: MessageEvent) => void) => listeners.delete(fn) } as unknown as Window;
  const getToken = vi.fn(async () => 'fictional-signed-token'), onError = vi.fn(), onSettled = vi.fn();
  const launcher = createPmsLauncher({ host, getToken, onError, onSettled });
  const dispatch = (data: unknown, origin = 'http://localhost:3000', source: unknown = child) => {
    listeners.forEach(listener => listener({ data, origin, source } as MessageEvent));
  };
  return { launcher, host, child, listeners, getToken, onError, onSettled, dispatch };
}
const ready = { version: 1, type: 'pms:ready', challenge: 'a'.repeat(64) };
afterEach(() => vi.useRealTimers());
describe('hardened EMS PMS launcher', () => {
  it('opens synchronously, validates source/origin and sends one bounded identity', async () => {
    const x = fixture(); x.launcher.launch('http://localhost:3000/');
    expect(x.host.open).toHaveBeenCalled(); expect(x.getToken).not.toHaveBeenCalled();
    x.dispatch(ready, 'http://localhost:3000.attacker.example'); x.dispatch(ready, 'http://localhost:3000', {});
    x.dispatch({ ...ready, extra: true }); expect(x.getToken).not.toHaveBeenCalled();
    x.dispatch(ready); x.dispatch(ready); await vi.waitFor(() => expect(x.child.postMessage).toHaveBeenCalledTimes(1));
    expect(x.getToken).toHaveBeenCalledTimes(1);
    expect(x.child.postMessage).toHaveBeenCalledWith({ ...ready, type: 'pms:identity', token: 'fictional-signed-token' }, 'http://localhost:3000');
    expect(x.listeners.size).toBe(0);
  });
  it('blocks invalid destinations and popup failures before requesting credentials', () => {
    const x = fixture(); x.launcher.launch('https://pms.example/?token=bad'); expect(x.host.open).not.toHaveBeenCalled();
    vi.mocked(x.host.open).mockReturnValue(null); x.launcher.launch('http://localhost:3000/');
    expect(x.onError).toHaveBeenCalled(); expect(x.getToken).not.toHaveBeenCalled(); expect(x.listeners.size).toBe(0);
  });
  it('cancels timeout and late token results without transmission', async () => {
    vi.useFakeTimers(); const x = fixture();
    let finish!: (token: string) => void; x.getToken.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    x.launcher.launch('http://localhost:3000/'); x.dispatch(ready);
    await vi.advanceTimersByTimeAsync(30000); finish('late-token'); await Promise.resolve();
    expect(x.child.postMessage).not.toHaveBeenCalled(); expect(x.listeners.size).toBe(0); expect(x.onError).toHaveBeenCalled();
  });
  it('replaces an active attempt and sanitizes malformed/provider failures', async () => {
    const x = fixture(); x.getToken.mockResolvedValue('x'.repeat(3801));
    x.launcher.launch('http://localhost:3000/'); x.launcher.launch('http://localhost:3000/'); x.dispatch(ready);
    await vi.waitFor(() => expect(x.onError).toHaveBeenCalled());
    expect(x.child.postMessage).toHaveBeenCalledWith({ ...ready, type: 'pms:error', code: 'LAUNCH_FAILED' }, 'http://localhost:3000');
    expect(x.listeners.size).toBe(0); expect(x.onError.mock.calls.flat().join()).not.toContain('xxxx');
  });
});
