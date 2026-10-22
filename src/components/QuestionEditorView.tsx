import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Plus,
  Trash2,
  Copy,
  Edit,
  ArrowUp,
  ArrowDown,
  Check,
  CheckSquare,
  Square,
  Eye,
  Filter,
  Share2,
} from 'lucide-react';
import { QuestionItem, ValidationCategory } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';
import { getOptionLabel } from '../utils/bengaliUtils';
import { validateQuestion } from '../utils/mcqParser';
import { formatQuestionForWhatsApp, createWhatsAppShareUrl } from '../utils/whatsappFormatter';

interface QuestionEditorViewProps {
  questions: QuestionItem[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionItem[]>>;
  onNavigateToPreview: (questionIndex?: number) => void;
  lang: SupportedLang;
}

export const QuestionEditorView: React.FC<QuestionEditorViewProps> = ({
  questions,
  setQuestions,
  onNavigateToPreview,
  lang,
}) => {
  const t = translations[lang];

  const [filter, setFilter] = useState<ValidationCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState<QuestionItem | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState<boolean>(false);

  // Filtered & Searched Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q, idx) => {
      // Status filter
      if (filter !== 'all' && q.status !== filter) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const numStr = String(q.questionNumber || idx + 1);
        const qMatches = q.question.toLowerCase().includes(query);
        const optMatches = q.options.some((o) => o.toLowerCase().includes(query));
        const expMatches = (q.explanation || '').toLowerCase().includes(query);
        return numStr === query || qMatches || optMatches || expMatches;
      }
      return true;
    });
  }, [questions, filter, searchQuery]);

  // Update correct answer quickly from the card
  const handleQuickCorrectAnswerChange = (questionId: string, newCorrectIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const updated = { ...q, correctOptionIndex: newCorrectIdx };
        const validation = validateQuestion(updated);
        return {
          ...updated,
          status: validation.status,
          issues: validation.issues,
        };
      })
    );
  };

  // Reorder up / down
  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    setQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Duplicate Question
  const handleDuplicate = (q: QuestionItem) => {
    const duplicated: QuestionItem = {
      ...q,
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      questionNumber: (q.questionNumber || questions.length) + 1,
    };
    setQuestions((prev) => [...prev, duplicated]);
  };

  // Delete single question
  const handleDelete = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Selection handlers
  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllReady = () => {
    const readyIds = questions.filter((q) => q.status === 'ready').map((q) => q.id);
    setSelectedIds(new Set(readyIds));
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Delete ${selectedIds.size} selected questions?`)) {
      setQuestions((prev) => prev.filter((q) => !selectedIds.has(q.id)));
      setSelectedIds(new Set());
    }
  };

  const handleSaveModal = () => {
    if (!editingQuestion) return;

    const validation = validateQuestion(editingQuestion);
    const finalized: QuestionItem = {
      ...editingQuestion,
      status: validation.status,
      issues: validation.issues,
    };

    if (isNewQuestion) {
      setQuestions((prev) => [...prev, finalized]);
    } else {
      setQuestions((prev) => prev.map((q) => (q.id === finalized.id ? finalized : q)));
    }

    setEditingQuestion(null);
    setIsNewQuestion(false);
  };

  const handleOpenNewQuestion = () => {
    const fresh: QuestionItem = {
      id: `q_${Date.now()}_manual`,
      questionNumber: questions.length + 1,
      question: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      status: 'invalid',
      issues: [],
    };
    setEditingQuestion(fresh);
    setIsNewQuestion(true);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls: Search, Filters, Bulk Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.filterAll} ({questions.length})
            </button>
            <button
              onClick={() => setFilter('ready')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === 'ready'
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              {t.filterReady} ({questions.filter((q) => q.status === 'ready').length})
            </button>
            <button
              onClick={() => setFilter('needs_review')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === 'needs_review'
                  ? 'bg-amber-600 text-white shadow-sm font-semibold'
                  : 'text-amber-700 hover:bg-amber-50'
              }`}
            >
              {t.filterReview} ({questions.filter((q) => q.status === 'needs_review').length})
            </button>
            <button
              onClick={() => setFilter('invalid')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === 'invalid'
                  ? 'bg-rose-600 text-white shadow-sm font-semibold'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              {t.filterInvalid} ({questions.filter((q) => q.status === 'invalid').length})
            </button>
          </div>

          {/* New Question Button */}
          <button
            onClick={handleOpenNewQuestion}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addQuestionManual}</span>
          </button>
        </div>

        {/* Search Bar & Bulk Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleSelectAllReady}
              className="px-2.5 py-1.5 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              {t.selectAllValid}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1 px-2.5 py-1.5 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.deleteSelected} ({selectedIds.size})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Questions List */}
      {filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 text-xs">
          {questions.length === 0 ? t.noQuestionsLoaded : 'No questions match the active filter or search.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQuestions.map((q, qIndex) => {
            const isSelected = selectedIds.has(q.id);
            const isBengali = q.language === 'bn';

            return (
              <div
                key={q.id}
                className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
                  isSelected ? 'border-indigo-400 bg-indigo-50/10 ring-1 ring-indigo-400' : 'border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Checkbox + Question Number */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      onClick={() => toggleSelectOne(q.id)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-xs font-bold text-slate-600 font-mono">
                      #{q.questionNumber || qIndex + 1}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {q.status === 'ready' && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Ready</span>
                      </span>
                    )}
                    {q.status === 'needs_review' && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>Needs Review</span>
                      </span>
                    )}
                    {q.status === 'invalid' && (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                        <XCircle className="w-3 h-3 text-rose-600" />
                        <span>Invalid</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Question Text */}
                <div className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
                  {q.question || <span className="text-rose-500 italic">[Blank Question Text]</span>}
                </div>

                {/* Character warning if length > 300 */}
                {q.question.length > 300 && (
                  <div className="text-[11px] text-rose-600 mt-1 font-mono">
                    Telegram limit exceeded: {q.question.length}/300 characters
                  </div>
                )}

                {/* 4 Options with instant click to select correct answer */}
                <div className="mt-3 space-y-1.5">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = q.correctOptionIndex === optIdx;
                    const optLabel = getOptionLabel(optIdx, isBengali);

                    return (
                      <div
                        key={optIdx}
                        onClick={() => handleQuickCorrectAnswerChange(q.id, optIdx)}
                        className={`cursor-pointer flex items-center justify-between p-2 rounded-lg border text-xs transition-all ${
                          isCorrect
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {optLabel}
                          </span>
                          <span>{opt || <span className="text-rose-400 italic">[Empty Option]</span>}</span>
                        </div>

                        {isCorrect && (
                          <div className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold shrink-0">
                            <Check className="w-3.5 h-3.5" />
                            <span>Correct</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation if present */}
                {q.explanation && (
                  <div className="mt-2.5 p-2 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Explanation: </span>
                    {q.explanation}
                  </div>
                )}

                {/* Validation Issues list */}
                {q.issues.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1">
                    {q.issues.map((iss, iIdx) => (
                      <div
                        key={iIdx}
                        className={`text-[11px] flex items-center gap-1.5 ${
                          iss.severity === 'error' ? 'text-rose-600 font-medium' : 'text-amber-600'
                        }`}
                      >
                        {iss.severity === 'error' ? (
                          <XCircle className="w-3.5 h-3.5 shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>{lang === 'bn' ? iss.messageBn : iss.messageEn}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMove(qIndex, 'up')}
                      disabled={qIndex === 0}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMove(qIndex, 'down')}
                      disabled={qIndex === questions.length - 1}
                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded hover:bg-slate-100"
                      title="Move Down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const text = formatQuestionForWhatsApp(q);
                        window.open(createWhatsAppShareUrl(text), '_blank');
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors font-medium"
                      title="Share to WhatsApp Group or Channel"
                    >
                      <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </button>

                    <button
                      onClick={() => onNavigateToPreview(qIndex)}
                      className="flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                      title="View Telegram / WhatsApp simulation"
                    >
                      <Eye className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleDuplicate(q)}
                      className="flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{t.duplicate}</span>
                    </button>

                    <button
                      onClick={() => {
                        setEditingQuestion({ ...q });
                        setIsNewQuestion(false);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md font-medium transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{t.edit}</span>
                    </button>

                    <button
                      onClick={() => handleDelete(q.id)}
                      className="flex items-center gap-1 px-2 py-1 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit / Add Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-xl w-full p-5 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {isNewQuestion ? t.addQuestionManual : `${t.edit} Question #${editingQuestion.questionNumber || ''}`}
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Question Text */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <label>Question Text *</label>
                <span className={`font-mono ${editingQuestion.question.length > 300 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  {editingQuestion.question.length}/300 chars
                </span>
              </div>
              <textarea
                rows={3}
                value={editingQuestion.question}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 text-slate-900"
              />
            </div>

            {/* Options */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <label>Answer Options (2 to 10) *</label>
                <span className="text-slate-400 font-normal">Select the radio to mark correct answer</span>
              </div>

              <div className="space-y-2">
                {editingQuestion.options.map((opt, oIdx) => (
                  <div key={oIdx} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOptionRadio"
                      checked={editingQuestion.correctOptionIndex === oIdx}
                      onChange={() => setEditingQuestion({ ...editingQuestion, correctOptionIndex: oIdx })}
                      className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="w-5 text-xs font-bold text-slate-600">
                      {getOptionLabel(oIdx, editingQuestion.language === 'bn')}:
                    </span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[oIdx] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                      placeholder={`Option text (max 100 chars)`}
                      className="flex-1 text-xs p-2 border border-slate-200 rounded-lg text-slate-900"
                    />
                    {editingQuestion.options.length > 2 && (
                      <button
                        onClick={() => {
                          const newOpts = editingQuestion.options.filter((_, idx) => idx !== oIdx);
                          let nextCorrect = editingQuestion.correctOptionIndex;
                          if (nextCorrect >= newOpts.length) nextCorrect = newOpts.length - 1;
                          setEditingQuestion({
                            ...editingQuestion,
                            options: newOpts,
                            correctOptionIndex: nextCorrect,
                          });
                        }}
                        className="text-slate-400 hover:text-rose-600 p-1"
                        title="Remove option"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {editingQuestion.options.length < 10 && (
                <button
                  onClick={() => {
                    setEditingQuestion({
                      ...editingQuestion,
                      options: [...editingQuestion.options, ''],
                    });
                  }}
                  className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add another option (up to 10)</span>
                </button>
              )}
            </div>

            {/* Explanation */}
            <div>
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 mb-1">
                <label>Explanation (Optional)</label>
                <span className={`font-mono ${(editingQuestion.explanation || '').length > 200 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
                  {(editingQuestion.explanation || '').length}/200 chars
                </span>
              </div>
              <textarea
                rows={2}
                value={editingQuestion.explanation || ''}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                placeholder="Telegram quiz explanation displayed when students answer..."
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg text-slate-900"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingQuestion(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModal}
                disabled={!editingQuestion.question.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
              >
                Save Question
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
