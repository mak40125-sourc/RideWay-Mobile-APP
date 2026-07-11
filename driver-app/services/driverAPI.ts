import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { File, UploadType } from 'expo-file-system';
import { Platform } from 'react-native';
import { api } from './api';
import type { Driver, DriverLocation } from '../types/driver';

function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (configuredUrl) return configuredUrl.replace(/\/$/, '');

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000/api/v1`;

  const fallbackHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  return `http://${fallbackHost}:3000/api/v1`;
}

const API_BASE_URL = getApiBaseUrl();
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

  setOnline: async () => {
    return api.put('/drivers/online', { isOnline: true });
  },

  setOffline: async () => {
    return api.put('/drivers/offline', { isOnline: false });
  },

  uploadDocument: async (
    fileUri: string,
    documentType: string
  ): Promise<string> => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);

    const file = new File(fileUri);
    const result = await file.upload(`${API_BASE_URL}/drivers/upload-document`, {
      uploadType: UploadType.MULTIPART,
      fieldName: 'document',
      httpMethod: 'POST',
      mimeType: 'image/jpeg',
      headers: { Authorization: `Bearer ${token}` },
      parameters: { document_type: documentType },
    });

    if (result.status < 200 || result.status >= 300) {
      let message = `Upload failed (${result.status})`;
      try {
        const err = JSON.parse(result.body);
        message = err?.error || message;
      } catch {}
      throw new Error(message);
    }

    const data = JSON.parse(result.body);
    return data.document_url;
  },
};
