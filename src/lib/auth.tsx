import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LocalUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  aud: string;
  created_at: string;
}

interface AuthContextType {
  user: LocalUser | null;
  session: { user: LocalUser; access_token: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<{ user: LocalUser; access_token: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: string, sess: unknown) => {
        const s = sess as { user?: LocalUser; access_token?: string } | null;
        const u = s?.user ?? null;
        setSession(s && u ? { user: u, access_token: s.access_token ?? '' } : null);
        setUser(u);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: sess } }: { data: { session: unknown } }) => {
      const s = sess as { user?: LocalUser; access_token?: string } | null;
      const u = s?.user ?? null;
      setSession(s && u ? { user: u, access_token: s.access_token ?? '' } : null);
      setUser(u);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (_email: string, _password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: _email, password: _password });
    return { error };
  };

  const signUp = async (_email: string, _password: string, _fullName?: string) => {
    const { error } = await supabase.auth.signUp({ email: _email, password: _password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
