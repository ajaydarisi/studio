
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
          // Only push to login if not already on signup or login to avoid redirect loops
          if (router.pathname !== '/login' && router.pathname !== '/signup') {
            router.push('/login');
          }
        } else if (event === 'USER_UPDATED') {
           // Refresh user data if already on profile page
           if (router.pathname === '/profile') {
             // Potentially trigger a re-fetch or rely on component's own useEffect for user
           }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session : currentSession } }) => { // Renamed to avoid conflict
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]); // router dependency is important here

  const signInWithEmail = ReactUseCallback(async (email: string, password: string) => {
    setIsLoading(true); // Consider if this global loading is needed for sign-in specifically
    const { error, data } = await supabase.auth.signInWithPassword({ email, password });
    // Session/user update handled by onAuthStateChange
    setIsLoading(false);
    return { error };
  }, []); // Empty dependency array: this function never changes

  const signUpWithEmail = ReactUseCallback(async (credentials: SignUpWithPasswordCredentials) => {
    setIsLoading(true); // Consider if this global loading is needed
    const { data, error } = await supabase.auth.signUp(credentials);
    setIsLoading(false);
    return { error, data };
  }, []); // Empty dependency array

  const signOutUser = ReactUseCallback(async () => { // Renamed to avoid conflict with 'signOut' from useState
    setIsLoading(true); // Consider if this global loading is needed
    const { error } = await supabase.auth.signOut();
    setIsLoading(false);
    return { error };
  }, []); // Empty dependency array


  const value = useMemo(() => ({
    session,
    user,
    isLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut: signOutUser, // Use the renamed function
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

// The problematic line "const useCallback = React.useCallback;" has been removed.
// Functions within the provider now use ReactUseCallback (aliased import) directly.
