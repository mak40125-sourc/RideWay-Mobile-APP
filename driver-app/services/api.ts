import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const API_PATH = "/api/v1";

function normalizeApiBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function getExpoHost() {
  const constants = Constants as typeof Constants & {
    expoGoConfig?: { debuggerHost?: string };
    manifest?: { debuggerHost?: string };
  };

  const hostUri =
    Constants.expoConfig?.hostUri ||
    constants.expoGoConfig?.debuggerHost ||
    constants.manifest?.debuggerHost;

  return hostUri?.split(":")[0];
}

function getApiBaseUrl() {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  // Runtime diagnostics: log which branch wins.
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] API_URL_RESOLVE', JSON.stringify({
    env_EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? null,
    env_configuredUrl: configuredUrl || null,
    expo_hostUri: (() => { try { return (Constants as any).expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost ?? (Constants as any).manifest?.debuggerHost ?? null; } catch { return null; } })(),
    expo_host: getExpoHost(),
    platform: Platform.OS,
  }));

  if (configuredUrl) {
    const url = normalizeApiBaseUrl(configuredUrl);
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] API_BASE_SOURCE', `env:${url}`);
    return url;
  }

  const host = getExpoHost();

  if (host) {
    const url = `http://${host}:3000${API_PATH}`;
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] API_BASE_SOURCE', `expoHost:${url}`);
    return url;
  }

  const fallbackHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  const url = `http://${fallbackHost}:3000${API_PATH}`;
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] API_BASE_SOURCE', `fallback:${url}`);
  return url;
}

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] API_BASE_URL_FINAL', API_BASE_URL);
  try { const { diagLogger } = require('../utils/diagLog'); diagLogger.log('API_BASE_URL', `${API_BASE_URL} src=${process.env.EXPO_PUBLIC_API_BASE_URL ? 'env' : getExpoHost() ? 'expoHost' : 'fallback'} platform=${Platform.OS}`); } catch {}
}

const TOKEN_KEY = "supabase_token";

export async function setAuthToken(token: string) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAuthToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

async function getHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch {
  }

  return headers;
}

async function request<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  const headers = await getHeaders();
  const startMs = Date.now();
  const timeoutMs = 10000;

  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] API_REQUEST_START', JSON.stringify({ method, endpoint, url, apiBaseUrl: API_BASE_URL, timeoutMs, startIso: new Date(startMs).toISOString() }));
  try { const { diagLogger } = require('../utils/diagLog'); diagLogger.log('API_REQUEST_START', `${method} ${endpoint} url=${url} timeout=${timeoutMs} base=${API_BASE_URL}`); } catch {}

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const elapsed = Date.now() - startMs;
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] API_REQUEST_RESPONSE', JSON.stringify({ method, endpoint, url, status: response.status, elapsedMs: elapsed }));
    try { const { diagLogger } = require('../utils/diagLog'); diagLogger.log('API_RESPONSE', `${method} ${endpoint} status=${response.status} elapsed=${elapsed}ms`); } catch {}
  } catch (err) {
    const elapsed = Date.now() - startMs;
    const isAbort = controller.signal.aborted;
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] API_REQUEST_FAIL', JSON.stringify({ method, endpoint, url, apiBaseUrl: API_BASE_URL, elapsedMs: elapsed, isAbort, error: msg, type: isAbort ? 'TIMEOUT' : 'CONN_FAIL' }));
    try { const { diagLogger } = require('../utils/diagLog'); diagLogger.log(isAbort ? 'API_TIMEOUT' : 'API_CONN_FAIL', `${method} ${endpoint} url=${url} elapsed=${elapsed}ms err=${msg}`); } catch {}
    if (isAbort) {
      throw new Error(`Request timed out for ${url}. Check backend IP and connectivity.`);
    }
    throw new Error(
      `Network request failed for ${url}. Make sure the backend is running and reachable from this device.`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || errorData?.message || `Request failed with ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function getWebSocketUrl(): string {
  const ws = API_BASE_URL.replace(/\/api\/v1$/, '').replace(/^http/, 'ws');
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] WS_URL', ws);
  return ws;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "PUT", body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
