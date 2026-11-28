import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LogOut, Building2, LayoutDashboard, Boxes } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, workspaces, activeWorkspace, setActiveWorkspace, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      isActive
        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
        : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
    }`;

  return (
    <header className="border-b border-slate-800/80 bg-[#060a14]/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <NavLink to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
            DS
          </div>
          <span className="font-bold tracking-tight text-white text-base">DevSentinel</span>
        </NavLink>

        <nav className="flex items-center gap-1.5">
          <NavLink to="/dashboard" className={navLinkClass}>
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Overview</span>
          </NavLink>
          <NavLink to="/applications" className={navLinkClass}>
            <Boxes className="w-3.5 h-3.5" />
            <span>Applications</span>
          </NavLink>
        </nav>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Workspace Switcher / Pill */}
        {activeWorkspace && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            {workspaces.length > 1 ? (
              <select
                value={activeWorkspace.id}
                onChange={(e) => {
                  const found = workspaces.find((w) => w.id === e.target.value);
                  if (found) setActiveWorkspace(found);
                }}
                className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id} className="bg-slate-900 text-white">
                    {ws.name}
                  </option>
                ))}
              </select>
            ) : (
              <strong className="text-white font-semibold">{activeWorkspace.name}</strong>
            )}
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
              {activeWorkspace.role}
            </span>
          </div>
        )}

        {/* User Profile Pill */}
        {user && (
          <div className="flex items-center gap-2.5 pl-1">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-8 h-8 rounded-full border border-slate-700 object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <div className="text-xs font-semibold text-white leading-tight">{user.name}</div>
              <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">
                {user.email}
              </div>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/40 hover:text-rose-300 border border-slate-800 hover:border-rose-900/50 text-xs font-medium text-slate-400 transition-colors disabled:opacity-50"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{loggingOut ? 'Signing out...' : 'Logout'}</span>
        </button>
      </div>
    </header>
  );
};
