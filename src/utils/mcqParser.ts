import { QuestionItem, ValidationCategory, ValidationIssue } from '../types/quiz';
import {
  bengaliToEnglishDigits,
  hasBengaliCharacters,
  parseOptionIdentifierToIndex,
  getOptionLabel,
} from './bengaliUtils';

// Regex patterns for Question start markers
const QUESTION_START_REGEX = /^(?:প্রশ্ন\s*(?:নং\s*)?([০-৯0-9]+)?[.:ঃ\-\)]\s*|question\s*([0-9]+)?[.:\-\)]\s*|q(?:uestion)?\.?\s*([0-9]+)[.:\-\)]\s*|\(?([০-৯0-9]+)\)?[.:\-]\s*|\(([০-৯0-9]+)\)\s*)/i;

// Regex patterns for Option markers
const OPTION_START_REGEX = /^(?:[\(\[]?([A-Ja-j]|[ক-ঞ]|[1-9]|10|[১-৯]|১০)[\)\]\.:\-]\s*)(.*)$/u;

// Regex patterns for inline Answer markers
const ANSWER_LINE_REGEX = /^(?:সঠিক\s*উত্তর\s*[:ঃ\-]|উত্তর\s*[:ঃ\-]|correct\s*answer\s*[:\-]|answer\s*[:\-]|ans\s*[:\-])\s*(.+)$/i;

// Regex patterns for Explanation markers
const EXPLANATION_LINE_REGEX = /^(?:ব্যাখ্যা\s*[:ঃ\-]|বিস্তারিত\s*[:ঃ\-]|explanation\s*[:\-]|explain\s*[:\-])\s*(.+)$/i;

// Regex for separate answer key section detection
const ANSWER_KEY_HEADER_REGEX = /^(?:answer\s*keys?|answers?|সঠিক\s*উত্তরমালা|উত্তরমালা|উত্তরসমূহ)\s*[:ঃ\-]?\s*$/i;

export interface ParserResult {
  questions: QuestionItem[];
  stats: {
    totalParsed: number;
    readyCount: number;
    needsReviewCount: number;
    invalidCount: number;
  };
  errors: { line: number; message: string; rawText: string }[];
  separateAnswerKeysFound: number;
}

/**
 * Deterministic line-by-line MCQ parser supporting Bengali & English formats
 */
