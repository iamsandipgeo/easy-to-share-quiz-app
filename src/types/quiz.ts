export type ValidationCategory = 'ready' | 'needs_review' | 'invalid';

export interface ValidationIssue {
  field: 'question' | 'options' | 'correctOption' | 'explanation' | 'general';
  severity: 'error' | 'warning';
  messageEn: string;
  messageBn: string;
}

export interface QuestionItem {
  id: string;
  questionNumber?: number;
  question: string;
  options: string[];
  correctOptionIndex: number; // 0-based
  explanation?: string;
  subject?: string;
  topic?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  language?: 'bn' | 'en' | 'mixed';
  sourceFile?: string;
  pageNumber?: number;
  status: ValidationCategory;
  issues: ValidationIssue[];
  rawText?: string;
}

export type DestinationPlatform = 'telegram' | 'whatsapp';

export interface TelegramDestination {
  id: string;
  platform?: DestinationPlatform; // 'telegram' or 'whatsapp'
  name: string;
  chatId: string; // Telegram: "-100..." or "@chan", WhatsApp: Phone number / Group JID / Invite link
  type: 'channel' | 'group' | 'supergroup' | 'whatsapp_group' | 'whatsapp_channel';
  status: 'active' | 'disabled';
  lastTested?: string;
  lastTestSuccess?: boolean;
  lastTestMessage?: string;
  botPermissions?: {
    canPostMessages?: boolean;
    isAdmin?: boolean;
    statusText?: string;
  };
}

export type JobStatus = 'idle' | 'queued' | 'publishing' | 'paused' | 'completed' | 'cancelled' | 'failed';

export type ItemDeliveryStatus = 'pending' | 'success' | 'failed' | 'uncertain';

export interface JobItemRecord {
  id: string;
  platform?: DestinationPlatform;
  questionId: string;
  questionText: string;
  destinationId: string;
  destinationName: string;
  destinationChatId: string;
  status: ItemDeliveryStatus;
  telegramMessageId?: number;
  whatsAppMessageId?: string;
  pollId?: string;
  error?: string;
  retryCount: number;
  sentAt?: string;
}

export interface PublishingJob {
  id: string;
  name: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  status: JobStatus;
  totalQuestions: number;
  destinations: { id: string; name: string; chatId: string; platform?: DestinationPlatform }[];
  delaySeconds: number;
  pauseBetweenDestinationsSeconds?: number;
  stopOnFailure: boolean;
  maxRetries: number;
  successCount: number;
  failedCount: number;
  uncertainCount: number;
  pendingCount: number;
  currentIndex: number;
  currentDestinationName?: string;
  currentQuestionSnippet?: string;
  errorMessage?: string;
  items: JobItemRecord[];
}

export interface QuestionBankSet {
  id: string;
  title: string;
  description?: string;
  subject?: string;
  topic?: string;
  createdAt: string;
  updatedAt: string;
  questionsCount: number;
  questions: QuestionItem[];
}

export interface AppConfig {
  hasBotToken: boolean;
  botUsername?: string;
  botFirstName?: string;
  hasWhatsAppConfig?: boolean;
  whatsAppPhoneNumberId?: string;
  defaultDelaySeconds: number;
  language: 'en' | 'bn';
  protectContentDefault: boolean;
  isAnonymousDefault: boolean;
}
