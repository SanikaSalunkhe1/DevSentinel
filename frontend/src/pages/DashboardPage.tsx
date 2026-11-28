import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  LogOut,
  Building2,
  Shield,
  Layers,
  User as UserIcon,
  CheckCircle2,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, activeWorkspace, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-[#060a14]/90 backdrop-blur sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
              DS
            </div>
            <span className="font-bold tracking-tight text-white text-base">DevSentinel</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            System Operational
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-4">
          {/* Active Workspace Pill */}
          {activeWorkspace && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Workspace:</span>
              <strong className="text-white font-semibold">{activeWorkspace.name}</strong>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                {activeWorkspace.role}
              </span>
            </div>
          )}

          {/* User Profile Pill */}
          {user && (
            <div className="flex items-center gap-2.5 pl-2">
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
                <div className="text-[11px] text-slate-400 leading-tight truncate max-w-[140px]">{user.email}</div>
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
            <span>{loggingOut ? 'Signing out...' : 'Logout'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* Welcome Banner */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-semibold mb-3 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Authentication &amp; Session Verified
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Your identity has been authenticated against the DevSentinel backend. You are ready to connect applications and monitor telemetry.
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Authenticated Profile Card */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-slate-900/40 border border-slate-800 backdrop-blur">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Authenticated Profile</h3>
              </div>
              <span className="text-xs text-slate-500">PostgreSQL Session</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1">Full Name</span>
                <span className="font-semibold text-white">{user?.name}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1">Verified Email</span>
                <span className="font-semibold text-white truncate block">{user?.email}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1">Account UUID</span>
                <span className="font-mono text-xs text-slate-300 truncate block">{user?.id}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-xs text-slate-500 block mb-1">Session Protection</span>
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <Shield className="w-3.5 h-3.5" />
                  <span>HTTP-Only Cookie (7 Days)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Active Workspace Summary Card */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Tenant Workspace</h3>
                </div>
                <span className="text-xs text-slate-500">Module 2</span>
              </div>

              {activeWorkspace ? (
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500 block">Workspace Name</span>
                    <strong className="text-base text-white">{activeWorkspace.name}</strong>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">URL Identifier / Slug</span>
                    <code className="text-xs text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                      {activeWorkspace.slug}
                    </code>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Role</span>
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-300">
                      {activeWorkspace.role}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500">No active workspace assigned.</p>
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Isolated Data Scope</span>
              <span className="text-emerald-400">100% Segmented</span>
            </div>
          </div>
        </div>

        {/* Next Steps Roadmap Panel */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900/60 via-slate-900/40 to-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Upcoming Modules Roadmap
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">Module 3</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Next</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">Application Registration</h4>
              <p className="text-xs text-slate-400">Register apps, generate API keys, configure SHA-256 key hashing &amp; key rotation.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 opacity-75">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400">Module 4</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Planned</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">@devsentinel/node-sdk</h4>
              <p className="text-xs text-slate-400">Custom non-blocking Express middleware for telemetry batching &amp; sensitive data redaction.</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 opacity-75">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-400">Module 5</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">Planned</span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1">Telemetry Ingestion Engine</h4>
              <p className="text-xs text-slate-400">High-throughput endpoint persisting logs, metrics, errors, and traces.</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 px-6 text-center text-xs text-slate-500">
        DevSentinel &bull; AI-Powered Application Monitoring &amp; Incident Intelligence Platform
      </footer>
    </div>
  );
};
