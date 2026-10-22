import * as XLSX from 'xlsx';
import { QuestionItem } from '../types/quiz';
import { parseMCQText, ParserResult } from './mcqParser';

export interface ColumnMapping {
  questionCol: string;
  optionACol: string;
  optionBCol: string;
  optionCCol: string;
  optionDCol: string;
  answerCol: string;
  explanationCol?: string;
  subjectCol?: string;
}

export interface SpreadsheetParseResult {
  sheetNames: string[];
  activeSheet: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

/**
 * Parse an Excel/CSV buffer into workbook sheets and preview rows
 */
export function readWorkbookSheets(buffer: ArrayBuffer | Uint8Array): SpreadsheetParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const firstSheetName = sheetNames[0] || '';
  const worksheet = workbook.Sheets[firstSheetName];

  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as any[][];

  if (!jsonData || jsonData.length === 0) {
    return {
      sheetNames,
      activeSheet: firstSheetName,
      headers: [],
      rows: [],
      totalRows: 0,
    };
  }

  const rawHeaders = (jsonData[0] || []).map(h => String(h || '').trim());
  const rows: Record<string, any>[] = [];

  for (let r = 1; r < jsonData.length; r++) {
    const rowObj: Record<string, any> = {};
    const rowData = jsonData[r] || [];
    let hasData = false;
    rawHeaders.forEach((hdr, colIdx) => {
      const val = rowData[colIdx] !== undefined ? String(rowData[colIdx]).trim() : '';
      if (val) hasData = true;
      rowObj[hdr || `Column_${colIdx + 1}`] = val;
    });
    if (hasData) {
      rows.push(rowObj);
    }
  }

  return {
    sheetNames,
    activeSheet: firstSheetName,
    headers: rawHeaders.filter(Boolean),
    rows,
    totalRows: rows.length,
  };
}

/**
 * Convert structured spreadsheet rows to QuestionItem[] using a field column mapping
 */
export function convertMappedRowsToQuestions(
  rows: Record<string, any>[],
  mapping: ColumnMapping,
  filename?: string
): ParserResult {
  let combinedText = '';

  rows.forEach((row, idx) => {
    const qText = (row[mapping.questionCol] || '').trim();
    if (!qText) return;

    const optA = (row[mapping.optionACol] || '').trim();
    const optB = (row[mapping.optionBCol] || '').trim();
    const optC = (row[mapping.optionCCol] || '').trim();
    const optD = (row[mapping.optionDCol] || '').trim();
    const ans = (row[mapping.answerCol] || '').trim();
    const exp = mapping.explanationCol ? (row[mapping.explanationCol] || '').trim() : '';

    let formatted = `প্রশ্ন ${idx + 1}. ${qText}\n`;
    if (optA) formatted += `A) ${optA}\n`;
    if (optB) formatted += `B) ${optB}\n`;
    if (optC) formatted += `C) ${optC}\n`;
    if (optD) formatted += `D) ${optD}\n`;
    if (ans) formatted += `সঠিক উত্তর: ${ans}\n`;
    if (exp) formatted += `ব্যাখ্যা: ${exp}\n`;
    formatted += '\n';

    combinedText += formatted;
  });

  const result = parseMCQText(combinedText);
  if (filename) {
    result.questions.forEach(q => {
      q.sourceFile = filename;
    });
  }
  return result;
}

/**
 * Auto-detect column mapping from common header names
 */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');

  const findHdr = (keywords: string[]) => {
    for (const hdr of headers) {
      const n = norm(hdr);
      if (keywords.some(k => n.includes(norm(k)))) {
        return hdr;
      }
    }
    return '';
  };

  return {
    questionCol: findHdr(['question', 'প্রশ্ন', 'q', 'item', 'mcq']) || headers[0] || '',
    optionACol: findHdr(['option a', 'optiona', 'opt a', 'opta', 'ক', 'a']) || headers[1] || '',
    optionBCol: findHdr(['option b', 'optionb', 'opt b', 'optb', 'খ', 'b']) || headers[2] || '',
    optionCCol: findHdr(['option c', 'optionc', 'opt c', 'optc', 'গ', 'c']) || headers[3] || '',
    optionDCol: findHdr(['option d', 'optiond', 'opt d', 'optd', 'ঘ', 'd']) || headers[4] || '',
    answerCol: findHdr(['answer', 'correct', 'ans', 'উত্তর', 'সঠিক উত্তর', 'key']) || headers[5] || '',
    explanationCol: findHdr(['explanation', 'explain', 'ব্যাখ্যা', 'বিস্তারিত']) || undefined,
    subjectCol: findHdr(['subject', 'বিভাগ', 'বিষয়', 'topic']) || undefined,
  };
}
