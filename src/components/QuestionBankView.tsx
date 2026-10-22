import React, { useState } from 'react';
import {
  FolderArchive,
  Save,
  Download,
  Upload,
  Trash2,
  ArrowRight,
  Plus,
  BookOpen,
  Calendar,
  Layers,
} from 'lucide-react';
import { QuestionItem, QuestionBankSet } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';

interface QuestionBankViewProps {
  currentQuestions: QuestionItem[];
  questionBanks: QuestionBankSet[];
  setQuestionBanks: React.Dispatch<React.SetStateAction<QuestionBankSet[]>>;
  onLoadQuestionsToEditor: (questions: QuestionItem[], append?: boolean) => void;
  lang: SupportedLang;
}

export const QuestionBankView: React.FC<QuestionBankViewProps> = ({
  currentQuestions,
  questionBanks,
  setQuestionBanks,
  onLoadQuestionsToEditor,
  lang,
}) => {
  const t = translations[lang];

  // Save Modal
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState('');
  const [topic, setTopic] = useState('');

  const handleOpenSave = () => {
    if (currentQuestions.length === 0) {
      alert('Editor has no questions to save. Please import or create questions first.');
      return;
    }
    setTitle(`MCQ Set - ${new Date().toLocaleDateString()}`);
    setDescription('');
    setSubject('');
    setTopic('');
    setIsSaveModalOpen(true);
  };

  const handleSaveToBank = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    try {
      const res = await fetch('/api/question-banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          subject,
          topic,
          questions: currentQuestions,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');

      setQuestionBanks(prev => [data, ...prev]);
      setIsSaveModalOpen(false);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!window.confirm('Delete this question bank set?')) return;
    try {
      await fetch(`/api/question-banks/${id}`, { method: 'DELETE' });
      setQuestionBanks(prev => prev.filter(b => b.id !== id));
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleExportJSON = (bank: QuestionBankSet) => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bank, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${bank.title.toLowerCase().replace(/\s+/g, '_')}_bank.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportBankJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        if (!questions || !Array.isArray(questions)) {
          throw new Error('Invalid Question Bank JSON format');
        }

        const res = await fetch('/api/question-banks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: parsed.title || file.name.replace('.json', ''),
            description: parsed.description || 'Imported Question Bank',
            subject: parsed.subject || '',
            topic: parsed.topic || '',
            questions,
          }),
        });

        const created = await res.json();
        if (res.ok) {
          setQuestionBanks(prev => [created, ...prev]);
        }
      } catch (err: any) {
        alert(`Failed to import JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{t.bankTitle}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Store and organize reusable question sets with subjects and topics for instant re-use.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Import JSON button */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>{t.importBank}</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBankJSON}
              className="hidden"
            />
          </label>

          {/* Save current editor set */}
          <button
            onClick={handleOpenSave}
            disabled={currentQuestions.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.saveCurrentToBank} ({currentQuestions.length})</span>
          </button>
        </div>
      </div>

      {/* List of Saved Question Banks */}
      {questionBanks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs space-y-3">
          <FolderArchive className="w-8 h-8 text-slate-300 mx-auto" />
          <p>No saved question sets in the bank yet.</p>
          {currentQuestions.length > 0 && (
            <button
              onClick={handleOpenSave}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
            >
              Save the current {currentQuestions.length} questions in the editor
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {questionBanks.map(bank => (
            <div
              key={bank.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 leading-snug">
                    {bank.title}
                  </h3>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded shrink-0">
                    {bank.questionsCount || bank.questions.length} MCQs
                  </span>
                </div>

                {bank.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {bank.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px] text-slate-500">
                  {bank.subject && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium">
                      {bank.subject}
                    </span>
                  )}
                  {bank.topic && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">
                      {bank.topic}
                    </span>
                  )}
                  <span className="text-slate-400 font-mono">
                    {new Date(bank.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <button
                  onClick={() => onLoadQuestionsToEditor(bank.questions, false)}
                  className="flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <span>{t.loadIntoEditor}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExportJSON(bank)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition-colors"
                    title="Export JSON"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteBank(bank.id)}
                    className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 transition-colors"
                    title="Delete Bank"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Save Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">{t.saveCurrentToBank}</h3>
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">{t.bankName} *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. 45th BCS Geography Set 1"
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.subject}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g. ভূগোল"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">{t.topic}</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g. সৌরজগত"
                    className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Notes or source information..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveToBank}
                disabled={!title.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
              >
                Save {currentQuestions.length} Questions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
