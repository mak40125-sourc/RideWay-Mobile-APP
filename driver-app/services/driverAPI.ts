import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from './api';
import type { Driver, DriverLocation } from '../types/driver';

function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] driverAPI_URL_RESOLVE', JSON.stringify({
    env: process.env.EXPO_PUBLIC_API_BASE_URL ?? null,
    configuredUrl: configuredUrl || null,
    hostUri: (Constants.expoConfig?.hostUri ?? (Constants as any).expoGoConfig?.debuggerHost ?? (Constants as any).manifest?.debuggerHost ?? null),
    platform: Platform.OS,
  }));
  if (configuredUrl) {
    const u = configuredUrl.replace(/\/$/, '');
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] driverAPI_BASE_SOURCE', `env:${u}`);
    return u;
  }
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) {
    const u = `http://${host}:3000/api/v1`;
    // eslint-disable-next-line no-console
    console.log('[RIDEWAY-DIAG] driverAPI_BASE_SOURCE', `expoHost:${u}`);
    return u;
  }
  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  const u = `http://${fallbackHost}:3000/api/v1`;
  // eslint-disable-next-line no-console
  console.log('[RIDEWAY-DIAG] driverAPI_BASE_SOURCE', `fallback:${u}`);
  return u;
}

const API_BASE_URL = getApiBaseUrl();
// eslint-disable-next-line no-console
console.log('[RIDEWAY-DIAG] driverAPI_BASE_URL_FINAL', API_BASE_URL);
const TOKEN_KEY = 'supabase_token';

export const driverAPI = {
  getMyProfile: async (): Promise<Driver> => {
    return api.get<Driver>('/drivers/me');
  },

  register: async (data: {
    vehicle_type: string;
    vehicle_number: string;
    vehicle_model?: string;
    vehicle_color?: string;
    documents?: { document_type: string; document_url: string }[];
  }): Promise<Driver> => {
    return api.post<Driver>('/drivers/register', data);
  },

  updateLocation: async (location: DriverLocation) => {
    return api.put('/drivers/location', { location });
  },

  setOnline: async (rideType?: string, vehicleNumber?: string) => {
    return api.put('/drivers/online', { isOnline: true, rideType, vehicleNumber });
  },

  setOffline: async () => {
    return api.put('/drivers/offline', { isOnline: false });
  },

  uploadDocument: async (
    fileUri: string,
    documentType: string
  ): Promise<string> => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);

    const formData = new FormData();
    formData.append('document', {
      uri: fileUri,
      type: 'image/jpeg',
      name: 'document.jpg',
    } as any);
    formData.append('document_type', documentType);

    const response = await fetch(`${API_BASE_URL}/drivers/upload-document`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!response.ok) {
      let message = `Upload failed (${response.status})`;
      try {
        const err = await response.json();
        message = err?.error || message;
      } catch {}
      throw new Error(message);
    }

    const data = await response.json();
    return data.document_url;
  },
};
