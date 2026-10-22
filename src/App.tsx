import React, { useState, useEffect } from 'react';
import { Navigation, ActiveTab } from './components/Navigation';
import { DashboardView } from './components/DashboardView';
import { ImportView } from './components/ImportView';
import { QuestionEditorView } from './components/QuestionEditorView';
import { QuizPreviewView } from './components/QuizPreviewView';
import { DestinationsView } from './components/DestinationsView';
import { PublishingView } from './components/PublishingView';
import { QuestionBankView } from './components/QuestionBankView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { QuestionItem, TelegramDestination, PublishingJob, QuestionBankSet, AppConfig } from './types/quiz';
import { SupportedLang } from './utils/i18n';
import { parseMCQText } from './utils/mcqParser';
import { generate100BenchmarkQuestions, BENGALI_SAMPLE_MCQ } from './utils/sampleData';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [lang, setLang] = useState<SupportedLang>('bn');

  // Question state in editor (preserved across tab navigation)
  const [questions, setQuestions] = useState<QuestionItem[]>(() => {
    try {
      const saved = localStorage.getItem('quiz_editor_questions');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // fallback
    }
    // Initial sample dataset for immediate preview
    return parseMCQText(BENGALI_SAMPLE_MCQ).questions;
  });

  // Save questions to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('quiz_editor_questions', JSON.stringify(questions));
    } catch (e) {
      console.warn('Could not persist questions to localStorage', e);
    }
  }, [questions]);

  // Preview index tracker
  const [previewIndex, setPreviewIndex] = useState<number>(0);

  // Server-synced state
  const [destinations, setDestinations] = useState<TelegramDestination[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBankSet[]>([]);
  const [jobs, setJobs] = useState<PublishingJob[]>([]);
  const [activeJob, setActiveJob] = useState<PublishingJob | null>(null);

  // Settings & bot config
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [maskedToken, setMaskedToken] = useState<string>('');

  // Initial data fetching
  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        setMaskedToken(data.maskedToken || '');
        if (data.config?.language) {
          setLang(data.config.language);
        }
      }
    } catch (err) {
      console.error('Settings fetch error:', err);
    }
  };

  const refreshDestinations = async () => {
    try {
      const res = await fetch('/api/telegram/destinations');
      if (res.ok) {
        const data = await res.json();
        setDestinations(data);
      }
    } catch (err) {
      console.error('Destinations fetch error:', err);
    }
  };

  const refreshQuestionBanks = async () => {
    try {
      const res = await fetch('/api/question-banks');
      if (res.ok) {
        const data = await res.json();
        setQuestionBanks(data);
      }
    } catch (err) {
      console.error('Question banks fetch error:', err);
    }
  };

  const refreshJobs = async () => {
    try {
      const res = await fetch('/api/publishing/jobs');
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
        // If there's an ongoing job, sync activeJob
        const ongoing = data.find((j: PublishingJob) => j.status === 'publishing' || j.status === 'queued' || j.status === 'paused');
        if (ongoing && (!activeJob || activeJob.id === ongoing.id)) {
          const detailRes = await fetch(`/api/publishing/jobs/${ongoing.id}`);
          if (detailRes.ok) {
            const detailData = await detailRes.json();
            setActiveJob(detailData);
          }
        }
      }
    } catch (err) {
      console.error('Jobs fetch error:', err);
    }
  };

  useEffect(() => {
    refreshSettings();
    refreshDestinations();
    refreshQuestionBanks();
    refreshJobs();
  }, []);

  // Question Import handler
  const handleQuestionsImported = (newQuestions: QuestionItem[], append = false) => {
    if (append) {
      setQuestions(prev => [...prev, ...newQuestions]);
    } else {
      setQuestions(newQuestions);
    }
    setActiveTab('editor');
  };

  // 100 Benchmark Loader
  const handleLoadBenchmark = () => {
    const raw = generate100BenchmarkQuestions();
    const result = parseMCQText(raw);
    setQuestions(result.questions);
    setActiveTab('editor');
  };

  const handleNavigateToPreview = (index = 0) => {
    setPreviewIndex(index);
    setActiveTab('preview');
  };

  const hasBotToken = !!(config?.hasBotToken || maskedToken);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-16 lg:pb-0">
      {/* Top Navigation & Mobile Bar */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        lang={lang}
        setLang={setLang}
        hasBotToken={hasBotToken}
        questionCount={questions.length}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            questions={questions}
            destinations={destinations}
            recentJobs={jobs}
            setActiveTab={setActiveTab}
            lang={lang}
            hasBotToken={hasBotToken}
            onLoadBenchmark={handleLoadBenchmark}
          />
        )}

        {activeTab === 'import' && (
          <ImportView
            onQuestionsImported={handleQuestionsImported}
            onNavigateToEditor={() => setActiveTab('editor')}
            lang={lang}
          />
        )}

        {activeTab === 'editor' && (
          <QuestionEditorView
            questions={questions}
            setQuestions={setQuestions}
            onNavigateToPreview={handleNavigateToPreview}
            lang={lang}
          />
        )}

        {activeTab === 'preview' && (
          <QuizPreviewView
            questions={questions}
            initialIndex={previewIndex}
            onNavigateToPublish={() => setActiveTab('publishing')}
            lang={lang}
          />
        )}

        {activeTab === 'destinations' && (
          <DestinationsView
            destinations={destinations}
            setDestinations={setDestinations}
            hasBotToken={hasBotToken}
            onNavigateToSettings={() => setActiveTab('settings')}
            lang={lang}
          />
        )}

        {activeTab === 'publishing' && (
          <PublishingView
            questions={questions}
            destinations={destinations}
            activeJob={activeJob}
            setActiveJob={setActiveJob}
            onRefreshJobs={refreshJobs}
            lang={lang}
          />
        )}

        {activeTab === 'bank' && (
          <QuestionBankView
            currentQuestions={questions}
            questionBanks={questionBanks}
            setQuestionBanks={setQuestionBanks}
            onLoadQuestionsToEditor={(qs, append) => handleQuestionsImported(qs, append)}
            lang={lang}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            jobs={jobs}
            lang={lang}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            config={config}
            maskedToken={maskedToken}
            onRefreshSettings={refreshSettings}
            lang={lang}
            setLang={setLang}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="hidden lg:block border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>Telegram Bulk Quiz Maker</span>
            <span className="mx-2">·</span>
            <span>Deterministic Bengali & English MCQ Parser</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('settings')} className="hover:text-slate-800 transition-colors">
              BotFather Wizard
            </button>
            <span>·</span>
            <button onClick={() => setActiveTab('bank')} className="hover:text-slate-800 transition-colors">
              Question Banks
            </button>
            <span>·</span>
            <span className="font-mono text-[11px] text-slate-400">Telegram Bot API 7.0+</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
