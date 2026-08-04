import AsyncStorage from "@react-native-async-storage/async-storage";

export type SavedPlace = {
  id: string;
  name: string;
  address: string;
};

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

export type NotificationPrefs = {
  rideUpdates: boolean;
  promotions: boolean;
  serviceAlerts: boolean;
};

const PREFIX = "rideway:";

async function readList<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(PREFIX + key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(list));
}

export function getSavedPlaces(): Promise<SavedPlace[]> {
  return readList<SavedPlace>("saved_places");
}

export function setSavedPlaces(places: SavedPlace[]): Promise<void> {
  return writeList<SavedPlace>("saved_places", places);
}

export function getEmergencyContacts(): Promise<EmergencyContact[]> {
  return readList<EmergencyContact>("emergency_contacts");
}

export function setEmergencyContacts(contacts: EmergencyContact[]): Promise<void> {
  return writeList<EmergencyContact>("emergency_contacts", contacts);
}

const PREFS_KEY = PREFIX + "notification_prefs";

const DEFAULT_PREFS: NotificationPrefs = {
  rideUpdates: true,
  promotions: false,
  serviceAlerts: true,
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotificationPrefs>) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setNotificationPrefs(prefs: NotificationPrefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}
