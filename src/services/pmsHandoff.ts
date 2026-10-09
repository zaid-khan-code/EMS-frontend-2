import { z } from 'zod';

const readySchema = z.object({ version: z.literal(1), type: z.literal('pms:ready'),
  challenge: z.string().regex(/^[a-f0-9]{64}$/) }).strict();

export function createPmsLauncher({ host = window, getToken, onError, onSettled }: {
  host?: Window; getToken: (signal: AbortSignal) => Promise<string>;
  onError: (message: string) => void; onSettled: () => void;
}) {
  let cancelActive: (() => void) | undefined;
  return {
    cancel() { cancelActive?.(); },
    launch(destination: string) {
      cancelActive?.();
      let url: URL;
      try {
        url = new URL(destination);
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (!(url.protocol === 'https:' || url.protocol === 'http:' && loopback) || url.username || url.password || url.search || url.hash) throw new Error();
      } catch { onError('Project Management launch URL is not configured correctly.'); onSettled(); return; }
      const controller = new AbortController();
      let child: Window | null = null, active = true, requesting = false, challenge = '', completedChallenge = '', settled = false;
      let timer: ReturnType<typeof setTimeout>;
      let closedTimer: ReturnType<typeof setInterval>;
      function settle() { if (!settled) { settled = true; onSettled(); } }
      function cleanup() {
        if (!active) return;
        active = false; clearTimeout(timer); clearInterval(closedTimer); controller.abort();
        host.removeEventListener('message', receive); cancelActive = undefined; settle();
      }
      function armTimeout() {
        clearTimeout(timer);
        timer = setTimeout(() => { onError('Project Management launch timed out. Please try again.'); cleanup(); }, 30000);
      }
      async function receive(event: MessageEvent) {
        if (!active || !child || event.source !== child || event.origin !== url.origin) return;
        if (child.closed) { cleanup(); return; }
        const ready = readySchema.safeParse(event.data);
        if (!ready.success || ready.data.challenge === completedChallenge) return;
        // A restarted child may announce a fresh challenge while the same token
        // request is pending; reply only to its latest validated challenge.
        challenge = ready.data.challenge;
        if (requesting) return;
        requesting = true;
        armTimeout();
        try {
          const token = await getToken(controller.signal);
          if (!active || child?.closed) { cleanup(); return; }
          if (typeof token !== 'string' || !token || new TextEncoder().encode(token).byteLength > 3800) throw new Error();
          child.postMessage({ version: 1, type: 'pms:identity', challenge, token }, url.origin);
          completedChallenge = challenge;
          requesting = false; clearTimeout(timer); settle();
          // Retain only the child-bound listener, never the token. A reload must
          // obtain a new identity from EMS rather than trust an old PMS cookie.
        } catch {
          if (!active) return;
          try { child?.postMessage({ version: 1, type: 'pms:error', challenge, code: 'LAUNCH_FAILED' }, url.origin); } catch { /* Closed/navigated child. */ }
          onError('Project Management access could not be verified. Please try again.'); cleanup();
        }
      }
      cancelActive = cleanup;
      host.addEventListener('message', receive);
      armTimeout();
      try { child = host.open(url.href, '_blank'); }
      catch { child = null; }
      if (!child) { onError('Allow the Project Management window to open, then try again.'); cleanup(); }
      else closedTimer = setInterval(() => { if (child?.closed) cleanup(); }, 1000);
    }
  };
}