export function parseMCQText(rawInput: string): ParserResult {
  const lines = rawInput.split(/\r?\n/);
  const errors: { line: number; message: string; rawText: string }[] = [];

  // Step 1: Detect if there is a separate answer key block at the bottom
  const { contentLines, separateAnswerMap } = extractSeparateAnswerKeys(lines);

  interface RawParsedQuestion {
    qNum?: number;
    qNumRaw?: string;
    questionLines: string[];
    options: { label: string; text: string }[];
    answerLine?: string;
    explanationLines: string[];
    rawLines: string[];
    lineStartIndex: number;
  }

  const rawQuestions: RawParsedQuestion[] = [];
  let currentQ: RawParsedQuestion | null = null;
  let activeSection: 'question' | 'option' | 'explanation' = 'question';

  for (let i = 0; i < contentLines.length; i++) {
    const originalLine = contentLines[i];
    const trimmed = originalLine.trim();

    if (!trimmed) {
      continue;
    }

    // Check if line starts a new question
    const qMatch = trimmed.match(QUESTION_START_REGEX);
    // Be careful not to confuse an option like "(1) option" if we are already inside a question with options
    const isExplicitQuestionKeyword = /^(?:প্রশ্ন|question|q\d|q\.)/i.test(trimmed);
    const hasQuestionMark = trimmed.includes('?') || trimmed.includes('？');

    const looksLikeQuestion = (qMatch && !currentQ) ||
      (qMatch && currentQ && (currentQ.options.length >= 2 || isExplicitQuestionKeyword || hasQuestionMark));

    if (looksLikeQuestion && qMatch) {
      if (currentQ) {
        rawQuestions.push(currentQ);
      }

      // Extract question number if present
      const numRaw = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || qMatch[5];
      let qNum: number | undefined;
      if (numRaw) {
        const engNum = parseInt(bengaliToEnglishDigits(numRaw), 10);
        if (!isNaN(engNum)) qNum = engNum;
      }

      // Remaining question text on this line
      const textAfterMarker = trimmed.substring(qMatch[0].length).trim();

      currentQ = {
        qNum,
        qNumRaw: numRaw,
        questionLines: textAfterMarker ? [textAfterMarker] : [],
        options: [],
        explanationLines: [],
        rawLines: [originalLine],
        lineStartIndex: i + 1,
      };
      activeSection = 'question';
      continue;
    }

    if (!currentQ) {
      // Not yet in a question, check if this line is a question without numbering
      if (trimmed.length > 5 && (trimmed.includes('?') || trimmed.includes('বলতে কি') || trimmed.endsWith(':'))) {
        currentQ = {
          questionLines: [trimmed],
          options: [],
          explanationLines: [],
          rawLines: [originalLine],
          lineStartIndex: i + 1,
        };
        activeSection = 'question';
        continue;
      } else {
        // Skip header lines or noise before first question
        continue;
      }
    }

    currentQ.rawLines.push(originalLine);

    // Check for inline answer line
    const ansMatch = trimmed.match(ANSWER_LINE_REGEX);
    if (ansMatch) {
      currentQ.answerLine = ansMatch[1].trim();
      continue;
    }

    // Check for explanation line
    const expMatch = trimmed.match(EXPLANATION_LINE_REGEX);
    if (expMatch) {
      currentQ.explanationLines.push(expMatch[1].trim());
      activeSection = 'explanation';
      continue;
    }

    // Check for option marker
    const optMatch = trimmed.match(OPTION_START_REGEX);
    if (optMatch && activeSection !== 'explanation') {
      const optLabel = optMatch[1].trim();
      const optText = optMatch[2].trim();
      currentQ.options.push({ label: optLabel, text: optText });
      activeSection = 'option';
      continue;
    }

    // Wrapped line handling
    if (activeSection === 'option' && currentQ.options.length > 0) {
      // Append to the last option if not an explanation
      const lastOpt = currentQ.options[currentQ.options.length - 1];
      lastOpt.text = (lastOpt.text + ' ' + trimmed).trim();
    } else if (activeSection === 'explanation') {
      currentQ.explanationLines.push(trimmed);
    } else {
      // Still in question text
      currentQ.questionLines.push(trimmed);
    }
  }

  if (currentQ) {
    rawQuestions.push(currentQ);
  }

  // Step 2: Convert to QuestionItem and resolve correct answer + validation
  const questionItems: QuestionItem[] = [];
  const seenQuestionTexts = new Map<string, number>();

  rawQuestions.forEach((raw, idx) => {
    const questionText = raw.questionLines.join(' ').replace(/\s+/g, ' ').trim();
    const optionsText = raw.options.map(o => o.text.replace(/\s+/g, ' ').trim());
    const explanation = raw.explanationLines.join(' ').replace(/\s+/g, ' ').trim();

    // Determine correct option index
    let correctOptionIndex = -1;
    let answerFoundFrom: 'inline' | 'separate_key' | 'option_text_match' | 'none' = 'none';

    // 1. Try inline answer line if available
    if (raw.answerLine) {
      const idxFromMarker = parseOptionIdentifierToIndex(raw.answerLine);
      if (idxFromMarker !== -1 && idxFromMarker < optionsText.length) {
        correctOptionIndex = idxFromMarker;
        answerFoundFrom = 'inline';
      } else {
        // Match by exact option text
        const matchIdx = optionsText.findIndex(
          opt => opt.toLowerCase() === raw.answerLine!.toLowerCase()
        );
        if (matchIdx !== -1) {
          correctOptionIndex = matchIdx;
          answerFoundFrom = 'option_text_match';
        }
      }
    }

    // 2. Try separate answer key map (by question number or sequence index 1-based)
    if (correctOptionIndex === -1 && separateAnswerMap.size > 0) {
      const qLookupKey = raw.qNum !== undefined ? raw.qNum : (idx + 1);
      const answerVal = separateAnswerMap.get(qLookupKey);
      if (answerVal) {
        const idxFromMarker = parseOptionIdentifierToIndex(answerVal);
        if (idxFromMarker !== -1 && idxFromMarker < optionsText.length) {
          correctOptionIndex = idxFromMarker;
          answerFoundFrom = 'separate_key';
        }
      }
    }

    // Language detection
    const fullTextSample = questionText + ' ' + optionsText.join(' ');
    const isBengali = hasBengaliCharacters(fullTextSample);
    const language: 'bn' | 'en' | 'mixed' = isBengali ? 'bn' : 'en';

    // Validation issues collection
    const issues: ValidationIssue[] = [];

    // Telegram question length: 1 to 300 characters
    if (!questionText) {
      issues.push({
        field: 'question',
        severity: 'error',
        messageEn: 'Question text is empty.',
        messageBn: 'প্রশ্নের মূল লেখা খালি রয়েছে।',
      });
    } else if (questionText.length > 300) {
      issues.push({
        field: 'question',
        severity: 'error',
        messageEn: `Question text is ${questionText.length} characters (Telegram maximum is 300).`,
        messageBn: `প্রশ্নের দৈর্ঘ্য ${questionText.length} অক্ষর (টেলিগ্রামের সর্বোচ্চ সীমা ৩০০ অক্ষর)।`,
      });
    }

    // Telegram options count: between 2 and 10
    if (optionsText.length < 2) {
      issues.push({
        field: 'options',
        severity: 'error',
        messageEn: `Found only ${optionsText.length} option(s). Telegram Quiz requires at least 2 options.`,
        messageBn: `মাত্র ${optionsText.length} টি অপশন পাওয়া গেছে। কুইজের জন্য কমপক্ষে ২টি অপশন প্রয়োজন।`,
      });
    } else if (optionsText.length > 10) {
      issues.push({
        field: 'options',
        severity: 'error',
        messageEn: `Found ${optionsText.length} options (Telegram allows maximum 10 options).`,
        messageBn: `${optionsText.length} টি অপশন রয়েছে (টেলিগ্রাম সর্বোচ্চ ১০টি অপশন সমর্থন করে)।`,
      });
    }

    // Check individual option length (Telegram limit: 1-100 chars)
    optionsText.forEach((opt, optI) => {
      if (!opt) {
        issues.push({
          field: 'options',
          severity: 'error',
          messageEn: `Option ${getOptionLabel(optI, isBengali)} is blank.`,
          messageBn: `অপশন ${getOptionLabel(optI, isBengali)} খালি।`,
        });
      } else if (opt.length > 100) {
        issues.push({
          field: 'options',
          severity: 'error',
          messageEn: `Option ${getOptionLabel(optI, isBengali)} is ${opt.length} characters (Telegram maximum is 100).`,
          messageBn: `অপশন ${getOptionLabel(optI, isBengali)} এর দৈর্ঘ্য ${opt.length} অক্ষর (টেলিগ্রাম সর্বোচ্চ ১০০ অক্ষর)।`,
        });
      }
    });

    // Check duplicate options
    const uniqueOptions = new Set(optionsText.map(o => o.toLowerCase().trim()));
    if (optionsText.length > 0 && uniqueOptions.size < optionsText.length) {
      issues.push({
        field: 'options',
        severity: 'warning',
        messageEn: 'Duplicate options detected in this question.',
        messageBn: 'প্রশ্নে একই অপশন একাধিকবার রয়েছে।',
      });
    }

    // Check correct answer
    if (correctOptionIndex === -1) {
      issues.push({
        field: 'correctOption',
        severity: 'error',
        messageEn: 'Correct answer is missing or not recognized.',
        messageBn: 'সঠিক উত্তর পাওয়া যায়নি বা চিহ্নিত করা যায়নি।',
      });
    } else if (correctOptionIndex >= optionsText.length) {
      issues.push({
        field: 'correctOption',
        severity: 'error',
        messageEn: `Answer index (${correctOptionIndex + 1}) exceeds available options count (${optionsText.length}).`,
        messageBn: `চিহ্নিত উত্তর অপশনের সীমার বাইরে।`,
      });
    }

    // Telegram explanation limit: max 200 characters
    if (explanation && explanation.length > 200) {
      issues.push({
        field: 'explanation',
        severity: 'warning',
        messageEn: `Explanation is ${explanation.length} characters (Telegram maximum is 200 chars).`,
        messageBn: `ব্যাখ্যার দৈর্ঘ্য ${explanation.length} অক্ষর (টেলিগ্রাম সর্বোচ্চ ২০০ অক্ষর)।`,
      });
    }

    // Duplicate question text detection across questions
    const normQ = questionText.toLowerCase();
    if (seenQuestionTexts.has(normQ)) {
      issues.push({
        field: 'question',
        severity: 'warning',
        messageEn: 'This question appears more than once in the dataset.',
        messageBn: 'এই প্রশ্নটি সেটে একাধিকবার রয়েছে।',
      });
    } else {
      seenQuestionTexts.set(normQ, (raw.qNum || idx + 1));
    }

    // Determine status: ready, needs_review, or invalid
    let status: ValidationCategory = 'ready';
    const hasError = issues.some(iss => iss.severity === 'error');
    const hasWarning = issues.some(iss => iss.severity === 'warning');

    if (hasError) {
      status = 'invalid';
    } else if (hasWarning || answerFoundFrom === 'option_text_match') {
      status = 'needs_review';
    }

    const item: QuestionItem = {
      id: `q_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      questionNumber: raw.qNum || (idx + 1),
      question: questionText,
      options: optionsText,
      correctOptionIndex,
      explanation: explanation || undefined,
      language,
      status,
      issues,
      rawText: raw.rawLines.join('\n'),
    };

    questionItems.push(item);
  });

  const readyCount = questionItems.filter(q => q.status === 'ready').length;
  const needsReviewCount = questionItems.filter(q => q.status === 'needs_review').length;
  const invalidCount = questionItems.filter(q => q.status === 'invalid').length;

  return {
    questions: questionItems,
    stats: {
      totalParsed: questionItems.length,
      readyCount,
      needsReviewCount,
      invalidCount,
    },
    errors,
    separateAnswerKeysFound: separateAnswerMap.size,
  };
}

/**
 * Detect separate answer keys at the end of the text
 * e.g. "Answer Key:\n1-B, 2-C, 3-A" or "1. B 2. C" or "১-খ, ২-গ"
 */
function extractSeparateAnswerKeys(lines: string[]): {
  contentLines: string[];
  separateAnswerMap: Map<number, string>;
} {
  const separateAnswerMap = new Map<number, string>();
  let headerIndex = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (ANSWER_KEY_HEADER_REGEX.test(trimmed)) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex !== -1) {
    const answerBlock = lines.slice(headerIndex + 1).join(' ');
    // Match patterns like "1-B", "1. C", "১-খ", "1: A", "Q1-B", "(1) C"
    const pairRegex = /(?:Q|প্রশ্ন\s*)?([০-৯0-9]+)\s*[\-.:]\s*([A-Ja-j]|[ক-ঞ])/gu;
    let match;
    while ((match = pairRegex.exec(answerBlock)) !== null) {
      const qNum = parseInt(bengaliToEnglishDigits(match[1]), 10);
      const ansChar = match[2];
      if (!isNaN(qNum)) {
        separateAnswerMap.set(qNum, ansChar);
      }
    }

    return {
      contentLines: lines.slice(0, headerIndex),
      separateAnswerMap,
    };
  }

  return {
    contentLines: lines,
    separateAnswerMap,
  };
}

/**
 * Re-validate a question after user manual edit in the UI
 */
export function validateQuestion(q: Partial<QuestionItem>): {
  status: ValidationCategory;
  issues: ValidationIssue[];
} {
  const issues: ValidationIssue[] = [];
  const questionText = (q.question || '').trim();
  const options = q.options || [];
  const explanation = (q.explanation || '').trim();
  const isBengali = hasBengaliCharacters(questionText + ' ' + options.join(' '));

  if (!questionText) {
    issues.push({
      field: 'question',
      severity: 'error',
      messageEn: 'Question text cannot be empty.',
      messageBn: 'প্রশ্নের মূল লেখা খালি রাখা যাবে না।',
    });
  } else if (questionText.length > 300) {
    issues.push({
      field: 'question',
      severity: 'error',
      messageEn: `Question exceeds Telegram 300-character limit (${questionText.length} chars).`,
      messageBn: `প্রশ্নের দৈর্ঘ্য টেলিগ্রামের ৩০০ অক্ষরের সীমা অতিক্রম করেছে (${questionText.length} অক্ষর)।`,
    });
  }

  if (options.length < 2) {
    issues.push({
      field: 'options',
      severity: 'error',
      messageEn: `Quiz requires at least 2 options (has ${options.length}).`,
      messageBn: `কুইজের জন্য কমপক্ষে ২টি অপশন প্রয়োজন (রয়েছে ${options.length}টি)।`,
    });
  } else if (options.length > 10) {
    issues.push({
      field: 'options',
      severity: 'error',
      messageEn: `Telegram allows maximum 10 options (has ${options.length}).`,
      messageBn: `টেলিগ্রাম সর্বোচ্চ ১০টি অপশন সমর্থন করে (রয়েছে ${options.length}টি)।`,
    });
  }

  options.forEach((opt, idx) => {
    const trimmed = (opt || '').trim();
    if (!trimmed) {
      issues.push({
        field: 'options',
        severity: 'error',
        messageEn: `Option ${getOptionLabel(idx, isBengali)} cannot be empty.`,
        messageBn: `অপশন ${getOptionLabel(idx, isBengali)} খালি রাখা যাবে না।`,
      });
    } else if (trimmed.length > 100) {
      issues.push({
        field: 'options',
        severity: 'error',
        messageEn: `Option ${getOptionLabel(idx, isBengali)} exceeds 100-character limit (${trimmed.length} chars).`,
        messageBn: `অপশন ${getOptionLabel(idx, isBengali)} ১০০ অক্ষরের সীমা অতিক্রম করেছে (${trimmed.length} অক্ষর)।`,
      });
    }
  });

  const unique = new Set(options.map(o => (o || '').trim().toLowerCase()));
  if (options.length > 0 && unique.size < options.length) {
    issues.push({
      field: 'options',
      severity: 'warning',
      messageEn: 'Duplicate options detected.',
      messageBn: 'প্রশ্নে ডুপ্লিকেট অপশন রয়েছে।',
    });
  }

  if (q.correctOptionIndex === undefined || q.correctOptionIndex < 0) {
    issues.push({
      field: 'correctOption',
      severity: 'error',
      messageEn: 'Please select a correct option.',
      messageBn: 'দয়া করে একটি সঠিক উত্তর নির্বাচন করুন।',
    });
  } else if (q.correctOptionIndex >= options.length) {
    issues.push({
      field: 'correctOption',
      severity: 'error',
      messageEn: 'Selected correct option is out of bounds.',
      messageBn: 'নির্বাচিত উত্তরটি অপশনের সীমার বাইরে।',
    });
  }

  if (explanation && explanation.length > 200) {
    issues.push({
      field: 'explanation',
      severity: 'warning',
      messageEn: `Explanation exceeds 200-character limit (${explanation.length} chars).`,
      messageBn: `ব্যাখ্যার দৈর্ঘ্য ২০০ অক্ষরের সীমা অতিক্রম করেছে (${explanation.length} অক্ষর)।`,
    });
  }

  let status: ValidationCategory = 'ready';
  if (issues.some(i => i.severity === 'error')) {
    status = 'invalid';
  } else if (issues.some(i => i.severity === 'warning')) {
    status = 'needs_review';
  }

  return { status, issues };
}
