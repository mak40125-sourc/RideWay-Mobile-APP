/**
 * RideWay Driver App - Ride Reception Diagnostic Logger
 *
 * Non-intrusive instrumentation. Logs lifecycle events with a consistent
 * metadata envelope so we can answer: "did the driver app receive the ride request?"
 *
 * Fields captured per entry:
 *   timestamp - ISO UTC time
 *   event     - logical event name (see events below)
 *   detail    - short human detail / rideId / route
 *   driver    - driver (supabase user) id
 *   socketId  - socket.io connection id (null once disconnected)
 *   screen    - most recent expo-router path
 *   network   - best-effort connectivity state
 */

type NetworkState = 'UNKNOWN' | 'UP' | 'DOWN';

export interface DiagEntry {
  t: string; // ISO timestamp
  event: string;
  detail: string;
  driverId: string | null;
  socketId: string | null;
  route: string;
  network: NetworkState;
}

const runtime = {
  socketId: null as string | null,
  socketUrl: '' as string | null,
  driverId: null as string | null,
  route: 'unknown',
  network: 'UNKNOWN' as NetworkState,
  lastAcceptCycle: null as number | null,
};

const buffer: DiagEntry[] = [];
const MAX_ENTRIES = 500;
const listeners = new Set<() => void>();
const STORAGE_KEY = 'rideway.diag.v1';
let storageReady = false;

function ensureStorage() {
  if (storageReady) return;
  storageReady = true;
  try {
    // eslint-disable-next-line no-console
    import('@react-native-async-storage/async-storage')
      .then((m) => {
        m.default.getItem(STORAGE_KEY)
          .then((raw) => {
            if (raw) {
              const parsed = JSON.parse(raw) as DiagEntry[];
              const entries = Array.isArray(parsed) ? parsed : [];
              // Prepend previously persisted entries (ring of MAX_ENTRIES)
              for (const e of entries) buffer.push(e);
              while (buffer.length > MAX_ENTRIES) buffer.shift();
            }
          })
          .catch(() => {});
        // console.log('[RIDEWAY-DIAG] storage ready');
      })
      .catch(() => {});
  } catch {
    // non-native env
  }
}

function persist() {
  if (!storageReady) return;
  try {
    // eslint-disable-next-line no-console
    import('@react-native-async-storage/async-storage')
      .then((m) => m.default.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-MAX_ENTRIES))).catch(() => {}))
      .catch(() => {});
  } catch {
    // ignore
  }
}

export const diagLogger = {
  setDriverId(id: string | null) {
    runtime.driverId = id;
  },

  setSocketId(id: string | null) {
    runtime.socketId = id;
  },

  setSocketUrl(url: string) {
    runtime.socketUrl = url;
  },

  socketUrl(): string | null {
    return runtime.socketUrl;
  },

  setRoute(route: string) {
    runtime.route = route;
  },

  setNetwork(state: NetworkState) {
    runtime.network = state;
  },

  /**
   * Highest-level event with consistent context.
   */
  log(event: string, detail = ''): DiagEntry {
    ensureStorage();
    const entry: DiagEntry = {
      t: new Date().toISOString(),
      event,
      detail,
      driverId: runtime.driverId,
      socketId: runtime.socketId,
      route: runtime.route,
      network: runtime.network,
    };
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) buffer.shift();
    persist();
    // eslint-disable-next-line no-console
    console.log(`[RIDEWAY-DIAG] ${JSON.stringify(entry)}`);
    listeners.forEach((l) => l());
    return entry;
  },

  snapshot(): DiagEntry[] {
    return buffer.slice();
  },

  clear(): void {
    buffer.length = 0;
    if (storageReady) {
      try {
        // eslint-disable-next-line no-console
        import('@react-native-async-storage/async-storage')
          .then((m) => m.default.removeItem(STORAGE_KEY).catch(() => {}))
          .catch(() => {});
      } catch {
        // ignore
      }
    }
  },

  dump(): string {
    const lines = buffer.map((e) => `${e.t}|${e.event}|${e.detail}|driver=${e.driverId ?? '-'}|sid=${e.socketId ?? '-'}|route=${e.route}|net=${e.network}`);
    return lines.join('\n');
  },

  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};