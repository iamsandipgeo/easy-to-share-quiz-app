/**
 * Automated test suite for Telegram Bulk Quiz Maker MCQ Parser & Validation Engine
 * Runs via tsx test/mcqParser.test.ts
 */

import { parseMCQText, validateQuestion } from '../src/utils/mcqParser';
import {
  bengaliToEnglishDigits,
  englishToBengaliDigits,
  parseOptionIdentifierToIndex,
  hasBengaliCharacters,
} from '../src/utils/bengaliUtils';
import {
  BENGALI_SAMPLE_MCQ,
  ENGLISH_SAMPLE_MCQ,
  SEPARATE_KEY_SAMPLE,
  generate100BenchmarkQuestions,
} from '../src/utils/sampleData';

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failCount++;
  }
}

console.log('\n=== RUNNING TELEGRAM BULK QUIZ MAKER TEST SUITE ===\n');

// TEST SUITE 1: Bengali Numeral & Digit Conversion
console.log('1. Bengali Numerals & Utility Tests:');
assert(bengaliToEnglishDigits('১২৩৪৫৬৭৮৯০') === '1234567890', 'Convert Bengali digits to English digits');
assert(englishToBengaliDigits(12345) === '১২৩৪৫', 'Convert English digits to Bengali digits');
assert(hasBengaliCharacters('সিন্ধু সভ্যতা'), 'Detect Bengali Unicode characters');
assert(!hasBengaliCharacters('Solar System'), 'Detect non-Bengali characters');
assert(parseOptionIdentifierToIndex('A') === 0, 'Map option "A" to index 0');
assert(parseOptionIdentifierToIndex('b') === 1, 'Map option "b" to index 1');
assert(parseOptionIdentifierToIndex('গ') === 2, 'Map Bengali option "গ" to index 2');
assert(parseOptionIdentifierToIndex('ঘ') === 3, 'Map Bengali option "ঘ" to index 3');
assert(parseOptionIdentifierToIndex('২') === 1, 'Map Bengali numeral "২" to index 1 (0-based)');

// TEST SUITE 2: Bengali Sample Question Set (20 MCQs)
console.log('\n2. Bengali Question Set Parsing (20 MCQs):');
const bengaliResult = parseMCQText(BENGALI_SAMPLE_MCQ);
assert(bengaliResult.questions.length === 20, `Parsed exactly 20 questions (got ${bengaliResult.questions.length})`);
assert(bengaliResult.stats.readyCount >= 18, `At least 18 questions are marked ready (got ${bengaliResult.stats.readyCount})`);

const q1 = bengaliResult.questions[0];
assert(q1.question.includes('সিন্ধু সভ্যতার'), 'Question 1 text matches');
assert(q1.options.length === 4, `Question 1 has 4 options (got ${q1.options.length})`);
assert(q1.options[1] === 'লোথাল', `Question 1 option B is 'লোথাল' (got '${q1.options[1]}')`);
assert(q1.correctOptionIndex === 1, `Question 1 correct option index is 1 (B) (got ${q1.correctOptionIndex})`);
assert(q1.explanation?.includes('লোথাল') || false, 'Question 1 explanation preserved');

const q2 = bengaliResult.questions[1];
assert(q2.options[1] === 'হিমোগ্লোবিন', `Question 2 option খ is 'হিমোগ্লোবিন'`);
assert(q2.correctOptionIndex === 1, `Question 2 correct option index is 1 (খ)`);

// TEST SUITE 3: English Question Set Parsing
console.log('\n3. English Question Set Parsing:');
const engResult = parseMCQText(ENGLISH_SAMPLE_MCQ);
assert(engResult.questions.length === 5, `Parsed 5 English questions (got ${engResult.questions.length})`);
assert(engResult.questions[0].correctOptionIndex === 1, 'Question 1 correct option is Mars (B = index 1)');
assert(engResult.questions[1].correctOptionIndex === 2, 'Question 2 correct option is Mitochondria (C = index 2)');
assert(engResult.questions[3].options.length === 4, 'Question 4 options count is 4');

// TEST SUITE 4: Separate Answer Key Detection
console.log('\n4. Separate Answer Key Block Parsing:');
const separateResult = parseMCQText(SEPARATE_KEY_SAMPLE);
assert(separateResult.questions.length === 5, `Parsed 5 questions with separate answer keys`);
assert(separateResult.separateAnswerKeysFound >= 5, `Found separate answer keys for all 5 questions`);
assert(separateResult.questions[0].correctOptionIndex === 0, 'Q1 mapped to Option A (index 0) from separate key');
assert(separateResult.questions[1].correctOptionIndex === 1, 'Q2 mapped to Option B (index 1) from separate key');
assert(separateResult.questions[3].correctOptionIndex === 2, 'Q4 mapped to Option C (index 2) from separate key');

