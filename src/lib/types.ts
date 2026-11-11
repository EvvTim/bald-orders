export interface Task {
  truck: string;
  number: string;
  product: string;
  loadingDateTime: string;
  loadingLocation: string;
  unloadingDateTime: string;
  unloadingLocation: string;
}

export interface Location {
  name: string;
  street: string;
  countryCity: string;
}

export interface ParsedDateTime {
  date: Date | null;
  time: string;
}

export interface Settings {
  autoSyncEnabled: boolean;
  intervalMinutes: number;
}

export interface DiffNewTasksResult {
  knownNumbers: string[];
  unseenNumbers: string[];
}

export interface StoredState {
  tasks?: Task[];
  syncedAt?: number;
  knownNumbers?: string[];
  unseenNumbers?: string[];
  favoriteLocations?: string[];
  settings?: Settings;
}
