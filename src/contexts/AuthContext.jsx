import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase.js';

const LOCAL_USER_STORAGE_KEY = 'ms_logged_in_member_session';

const AuthContext = createContext({
  user: null,
  profile: null,
  session: null,
  loading: true,
  isConfigured: false,
  signUp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  updateProfile: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if user already logged in via Common Club PIN
    try {
      const savedSession = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession);
        setUser(parsed.user);
        setProfile(parsed.profile);
        setLoading(false);
        return;
      }
    } catch {}

    // 2. If Supabase is configured, check Supabase auth
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => {
        if (!isMounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        console.warn('Supabase auth warning:', err);
        if (isMounted) setLoading(false);
      });

    let subscription = null;
    try {
      const res = supabase.auth.onAuthStateChange(async (_event, s) => {
        if (!isMounted) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          await fetchProfile(s.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });
      subscription = res?.data?.subscription;
    } catch (err) {
      console.warn('onAuthStateChange warning:', err);
    }

    return () => {
      isMounted = false;
      if (subscription?.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  async function fetchProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data) {
        setProfile(data);
      }
    } catch (err) {
      console.warn('Profile fetch warning:', err);
    } finally {
      setLoading(false);
    }
  }

  async function signUp({ email, password, displayName }) {
    if (!isSupabaseConfigured) {
      const cleanName = displayName?.trim() || email.split('@')[0];
      const memberUser = {
        id: `user-${Date.now()}`,
        email: email
      };
      const memberProfile = {
        display_name: cleanName,
        role: 'scorer'
      };
      setUser(memberUser);
      setProfile(memberProfile);
      try {
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify({
          user: memberUser,
          profile: memberProfile,
          loggedInAt: new Date().toISOString()
        }));
      } catch {}
      return { user: memberUser, profile: memberProfile };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) throw error;
    return data;
  }

  async function signIn({ email, password }) {
    if (!isSupabaseConfigured) {
      const cleanName = email.split('@')[0];
      const memberUser = {
        id: `user-${Date.now()}`,
        email: email
      };
      const memberProfile = {
        display_name: cleanName,
        role: 'scorer'
      };
      setUser(memberUser);
      setProfile(memberProfile);
      try {
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify({
          user: memberUser,
          profile: memberProfile,
          loggedInAt: new Date().toISOString()
        }));
      } catch {}
      return { user: memberUser, session: null };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    try {
      localStorage.removeItem(LOCAL_USER_STORAGE_KEY);
      if (isSupabaseConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('SignOut error:', err);
    }
    setUser(null);
    setProfile(null);
    setSession(null);
  }

  async function updateProfile(updates) {
    if (!user) throw new Error('Not authenticated');
    const updatedProfile = { ...(profile || {}), ...updates };
    setProfile(updatedProfile);

    try {
      const saved = localStorage.getItem(LOCAL_USER_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        parsed.profile = updatedProfile;
        localStorage.setItem(LOCAL_USER_STORAGE_KEY, JSON.stringify(parsed));
      }
    } catch {}

    return updatedProfile;
  }

  const value = {
    user,
    profile,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
