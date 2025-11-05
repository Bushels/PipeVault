/**
 * Authentication Context using Supabase Auth
 * Provides auth state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { queryClient } from './QueryProvider';
import { queryKeys } from '../hooks/useSupabaseData';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    profile?: {
      companyName?: string;
      firstName?: string;
      lastName?: string;
      contactNumber?: string;
    }
  ) => Promise<void>;
  signInWithOAuth: (provider: 'google' | 'apple' | 'azure') => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const ensuredCompanyRef = useRef<string | null>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const previousUserId = user?.id;
      const newUserId = session?.user?.id;

      setSession(session);
      setUser(session?.user ?? null);
      checkAdminStatus(session?.user ?? null);

      // Clear React Query cache when:
      // 1. User signs out (SIGNED_OUT event)
      // 2. User signs in with a different account (different user ID)
      if (event === 'SIGNED_OUT' || (newUserId && previousUserId && newUserId !== previousUserId)) {
        console.log('Auth state changed - clearing query cache to prevent stale data');
        queryClient.clear();
      }
      // Also refetch all queries when signing in to ensure fresh data with new JWT
      else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        console.log('User authenticated - invalidating queries to refetch with new permissions');
        queryClient.invalidateQueries();
      }
    });

    return () => subscription.unsubscribe();
  }, [user?.id]);

  const checkAdminStatus = async (user: User | null) => {
    if (!user) {
      setIsAdmin(false);
      return;
    }

    try {
      // Method 1: Hardcoded admin email (for testing/initial setup)
      // TODO: Remove this after setting up proper admin in Supabase
      const adminEmails = [
        'admin@mpsgroup.com',
        'kyle@bushels.com',
        'admin@bushels.com',
        'kylegronning@mpsgroup.ca'
      ];
      if (user.email && adminEmails.includes(user.email.toLowerCase())) {
        setIsAdmin(true);
        return;
      }

      // Method 2: Check user metadata
      const userMetadata = user.app_metadata;
      if (userMetadata?.role === 'admin') {
        setIsAdmin(true);
        return;
      }

      // Method 3: Check admin_users table
      const { data, error } = await supabase
        .from('admin_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle(); // Use maybeSingle() to avoid 406 errors when no record exists

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail || email,
      password,
    });

    if (error) {
      throw error;
    }
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    profile?: { companyName?: string; firstName?: string; lastName?: string; contactNumber?: string }
  ) => {
    const metadata: Record<string, string> = {};
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      metadata.contact_email = normalizedEmail;
    }
    if (profile?.companyName) metadata.company_name = profile.companyName.trim();
    if (profile?.firstName) metadata.first_name = profile.firstName.trim();
    if (profile?.lastName) metadata.last_name = profile.lastName.trim();
    if (profile?.contactNumber) metadata.contact_number = profile.contactNumber.trim();

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail || email,
      password,
      options: Object.keys(metadata).length ? { data: metadata } : undefined,
    });

    if (error) {
      throw error;
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'apple' | 'azure') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.log('Supabase signOut error (may be expected):', error.message);
      }
    } finally {
      // Always clear local state, even if API call fails
      setUser(null);
      setSession(null);
      setIsAdmin(false);

      // Clear React Query cache to prevent stale data when logging in with different account
      console.log('Logout - clearing all cached queries');
      queryClient.clear();
    }
  };

  const ensureCompanyForUser = async (currentUser: User): Promise<boolean> => {
    const rawEmail = currentUser.email?.trim().toLowerCase();
    if (!rawEmail) return false;
    const domain = rawEmail.split('@')[1];
    if (!domain) return false;

    try {
      const { data: existing, error } = await supabase
        .from('companies')
        .select('id')
        .eq('domain', domain)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch company record', error);
        return false;
      }

      if (existing) {
        return true;
      }

      const metadataName = (currentUser.user_metadata?.company_name as string | undefined)?.trim();
      const derivedName = metadataName && metadataName.length > 0
        ? metadataName
        : domain.split('.')[0].replace(/[-_]/g, ' ');
      const companyName = derivedName.replace(/\b\w/g, (char) => char.toUpperCase());

      const { error: insertError } = await supabase
        .from('companies')
        .insert({ name: companyName, domain })
        .select('id')
        .single();

      if (insertError) {
        if (insertError.code === '23505') {
          return true;
        }
        console.error('Failed to create company record', insertError);
        return false;
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.companies });
      return true;
    } catch (error) {
      console.error('Unexpected error ensuring company', error);
      return false;
    }
  };

  useEffect(() => {
    if (!user) {
      ensuredCompanyRef.current = null;
      return;
    }

    if (ensuredCompanyRef.current === user.id) {
      return;
    }

    ensureCompanyForUser(user).then((ensured) => {
      if (ensured) {
        ensuredCompanyRef.current = user.id;
      }
    });
  }, [user?.id]);

  const value = {
    user,
    session,
    isAdmin,
    loading,
    signInWithEmail,
    signUpWithEmail,
    signInWithOAuth,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
