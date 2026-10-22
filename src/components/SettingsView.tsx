import React, { useState } from 'react';
import {
  Settings,
  Bot,
  CheckCircle2,
  AlertTriangle,
  Send,
  Shield,
  Key,
  ExternalLink,
  RefreshCw,
  Sliders,
  Languages,
  RotateCcw,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { SupportedLang, translations } from '../utils/i18n';
import { AppConfig } from '../types/quiz';

interface SettingsViewProps {
  config: AppConfig | null;
  maskedToken: string;
  onRefreshSettings: () => void;
  lang: SupportedLang;
  setLang: (lang: SupportedLang) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  config,
  maskedToken,
  onRefreshSettings,
  lang,
  setLang,
}) => {
  const t = translations[lang];

  // Telegram state
  const [botTokenInput, setBotTokenInput] = useState('');
  const [defaultDelay, setDefaultDelay] = useState(config?.defaultDelaySeconds || 3);
  const [isAnonymous, setIsAnonymous] = useState(config?.isAnonymousDefault ?? true);
  const [protectContent, setProtectContent] = useState(config?.protectContentDefault ?? false);

  // WhatsApp state
  const [whatsAppTokenInput, setWhatsAppTokenInput] = useState('');
  const [whatsAppPhoneIdInput, setWhatsAppPhoneIdInput] = useState(config?.whatsAppPhoneNumberId || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ success: boolean; message: string; botInfo?: any } | null>(null);

  const [isTestingWhatsApp, setIsTestingWhatsApp] = useState(false);
  const [waFeedback, setWaFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const handleSaveAndTest = async () => {
    setIsSaving(true);
    setSaveFeedback(null);

    try {
      // 1. Test bot token against Telegram Bot API getMe if provided
      let verifiedBotInfo: any = null;
      if (botTokenInput.trim()) {
        const testRes = await fetch('/api/telegram/test-bot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: botTokenInput.trim() }),
        });
        const testData = await testRes.json();
        if (!testRes.ok || !testData.success) {
          throw new Error(testData.error || 'Failed to verify bot token with Telegram');
        }
        verifiedBotInfo = testData.bot;
      }

      // 2. Save settings to backend
      const saveRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botToken: botTokenInput.trim() ? botTokenInput.trim() : undefined,
          whatsAppAccessToken: whatsAppTokenInput.trim() ? whatsAppTokenInput.trim() : undefined,
          whatsAppPhoneNumberId: whatsAppPhoneIdInput.trim() ? whatsAppPhoneIdInput.trim() : undefined,
          defaultDelaySeconds: defaultDelay,
          language: lang,
          isAnonymousDefault: isAnonymous,
          protectContentDefault: protectContent,
        }),
      });

      const saveData = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveData.error || 'Failed to save settings');

      setSaveFeedback({
        success: true,
        message: 'Settings updated and credentials securely saved!',
        botInfo: verifiedBotInfo,
      });

      setBotTokenInput('');
      setWhatsAppTokenInput('');
      onRefreshSettings();
    } catch (err: any) {
      setSaveFeedback({
        success: false,
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestWhatsAppCloud = async () => {
    setIsTestingWhatsApp(true);
    setWaFeedback(null);

    try {
      const res = await fetch('/api/whatsapp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: whatsAppTokenInput.trim() || undefined,
          phoneNumberId: whatsAppPhoneIdInput.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'WhatsApp Cloud API verification failed');
      }

      setWaFeedback({
        success: true,
        message: `Verified: ${data.verifiedName} (${data.displayPhoneNumber || 'Connected'})`,
      });
    } catch (err: any) {
      setWaFeedback({
        success: false,
        message: err.message,
      });
    } finally {
      setIsTestingWhatsApp(false);
    }
  };

  const steps = [
    { num: 1, text: t.wizardStep1 },
    { num: 2, text: t.wizardStep2 },
    { num: 3, text: t.wizardStep3 },
    { num: 4, text: t.wizardStep4 },
    { num: 5, text: t.wizardStep5 },
    { num: 6, text: t.wizardStep6 },
    { num: 7, text: t.wizardStep7 },
    { num: 8, text: t.wizardStep8 },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 1. Telegram Bot Token Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">
              Telegram Bot Credentials
            </h2>
          </div>
          {maskedToken ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs rounded-md border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Connected: {maskedToken}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs rounded-md border border-amber-200">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Not Configured</span>
            </div>
          )}
        </div>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              {t.botTokenLabel}
            </label>
            <input
              type="password"
              value={botTokenInput}
              onChange={e => setBotTokenInput(e.target.value)}
              placeholder={maskedToken ? 'Enter new token to replace existing...' : 'e.g. 123456789:ABCdefGhIJKlmNoPQRstuvwxYZ'}
              className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-slate-900"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Tokens are stored securely server-side and never exposed to client-side scripts.
            </p>
          </div>
        </div>
      </div>

      {/* 2. WhatsApp Channels & Groups Integration */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-900">
              WhatsApp Integration (Groups & Channels)
            </h2>
          </div>
          <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
            Dual Publishing
          </span>
        </div>

        {/* Two Sharing Methods Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <Share2 className="w-4 h-4 text-emerald-700" />
              <span>Method A: 1-Click WhatsApp Share</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>Zero Cost & Immediate:</strong> In Quiz Preview and Editor, click "Share to WhatsApp" to post formatted quiz cards directly into any WhatsApp Group or Channel.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-900">
              <Bot className="w-4 h-4 text-indigo-600" />
              <span>Method B: Meta Cloud API</span>
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              <strong>Automated Queue:</strong> Enter your Meta WhatsApp Business Cloud API Access Token and Phone Number ID below for automated server-side sending.
            </p>
          </div>
        </div>

        {/* WhatsApp Cloud API credentials */}
        <div className="space-y-3 pt-2 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                WhatsApp Phone Number ID (Optional)
              </label>
              <input
                type="text"
                value={whatsAppPhoneIdInput}
                onChange={e => setWhatsAppPhoneIdInput(e.target.value)}
                placeholder="e.g. 109876543210987"
                className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                WhatsApp Cloud API Access Token (Optional)
              </label>
              <input
                type="password"
                value={whatsAppTokenInput}
                onChange={e => setWhatsAppTokenInput(e.target.value)}
                placeholder="EAAG... (Meta Permanent System User Token)"
                className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-slate-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestWhatsAppCloud}
              disabled={isTestingWhatsApp || (!whatsAppPhoneIdInput && !config?.whatsAppPhoneNumberId)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition-colors disabled:opacity-40"
            >
              {isTestingWhatsApp ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />}
              <span>Test WhatsApp Cloud Connection</span>
            </button>
          </div>

          {waFeedback && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                waFeedback.success
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {waFeedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
              <span>{waFeedback.message}</span>
            </div>
          )}
        </div>

        {/* Unified Save Button */}
        <div className="pt-2 border-t border-slate-100">
          <button
            onClick={handleSaveAndTest}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            <span>Save All Credentials</span>
          </button>
        </div>

        {/* Verification feedback */}
        {saveFeedback && (
          <div
            className={`p-3.5 rounded-lg text-xs space-y-1.5 ${
              saveFeedback.success
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-rose-50 text-rose-900 border border-rose-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {saveFeedback.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{saveFeedback.message}</span>
            </div>
            {saveFeedback.botInfo && (
              <div className="text-[11px] pl-5 text-emerald-800 font-mono">
                Telegram Bot: {saveFeedback.botInfo.firstName} (@{saveFeedback.botInfo.username})
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 8-Step Telegram Setup Wizard */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Key className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">{t.setupWizard}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {steps.map(step => (
            <div
              key={step.num}
              className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-start gap-2.5"
            >
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {step.num}
              </span>
              <span className="text-slate-700 leading-relaxed">{step.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Preferences & Publishing Defaults */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Sliders className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-900">Preferences & Publishing Defaults</h2>
        </div>

        <div className="space-y-4 text-xs">
          {/* Interface Language */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold text-slate-800 block">Interface Language</span>
              <span className="text-slate-500 text-[11px]">Choose between Bengali (বাংলা) and English</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setLang('bn')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  lang === 'bn' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                বাংলা
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  lang === 'en' ? 'bg-white text-indigo-600 shadow-sm font-bold' : 'text-slate-600'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Anonymous polls default */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <span className="font-semibold text-slate-800 block">Anonymous Quiz Polls</span>
              <span className="text-slate-500 text-[11px]">Hide participant identities from channel members</span>
            </div>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={e => setIsAnonymous(e.target.checked)}
              className="rounded text-indigo-600 w-4 h-4"
            />
          </div>

          {/* Protect Content default */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <span className="font-semibold text-slate-800 block">Protect Quiz Content</span>
              <span className="text-slate-500 text-[11px]">Prevent forwarding or saving quiz messages</span>
            </div>
            <input
              type="checkbox"
              checked={protectContent}
              onChange={e => setProtectContent(e.target.checked)}
              className="rounded text-indigo-600 w-4 h-4"
            />
          </div>

          {/* Security Rotation Notice */}
          <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-[11px] leading-relaxed border border-slate-100">
            <span className="font-semibold text-slate-700">Token Security & Rotation: </span>
            If you ever believe your Telegram Bot or WhatsApp credentials were leaked, immediately revoke them in their respective developer portals and update them here.
          </div>
        </div>
      </div>
    </div>
  );
};
