
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import { createContext, useContext, useEffect, useState, useMemo, useCallback as ReactUseCallback } from 'react'; // Aliased useCallback to avoid conflict
import type { AuthError, Session, User, SignUpWithPasswordCredentials } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (credentials: SignUpWithPasswordCredentials) => Promise<{ error: AuthError | null; data: { user: User | null; session: Session | null; } | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setIsLoading(true);
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        if (event === 'SIGNED_IN' && session) {
          router.push('/');
        } else if (event === 'SIGNED_OUT') {
          if (router.pathname !== '/login' && router.pathname !== '/signup') {
            router.push('/login');
          }
        } else if (event === 'USER_UPDATED') {
           if (router.pathname === '/profile') {
           }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session : currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    }).catch(error => {
      console.error("AuthContext: Error fetching initial session:", error);
      setSession(null);
      setUser(null);
      setIsLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  const signInWithEmail = ReactUseCallback(async (email: string, password: string) => {
    setIsLoading(true); 
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    setIsLoading(false);
    return { error };
  }, []); 

  const signUpWithEmail = ReactUseCallback(async (credentials: SignUpWithPasswordCredentials) => {
    setIsLoading(true); 
    const { data, error } = await supabase.auth.signUp(credentials);
    setIsLoading(false);
    return { error, data };
  }, []); 

  const signOutUser = ReactUseCallback(async () => { 
    setIsLoading(true); 
    const { error } = await supabase.auth.signOut();
    setIsLoading(false);
    return { error };
  }, []); 


  const value = useMemo(() => ({
    session,
    user,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut: signOutUser, 
  }), [session, user, isLoading, signInWithEmail, signUpWithEmail, signOutUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

