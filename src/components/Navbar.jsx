import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Navbar() {
  const location = useLocation();

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'New Match', path: '/create-match' },
    { label: 'Matches', path: '/history' },
    { label: 'Player Stats', path: '/stats' },
    { label: 'Login', path: '/login' }
  ];

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          🏏 Cricket Scorer
        </Link>
        <ul className="navbar-menu">
          {navLinks.map((link) => (
            <li key={link.path}>
              <Link
                to={link.path}
                className={`navbar-link ${location.pathname === link.path ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
