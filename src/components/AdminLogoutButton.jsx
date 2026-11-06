import React from 'react';
import { LogOut } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useAdmin } from '../contexts/AdminContext';

/**
 * Dedicated circular red glossy Admin Logout button.
 * Inspired by reference design:
 * - Rich 3D red radial gloss gradient
 * - Centered white logout/exit door icon
 * - Appears ONLY when admin is authenticated and NOT on the public home page or MPIN screen
 * - Revokes admin session and redirects to public Cricket Home Page
 */
export default function AdminLogoutButton({ className = '' }) {
  const { isAdmin, logoutAdmin } = useAdmin();
  const location = useLocation();

  // Strictly appear only when admin is authenticated and not on the public home page
  if (!isAdmin || location.pathname === '/') {
    return null;
  }

  const handleLogout = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await logoutAdmin();
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer select-none transition-all duration-200 active:scale-90 active:brightness-90 flex-shrink-0 ${className}`}
      style={{
        background: 'radial-gradient(circle at 35% 30%, #ff4d4d 0%, #e60000 55%, #990000 100%)',
        boxShadow:
          '0 4px 12px rgba(230, 0, 0, 0.45), 0 1px 3px rgba(0, 0, 0, 0.4), inset 0 2px 2px rgba(255, 255, 255, 0.45), inset 0 -2px 3px rgba(0, 0, 0, 0.3)',
        border: '1.5px solid rgba(255, 120, 120, 0.45)',
      }}
      title="Admin Logout"
      aria-label="Admin Logout"
    >
      <LogOut className="w-4 h-4 sm:w-5 sm:h-5 text-white stroke-[2.4] -translate-x-[1px]" />
    </button>
  );
}
