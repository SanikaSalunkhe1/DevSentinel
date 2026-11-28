import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  Plus,
  Search,
  ArrowRight,
  AlertCircle,
  Loader2,
  Code2,
  Server,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/layout/Navbar';
import { CopyButton } from '../components/common/CopyButton';
import { AddApplicationModal } from '../components/applications/AddApplicationModal';
import { applicationService } from '../services/application.service';
import { Application, AppStatus } from '../types/application';

const ENV_BADGE: Record<string, string> = {
  PRODUCTION: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  STAGING: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  DEVELOPMENT: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  INACTIVE: 'bg-slate-700/40 text-slate-300 border-slate-600/40',
  ARCHIVED: 'bg-slate-800/60 text-slate-500 border-slate-700/40',
};

export const ApplicationsPage: React.FC = () => {
  const { activeWorkspace } = useAuth();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchApplications = useCallback(async () => {
    if (!activeWorkspace) return;
    setLoading(true);
    setError(null);
    try {
      const list = await applicationService.listApplications(
        activeWorkspace.id,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setApplications(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, statusFilter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const filteredApps = applications.filter((app) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      app.name.toLowerCase().includes(q) ||
      app.appId.toLowerCase().includes(q) ||
      (app.language && app.language.toLowerCase().includes(q)) ||
      (app.framework && app.framework.toLowerCase().includes(q))
    );
  });

  const handleApplicationCreated = (newApp: Application) => {
    setApplications((prev) => [newApp, ...prev]);
    navigate(`/applications/${newApp.id}`);
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
              <Boxes className="w-3.5 h-3.5" />
              <span>Application Registry</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Applications
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Register services in{' '}
              <span className="text-slate-200 font-medium">
                {activeWorkspace?.name ?? 'your workspace'}
              </span>{' '}
              and manage their API keys.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={fetchApplications}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              disabled={!activeWorkspace}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>Add Application</span>
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, App ID, language, framework..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-slate-800 p-1 rounded-xl">
            {(['ALL', 'ACTIVE', 'INACTIVE', 'ARCHIVED'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === status
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm">Loading applications...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          /* Empty State */
          <div className="p-12 rounded-2xl bg-slate-900/30 border border-dashed border-slate-800 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">
              {applications.length === 0 ? 'No applications registered yet' : 'No matching applications'}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
              {applications.length === 0
                ? 'Register your first application to receive a unique Application ID and generate secure API keys.'
                : 'Try clearing your search query or switching the status filter.'}
            </p>
            {applications.length === 0 && (
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Application</span>
              </button>
            )}
          </div>
        ) : (
          /* Applications Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredApps.map((app) => (
              <div
                key={app.id}
                onClick={() => navigate(`/applications/${app.id}`)}
                className="group p-5 rounded-2xl bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                        {app.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                        {app.description || 'No description provided'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          ENV_BADGE[app.environment] || ENV_BADGE.DEVELOPMENT
                        }`}
                      >
                        {app.environment}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          STATUS_BADGE[app.status] || STATUS_BADGE.ACTIVE
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>
                  </div>

                  {/* Stack tags */}
                  {(app.language || app.framework) && (
                    <div className="flex items-center gap-2 mt-3">
                      <Code2 className="w-3.5 h-3.5 text-slate-500" />
                      {app.language && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                          {app.language}
                        </span>
                      )}
                      {app.framework && (
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
                          {app.framework}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer with App ID + View */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-cyan-300 bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40">
                      {app.appId}
                    </code>
                    <CopyButton value={app.appId} label="Copy ID" />
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {activeWorkspace && (
        <AddApplicationModal
          workspaceId={activeWorkspace.id}
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={handleApplicationCreated}
        />
      )}
    </div>
  );
};
