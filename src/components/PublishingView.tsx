import React, { useState, useEffect } from 'react';
import {
  Send,
  Play,
  Pause,
  RotateCcw,
  StopCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Radio,
  RefreshCw,
  HelpCircle,
  Sliders,
  ShieldAlert,
} from 'lucide-react';
import { QuestionItem, TelegramDestination, PublishingJob, ItemDeliveryStatus } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';

interface PublishingViewProps {
  questions: QuestionItem[];
  destinations: TelegramDestination[];
  activeJob: PublishingJob | null;
  setActiveJob: React.Dispatch<React.SetStateAction<PublishingJob | null>>;
  onRefreshJobs: () => void;
  lang: SupportedLang;
}

export const PublishingView: React.FC<PublishingViewProps> = ({
  questions,
  destinations,
  activeJob,
  setActiveJob,
  onRefreshJobs,
  lang,
}) => {
  const t = translations[lang];

  // Config form state
  const [jobName, setJobName] = useState<string>('');
  const [selectedDestIds, setSelectedDestIds] = useState<Set<string>>(
    new Set(destinations.filter(d => d.status === 'active').map(d => d.id))
  );
  const [delaySeconds, setDelaySeconds] = useState<number>(3);
  const [stopOnFailure, setStopOnFailure] = useState<boolean>(false);
  const [maxRetries, setMaxRetries] = useState<number>(2);
  const [onlyPublishReady, setOnlyPublishReady] = useState<boolean>(true);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Auto-refresh active job status while running
  useEffect(() => {
    if (!activeJob) return;

    if (activeJob.status === 'publishing' || activeJob.status === 'queued') {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/publishing/jobs/${activeJob.id}`);
          if (res.ok) {
            const data = await res.json();
            setActiveJob(data);
            if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
              onRefreshJobs();
            }
          }
        } catch (err) {
          console.error('Job polling error:', err);
        }
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [activeJob?.id, activeJob?.status]);

  const activeDestinations = destinations.filter(d => d.status === 'active');
  const validQuestions = questions.filter(q => q.status === 'ready');
  const questionsToPublish = onlyPublishReady ? validQuestions : questions;

  const toggleSelectDest = (id: string) => {
    setSelectedDestIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllDest = () => {
    setSelectedDestIds(new Set(activeDestinations.map(d => d.id)));
  };

  const handleStartPublishing = async () => {
    if (questionsToPublish.length === 0) {
      alert('No valid questions available to publish. Check Question Editor.');
      return;
    }

    if (selectedDestIds.size === 0) {
      alert('Please select at least one Telegram destination.');
      return;
    }

    setIsStarting(true);

    try {
      const res = await fetch('/api/publishing/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: jobName.trim() || `Quiz Set (${questionsToPublish.length} MCQs) - ${new Date().toLocaleTimeString()}`,
          questions: questionsToPublish,
          destinationIds: Array.from(selectedDestIds),
          delaySeconds,
          stopOnFailure,
          maxRetries,
        }),
      });

      const newJob = await res.json();
      if (!res.ok) throw new Error(newJob.error || 'Failed to start publishing');

      setActiveJob(newJob);
      onRefreshJobs();
    } catch (err: any) {
      alert(`Publishing Error: ${err.message}`);
    } finally {
      setIsStarting(false);
    }
  };

  const handlePause = async () => {
    if (!activeJob) return;
    await fetch(`/api/publishing/jobs/${activeJob.id}/pause`, { method: 'POST' });
    setActiveJob(prev => prev ? { ...prev, status: 'paused' } : null);
  };

  const handleResume = async () => {
    if (!activeJob) return;
    await fetch(`/api/publishing/jobs/${activeJob.id}/resume`, { method: 'POST' });
    setActiveJob(prev => prev ? { ...prev, status: 'publishing' } : null);
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    if (window.confirm('Cancel remaining queued quiz polls?')) {
      await fetch(`/api/publishing/jobs/${activeJob.id}/cancel`, { method: 'POST' });
      setActiveJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
      onRefreshJobs();
    }
  };

  const handleRetry = async () => {
    if (!activeJob) return;
    const res = await fetch(`/api/publishing/jobs/${activeJob.id}/retry`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      setActiveJob(data.job);
      onRefreshJobs();
    } else {
      alert(data.error || 'Retry failed');
    }
  };

  const totalItems = activeJob ? activeJob.items.length : 0;
  const progressPercent = totalItems > 0 && activeJob
    ? Math.round(((activeJob.successCount + activeJob.failedCount) / totalItems) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">{t.publishingControl}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Publish native Telegram Quiz Polls with configurable delays and rate-limit backoff.
            </p>
          </div>

          <div className="text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            {questionsToPublish.length} questions ready to send
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Left Column: Destinations & Questions Scope */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1.5">
                <label>{t.selectDestinations} ({selectedDestIds.size}/{activeDestinations.length})</label>
                <button
                  type="button"
                  onClick={handleSelectAllDest}
                  className="text-indigo-600 hover:text-indigo-700 font-normal"
                >
                  Select All
                </button>
              </div>

              {activeDestinations.length === 0 ? (
                <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-xs">
                  No active destinations configured. Please add one in Telegram Destinations tab.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                  {activeDestinations.map(dest => {
                    const isWa = dest.platform === 'whatsapp' || dest.type.startsWith('whatsapp');
                    return (
                      <label
                        key={dest.id}
                        className="flex items-center gap-2 p-1.5 rounded hover:bg-slate-100 cursor-pointer text-xs text-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDestIds.has(dest.id)}
                          onChange={() => toggleSelectDest(dest.id)}
                          className="rounded text-indigo-600"
                        />
                        <span className={`w-2 h-2 rounded-full ${isWa ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <span className="font-medium">{dest.name}</span>
                        <span className={`text-[10px] font-mono px-1 rounded ${isWa ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
                          {isWa ? 'WhatsApp' : 'Telegram'}
                        </span>
                        <span className="text-slate-400 font-mono text-[10px]">({dest.chatId})</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Scope Filter */}
            <div>
              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyPublishReady}
                  onChange={e => setOnlyPublishReady(e.target.checked)}
                  className="rounded text-indigo-600"
                />
                <span className="font-medium">
                  Publish only verified "Ready" questions ({validQuestions.length} of {questions.length})
                </span>
              </label>
            </div>
          </div>

          {/* Right Column: Delays and Error Behavior */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <label>{t.delayBetweenPolls}:</label>
                <span className="font-mono text-indigo-600 font-bold">{delaySeconds}s</span>
              </div>
              <input
                type="range"
                min={1}
                max={30}
                value={delaySeconds}
                onChange={e => setDelaySeconds(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {t.delayHint}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  {t.maxRetries}
                </label>
                <select
                  value={maxRetries}
                  onChange={e => setMaxRetries(Number(e.target.value))}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white text-slate-800"
                >
                  <option value={0}>0 (No retry)</option>
                  <option value={1}>1 attempt</option>
                  <option value={2}>2 attempts (Default)</option>
                  <option value={3}>3 attempts</option>
                </select>
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stopOnFailure}
                    onChange={e => setStopOnFailure(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Stop on error</span>
                </label>
              </div>
            </div>

            {/* Launch Button */}
            <div className="pt-2">
              <button
                onClick={handleStartPublishing}
                disabled={isStarting || questionsToPublish.length === 0 || selectedDestIds.size === 0 || (activeJob?.status === 'publishing')}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
              >
                {isStarting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{t.startPublishing} ({questionsToPublish.length * selectedDestIds.size} total polls)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Publishing Progress & Job Monitor */}
      {activeJob && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">{activeJob.name}</h3>
                <span
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded uppercase tracking-wide ${
                    activeJob.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-800'
                      : activeJob.status === 'publishing'
                      ? 'bg-indigo-100 text-indigo-800 animate-pulse'
                      : activeJob.status === 'paused'
                      ? 'bg-amber-100 text-amber-800'
                      : activeJob.status === 'cancelled'
                      ? 'bg-slate-200 text-slate-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {activeJob.status}
                </span>
              </div>
              {activeJob.currentDestinationName && activeJob.status === 'publishing' && (
                <p className="text-xs text-indigo-600 mt-1 font-mono">
                  {t.sendingTo} {activeJob.currentDestinationName} — #{activeJob.currentIndex}: {activeJob.currentQuestionSnippet}...
                </p>
              )}
            </div>

            {/* Queue Controls */}
            <div className="flex items-center gap-2">
              {activeJob.status === 'publishing' && (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors"
                >
                  <Pause className="w-3.5 h-3.5" />
                  <span>{t.pause}</span>
                </button>
              )}

              {activeJob.status === 'paused' && (
                <button
                  onClick={handleResume}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{t.resume}</span>
                </button>
              )}

              {(activeJob.status === 'publishing' || activeJob.status === 'paused') && (
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>{t.cancel}</span>
                </button>
              )}

              {(activeJob.failedCount > 0 || activeJob.uncertainCount > 0) &&
                (activeJob.status === 'completed' || activeJob.status === 'failed' || activeJob.status === 'cancelled') && (
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.retryFailed} ({activeJob.failedCount + activeJob.uncertainCount})</span>
                  </button>
                )}
            </div>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-600 mb-1 font-mono">
              <span>Progress: {progressPercent}%</span>
              <span>
                {activeJob.successCount + activeJob.failedCount} / {totalItems} items
              </span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-2 transition-all duration-300"
                style={{ width: `${(activeJob.successCount / (totalItems || 1)) * 100}%` }}
              />
              <div
                className="bg-rose-500 h-2 transition-all duration-300"
                style={{ width: `${(activeJob.failedCount / (totalItems || 1)) * 100}%` }}
              />
              <div
                className="bg-amber-400 h-2 transition-all duration-300"
                style={{ width: `${(activeJob.uncertainCount / (totalItems || 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Status Metrics */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <div className="text-[10px] text-emerald-700 font-medium">{t.successDelivered}</div>
              <div className="text-base font-bold text-emerald-800 font-mono tabular-nums">
                {activeJob.successCount}
              </div>
            </div>

            <div className="p-2 bg-rose-50 rounded-lg">
              <div className="text-[10px] text-rose-700 font-medium">{t.failedDeliveries}</div>
              <div className="text-base font-bold text-rose-800 font-mono tabular-nums">
                {activeJob.failedCount}
              </div>
            </div>

            <div className="p-2 bg-amber-50 rounded-lg">
              <div className="text-[10px] text-amber-700 font-medium">{t.uncertainDeliveries}</div>
              <div className="text-base font-bold text-amber-800 font-mono tabular-nums">
                {activeJob.uncertainCount}
              </div>
            </div>

            <div className="p-2 bg-slate-50 rounded-lg">
              <div className="text-[10px] text-slate-500 font-medium">{t.pendingDeliveries}</div>
              <div className="text-base font-bold text-slate-700 font-mono tabular-nums">
                {activeJob.pendingCount}
              </div>
            </div>
          </div>

          {/* Job Items Table */}
          <div className="overflow-x-auto max-h-72 border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Destination</th>
                  <th className="py-2 px-3">Question</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 font-mono">Msg ID</th>
                  <th className="py-2 px-3">Error / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeJob.items.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-800 whitespace-nowrap">
                      {item.destinationName}
                    </td>
                    <td className="py-2 px-3 text-slate-700 max-w-xs truncate">
                      {item.questionText}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {item.status === 'success' && (
                        <span className="flex items-center gap-1 text-emerald-700 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sent</span>
                        </span>
                      )}
                      {item.status === 'failed' && (
                        <span className="flex items-center gap-1 text-rose-700 font-medium">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Failed</span>
                        </span>
                      )}
                      {item.status === 'uncertain' && (
                        <span className="flex items-center gap-1 text-amber-700 font-medium" title="Request timed out. Do not blindly duplicate.">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Uncertain</span>
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="text-slate-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Queued</span>
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-500">
                      {item.telegramMessageId ? `TG:#${item.telegramMessageId}` : item.whatsAppMessageId ? `WA:${item.whatsAppMessageId.slice(0, 8)}...` : '—'}
                    </td>
                    <td className="py-2 px-3 text-rose-600 max-w-xs truncate">
                      {item.error || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
