import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { rideLog, setDiagnosticNetwork } from "../utils/ride-request-diagnostics";

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

  if (configuredUrl) {
    return normalizeApiBaseUrl(configuredUrl);
  }

  const host = getExpoHost();

  if (host) {
    return `http://${host}:3000${API_PATH}`;
  }

  const fallbackHost = Platform.OS === "android" ? "10.0.2.2" : "localhost";
  return `http://${fallbackHost}:3000${API_PATH}`;
}

const API_BASE_URL = getApiBaseUrl();

if (__DEV__) {
  console.log("RideWay API base URL:", API_BASE_URL);
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
    // no token available
  }

  return headers;
}

type HttpClientOptions = {
  method?: string;
  body?: unknown;
  withStatus?: boolean;
  traceId?: string;
  attempt?: number;
};

async function request<T>(
  endpoint: string,
  options: HttpClientOptions = {}
): Promise<T> {
  const { method = "GET", body, withStatus = false, traceId, attempt } = options;
  const trace = traceId ?? `http-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const url = `${API_BASE_URL}${endpoint}`;
  const headers = await getHeaders();

  let response: Response;

  rideLog("HTTP_REQUEST_START", { method, endpoint });

  const startedAt = Date.now();
  rideLog("API_REQUEST_STARTED", {
    method,
    endpoint,
    url,
    traceId: trace,
    attempt: attempt ?? 1,
    timestamp: new Date().toISOString(),
    body,
  });

  try {
    setDiagnosticNetwork("online");
    const fetchPromise = fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    rideLog("API_REQUEST_SENT", { method, endpoint, traceId: trace, msToInit: Date.now() - startedAt });
    response = await fetchPromise;
  } catch {
    rideLog("HTTP_NETWORK_ERROR", { method, endpoint, traceId: trace, elapsedMs: Date.now() - startedAt });
    setDiagnosticNetwork("offline");
    throw new Error(
      `Network request failed for ${url}. Make sure the backend is running and reachable from this device.`
    );
  }

  setDiagnosticNetwork("online");
  rideLog("HTTP_RESPONSE", { method, endpoint, status: response.status });

  const rawBody = response.status === 204 ? null : await response.text();
  let parsedBody: unknown = null;
  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = rawBody;
    }
  }

  rideLog("API_RESPONSE_RECEIVED", {
    method,
    endpoint,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    traceId: trace,
    body: parsedBody,
  });

  if (!response.ok) {
    const errorData =
      parsedBody && typeof parsedBody === "object"
        ? (parsedBody as { error?: string; message?: string })
        : null;
    const message = errorData?.error || errorData?.message || `Request failed with ${response.status}`;
    rideLog("HTTP_ERROR", { method, endpoint, status: response.status, message, traceId: trace });
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    if (withStatus) {
      return { status: response.status, data: undefined } as T;
    }
    return undefined as T;
  }

  if (withStatus) {
    return { status: response.status, data: parsedBody } as T;
  }

  return parsedBody as T;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body: unknown, options?: { withStatus?: boolean; traceId?: string; attempt?: number }) =>
    request<T>(endpoint, { method: "POST", body, ...options }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "PUT", body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
