import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const AdminContext = createContext(null);

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminToken, setAdminToken] = useState(null);
  const [isPinScreenOpen, setIsPinScreenOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const openPinScreen = () => {
    setIsPinScreenOpen(true);
  };

  const closePinScreen = () => {
    setIsPinScreenOpen(false);
  };

  /**
   * Verify the entered PIN against Supabase admin_settings table via RPC.
   * If correct, establishes a server-authorized admin session.
   * NEVER stores the PIN in localStorage or sessionStorage.
   */
  const verifyPin = async (enteredPin) => {
    if (!enteredPin || enteredPin.length !== 6) {
      return { success: false, error: 'PIN must be exactly 6 digits.' };
    }

    // Generate a cryptographically random session token for server authorization
    const generatedToken =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `adm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.rpc('verify_admin_pin', {
          input_pin: enteredPin,
          session_token: generatedToken,
        });

        if (error) {
          console.error('Supabase verify_admin_pin error:', error);
          return {
            success: false,
            error: error.message || 'Verification failed. Please try again.',
          };
        }

        if (data === true) {
          setIsAdmin(true);
          setAdminToken(generatedToken);
          setIsPinScreenOpen(false);
          // Navigate to admin dashboard area
          navigate('/matches');
          return { success: true };
        } else {
          return { success: false, error: 'Incorrect PIN. Access denied.' };
        }
      } catch (err) {
        console.error('verifyPin exception:', err);
        return {
          success: false,
          error: err.message || 'Connection error. Please try again.',
        };
      }
    } else {
      // Offline fallback: check default '000000'
      if (enteredPin === '000000') {
        setIsAdmin(true);
        setAdminToken(`offline_${Date.now()}`);
        setIsPinScreenOpen(false);
        navigate('/matches');
        return { success: true };
      }
      return { success: false, error: 'Incorrect PIN. Access denied.' };
    }
  };

  /**
   * Explicitly revoke admin session both server-side and client-side,
   * then redirect to public Cricket Home Page.
   */
  const logoutAdmin = async () => {
    if (adminToken && isSupabaseConfigured) {
      try {
        await supabase.rpc('admin_close_session', { p_token: adminToken });
      } catch (err) {
        console.warn('Error closing admin session on server:', err);
      }
    }
    setIsAdmin(false);
    setAdminToken(null);
    navigate('/');
  };

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        adminToken,
        isPinScreenOpen,
        openPinScreen,
        closePinScreen,
        verifyPin,
        logoutAdmin,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
}
