import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, Activity, Cpu, Sparkles, AlertCircle, ArrowRight, Terminal } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, loginWithMock, error, clearError } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devName, setDevName] = useState('');
  const [showDevLogin, setShowDevLogin] = useState(false);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      console.error('No credential returned by Google');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithGoogle(credentialResponse.credential);
    } catch (err) {
      console.error('Google Sign-In Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!devEmail || !devName) return;
    setSubmitting(true);
    try {
      await loginWithMock(devEmail, devName);
    } catch (err) {
      console.error('Mock Sign-In Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDevLogin = async (email: string, name: string) => {
    setSubmitting(true);
    try {
      await loginWithMock(email, name);
    } catch (err) {
      console.error('Quick Dev Sign-In Error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-100 flex flex-col md:flex-row">
      {/* Left Column: Brand & Architecture Highlights */}
      <div className="md:w-1/2 p-8 md:p-16 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800 bg-gradient-to-br from-[#090d16] to-[#030712]">
        <div>
          {/* Logo & Tagline */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xl shadow-[0_0_20px_rgba(16,185,129,0.15)]">
              DS
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">DevSentinel</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                v0.1.0-alpha
              </span>
            </div>
          </div>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4 leading-tight">
            Detect. Investigate. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              Resolve with Intelligence.
            </span>
          </h1>

          <p className="text-slate-400 text-base md:text-lg mb-10 max-w-lg leading-relaxed">
            AI-powered application monitoring and incident investigation platform designed for developers. Centralized telemetry, statistical anomaly detection, and Gemini-assisted root cause analysis.
          </p>

          {/* Core Feature Badges */}
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <Activity className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">Centralized Telemetry Ingestion</h4>
                <p className="text-xs text-slate-400">Batched collection of HTTP metrics, logs, traces, and deployment markers.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <Cpu className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">Lightweight Anomaly Engine</h4>
                <p className="text-xs text-slate-400">Sliding-window Z-Score and Isolation Forest detection with zero bloat.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <Sparkles className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-white">AI-Powered Root Cause Analysis</h4>
                <p className="text-xs text-slate-400">Grounding forensic evidence with Gemini to generate actionable hypotheses.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 text-xs text-slate-500 flex items-center justify-between">
          <span>Zero-budget open-source architecture</span>
          <span>PostgreSQL 16 + pgvector</span>
        </div>
      </div>

      {/* Right Column: Authentication Form */}
      <div className="md:w-1/2 p-8 md:p-16 flex items-center justify-center bg-[#030712]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Welcome to DevSentinel</h2>
            <p className="text-sm text-slate-400">
              Sign in with your Google account to access your workspace and connected applications.
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start justify-between">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={clearError} className="text-rose-400 hover:text-white text-xs font-semibold ml-2">
                ✕
              </button>
            </div>
          )}

          {/* Primary Authentication Option: Google */}
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800/80 shadow-xl">
              <div className="mb-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                Single Sign-On
              </div>
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => console.error('Google Sign-In prompt failed')}
                  theme="filled_black"
                  shape="pill"
                  size="large"
                  text="continue_with"
                  width="100%"
                />
              </div>
            </div>

            <div className="relative my-6 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800"></div>
              </div>
              <span className="relative px-3 text-xs text-slate-500 bg-[#030712] uppercase tracking-wider font-medium">
                Developer Local Testing
              </span>
            </div>

            {/* Development Mock Sign-In Options (for instant testing without Google credentials) */}
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => handleQuickDevLogin('sanika@devsentinel.local', 'Sanika Salunkhe')}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 text-sm font-medium text-slate-200 transition-colors flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Dev Sign-In as <strong>Sanika Salunkhe</strong></span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickDevLogin('alex.engineer@devsentinel.local', 'Alex Engineer')}
                disabled={submitting}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 text-sm font-medium text-slate-200 transition-colors flex items-center justify-between group disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>Dev Sign-In as <strong>Alex Engineer</strong></span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setShowDevLogin(!showDevLogin)}
                  className="text-xs text-slate-400 hover:text-emerald-400 underline transition-colors"
                >
                  {showDevLogin ? 'Hide custom tester form' : '+ Sign in with custom test email'}
                </button>
              </div>

              {showDevLogin && (
                <form onSubmit={handleMockSubmit} className="pt-3 space-y-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={devName}
                      onChange={(e) => setDevName(e.target.value)}
                      placeholder="e.g. Maya Patel"
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      placeholder="e.g. maya@example.com"
                      required
                      className="w-full px-3 py-2 text-sm rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Authenticating...' : 'Register / Login Custom User'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-400/80" />
            <span>Secure HTTP-only session cookie protection</span>
          </div>
        </div>
      </div>
    </div>
  );
};
