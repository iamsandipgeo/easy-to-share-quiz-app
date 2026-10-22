import React from 'react';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  Send,
  ArrowRight,
  ShieldCheck,
  Bot,
  Zap,
} from 'lucide-react';
import { QuestionItem, TelegramDestination, PublishingJob } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';
import { ActiveTab } from './Navigation';

interface DashboardViewProps {
  questions: QuestionItem[];
  destinations: TelegramDestination[];
  recentJobs: PublishingJob[];
  setActiveTab: (tab: ActiveTab) => void;
  lang: SupportedLang;
  hasBotToken: boolean;
  onLoadBenchmark: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  questions,
  destinations,
  recentJobs,
  setActiveTab,
  lang,
  hasBotToken,
  onLoadBenchmark,
}) => {
  const t = translations[lang];

  const readyCount = questions.filter(q => q.status === 'ready').length;
  const reviewCount = questions.filter(q => q.status === 'needs_review').length;
  const invalidCount = questions.filter(q => q.status === 'invalid').length;

  const totalDelivered = recentJobs.reduce((acc, job) => acc + (job.successCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Bot Token Setup Alert Banner if not configured */}
      {!hasBotToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg text-amber-800 shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                {lang === 'bn' ? 'টেলিগ্রাম বট সংযুক্ত করা হয়নি' : 'Telegram Bot Token Required'}
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                {lang === 'bn'
                  ? 'চ্যানেল বা গ্রুপে কুইজ পোস্ট করার জন্য সেটিংস পেজে গিয়ে আপনার বট টোকেন দিন।'
                  : 'Configure your Telegram Bot token in Settings to enable native quiz publishing.'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('settings')}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {t.connectBot}
          </button>
        </div>
      )}

      {/* Hero Welcome & Quick Benchmark loader */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {t.appTitle}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              {t.tagline}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onLoadBenchmark}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <Zap className="w-4 h-4 text-amber-600" />
              <span>{t.load100Benchmark}</span>
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              <span>{t.pasteOrUploadMCQs}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{t.totalQuestionsInEditor}</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-900 mt-2 font-mono tabular-nums">
            {questions.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {questions.length > 0 ? `${readyCount} ready to publish` : 'No questions loaded'}
          </div>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span>{t.readyToPublish}</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-2 font-mono tabular-nums">
            {readyCount}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">
            Passed Telegram structure checks
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>{t.needsReview}</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-700 mt-2 font-mono tabular-nums">
            {reviewCount}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">
            Minor warning / answer inferred
          </div>
        </div>

        <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-rose-700">
            <span>{t.invalid}</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-700 mt-2 font-mono tabular-nums">
            {invalidCount}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            Missing answer or options
          </div>
        </div>

        <div className="bg-white border border-indigo-200 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-indigo-700">
            <span>{t.configuredDestinations}</span>
            <Radio className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-indigo-700 mt-2 font-mono tabular-nums">
            {destinations.length}
          </div>
          <div className="text-[11px] text-indigo-600 mt-1">
            {destinations.filter(d => d.status === 'active').length} active channels/groups
          </div>
        </div>
      </div>

      {/* Workflow Navigation Cards */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">{t.quickStart}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setActiveTab('import')}
            className="cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-5 shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
              1. {t.importQuestions}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Bulk paste 100+ MCQs or upload PDF, DOCX, XLSX, CSV, and TXT files.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600">
              <span>Import now</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('editor')}
            className="cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-5 shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
              2. {t.questionEditor}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Validate question limits, fix missing answers, and edit explanations.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600">
              <span>Review {questions.length} questions</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('destinations')}
            className="cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-5 shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Radio className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
              3. {t.destinations}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Connect Telegram channels and groups and verify posting permissions.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600">
              <span>Manage destinations ({destinations.length})</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          <div
            onClick={() => setActiveTab('publishing')}
            className="cursor-pointer bg-white border border-slate-200 hover:border-indigo-300 rounded-xl p-5 shadow-sm hover:shadow transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
              4. {t.bulkPublishing}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Send quiz polls with configurable delay (1-60s), pause, and retry support.
            </p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-indigo-600">
              <span>Configure queue</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Publishing Activity */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-800">
            {t.publishingReports}
          </h2>
          <button
            onClick={() => setActiveTab('reports')}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            View all ({recentJobs.length}) →
          </button>
        </div>

        {recentJobs.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No publishing jobs executed yet. Once you launch a job, live progress and Telegram delivery confirmations will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Job Name</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Destinations</th>
                  <th className="py-2.5 px-3 text-right">Success</th>
                  <th className="py-2.5 px-3 text-right">Failed</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentJobs.slice(0, 5).map(job => (
                  <tr key={job.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-medium text-slate-900">{job.name}</td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize text-slate-700 font-medium">
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {job.destinations.map(d => d.name).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-600 font-semibold">
                      {job.successCount}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-600">
                      {job.failedCount}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {new Date(job.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
