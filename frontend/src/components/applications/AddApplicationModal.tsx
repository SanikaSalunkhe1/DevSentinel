import React, { useState } from 'react';
import { X, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { applicationService } from '../../services/application.service';
import { AppEnvironment, Application } from '../../types/application';

interface AddApplicationModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (application: Application) => void;
}

const LANGUAGES = ['TypeScript', 'JavaScript', 'Python', 'Go', 'Java', 'Rust', 'C#'];
const FRAMEWORKS = ['Express', 'NestJS', 'Fastify', 'Next.js', 'FastAPI', 'Django', 'Gin', 'Spring Boot'];

export const AddApplicationModal: React.FC<AddApplicationModalProps> = ({
  workspaceId,
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [language, setLanguage] = useState('TypeScript');
  const [framework, setFramework] = useState('Express');
  const [environment, setEnvironment] = useState<AppEnvironment>('DEVELOPMENT');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError('Application name must be at least 2 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const app = await applicationService.createApplication(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        language: language.trim() || undefined,
        framework: framework.trim() || undefined,
        environment,
      });

      // Reset form
      setName('');
      setDescription('');
      setLanguage('TypeScript');
      setFramework('Express');
      setEnvironment('DEVELOPMENT');

      onCreated(app);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to register application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-[#0b1120] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-bold text-white">Register New Application</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Create an application to generate a unique App ID and API keys.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Application Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payment Gateway API"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of what this service does..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Language
              </label>
              <input
                list="ds-languages"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="TypeScript"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <datalist id="ds-languages">
                {LANGUAGES.map((lang) => (
                  <option key={lang} value={lang} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Framework
              </label>
              <input
                list="ds-frameworks"
                value={framework}
                onChange={(e) => setFramework(e.target.value)}
                placeholder="Express"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
              <datalist id="ds-frameworks">
                {FRAMEWORKS.map((fw) => (
                  <option key={fw} value={fw} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Environment
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['DEVELOPMENT', 'STAGING', 'PRODUCTION'] as AppEnvironment[]).map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setEnvironment(env)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    environment === env
                      ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Register Application</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
