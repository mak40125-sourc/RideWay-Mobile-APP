import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { clearAuthToken, setAuthToken } from "../services/api";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Custom storage adapter for Supabase
const secureStorageAdapter = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") {
      return await AsyncStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Listen for auth state changes and sync token to API layer
supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.access_token) {
    await setAuthToken(session.access_token);
  } else {
    await clearAuthToken();
  }
});

export async function signUpWithPhone(phone: string, password: string, name: string) {
  // Normalize phone number to E.164 format
  const formattedPhone = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;
  
  const { data, error } = await supabase.auth.signUp({
    phone: formattedPhone,
    password,
    options: { // In the rider app, new phone sign-ups should always be riders.
      data: { name, role: 'rider' },
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithPhone(phone: string, password: string) {
  // Normalize phone number to E.164 format
  const formattedPhone = phone.trim().startsWith('+') ? phone.trim() : `+${phone.trim()}`;

  const { data, error } = await supabase.auth.signInWithPassword({
    phone: formattedPhone,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, name: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { 
        name, 
        full_name: name,
        display_name: name,
        role: 'rider' 
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export type UserProfile = {
  id: string;
  name: string;
  phone: string | null; // Phone might be null if signed up with email
  role: "rider"; // In the rider app, the user's role is always 'rider'
  avatar_url: string | null;
  created_at: string;
};

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }

    throw error;
  }
  return data;
}

export async function updateProfile(userId: string, updates: Partial<Omit<UserProfile, "id" | "created_at">>) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
}