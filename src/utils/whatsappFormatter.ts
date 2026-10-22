import { QuestionItem } from '../types/quiz';
import { getOptionLabel } from './bengaliUtils';

/**
 * Formats a single MCQ into a high-engagement WhatsApp message card.
 * Uses WhatsApp Markdown: *bold*, _italics_, ~strikethrough~, ```code```.
 */
export function formatQuestionForWhatsApp(
  q: QuestionItem,
  options?: {
    includeAnswerWithSpoiler?: boolean;
    includeExplanation?: boolean;
    quizNumberPrefix?: boolean;
  }
): string {
  const isBengali = q.language === 'bn';
  const prefix = options?.quizNumberPrefix && q.questionNumber ? `*প্রশ্ন #${q.questionNumber}*` : '*🎯 DAILY QUIZ POLL*';

  let text = `${prefix}\n\n`;
  text += `*${q.question.trim()}*\n\n`;

  // Options with emojis
  const optionLetters = ['🇦', '🇧', '🇨', '🇩', '🇪', '🇫', '🇬', '🇭', '🇮', '🇯'];
  q.options.forEach((opt, idx) => {
    const letter = getOptionLabel(idx, isBengali);
    const emoji = idx < optionLetters.length ? optionLetters[idx] : `(${letter})`;
    text += `${emoji} *${letter})* ${opt.trim()}\n`;
  });

  // Correct answer with WhatsApp spoiler spacing
  if (options?.includeAnswerWithSpoiler !== false) {
    const correctLetter = getOptionLabel(q.correctOptionIndex, isBengali);
    const correctText = q.options[q.correctOptionIndex] || '';

    text += `\n━━━━━━━━━━━━━━━\n`;
    text += `🔍 *সঠিক উত্তর দেখতে নিচে স্ক্রোল করুন:*\n`;
    text += `\n\n\n\n\n`; // Spacing acting as visual spoiler on WhatsApp
    text += `✅ *সঠিক উত্তর:* *${correctLetter}) ${correctText}*\n`;
  }

  // Explanation
  if (options?.includeExplanation !== false && q.explanation) {
    text += `💡 *ব্যাখ্যা:* _${q.explanation.trim()}_\n`;
  }

  text += `━━━━━━━━━━━━━━━\n`;
  text += `📢 *আমাদের হোয়াটসঅ্যাপ চ্যানেলে যুক্ত থাকুন!*`;

  return text;
}

/**
 * Generate a 1-click WhatsApp web/mobile sharing URL
 */
export function createWhatsAppShareUrl(text: string, phoneOrChat?: string): string {
  const encodedText = encodeURIComponent(text);
  if (phoneOrChat && /^\+?[0-9]{8,15}$/.test(phoneOrChat.replace(/[^0-9+]/g, ''))) {
    const cleanPhone = phoneOrChat.replace(/[^0-9]/g, '');
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Format WhatsApp Cloud API Poll payload
 */
export function createWhatsAppCloudPollPayload(to: string, q: QuestionItem): Record<string, any> {
  // WhatsApp Cloud API supports max 12 options and option name max 100 chars
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'poll',
    poll: {
      name: q.question.trim().slice(0, 300),
      options: q.options.slice(0, 10).map((opt, idx) => ({
        option_name: `${getOptionLabel(idx, q.language === 'bn')}) ${opt.trim()}`.slice(0, 100),
      })),
      selectable_options_count: 1,
    },
  };
}
