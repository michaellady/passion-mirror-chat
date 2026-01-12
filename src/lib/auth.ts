// Auth service - replaces Supabase Auth

const API_URL = import.meta.env.VITE_API_URL || '';

export interface User {
  id: string;
  email: string;
  display_name: string;
  niche_interest: string;
  created_at: string;
}

export interface Session {
  user: User;
  token: string;
}

type AuthChangeCallback = (event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null) => void;

const AUTH_TOKEN_KEY = 'passion_auth_token';
const AUTH_USER_KEY = 'passion_auth_user';

let currentSession: Session | null = null;
const listeners: Set<AuthChangeCallback> = new Set();

// Initialize session from localStorage
function initSession(): void {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const userJson = localStorage.getItem(AUTH_USER_KEY);

  if (token && userJson) {
    try {
      currentSession = {
        token,
        user: JSON.parse(userJson),
      };
    } catch {
      clearSession();
    }
  }
}

function setSession(session: Session | null): void {
  currentSession = session;

  if (session) {
    localStorage.setItem(AUTH_TOKEN_KEY, session.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
    notifyListeners('SIGNED_IN', session);
  } else {
    clearSession();
    notifyListeners('SIGNED_OUT', null);
  }
}

function clearSession(): void {
  currentSession = null;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function notifyListeners(event: 'SIGNED_IN' | 'SIGNED_OUT', session: Session | null): void {
  listeners.forEach((callback) => callback(event, session));
}

export const auth = {
  async signUp(params: {
    email: string;
    password: string;
    options?: { data?: { display_name?: string; niche_interest?: string } };
  }): Promise<{ data: { user: User | null }; error: Error | null }> {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          display_name: params.options?.data?.display_name || '',
          niche_interest: params.options?.data?.niche_interest || '',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: { user: null }, error: new Error(data.error || 'Signup failed') };
      }

      setSession({ user: data.user, token: data.token });
      return { data: { user: data.user }, error: null };
    } catch (error) {
      return { data: { user: null }, error: error as Error };
    }
  },

  async signInWithPassword(params: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null }; error: Error | null }> {
    try {
      const response = await fetch(`${API_URL}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          password: params.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { data: { user: null }, error: new Error(data.error || 'Sign in failed') };
      }

      setSession({ user: data.user, token: data.token });
      return { data: { user: data.user }, error: null };
    } catch (error) {
      return { data: { user: null }, error: error as Error };
    }
  },

  async signOut(): Promise<{ error: Error | null }> {
    setSession(null);
    return { error: null };
  },

  async getSession(): Promise<{ data: { session: Session | null } }> {
    if (!currentSession) {
      initSession();
    }

    // Verify token is still valid
    if (currentSession) {
      try {
        const response = await fetch(`${API_URL}/auth/session`, {
          headers: { Authorization: `Bearer ${currentSession.token}` },
        });

        if (!response.ok) {
          clearSession();
          return { data: { session: null } };
        }

        const data = await response.json();
        if (data.user) {
          currentSession.user = data.user;
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));
        }
      } catch {
        // Network error - keep existing session
      }
    }

    return { data: { session: currentSession } };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: Error | null }> {
    const { data } = await this.getSession();
    return { data: { user: data.session?.user || null }, error: null };
  },

  onAuthStateChange(callback: AuthChangeCallback): { data: { subscription: { unsubscribe: () => void } } } {
    listeners.add(callback);

    // Notify with current state
    if (currentSession) {
      callback('SIGNED_IN', currentSession);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(callback),
        },
      },
    };
  },

  getToken(): string | null {
    return currentSession?.token || localStorage.getItem(AUTH_TOKEN_KEY);
  },
};

// Initialize on module load
initSession();
