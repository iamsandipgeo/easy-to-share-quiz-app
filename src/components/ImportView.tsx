import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  Trash2,
  Table,
  Zap,
  Info,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { QuestionItem } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';
import { parseMCQText, ParserResult } from '../utils/mcqParser';
import {
  BENGALI_SAMPLE_MCQ,
  ENGLISH_SAMPLE_MCQ,
  SEPARATE_KEY_SAMPLE,
  generate100BenchmarkQuestions,
} from '../utils/sampleData';
import { ColumnMapping } from '../utils/fileExtractors';

interface ImportViewProps {
  onQuestionsImported: (questions: QuestionItem[], append?: boolean) => void;
  onNavigateToEditor: () => void;
  lang: SupportedLang;
}

export const ImportView: React.FC<ImportViewProps> = ({
  onQuestionsImported,
  onNavigateToEditor,
  lang,
}) => {
  const t = translations[lang];
  const [activeSubTab, setActiveSubTab] = useState<'paste' | 'file'>('paste');

  // Bulk Paste State
  const [pasteText, setPasteText] = useState<string>('');
  const [parseResult, setParseResult] = useState<ParserResult | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  // File Upload State
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedFileSummary, setUploadedFileSummary] = useState<{
    filename: string;
    size: number;
    fileType: string;
    warning?: string;
    isScannedPdf?: boolean;
    pages?: number;
  } | null>(null);

  // Spreadsheet mapping modal state
  const [spreadsheetHeaders, setSpreadsheetHeaders] = useState<string[]>([]);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    questionCol: '',
    optionACol: '',
    optionBCol: '',
    optionCCol: '',
    optionDCol: '',
    answerCol: '',
    explanationCol: '',
  });
  const [storedSpreadsheetFile, setStoredSpreadsheetFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handler for parsing pasted text
  const handleParseText = () => {
    if (!pasteText.trim()) return;
    setIsParsing(true);
    try {
      const result = parseMCQText(pasteText);
      setParseResult(result);
    } catch (err: any) {
      alert(`Parsing error: ${err.message}`);
    } finally {
      setIsParsing(false);
    }
  };

  const handleApplyToEditor = (append = false) => {
    if (!parseResult || parseResult.questions.length === 0) return;
    onQuestionsImported(parseResult.questions, append);
    onNavigateToEditor();
  };

  // Sample Loaders
  const handleLoadBengaliSample = () => {
    setPasteText(BENGALI_SAMPLE_MCQ.trim());
    setParseResult(null);
  };

  const handleLoadEnglishSample = () => {
    setPasteText(ENGLISH_SAMPLE_MCQ.trim());
    setParseResult(null);
  };

  const handleLoadSeparateKeySample = () => {
    setPasteText(SEPARATE_KEY_SAMPLE.trim());
    setParseResult(null);
  };

  const handleLoad100Benchmark = () => {
    const text = generate100BenchmarkQuestions();
    setPasteText(text);
    setParseResult(null);
  };

  const handleClear = () => {
    setPasteText('');
    setParseResult(null);
  };

  // Export parsed result as JSON
  const handleExportJSON = () => {
    if (!parseResult) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(parseResult.questions, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'parsed_mcqs.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Download parsing errors as text
  const handleDownloadErrors = () => {
    if (!parseResult) return;
    const invalidList = parseResult.questions.filter(q => q.status === 'invalid' || q.status === 'needs_review');
    const content = invalidList.map((q, idx) => {
      const issues = q.issues.map(iss => `  - [${iss.severity.toUpperCase()}] ${iss.messageEn} / ${iss.messageBn}`).join('\n');
      return `Question ${idx + 1} (${q.questionNumber || 'N/A'}):\n"${q.question}"\nIssues:\n${issues}\n`;
    }).join('\n---\n\n');

    const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(content || 'No issues found!');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'parsing_issues_report.txt');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadedFileSummary(null);
    setStoredSpreadsheetFile(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import/file', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadedFileSummary({
        filename: data.filename,
        size: data.size,
        fileType: data.fileType,
        warning: data.warning,
        isScannedPdf: data.isScannedPdf,
        pages: data.pages,
      });

      // If it's a spreadsheet with columns
      if (['xlsx', 'xls', 'csv'].includes(data.fileType)) {
        setStoredSpreadsheetFile(file);
        setSpreadsheetHeaders(data.headers || []);
        setSheetNames(data.sheetNames || []);
        setSelectedSheet(data.activeSheet || '');
        if (data.suggestedMapping) {
          setColumnMapping(data.suggestedMapping);
        }
      } else if (data.result) {
        // Direct TXT, DOCX, or PDF parsed questions
        setParseResult(data.result);
      }
    } catch (err: any) {
      alert(`File upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Process mapped spreadsheet
  const handleProcessMappedSpreadsheet = async () => {
    if (!storedSpreadsheetFile) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', storedSpreadsheetFile);
    formData.append('mapping', JSON.stringify(columnMapping));
    formData.append('sheetName', selectedSheet);

    try {
      const res = await fetch('/api/import/spreadsheet-map', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mapping process failed');

      setParseResult(data.result);
      setStoredSpreadsheetFile(null); // Close mapping interface
    } catch (err: any) {
      alert(`Spreadsheet mapping error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Switcher: Bulk Paste vs File Import */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('paste')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'paste'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>{t.bulkPasteTab}</span>
        </button>

        <button
          onClick={() => setActiveSubTab('file')}
          className={`flex items-center gap-2 py-3 px-5 text-xs font-semibold border-b-2 transition-colors ${
            activeSubTab === 'file'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>{t.fileUploadTab}</span>
        </button>
      </div>

      {/* Subtab 1: Bulk Paste Import */}
      {activeSubTab === 'paste' && (
        <div className="space-y-4">
          {/* Quick sample loading actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Load Samples:</span>
            <button
              onClick={handleLoadBengaliSample}
              className="px-2.5 py-1 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
            >
              {t.loadBengaliSample}
            </button>
            <button
              onClick={handleLoadEnglishSample}
              className="px-2.5 py-1 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
            >
              {t.loadEnglishSample}
            </button>
            <button
              onClick={handleLoadSeparateKeySample}
              className="px-2.5 py-1 text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
            >
              {t.loadSeparateKeySample}
            </button>
            <button
              onClick={handleLoad100Benchmark}
              className="flex items-center gap-1 px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md font-medium transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.load100Benchmark}</span>
            </button>
          </div>

          {/* Large Text Area */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
            <textarea
              rows={14}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={t.pastePlaceholder}
              className="w-full text-xs font-mono text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg p-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-y leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleParseText}
                  disabled={!pasteText.trim() || isParsing}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {isParsing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>{t.parseQuestionsBtn}</span>
                </button>

                <button
                  onClick={handleClear}
                  disabled={!pasteText}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.clearTextBtn}</span>
                </button>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                {pasteText.length > 0 && `${pasteText.split('\n').length} lines · ${pasteText.length} chars`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 2: File Import */}
      {activeSubTab === 'file' && (
        <div className="space-y-4">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/30 rounded-xl p-8 text-center transition-all group"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.csv,.xlsx,.xls,.docx,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {t.dropFilesHere}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {t.supportedFormatsNotice}
            </p>
            {isUploading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-indigo-600 font-medium">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Uploading and extracting text...</span>
              </div>
            )}
          </div>

          {/* Scanned PDF Alert Banner */}
          {uploadedFileSummary?.isScannedPdf && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold text-amber-900">
                  {lang === 'bn' ? 'স্ক্যান করা PDF সনাক্ত হয়েছে' : 'Scanned PDF Detected'}
                </h4>
                <p className="text-xs text-amber-700 mt-0.5">
                  {uploadedFileSummary.warning}
                </p>
              </div>
            </div>
          )}

          {/* Spreadsheet Column Mapping Interface */}
          {storedSpreadsheetFile && spreadsheetHeaders.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Table className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-semibold text-slate-900">
                    {t.mapColumnsTitle}
                  </h3>
                </div>
                {sheetNames.length > 1 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500">{t.sheetSelector}:</span>
                    <select
                      value={selectedSheet}
                      onChange={(e) => setSelectedSheet(e.target.value)}
                      className="border border-slate-200 rounded px-2 py-1 bg-white text-slate-800"
                    >
                      {sheetNames.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500">
                Match each MCQ component to the column header in your spreadsheet file:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Question Text Column *
                  </label>
                  <select
                    value={columnMapping.questionCol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, questionCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Option A Column *
                  </label>
                  <select
                    value={columnMapping.optionACol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, optionACol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Option B Column *
                  </label>
                  <select
                    value={columnMapping.optionBCol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, optionBCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Option C Column
                  </label>
                  <select
                    value={columnMapping.optionCCol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, optionCCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column (Optional) --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Option D Column
                  </label>
                  <select
                    value={columnMapping.optionDCol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, optionDCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column (Optional) --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Correct Answer Column *
                  </label>
                  <select
                    value={columnMapping.answerCol}
                    onChange={(e) => setColumnMapping({ ...columnMapping, answerCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- Select Column --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Explanation Column (Optional)
                  </label>
                  <select
                    value={columnMapping.explanationCol || ''}
                    onChange={(e) => setColumnMapping({ ...columnMapping, explanationCol: e.target.value })}
                    className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 text-slate-800"
                  >
                    <option value="">-- None --</option>
                    {spreadsheetHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setStoredSpreadsheetFile(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessMappedSpreadsheet}
                  disabled={!columnMapping.questionCol || !columnMapping.answerCol}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  Process Questions
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Parsing Result Summary Card */}
      {parseResult && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  {t.parsingResult}: {parseResult.stats.totalParsed} {t.parsedSuccessfully}
                </h3>
              </div>
              {parseResult.separateAnswerKeysFound > 0 && (
                <p className="text-xs text-indigo-600 mt-1 font-medium">
                  ✓ Found and mapped {parseResult.separateAnswerKeysFound} separate answer keys!
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadErrors}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.downloadErrors}</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.exportParsedQuestions}</span>
              </button>
            </div>
          </div>

          {/* Metric breakdown */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-900">
              <div className="text-[11px] font-medium text-emerald-700">Ready to Publish</div>
              <div className="text-xl font-bold font-mono tabular-nums">{parseResult.stats.readyCount}</div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-amber-900">
              <div className="text-[11px] font-medium text-amber-700">Needs Review</div>
              <div className="text-xl font-bold font-mono tabular-nums">{parseResult.stats.needsReviewCount}</div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-rose-900">
              <div className="text-[11px] font-medium text-rose-700">Invalid / Incomplete</div>
              <div className="text-xl font-bold font-mono tabular-nums">{parseResult.stats.invalidCount}</div>
            </div>
          </div>

          {/* Load into Editor Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-slate-400" />
              <span>
                You can review, modify answers, and edit any flagged question in the Question Editor.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApplyToEditor(true)}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Append to Existing Editor Questions
              </button>
              <button
                onClick={() => handleApplyToEditor(false)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                <span>Load in Question Editor</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
