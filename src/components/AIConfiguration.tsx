import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Key, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCcw, 
  History, 
  Cpu,
  Clock,
  ShieldAlert,
  Github,
  GitBranch,
  ArrowUpRight,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth } from '../services/firebase';
import { apiFetch } from '../utils/api';

interface AIConfigStats {
  activeKeyIndex: number;
  lastSuccessfulKey: string;
  availableKeysCount: number;
  lastSuccessTimestamp: string;
  lastError: string;
  totalRequests: number;
  failedRequests: number;
  keyUsage: Record<string, number>;
  availableKeys: string[];
  poolSize: number;
  defaultModel: string;
}

export function AIConfiguration() {
  const [stats, setStats] = useState<AIConfigStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gitSyncing, setGitSyncing] = useState(false);
  const [gitSyncResult, setGitSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [customGitToken, setCustomGitToken] = useState<string>(() => localStorage.getItem("custom_github_token") || "");

  const fetchStats = async () => {
    try {
      setRefreshing(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await apiFetch('/api/admin/ai-config', {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errorMsg = `HTTP Error ${res.status}`;
        if (contentType.includes("application/json")) {
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            // Ignore parse error
          }
        } else {
          errorMsg = `Server returned status ${res.status}. The service might be starting up or temporarily unavailable.`;
        }
        throw new Error(errorMsg);
      }

      if (!contentType.includes("application/json")) {
        throw new Error("Received invalid non-JSON response from server.");
      }

      const data = await res.json();
      setStats(data);
      setFetchError(null);
    } catch (err: any) {
      const displayMsg = err.message || "Failed to fetch AI configuration stats.";
      setFetchError(displayMsg);
      console.warn("AI configuration fetch failed:", displayMsg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Auto refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleGitSync = async () => {
    try {
      setGitSyncing(true);
      setGitSyncResult(null);
      const token = await auth.currentUser?.getIdToken();
      const res = await apiFetch('/api/admin/github-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ gitToken: customGitToken || undefined })
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errorMsg = "Failed to sync with GitHub.";
        if (contentType.includes("application/json")) {
          try {
            const errData = await res.json();
            errorMsg = errData.error || errorMsg;
          } catch {}
        } else {
          errorMsg = `Sync failed with status ${res.status}.`;
        }
        throw new Error(errorMsg);
      }

      if (!contentType.includes("application/json")) {
        throw new Error("Received non-JSON response during GitHub sync.");
      }

      const data = await res.json();
      if (data.success) {
        setGitSyncResult({ success: true, message: data.message });
      } else {
        setGitSyncResult({ success: false, message: data.error || 'Failed to sync with GitHub.' });
      }
    } catch (err: any) {
      setGitSyncResult({ success: false, message: err.message || 'An error occurred.' });
    } finally {
      setGitSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCcw className="w-8 h-8 animate-spin mb-4" />
        <p className="font-medium">Loading AI Resiliency Metrics...</p>
      </div>
    );
  }

  const failureRate = stats && stats.totalRequests > 0 
    ? ((stats.failedRequests / stats.totalRequests) * 100).toFixed(1) 
    : "0";

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Cpu className="w-8 h-8 text-indigo-600" />
            AI Resiliency Pool
          </h1>
          <p className="text-slate-500 mt-1 italic">
            Automated failover and key rotation diagnostics for Gemini AI services.
          </p>
        </div>
        <button 
          onClick={fetchStats}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Force Refresh
        </button>
      </div>

      {fetchError && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs flex items-start gap-2 leading-relaxed">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block mb-0.5">Pool Monitor Notice</span>
            <span>{fetchError}</span>
          </div>
        </div>
      )}

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-indigo-600 mb-2">
            <Key className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Active Pool</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.poolSize || 0} Keys</div>
          <div className="text-xs text-slate-400 mt-1 uppercase">Available Slots</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-emerald-600 mb-2">
            <Activity className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Reliability</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{100 - Number(failureRate)}%</div>
          <div className="text-xs text-slate-400 mt-1 uppercase">Uptime Score</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <History className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Total Traffic</span>
          </div>
          <div className="text-3xl font-bold text-slate-900">{stats?.totalRequests || 0}</div>
          <div className="text-xs text-slate-400 mt-1 uppercase">AI Generations</div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">Last Success</span>
          </div>
          <div className="text-lg font-bold text-slate-900 truncate">
            {stats?.lastSuccessTimestamp !== "Never" 
              ? new Date(stats!.lastSuccessTimestamp).toLocaleTimeString() 
              : "No Traffic"}
          </div>
          <div className="text-xs text-slate-400 mt-1 uppercase">UTC Timestamp</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Key Health Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">Key Health Status</h2>
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight">System Critical</span>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-50 text-slate-400 font-medium">
                  <th className="px-6 py-3 font-semibold">Key Identifier</th>
                  <th className="px-6 py-3 font-semibold">Rotation Status</th>
                  <th className="px-6 py-3 font-semibold">Usage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats?.availableKeys.map((key, idx) => {
                  const isActive = stats.activeKeyIndex === idx;
                  return (
                    <tr key={idx} className={`${isActive ? 'bg-indigo-50/30' : 'hover:bg-slate-50/30'} transition-colors`}>
                      <td className="px-6 py-4 font-mono text-slate-600">{key}</td>
                      <td className="px-6 py-4">
                        {isActive ? (
                          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            Active & Primary
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-slate-400 italic">
                            Standby Pool
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 uppercase tracking-tighter">
                        {stats.keyUsage[idx] || 0} Calls
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Last Error Log */}
          <div className="bg-rose-50 rounded-2xl border border-rose-100 p-6">
            <div className="flex items-start gap-4 text-rose-800">
              <div className="p-2 bg-rose-100 rounded-lg">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg mb-1">Live Diagnostic Logs</h3>
                <p className="text-sm text-rose-700 font-mono bg-white/50 p-4 rounded-xl border border-rose-200 mt-3 whitespace-pre-wrap break-words leading-relaxed">
                  {stats?.lastError || "No critical key failures detected in the current session."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Sidebar */}
        <div className="space-y-6">
          {/* GitHub Repository Sync */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Github className="w-5 h-5 text-slate-700" />
              GitHub Sync & Build
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Link, sync and deploy your codebase directly to GitHub to trigger automated Android release builds.
            </p>
            
            <div className="space-y-3 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase font-semibold text-[9px]">Repository</span>
                <span className="text-slate-700 truncate max-w-[150px]">AdiMadhu999/MissionSelection</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 uppercase font-semibold text-[9px]">Branch</span>
                <span className="text-slate-700 flex items-center gap-1">
                  <GitBranch className="w-3 h-3 text-indigo-500" />
                  main
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/50 pt-2 mt-2">
                <span className="text-slate-400 uppercase font-semibold text-[9px]">Local Commit</span>
                <span className="text-slate-600">9b58e58</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-500 uppercase font-bold text-[9px] block tracking-wide">
                Custom GitHub Token (Optional Override)
              </label>
              <input
                type="password"
                placeholder="Enter ghp_... to override"
                value={customGitToken}
                onChange={(e) => {
                  setCustomGitToken(e.target.value);
                  localStorage.setItem("custom_github_token", e.target.value);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono transition-all placeholder:text-slate-400"
              />
            </div>

            <button
              onClick={handleGitSync}
              disabled={gitSyncing}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-xl text-sm transition-colors shadow-sm shadow-indigo-100 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCcw className={`w-4 h-4 ${gitSyncing ? 'animate-spin' : ''}`} />
              {gitSyncing ? 'Syncing & Building...' : 'Sync & Trigger Build'}
            </button>

            {gitSyncResult && (
              <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                gitSyncResult.success 
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                  : 'bg-rose-50 border-rose-100 text-rose-800'
              }`}>
                <div className="flex items-start gap-2">
                  {gitSyncResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <span className="font-medium whitespace-pre-wrap">{gitSyncResult.message}</span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl shadow-slate-200">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Engine Configuration
            </h3>
            <div className="space-y-4 text-sm opacity-90">
              <div className="border-b border-white/10 pb-3">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">AI Engine</div>
                <div className="font-medium text-emerald-400">Google Gemini Gen 3</div>
              </div>
              <div className="border-b border-white/10 pb-3">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Processing Model</div>
                <div className="font-mono">{stats?.defaultModel || "gemini-3.5-flash"}</div>
              </div>
              <div className="border-b border-white/10 pb-3">
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Failover Strategy</div>
                <div className="font-medium">Sequential Pool Rotation</div>
              </div>
              <div>
                <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Timeout Policy</div>
                <div className="font-medium">Passive Background Wait</div>
              </div>
            </div>
            
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="text-amber-400 text-xs font-semibold flex items-center gap-1.5 mb-2">
                <ShieldAlert className="w-3.5 h-3.5" />
                Security Notice
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed italic">
                API Keys are securely stored on the server-side environment and are never transmitted to the client-side browser. Obfuscated identifiers are used for monitoring display only.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4">Maintenance Guidelines</h3>
            <ul className="space-y-3 text-xs text-slate-500 list-disc pl-4 leading-relaxed">
              <li>If "Uptime Score" drops significantly, verify KEY_1 status in AI Studio Secrets.</li>
              <li>"Failed Requests" include quota interruptions and invalid keys.</li>
              <li>Pool rotation ensures continuous test generation even during massive traffic spikes.</li>
              <li>Model migrations from 2.0 to 3.0 are handled automatically by the pool balancer.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
