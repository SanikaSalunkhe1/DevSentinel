import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/layout/Navbar';
import {
  Building2,
  Shield,
  Layers,
  User as UserIcon,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { user, activeWorkspace } = useAuth();

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      <Navbar />

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
            <Link
              to="/applications"
              className="p-4 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-emerald-500/30 transition-colors block"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">Module 3</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">
                  Active
                </span>
              </div>
              <h4 className="text-sm font-semibold text-white mb-1 flex items-center justify-between">
                <span>Application Registration</span>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
              </h4>
              <p className="text-xs text-slate-400">Register apps, generate API keys, configure SHA-256 key hashing &amp; key rotation.</p>
            </Link>

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
