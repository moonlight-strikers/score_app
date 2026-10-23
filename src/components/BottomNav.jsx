import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Trophy,
  PlusCircle,
  Radio,
  BarChart3,
} from 'lucide-react';

const navItems = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Matches', path: '/matches', icon: Trophy },
  { label: 'New Match', path: '/matches/create', icon: PlusCircle },
  { label: 'Live', path: '/live', icon: Radio },
  { label: 'Records', path: '/records', icon: BarChart3 },
];

export default function BottomNav() {
  return (
    <nav className="ms-bottom-nav md:hidden safe-area-bottom">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `ms-bottom-nav-item ${isActive ? 'ms-bottom-nav-item-active' : ''}`
          }
        >
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
