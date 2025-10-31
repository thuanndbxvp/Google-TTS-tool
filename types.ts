

export interface AudioResult {
  id: number;
  text: string;
  audioUrl: string;
}

// FIX: Added missing ApiKey interface.
export interface ApiKey {
  id: number;
  key: string;
}
