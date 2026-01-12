// API client - replaces Supabase database client

import { auth } from './auth';

const API_URL = import.meta.env.VITE_API_URL || '';

async function fetchWithAuth(path: string, options: RequestInit = {}): Promise<Response> {
  const token = auth.getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
}

// Generic response type
interface ApiResponse<T> {
  data: T | null;
  error: Error | null;
}

// Profile types
export interface Profile {
  id: string;
  display_name: string;
  niche_interest: string;
  avatar_url: string | null;
  created_at: string;
}

// Traits types
export interface Traits {
  user_id: string;
  big5: object;
  passion_score: number;
  archetype: string;
  tags: string[];
  deep_hooks: string[];
  updated_at: string;
}

// Room types
export interface Room {
  id: string;
  name: string;
  slug: string;
  type: 'interest' | 'vibe';
  description: string | null;
  created_at: string;
}

// Message types
export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// API functions
export const api = {
  // Profiles
  async getProfile(id: string): Promise<ApiResponse<Profile>> {
    try {
      const response = await fetchWithAuth(`/api/profiles/${id}`);
      if (!response.ok) {
        return { data: null, error: new Error('Profile not found') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async getProfiles(ids: string[]): Promise<ApiResponse<Profile[]>> {
    try {
      const response = await fetchWithAuth(`/api/profiles?ids=${ids.join(',')}`);
      if (!response.ok) {
        return { data: null, error: new Error('Failed to fetch profiles') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Traits
  async getTraits(userId: string): Promise<ApiResponse<Traits>> {
    try {
      const response = await fetchWithAuth(`/api/traits/${userId}`);
      if (!response.ok) {
        return { data: null, error: new Error('Traits not found') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async upsertTraits(traits: Omit<Traits, 'user_id' | 'updated_at'>): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetchWithAuth('/api/traits', {
        method: 'POST',
        body: JSON.stringify(traits),
      });
      if (!response.ok) {
        return { data: null, error: new Error('Failed to save traits') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Rooms
  async getRooms(): Promise<ApiResponse<Room[]>> {
    try {
      const response = await fetchWithAuth('/api/rooms');
      if (!response.ok) {
        return { data: null, error: new Error('Failed to fetch rooms') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async getRoomBySlug(slug: string): Promise<ApiResponse<Room>> {
    try {
      const response = await fetchWithAuth(`/api/rooms?slug=${encodeURIComponent(slug)}`);
      if (!response.ok) {
        return { data: null, error: new Error('Room not found') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async createRoom(room: Omit<Room, 'id' | 'created_at'>): Promise<ApiResponse<Room>> {
    try {
      const response = await fetchWithAuth('/api/rooms', {
        method: 'POST',
        body: JSON.stringify(room),
      });
      if (!response.ok) {
        return { data: null, error: new Error('Failed to create room') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // User rooms (room membership)
  async getUserRooms(): Promise<ApiResponse<Room[]>> {
    try {
      const response = await fetchWithAuth('/api/user-rooms');
      if (!response.ok) {
        return { data: null, error: new Error('Failed to fetch user rooms') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async joinRoom(roomId: string): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetchWithAuth('/api/room-members', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId }),
      });
      if (!response.ok) {
        return { data: null, error: new Error('Failed to join room') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Messages
  async getMessages(roomId: string): Promise<ApiResponse<Message[]>> {
    try {
      const response = await fetchWithAuth(`/api/messages?room_id=${roomId}`);
      if (!response.ok) {
        return { data: null, error: new Error('Failed to fetch messages') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async sendMessage(roomId: string, content: string): Promise<ApiResponse<Message>> {
    try {
      const response = await fetchWithAuth('/api/messages', {
        method: 'POST',
        body: JSON.stringify({ room_id: roomId, content }),
      });
      if (!response.ok) {
        return { data: null, error: new Error('Failed to send message') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Sessions (update status)
  async updateSession(updates: { status?: string; transcript?: string }): Promise<ApiResponse<{ success: boolean }>> {
    try {
      const response = await fetchWithAuth('/api/sessions', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!response.ok) {
        return { data: null, error: new Error('Failed to update session') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  // Interview functions (replaces supabase.functions.invoke)
  async startInterview(niche: string): Promise<ApiResponse<{ session_id: string; session_url: string }>> {
    try {
      const response = await fetchWithAuth('/start-interview', {
        method: 'POST',
        body: JSON.stringify({ niche }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: new Error(errorData.error || 'Failed to start interview') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },

  async checkInterviewStatus(): Promise<ApiResponse<{
    status: string;
    transcript?: string;
    message?: string;
  }>> {
    try {
      const response = await fetchWithAuth('/check-interview-status');
      if (!response.ok) {
        const errorData = await response.json();
        return { data: null, error: new Error(errorData.error || 'Failed to check status') };
      }
      const data = await response.json();
      return { data, error: null };
    } catch (error) {
      return { data: null, error: error as Error };
    }
  },
};