// TEST SUITE 5: Wrapped Lines and Edge Cases
console.log('\n5. Wrapped Lines & Fault Tolerance:');
const wrappedInput = `1. Which of the following is a multi-line wrapped
question that continues onto the next line
before displaying options?
A) First line of option A
that wraps around here
B) Second option
C) Third option
D) Fourth option
Answer: A
`;
const wrappedResult = parseMCQText(wrappedInput);
assert(wrappedResult.questions.length === 1, 'Wrapped question parsed as 1 question');
assert(wrappedResult.questions[0].options[0].includes('that wraps around here'), 'Wrapped option text merged cleanly');
assert(wrappedResult.questions[0].correctOptionIndex === 0, 'Wrapped question answer resolved to 0');

// TEST SUITE 6: Quality & Validation Checks
console.log('\n6. Validation & Quality Limit Checks:');
// Missing option (<2)
const badOpts = validateQuestion({
  question: 'Valid question text?',
  options: ['Only one option'],
  correctOptionIndex: 0,
});
assert(badOpts.status === 'invalid', 'Flag question with <2 options as invalid');

// Missing answer
const noAns = validateQuestion({
  question: 'What is this?',
  options: ['A', 'B', 'C', 'D'],
  correctOptionIndex: -1,
});
assert(noAns.status === 'invalid', 'Flag question with missing answer as invalid');

// Telegram 300 char question limit
const longText = 'A'.repeat(305);
const overLimitQ = validateQuestion({
  question: longText,
  options: ['Opt 1', 'Opt 2'],
  correctOptionIndex: 0,
});
assert(overLimitQ.status === 'invalid', 'Flag question exceeding 300 characters as invalid');

// Telegram 100 char option limit
const longOpt = 'B'.repeat(105);
const overLimitOpt = validateQuestion({
  question: 'Sample question?',
  options: [longOpt, 'Normal opt'],
  correctOptionIndex: 0,
});
assert(overLimitOpt.status === 'invalid', 'Flag option exceeding 100 characters as invalid');

// TEST SUITE 7: 100-Question Bulk Parsing Benchmark
console.log('\n7. Bulk 100-Question Parsing Benchmark:');
const startT = Date.now();
const bulkBenchmarkText = generate100BenchmarkQuestions();
const bulkResult = parseMCQText(bulkBenchmarkText);
const elapsedMs = Date.now() - startT;

assert(bulkResult.questions.length === 100, `Parsed all 100 questions (got ${bulkResult.questions.length})`);
assert(bulkResult.stats.readyCount === 100, `All 100 questions are valid and ready (got ${bulkResult.stats.readyCount})`);
assert(elapsedMs < 1500, `Completed 100 MCQ parsing in ${elapsedMs}ms (< 1500ms)`);

// TEST SUITE 8: WhatsApp Formatting & Sharing Utilities
console.log('\n8. WhatsApp Formatter & Sharing Tests:');
import { formatQuestionForWhatsApp, createWhatsAppShareUrl, createWhatsAppCloudPollPayload } from '../src/utils/whatsappFormatter';

const sampleQ = bulkResult.questions[0];
const waCard = formatQuestionForWhatsApp(sampleQ);
assert(waCard.includes('*🎯 DAILY QUIZ POLL*') || waCard.includes('*প্রশ্ন'), 'WhatsApp card has bold quiz header');
assert(waCard.includes('🇦') || waCard.includes('🇧'), 'WhatsApp card includes option emojis');
assert(waCard.includes('✅ *সঠিক উত্তর:*'), 'WhatsApp card includes spoiler-protected answer');

const shareUrl = createWhatsAppShareUrl('Sample Quiz Text');
assert(shareUrl.startsWith('https://api.whatsapp.com/send?text='), 'Generates valid WhatsApp web/mobile share URL');

const directPhoneShareUrl = createWhatsAppShareUrl('Quiz', '+8801712345678');
assert(directPhoneShareUrl.includes('phone=8801712345678'), 'Targets specific phone number or chat recipient');

const cloudPoll = createWhatsAppCloudPollPayload('8801712345678', sampleQ);
assert(cloudPoll.type === 'poll', 'Creates native WhatsApp Cloud API poll payload');
assert(cloudPoll.poll.options.length === 4, 'WhatsApp Cloud API poll contains 4 options');

console.log(`\n========================================`);
console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
console.log(`========================================\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('All automated tests passed successfully!');
}
