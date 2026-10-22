import React from 'react';
import {
  LayoutDashboard,
  FileText,
  Edit3,
  Eye,
  Send,
  Radio,
  FolderArchive,
  BarChart3,
  Settings,
  Languages,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { SupportedLang, translations } from '../utils/i18n';

export type ActiveTab =
  | 'dashboard'
  | 'import'
  | 'editor'
  | 'preview'
  | 'destinations'
  | 'publishing'
  | 'bank'
  | 'reports'
  | 'settings';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
  hasBotToken: boolean;
  questionCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  hasBotToken,
  questionCount,
}) => {
  const t = translations[lang];

  const navItems = [
    { id: 'dashboard' as ActiveTab, label: t.dashboard, icon: LayoutDashboard },
    { id: 'import' as ActiveTab, label: t.importQuestions, icon: FileText },
    {
      id: 'editor' as ActiveTab,
      label: t.questionEditor,
      icon: Edit3,
      badge: questionCount > 0 ? questionCount : undefined,
    },
    { id: 'preview' as ActiveTab, label: t.quizPreview, icon: Eye },
    { id: 'destinations' as ActiveTab, label: t.destinations, icon: Radio },
    { id: 'publishing' as ActiveTab, label: t.bulkPublishing, icon: Send },
    { id: 'bank' as ActiveTab, label: t.questionBank, icon: FolderArchive },
    { id: 'reports' as ActiveTab, label: t.publishingReports, icon: BarChart3 },
    { id: 'settings' as ActiveTab, label: t.settings, icon: Settings },
  ];

  return (
    <>
      {/* Top Bar following Top Bar Contract: Brand - Nav - Action */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Zone 1: Brand Wordmark */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                <Send className="w-5 h-5 -rotate-12" />
              </div>
              <div className="cursor-pointer" onClick={() => setActiveTab('dashboard')}>
                <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                  {t.appTitle}
                </span>
                <span className="hidden sm:inline-block ml-2 text-xs text-slate-500 font-mono">
                  v1.0
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-1 overflow-x-auto py-2">
              {navItems.slice(0, 7).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className="ml-1 px-1.5 py-0.2 bg-indigo-100 text-indigo-800 text-[10px] rounded-full font-mono">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Zone 3: Primary Action & Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Bot status chip */}
              <div
                onClick={() => setActiveTab('settings')}
                className={`cursor-pointer hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border ${
                  hasBotToken
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
                title={hasBotToken ? 'Telegram Bot Connected' : 'Telegram Bot Not Configured'}
              >
                {hasBotToken ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                )}
                <span className="font-medium whitespace-nowrap">
                  {hasBotToken ? 'Bot Ready' : 'Setup Bot'}
                </span>
              </div>

              {/* Language Switcher */}
              <button
                onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
                title="Switch Language (বাংলা / English)"
              >
                <Languages className="w-3.5 h-3.5 text-slate-600" />
                <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
              </button>

              {/* Quick Publish CTA button */}
              <button
                onClick={() => setActiveTab('publishing')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-md shadow-sm transition-colors whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.startPublishing}</span>
                <span className="sm:hidden">Publish</span>
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Subnav for Tablet/Desktop showing remaining tabs */}
        <div className="lg:flex hidden border-t border-slate-100 bg-slate-50/70 px-4 sm:px-6 lg:px-8 py-1.5 gap-2 text-xs">
          <div className="flex items-center gap-4 text-slate-500">
            <span>More:</span>
            <button
              onClick={() => setActiveTab('bank')}
              className={`hover:text-slate-900 transition-colors ${
                activeTab === 'bank' ? 'text-indigo-600 font-semibold underline' : ''
              }`}
            >
              {t.questionBank}
            </button>
            <span>·</span>
            <button
              onClick={() => setActiveTab('reports')}
              className={`hover:text-slate-900 transition-colors ${
                activeTab === 'reports' ? 'text-indigo-600 font-semibold underline' : ''
              }`}
            >
              {t.publishingReports}
            </button>
            <span>·</span>
            <button
              onClick={() => setActiveTab('settings')}
              className={`hover:text-slate-900 transition-colors ${
                activeTab === 'settings' ? 'text-indigo-600 font-semibold underline' : ''
              }`}
            >
              {t.settings}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Optimized for Android & touch phones) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 shadow-lg">
        <div className="grid grid-cols-5 gap-1 text-center">
          {[
            { id: 'dashboard' as ActiveTab, label: t.dashboard, icon: LayoutDashboard },
            { id: 'import' as ActiveTab, label: t.importQuestions, icon: FileText },
            {
              id: 'editor' as ActiveTab,
              label: t.questionEditor,
              icon: Edit3,
              badge: questionCount > 0 ? questionCount : undefined,
            },
            { id: 'preview' as ActiveTab, label: t.quizPreview, icon: Eye },
            { id: 'publishing' as ActiveTab, label: t.bulkPublishing, icon: Send },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded-md text-[10px] font-medium transition-colors ${
                  isActive ? 'text-indigo-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5 mb-0.5" />
                  {item.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-mono">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-[58px]">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
