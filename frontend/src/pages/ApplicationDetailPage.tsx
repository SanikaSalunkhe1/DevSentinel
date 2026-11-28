import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Key,
  Plus,
  RotateCw,
  Ban,
  Trash2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  ShieldAlert,
  Terminal,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Navbar } from '../components/layout/Navbar';
import { CopyButton } from '../components/common/CopyButton';
import { applicationService } from '../services/application.service';
import {
  Application,
  ApiKeyInfo,
  GeneratedApiKey,
  ConnectionStatus,
} from '../types/application';

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const ApplicationDetailPage: React.FC = () => {
  const { applicationId } = useParams<{ applicationId: string }>();
  const { activeWorkspace } = useAuth();
  const navigate = useNavigate();

  const [application, setApplication] = useState<Application | null>(null);
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // One-time revealed key (after generate or rotate)
  const [revealedKey, setRevealedKey] = useState<GeneratedApiKey | null>(null);

  // Key generation form state
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generatingKey, setGeneratingKey] = useState(false);

  // Action states
  const [actionKeyId, setActionKeyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmDeleteApp, setConfirmDeleteApp] = useState(false);
  const [deletingApp, setDeletingApp] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeWorkspace || !applicationId) return;
    setLoading(true);
    setError(null);
    try {
      const [appData, keyList] = await Promise.all([
        applicationService.getApplication(activeWorkspace.id, applicationId),
        applicationService.listApiKeys(activeWorkspace.id, applicationId),
      ]);
      setApplication(appData);
      setKeys(keyList);
    } catch (err: any) {
      setError(err.message || 'Failed to load application details');
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace, applicationId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derive real connection status and last telemetry timestamp from actual backend key usage
  const telemetryState = useMemo(() => {
    const now = new Date();
    const activeKeys = keys.filter(
      (k) => k.isActive && !k.revokedAt && (!k.expiresAt || new Date(k.expiresAt) > now)
    );

    const usedTimestamps = keys
      .map((k) => k.lastUsedAt)
      .filter((t): t is string => Boolean(t))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    const lastTelemetryAt = usedTimestamps.length > 0 ? usedTimestamps[0] : null;

    let connectionStatus: ConnectionStatus = 'AWAITING_TELEMETRY';
    if (activeKeys.length === 0) {
      connectionStatus = 'NO_ACTIVE_KEY';
    } else if (lastTelemetryAt) {
      connectionStatus = 'CONNECTED';
    }

    return {
      connectionStatus,
      lastTelemetryAt,
      activeKeyCount: activeKeys.length,
    };
  }, [keys]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !application || !newKeyLabel.trim()) return;

    setGeneratingKey(true);
    setError(null);
    try {
      const generated = await applicationService.generateApiKey(
        activeWorkspace.id,
        application.id,
        newKeyLabel.trim()
      );
      setRevealedKey(generated);
      setNewKeyLabel('');
      const updatedKeys = await applicationService.listApiKeys(
        activeWorkspace.id,
        application.id
      );
      setKeys(updatedKeys);
    } catch (err: any) {
      setError(err.message || 'Failed to generate API key');
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRotateKey = async (keyId: string) => {
    if (!activeWorkspace || !application) return;
    setActionKeyId(keyId);
    setError(null);
    try {
      const rotated = await applicationService.rotateApiKey(
        activeWorkspace.id,
        application.id,
        keyId
      );
      setRevealedKey(rotated);
      const updatedKeys = await applicationService.listApiKeys(
        activeWorkspace.id,
        application.id
      );
      setKeys(updatedKeys);
    } catch (err: any) {
      setError(err.message || 'Failed to rotate API key');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!activeWorkspace || !application) return;
    setActionKeyId(keyId);
    setError(null);
    try {
      await applicationService.revokeApiKey(activeWorkspace.id, application.id, keyId);
      setConfirmRevokeId(null);
      const updatedKeys = await applicationService.listApiKeys(
        activeWorkspace.id,
        application.id
      );
      setKeys(updatedKeys);
    } catch (err: any) {
      setError(err.message || 'Failed to revoke API key');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!activeWorkspace || !application) return;
    setActionKeyId(keyId);
    setError(null);
    try {
      await applicationService.deleteApiKey(activeWorkspace.id, application.id, keyId);
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete API key');
    } finally {
      setActionKeyId(null);
    }
  };

  const handleDeleteApplication = async () => {
    if (!activeWorkspace || !application) return;
    setDeletingApp(true);
    setError(null);
    try {
      await applicationService.deleteApplication(activeWorkspace.id, application.id);
      navigate('/applications');
    } catch (err: any) {
      setError(err.message || 'Failed to delete application');
      setDeletingApp(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col">
      <Navbar />

      <main className="flex-1 p-6 md:p-10 max-w-6xl mx-auto w-full">
        {/* Back Breadcrumb */}
        <div className="mb-6">
          <Link
            to="/applications"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Applications</span>
          </Link>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400 mb-3" />
            <p className="text-sm">Loading application details...</p>
          </div>
        ) : !application ? (
          <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
            <h2 className="text-lg font-bold text-white mb-2">Application Not Found</h2>
            <p className="text-xs text-slate-400 mb-4">
              This application does not exist in your active workspace or has been deleted.
            </p>
            <Link
              to="/applications"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
            >
              Return to Applications
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Card */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5 mb-2">
                  <h1 className="text-2xl font-bold text-white tracking-tight">
                    {application.name}
                  </h1>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {application.environment}
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {application.status}
                  </span>
                </div>
                <p className="text-sm text-slate-400">
                  {application.description || 'No description provided'}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-slate-400">
                  {application.language && (
                    <span>
                      Language: <strong className="text-slate-200">{application.language}</strong>
                    </span>
                  )}
                  {application.framework && (
                    <span>
                      Framework: <strong className="text-slate-200">{application.framework}</strong>
                    </span>
                  )}
                  <span>
                    Created: <strong className="text-slate-200">{formatDateTime(application.createdAt)}</strong>
                  </span>
                </div>
              </div>

              {/* Delete Application Control */}
              <div className="shrink-0">
                {!confirmDeleteApp ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteApp(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 hover:border-rose-900/60 text-xs font-medium text-slate-400 hover:text-rose-300 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Application</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-950/30 border border-rose-500/30">
                    <span className="text-xs text-rose-200 px-1">Delete permanently?</span>
                    <button
                      type="button"
                      onClick={handleDeleteApplication}
                      disabled={deletingApp}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {deletingApp ? 'Deleting...' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteApp(false)}
                      disabled={deletingApp}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Application ID + Connection Status + Last Telemetry */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Application ID Card */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Application ID
                </span>
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <code className="text-sm font-mono font-bold text-cyan-300 truncate">
                    {application.appId}
                  </code>
                  <CopyButton value={application.appId} label="Copy" />
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-mono truncate">
                  UUID: {application.id}
                </p>
              </div>

              {/* Real Connection Status Card */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Connection Status
                </span>
                {telemetryState.connectionStatus === 'CONNECTED' ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Wifi className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-emerald-300">Connected</div>
                      <div className="text-xs text-slate-400">
                        {telemetryState.activeKeyCount} active API key
                        {telemetryState.activeKeyCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                ) : telemetryState.connectionStatus === 'AWAITING_TELEMETRY' ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-amber-300">Awaiting Telemetry</div>
                      <div className="text-xs text-slate-400">
                        Active key created, no events received yet
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                      <WifiOff className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-300">Not Connected</div>
                      <div className="text-xs text-slate-400">
                        Generate an API key to connect your app
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Last Telemetry Received Card */}
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                  Last Telemetry Received
                </span>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    {telemetryState.lastTelemetryAt ? (
                      <>
                        <div className="text-sm font-bold text-white">
                          {formatRelativeTime(telemetryState.lastTelemetryAt)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatDateTime(telemetryState.lastTelemetryAt)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-bold text-slate-300">Never</div>
                        <div className="text-xs text-slate-500">
                          No telemetry or key validation recorded
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* One-Time API Key Reveal Banner */}
            {revealedKey && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-amber-200">
                        Save Your New API Key ({revealedKey.label})
                      </h3>
                      <p className="text-xs text-amber-200/80 mt-0.5">
                        This complete key is displayed <strong>only once</strong>. Copy and store it
                        securely now — DevSentinel only stores a SHA-256 hash.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRevealedKey(null)}
                    className="p-1 rounded-lg text-amber-300/70 hover:text-amber-200 hover:bg-amber-500/10"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-slate-950 border border-amber-500/30">
                  <code className="text-xs font-mono text-emerald-300 break-all">
                    {revealedKey.rawKey}
                  </code>
                  <CopyButton value={revealedKey.rawKey} label="Copy Key" className="shrink-0" />
                </div>
              </div>
            )}

            {/* API Keys Management Section */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    API Keys
                  </h2>
                </div>

                {/* Generate New Key Form */}
                <form onSubmit={handleGenerateKey} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    placeholder="Key label (e.g. production-key)"
                    className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 w-56"
                  />
                  <button
                    type="submit"
                    disabled={generatingKey || !newKeyLabel.trim()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    {generatingKey ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Generate Key</span>
                  </button>
                </form>
              </div>

              {keys.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No API keys have been generated for this application yet. Enter a label above and
                  click <strong>Generate Key</strong>.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Label</th>
                        <th className="pb-3 font-semibold">Prefix</th>
                        <th className="pb-3 font-semibold">Status</th>
                        <th className="pb-3 font-semibold">Last Used</th>
                        <th className="pb-3 font-semibold">Created</th>
                        <th className="pb-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {keys.map((k) => {
                        const isExpired = k.expiresAt && new Date(k.expiresAt) <= new Date();
                        const isBusy = actionKeyId === k.id;
                        return (
                          <tr key={k.id} className="hover:bg-slate-900/40">
                            <td className="py-3.5 font-semibold text-white">{k.label}</td>
                            <td className="py-3.5">
                              <code className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                {k.prefix}••••••••
                              </code>
                            </td>
                            <td className="py-3.5">
                              {!k.isActive || k.revokedAt ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold">
                                  Revoked
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                                  Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-slate-400">
                              {k.lastUsedAt ? formatDateTime(k.lastUsedAt) : 'Never'}
                            </td>
                            <td className="py-3.5 text-slate-400">
                              {formatDateTime(k.createdAt)}
                            </td>
                            <td className="py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                {k.isActive && !k.revokedAt ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleRotateKey(k.id)}
                                      disabled={isBusy}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-medium transition-colors disabled:opacity-50"
                                      title="Revoke current key and generate a replacement"
                                    >
                                      <RotateCw
                                        className={`w-3 h-3 ${isBusy ? 'animate-spin' : ''}`}
                                      />
                                      <span>Rotate</span>
                                    </button>

                                    {confirmRevokeId === k.id ? (
                                      <div className="inline-flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleRevokeKey(k.id)}
                                          disabled={isBusy}
                                          className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold"
                                        >
                                          Confirm
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmRevokeId(null)}
                                          className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmRevokeId(k.id)}
                                        disabled={isBusy}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 font-medium transition-colors disabled:opacity-50"
                                      >
                                        <Ban className="w-3 h-3" />
                                        <span>Revoke</span>
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteKey(k.id)}
                                    disabled={isBusy}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/50 text-slate-400 hover:text-rose-300 font-medium transition-colors disabled:opacity-50"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SDK / API Configuration Snippet */}
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Configuration Reference
                  </h2>
                </div>
                <CopyButton
                  value={`DEVSENTINEL_APP_ID=${application.appId}\nDEVSENTINEL_API_KEY=${
                    revealedKey ? revealedKey.rawKey : '<YOUR_API_KEY>'
                  }`}
                  label="Copy .env"
                />
              </div>
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto">
{`DEVSENTINEL_APP_ID=${application.appId}
DEVSENTINEL_API_KEY=${revealedKey ? revealedKey.rawKey : '<YOUR_API_KEY>'}`}
              </pre>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
