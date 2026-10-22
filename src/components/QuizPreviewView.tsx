import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Smartphone,
  Eye,
  Share2,
  Copy,
  ExternalLink,
  Check,
} from 'lucide-react';
import { QuestionItem } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';
import { getOptionLabel } from '../utils/bengaliUtils';
import { formatQuestionForWhatsApp, createWhatsAppShareUrl } from '../utils/whatsappFormatter';

interface QuizPreviewViewProps {
  questions: QuestionItem[];
  initialIndex?: number;
  onNavigateToPublish: () => void;
  lang: SupportedLang;
}

export const QuizPreviewView: React.FC<QuizPreviewViewProps> = ({
  questions,
  initialIndex = 0,
  onNavigateToPublish,
  lang,
}) => {
  const t = translations[lang];

  const [currentIndex, setCurrentIndex] = useState<number>(
    questions.length > 0 ? Math.min(initialIndex, questions.length - 1) : 0
  );

  const [previewPlatform, setPreviewPlatform] = useState<'telegram' | 'whatsapp'>('telegram');

  // Simulated voting state per question: selected option index
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealedWhatsAppAnswer, setRevealedWhatsAppAnswer] = useState<boolean>(false);
  const [copiedWhatsApp, setCopiedWhatsApp] = useState<boolean>(false);

  const currentQ = questions[currentIndex];
  const isBengali = currentQ ? currentQ.language === 'bn' : false;

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return; // already voted
    setSelectedOption(idx);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setRevealedWhatsAppAnswer(false);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setSelectedOption(null);
      setRevealedWhatsAppAnswer(false);
    }
  };

  const handleCopyWhatsAppText = () => {
    if (!currentQ) return;
    const text = formatQuestionForWhatsApp(currentQ);
    navigator.clipboard.writeText(text);
    setCopiedWhatsApp(true);
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleShareToWhatsAppDirect = () => {
    if (!currentQ) return;
    const text = formatQuestionForWhatsApp(currentQ);
    const url = createWhatsAppShareUrl(text);
    window.open(url, '_blank');
  };

  if (questions.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs space-y-3">
        <Eye className="w-8 h-8 text-slate-300 mx-auto" />
        <p>{t.noQuestionsLoaded}</p>
      </div>
    );
  }

  const isAnswered = selectedOption !== null;
  const isUserCorrect = isAnswered && selectedOption === currentQ.correctOptionIndex;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header with Navigation and Question Selector */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-indigo-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {previewPlatform === 'telegram' ? t.telegramQuizPreviewTitle : t.whatsAppPreviewTitle}
            </h2>
            <p className="text-[11px] text-slate-500">
              Question {currentIndex + 1} of {questions.length}
            </p>
          </div>
        </div>

        {/* Platform View Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs">
          <button
            onClick={() => {
              setPreviewPlatform('telegram');
              setSelectedOption(null);
            }}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              previewPlatform === 'telegram'
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Telegram Poll
          </button>
          <button
            onClick={() => {
              setPreviewPlatform('whatsapp');
              setSelectedOption(null);
            }}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              previewPlatform === 'whatsapp'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            WhatsApp Card
          </button>
        </div>

        {/* Question Selector Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t.previousQuestion}</span>
          </button>

          <select
            value={currentIndex}
            onChange={(e) => {
              setCurrentIndex(Number(e.target.value));
              setSelectedOption(null);
              setRevealedWhatsAppAnswer(false);
            }}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 font-mono"
          >
            {questions.map((q, idx) => (
              <option key={q.id} value={idx}>
                #{q.questionNumber || idx + 1}: {q.question.slice(0, 24)}...
              </option>
            ))}
          </select>

          <button
            onClick={handleNext}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-30 rounded-lg transition-colors"
          >
            <span>{t.nextQuestion}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 1. TELEGRAM PREVIEW MODE */}
      {previewPlatform === 'telegram' && (
        <div className="bg-[#6b8c9c] p-3 sm:p-6 rounded-2xl shadow-inner max-w-lg mx-auto">
          {/* Telegram Chat Message Bubble */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-md space-y-3 relative overflow-hidden">
            {/* Quiz Header Bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5 font-medium text-indigo-700">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{t.anonymousQuiz}</span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                <span>#{currentIndex + 1}</span>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </div>

            {/* Options List */}
            <div className="space-y-2 pt-1">
              {currentQ.options.map((opt, optIdx) => {
                const optLabel = getOptionLabel(optIdx, isBengali);
                const isSelected = selectedOption === optIdx;
                const isTheCorrectOption = optIdx === currentQ.correctOptionIndex;

                let btnStyle = 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-800';
                let badgeStyle = 'bg-slate-100 text-slate-700';

                if (isAnswered) {
                  if (isTheCorrectOption) {
                    btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold ring-1 ring-emerald-500';
                    badgeStyle = 'bg-emerald-600 text-white';
                  } else if (isSelected && !isTheCorrectOption) {
                    btnStyle = 'border-rose-400 bg-rose-50 text-rose-950 ring-1 ring-rose-400';
                    badgeStyle = 'bg-rose-600 text-white';
                  } else {
                    btnStyle = 'border-slate-100 bg-slate-50/50 text-slate-400 opacity-60';
                    badgeStyle = 'bg-slate-100 text-slate-400';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`w-full text-left p-3 rounded-xl border text-xs sm:text-sm flex items-center justify-between transition-all ${btnStyle}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${badgeStyle}`}>
                        {optLabel}
                      </span>
                      <span className="leading-snug">{opt}</span>
                    </div>

                    {isAnswered && (
                      <div className="shrink-0 ml-2">
                        {isTheCorrectOption ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : isSelected ? (
                          <XCircle className="w-5 h-5 text-rose-600" />
                        ) : null}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tip / Voted state status */}
            {!isAnswered ? (
              <div className="text-[11px] text-slate-400 italic text-center pt-1">
                {t.voteToSeeResults}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                {/* Correct / Wrong Result Banner */}
                <div
                  className={`p-2.5 rounded-lg text-xs font-medium flex items-center justify-between ${
                    isUserCorrect
                      ? 'bg-emerald-100/70 text-emerald-800'
                      : 'bg-rose-100/70 text-rose-800'
                  }`}
                >
                  <span>{isUserCorrect ? '🎉 Correct answer!' : '❌ Incorrect answer'}</span>
                  <span className="font-mono text-[10px]">
                    Correct: Option {getOptionLabel(currentQ.correctOptionIndex, isBengali)}
                  </span>
                </div>

                {/* Telegram Quiz Explanation Balloon */}
                {currentQ.explanation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                      <Lightbulb className="w-4 h-4 text-amber-600" />
                      <span>Explanation</span>
                    </div>
                    <p className="text-slate-700 leading-relaxed pl-5">
                      {currentQ.explanation}
                    </p>
                  </div>
                )}

                <div className="text-center">
                  <button
                    onClick={() => setSelectedOption(null)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline"
                  >
                    Reset poll simulation
                  </button>
                </div>
              </div>
            )}

            {/* Telegram Footer Meta */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
              <span>Quiz Poll</span>
              <span>12:00 PM</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. WHATSAPP PREVIEW MODE */}
      {previewPlatform === 'whatsapp' && (
        <div className="bg-[#efeae2] p-3 sm:p-6 rounded-2xl shadow-inner max-w-lg mx-auto border border-[#d1d7db]">
          {/* WhatsApp Header bar */}
          <div className="bg-[#008069] text-white px-4 py-2.5 rounded-t-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
                📱
              </div>
              <div>
                <h4 className="text-xs font-bold leading-tight">BCS WhatsApp Study Group</h4>
                <p className="text-[10px] text-white/80">3,450 members · online</p>
              </div>
            </div>
            <button
              onClick={handleShareToWhatsAppDirect}
              className="flex items-center gap-1 px-2.5 py-1 bg-white text-[#008069] hover:bg-emerald-50 rounded-md text-[11px] font-bold shadow-sm transition-colors"
            >
              <Share2 className="w-3 h-3" />
              <span>Share</span>
            </button>
          </div>

          {/* WhatsApp Chat Message Bubble */}
          <div className="bg-white rounded-b-xl rounded-tr-xl p-4 shadow space-y-2.5 text-xs text-slate-800 font-sans border-l-4 border-l-[#00a884]">
            <div className="text-[11px] font-bold text-[#008069] flex items-center gap-1">
              <span>🎯 DAILY QUIZ POLL</span>
              <span className="text-slate-400 font-mono text-[10px]">#{currentIndex + 1}</span>
            </div>

            {/* Question Text in WhatsApp bold style */}
            <div className="text-sm font-bold text-slate-900 leading-snug">
              {currentQ.question}
            </div>

            {/* Options with emojis */}
            <div className="space-y-1.5 py-1 text-xs">
              {currentQ.options.map((opt, optIdx) => {
                const optLetters = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];
                const emoji = optIdx < optLetters.length ? optLetters[optIdx] : '🔹';
                const label = getOptionLabel(optIdx, isBengali);

                return (
                  <div key={optIdx} className="flex items-start gap-2 p-1 rounded hover:bg-slate-50">
                    <span className="shrink-0 text-sm">{emoji}</span>
                    <span className="font-semibold text-slate-700">{label})</span>
                    <span className="text-slate-900">{opt}</span>
                  </div>
                );
              })}
            </div>

            {/* WhatsApp Click-to-Reveal Answer (Spoiler feature) */}
            <div className="pt-2 border-t border-slate-100">
              {!revealedWhatsAppAnswer ? (
                <button
                  onClick={() => setRevealedWhatsAppAnswer(true)}
                  className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-[#008069] rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>🔍 সঠিক উত্তর দেখতে এখানে ট্যাপ করুন (Click to Reveal)</span>
                </button>
              ) : (
                <div className="p-3 bg-emerald-50 rounded-lg space-y-1.5 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        সঠিক উত্তর: {getOptionLabel(currentQ.correctOptionIndex, isBengali)}) {currentQ.options[currentQ.correctOptionIndex]}
                      </span>
                    </div>
                    <button
                      onClick={() => setRevealedWhatsAppAnswer(false)}
                      className="text-[10px] text-slate-500 hover:text-slate-700 underline"
                    >
                      Hide
                    </button>
                  </div>
                  {currentQ.explanation && (
                    <div className="text-[11px] text-slate-700 italic border-t border-emerald-200/50 pt-1">
                      💡 <strong>ব্যাখ্যা:</strong> {currentQ.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bubble Timestamp */}
            <div className="flex justify-end items-center gap-1 text-[10px] text-slate-400 font-mono pt-1">
              <span>12:01 PM</span>
              <span className="text-sky-500 font-bold">✓✓</span>
            </div>
          </div>

          {/* Quick 1-Click WhatsApp Share Bar */}
          <div className="mt-3 flex items-center justify-between gap-2 pt-1">
            <button
              onClick={handleCopyWhatsAppText}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm transition-colors"
            >
              {copiedWhatsApp ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied WhatsApp Text!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy Formatted Quiz</span>
                </>
              )}
            </button>

            <button
              onClick={handleShareToWhatsAppDirect}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#00a884] hover:bg-[#008069] text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share to WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-600">
          Ready to publish? Send native polls to Telegram channels and formatted cards to WhatsApp groups.
        </div>
        <button
          onClick={onNavigateToPublish}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors whitespace-nowrap"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{t.startPublishingJob}</span>
        </button>
      </div>
    </div>
  );
};
