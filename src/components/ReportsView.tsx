import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileCode,
  Calendar,
} from 'lucide-react';
import { PublishingJob } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';

interface ReportsViewProps {
  jobs: PublishingJob[];
  lang: SupportedLang;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ jobs, lang }) => {
  const t = translations[lang];

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredJobs = jobs.filter(job => {
    if (statusFilter === 'all') return true;
    return job.status === statusFilter;
  });

  const handleDownloadCsv = () => {
    window.open('/api/reports/export?format=csv', '_blank');
  };

  const handleDownloadJson = () => {
    window.open('/api/reports/export?format=json', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{t.reportsTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs with real Telegram message IDs, timestamps, and error diagnostics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.downloadCsv}</span>
          </button>

          <button
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>{t.downloadJson}</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs w-fit">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            statusFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Jobs ({jobs.length})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            statusFilter === 'completed' ? 'bg-emerald-600 text-white shadow-sm font-semibold' : 'text-emerald-700 hover:bg-emerald-50'
          }`}
        >
          Completed ({jobs.filter(j => j.status === 'completed').length})
        </button>
        <button
          onClick={() => setStatusFilter('publishing')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            statusFilter === 'publishing' ? 'bg-indigo-600 text-white shadow-sm font-semibold' : 'text-indigo-700 hover:bg-indigo-50'
          }`}
        >
          In Progress ({jobs.filter(j => j.status === 'publishing').length})
        </button>
        <button
          onClick={() => setStatusFilter('failed')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
            statusFilter === 'failed' ? 'bg-rose-600 text-white shadow-sm font-semibold' : 'text-rose-700 hover:bg-rose-50'
          }`}
        >
          Failed / Cancelled ({jobs.filter(j => j.status === 'failed' || j.status === 'cancelled').length})
        </button>
      </div>

      {/* Reports Job List */}
      {filteredJobs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs space-y-2">
          <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
          <p>No publishing jobs recorded yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredJobs.map(job => {
            const isExpanded = expandedJobId === job.id;
            const total = job.items ? job.items.length : 0;

            return (
              <div
                key={job.id}
                className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{job.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded">
                        ID: {job.id.slice(0, 14)}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                          job.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : job.status === 'failed'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2">
                      <span>Destinations: {job.destinations.map(d => d.name).join(', ')}</span>
                      <span>·</span>
                      <span className="font-mono">{new Date(job.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Summary Counts */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-emerald-600 font-semibold">
                      ✓ {job.successCount} sent
                    </span>
                    {job.failedCount > 0 && (
                      <span className="font-mono text-rose-600 font-semibold">
                        ✗ {job.failedCount} failed
                      </span>
                    )}
                    {job.uncertainCount > 0 && (
                      <span className="font-mono text-amber-600 font-semibold">
                        ⚠ {job.uncertainCount} uncertain
                      </span>
                    )}

                    <button
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Item Logs */}
                {isExpanded && job.items && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-700 mb-2">
                      Delivered Items Log ({job.items.length})
                    </h4>
                    <div className="overflow-x-auto max-h-60 border border-slate-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-medium sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">#</th>
                            <th className="py-2 px-3">Question</th>
                            <th className="py-2 px-3">Destination</th>
                            <th className="py-2 px-3">Status</th>
                            <th className="py-2 px-3 font-mono">Telegram Msg ID</th>
                            <th className="py-2 px-3">Sent Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {job.items.map((item, idx) => (
                            <tr key={item.id} className="hover:bg-slate-50/50">
                              <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-1.5 px-3 max-w-xs truncate text-slate-800">
                                {item.questionText}
                              </td>
                              <td className="py-1.5 px-3 whitespace-nowrap text-slate-600">
                                {item.destinationName}
                              </td>
                              <td className="py-1.5 px-3 whitespace-nowrap">
                                <span
                                  className={`capitalize font-medium ${
                                    item.status === 'success'
                                      ? 'text-emerald-600'
                                      : item.status === 'failed'
                                      ? 'text-rose-600'
                                      : item.status === 'uncertain'
                                      ? 'text-amber-600'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 font-mono text-slate-600">
                                {item.telegramMessageId ? `#${item.telegramMessageId}` : '—'}
                              </td>
                              <td className="py-1.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                                {item.sentAt ? new Date(item.sentAt).toLocaleTimeString() : '—'}
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
          })}
        </div>
      )}
    </div>
  );
};
