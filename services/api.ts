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

async function request<T>(
  endpoint: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const url = `${API_BASE_URL}${endpoint}`;
  const headers = await getHeaders();

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(
      `Network request failed for ${url}. Make sure the backend is running and reachable from this device.`
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || errorData?.message || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: "GET" }),
  post: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "POST", body }),
  put: <T>(endpoint: string, body: unknown) => request<T>(endpoint, { method: "PUT", body }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: "DELETE" }),
};
