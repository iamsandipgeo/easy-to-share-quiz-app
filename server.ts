import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { parseMCQText, validateQuestion } from './src/utils/mcqParser';
import { readWorkbookSheets, guessColumnMapping, convertMappedRowsToQuestions } from './src/utils/fileExtractors';
import { formatQuestionForWhatsApp, createWhatsAppCloudPollPayload } from './src/utils/whatsappFormatter';
import { getOptionLabel } from './src/utils/bengaliUtils';
import {
  TelegramDestination,
  PublishingJob,
  JobItemRecord,
  QuestionBankSet,
  QuestionItem,
  AppConfig,
} from './src/types/quiz';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'storage.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default storage state
interface DBState {
  settings: {
    botToken: string;
    whatsAppAccessToken?: string;
    whatsAppPhoneNumberId?: string;
    defaultDelaySeconds: number;
    language: 'en' | 'bn';
    protectContentDefault: boolean;
    isAnonymousDefault: boolean;
  };
  destinations: TelegramDestination[];
  questionBanks: QuestionBankSet[];
  jobs: PublishingJob[];
}

function loadDB(): DBState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading storage.json, initializing fresh database:', err);
  }

  const initial: DBState = {
    settings: {
      botToken: process.env.TELEGRAM_BOT_TOKEN || '',
      whatsAppAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
      whatsAppPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
      defaultDelaySeconds: 3,
      language: 'bn',
      protectContentDefault: false,
      isAnonymousDefault: true,
    },
    destinations: [],
    questionBanks: [],
    jobs: [],
  };

  saveDB(initial);
  return initial;
}

function saveDB(data: DBState): void {
  try {
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error writing storage.json:', err);
  }
}

let db = loadDB();

// File upload configuration with Multer (memory storage, max 15MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedExts = ['.txt', '.csv', '.xlsx', '.xls', '.docx', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported types: TXT, CSV, XLSX, XLS, DOCX, PDF.`));
    }
  },
});

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Helper to get active bot token (from DB or process.env)
function getActiveBotToken(): string {
  return db.settings.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
}

// ----------------------------------------------------
// TELEGRAM BOT API CALL HELPER
// ----------------------------------------------------
async function callTelegramApi(method: string, payload: Record<string, any>, tokenOverride?: string): Promise<any> {
  const token = tokenOverride || getActiveBotToken();
  if (!token) {
    throw new Error('Telegram Bot Token is not configured. Please set up your bot in Settings or configure TELEGRAM_BOT_TOKEN.');
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || !data.ok) {
      const errorMsg = data.description || `Telegram API error: ${response.statusText} (${response.status})`;
      const errorObj: any = new Error(errorMsg);
      errorObj.statusCode = response.status;
      errorObj.parameters = data.parameters;
      throw errorObj;
    }

    return data.result;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error('Telegram request timed out after 20 seconds');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

// ----------------------------------------------------
// WHATSAPP CLOUD API CALL HELPER
// ----------------------------------------------------
function getActiveWhatsAppConfig() {
  return {
    accessToken: db.settings.whatsAppAccessToken || process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: db.settings.whatsAppPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '',
  };
}

async function callWhatsAppApi(
  endpoint: string,
  payload: Record<string, any>,
  tokenOverride?: string,
  phoneIdOverride?: string
): Promise<any> {
  const { accessToken: defaultToken, phoneNumberId: defaultPhoneId } = getActiveWhatsAppConfig();
  const token = tokenOverride || defaultToken;
  const phoneId = phoneIdOverride || defaultPhoneId;

  if (!token || !phoneId) {
    throw new Error('WhatsApp Cloud API is not configured. Please set your Access Token and Phone Number ID in Settings.');
  }

  const url = `https://graph.facebook.com/v21.0/${phoneId}/${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || `WhatsApp API error: ${response.statusText} (${response.status})`;
      const errorObj: any = new Error(errorMsg);
      errorObj.statusCode = response.status;
      errorObj.fbtrace_id = data.error?.fbtrace_id;
      throw errorObj;
    }

    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutErr: any = new Error('WhatsApp request timed out after 20 seconds');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  }
}

// ----------------------------------------------------
// JOB QUEUE WORKER
// ----------------------------------------------------
class PublishingQueueWorker {
  private isProcessing = false;
  private currentJobId: string | null = null;
  private shouldPause = false;
  private shouldCancel = false;

  public async startJob(jobId: string) {
    this.currentJobId = jobId;
    this.shouldPause = false;
    this.shouldCancel = false;

    if (this.isProcessing) return;
    this.processQueue();
  }

  public pauseJob(jobId: string) {
    if (this.currentJobId === jobId) {
      this.shouldPause = true;
    }
  }

  public resumeJob(jobId: string) {
    if (this.currentJobId === jobId) {
      this.shouldPause = false;
      this.processQueue();
    }
  }

  public cancelJob(jobId: string) {
    if (this.currentJobId === jobId) {
      this.shouldCancel = true;
    }
  }

  private async processQueue() {
    if (this.isProcessing || !this.currentJobId) return;
    this.isProcessing = true;

    try {
      db = loadDB();
      const job = db.jobs.find(j => j.id === this.currentJobId);
      if (!job) {
        this.isProcessing = false;
        return;
      }

      job.status = 'publishing';
      if (!job.startedAt) job.startedAt = new Date().toISOString();
      saveDB(db);

      const botToken = getActiveBotToken();
      if (!botToken) {
        job.status = 'failed';
        job.errorMessage = 'Bot token is missing';
        saveDB(db);
        this.isProcessing = false;
        return;
      }

      // Process pending items
      for (let i = 0; i < job.items.length; i++) {
        const item = job.items[i];

        if (this.shouldCancel) {
          job.status = 'cancelled';
          saveDB(db);
          break;
        }

        if (this.shouldPause) {
          job.status = 'paused';
          saveDB(db);
          break;
        }

        if (item.status === 'success') {
          continue; // Already successfully delivered
        }

        job.currentIndex = i + 1;
        job.currentDestinationName = item.destinationName;
        job.currentQuestionSnippet = item.questionText.slice(0, 50);

        // Fetch question details from the bank or job metadata
        const questionObj = (job as any).questionsPayload?.find((q: QuestionItem) => q.id === item.questionId);
        if (!questionObj) {
          item.status = 'failed';
          item.error = 'Question content not found in job package';
          job.failedCount++;
          job.pendingCount--;
          saveDB(db);
          continue;
        }

        let sentSuccess = false;
        let attempt = 0;
        const maxAttempts = job.maxRetries || 2;

        while (attempt <= maxAttempts && !sentSuccess) {
          attempt++;
          item.retryCount = attempt - 1;

          try {
            const isWhatsApp = item.platform === 'whatsapp' ||
              item.destinationChatId.startsWith('wa:') ||
              item.destinationChatId.includes('@g.us');

            if (isWhatsApp) {
              const cleanTo = item.destinationChatId.replace(/^wa:/, '').trim();
              const waConfig = getActiveWhatsAppConfig();

              if (waConfig.accessToken && waConfig.phoneNumberId) {
                try {
                  // Try sending WhatsApp native poll
                  const pollPayload = createWhatsAppCloudPollPayload(cleanTo, questionObj);
                  const waRes = await callWhatsAppApi('messages', pollPayload);
                  item.status = 'success';
                  item.whatsAppMessageId = waRes.messages?.[0]?.id;
                  item.sentAt = new Date().toISOString();
                  item.error = undefined;
                  job.successCount++;
                  job.pendingCount--;
                  sentSuccess = true;
                  saveDB(db);
                } catch (pollErr: any) {
                  // Fallback: send as WhatsApp formatted markdown card with spoiler
                  const textCard = formatQuestionForWhatsApp(questionObj);
                  const textPayload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanTo,
                    type: 'text',
                    text: { body: textCard },
                  };
                  const textRes = await callWhatsAppApi('messages', textPayload);
                  item.status = 'success';
                  item.whatsAppMessageId = textRes.messages?.[0]?.id;
                  item.sentAt = new Date().toISOString();
                  item.error = undefined;
                  job.successCount++;
                  job.pendingCount--;
                  sentSuccess = true;
                  saveDB(db);
                }
              } else {
                // Configured for 1-click WhatsApp share / zero-cost record
                item.status = 'success';
                item.whatsAppMessageId = `wa_shared_${Date.now()}`;
                item.sentAt = new Date().toISOString();
                item.error = undefined;
                job.successCount++;
                job.pendingCount--;
                sentSuccess = true;
                saveDB(db);
              }
            } else {
              // Telegram sendPoll requires:
              // chat_id, question (1-300), options (array of strings), correct_option_id, type="quiz"
              const pollPayload: Record<string, any> = {
                chat_id: item.destinationChatId,
                question: questionObj.question.trim().slice(0, 300),
                options: questionObj.options.map((o: string) => o.trim().slice(0, 100)),
                type: 'quiz',
                correct_option_id: questionObj.correctOptionIndex,
                is_anonymous: db.settings.isAnonymousDefault ?? true,
              };

              if (questionObj.explanation) {
                pollPayload.explanation = questionObj.explanation.trim().slice(0, 200);
              }

              if (db.settings.protectContentDefault) {
                pollPayload.protect_content = true;
              }

              const res = await callTelegramApi('sendPoll', pollPayload, botToken);
              item.status = 'success';
              item.telegramMessageId = res.message_id;
              item.pollId = res.poll?.id;
              item.sentAt = new Date().toISOString();
              item.error = undefined;
              job.successCount++;
              job.pendingCount--;
              sentSuccess = true;
              saveDB(db);
            }
          } catch (err: any) {
            console.error(`Error sending poll for item ${item.id} (attempt ${attempt}):`, err.message);

            if (err.isTimeout) {
              // Request timed out after Telegram might have accepted it!
              // Flag as uncertain to prevent duplicate send
              item.status = 'uncertain';
              item.error = 'Request timed out waiting for Telegram response. Delivery status uncertain.';
              job.uncertainCount++;
              job.pendingCount--;
              saveDB(db);
              break;
            }

            // Check for Rate Limit 429
            if (err.statusCode === 429 && err.parameters?.retry_after) {
              const waitSec = err.parameters.retry_after;
              console.log(`Telegram Rate Limited. Waiting ${waitSec}s as instructed by Telegram...`);
              await new Promise(r => setTimeout(r, (waitSec + 1) * 1000));
              continue; // Retry after waiting
            }

            if (attempt > maxAttempts) {
              item.status = 'failed';
              item.error = err.message || 'Delivery failed';
              job.failedCount++;
              job.pendingCount--;
              saveDB(db);

              if (job.stopOnFailure) {
                job.status = 'failed';
                job.errorMessage = `Job stopped after failure at question ${i + 1}: ${err.message}`;
                saveDB(db);
                this.isProcessing = false;
                return;
              }
            } else {
              // Wait 1.5s before retry
              await new Promise(r => setTimeout(r, 1500));
            }
          }
        }

        // Delay between polls
        const delayMs = Math.max(1, job.delaySeconds || 3) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Check final job status
      if (!this.shouldPause && !this.shouldCancel && job.status === 'publishing') {
        job.completedAt = new Date().toISOString();
        if (job.failedCount === 0 && job.uncertainCount === 0) {
          job.status = 'completed';
        } else if (job.successCount > 0) {
          job.status = 'completed'; // partial success
        } else {
          job.status = 'failed';
        }
        saveDB(db);
      }
    } catch (err: any) {
      console.error('Fatal queue worker error:', err);
      if (this.currentJobId) {
        const j = db.jobs.find(x => x.id === this.currentJobId);
        if (j) {
          j.status = 'failed';
          j.errorMessage = err.message;
          saveDB(db);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
}

const queueWorker = new PublishingQueueWorker();

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// 1. Text Parse API
app.post('/api/import/parse', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text content is required' });
      return;
    }
    const result = parseMCQText(text);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to parse text' });
  }
});

// 2. File Import API (TXT, CSV, XLSX, DOCX, PDF)
app.post('/api/import/file', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const filename = file.originalname;
    const ext = path.extname(filename).toLowerCase();
    const buffer = file.buffer;

    // A. Plain Text (.txt)
    if (ext === '.txt') {
      const textContent = buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const parsed = parseMCQText(textContent);
      parsed.questions.forEach(q => (q.sourceFile = filename));
      res.json({
        fileType: 'txt',
        filename,
        size: file.size,
        result: parsed,
      });
      return;
    }

    // B. Word Document (.docx)
    if (ext === '.docx') {
      const docxResult = await mammoth.extractRawText({ buffer });
      const rawText = docxResult.value || '';
      if (!rawText.trim()) {
        res.status(400).json({
          error: 'Could not extract text from DOCX file. File might be blank or corrupted.',
          filename,
        });
        return;
      }
      const parsed = parseMCQText(rawText);
      parsed.questions.forEach(q => (q.sourceFile = filename));
      res.json({
        fileType: 'docx',
        filename,
        size: file.size,
        result: parsed,
        warnings: docxResult.messages,
      });
      return;
    }

    // C. PDF Document (.pdf)
    if (ext === '.pdf') {
      try {
        // Dynamic import to handle potential ESM/CJS differences
        const pdfModule = await import('pdf-parse');
        const pdfParseFunc = (pdfModule as any).default || pdfModule;
        const pdfData = await pdfParseFunc(buffer);
        const extractedText = (pdfData.text || '').trim();

        if (extractedText.length < 30) {
          res.json({
            fileType: 'pdf',
            filename,
            size: file.size,
            isScannedPdf: true,
            warning: 'Scanned PDF detected. The document contains photographic scans without an embedded digital text layer. OCR extraction is recommended.',
            result: {
              questions: [],
              stats: { totalParsed: 0, readyCount: 0, needsReviewCount: 0, invalidCount: 0 },
              errors: [{ line: 1, message: 'Scanned document without digital text layer', rawText: '' }],
              separateAnswerKeysFound: 0,
            },
          });
          return;
        }

        const parsed = parseMCQText(extractedText);
        parsed.questions.forEach(q => (q.sourceFile = filename));
        res.json({
          fileType: 'pdf',
          filename,
          size: file.size,
          pages: pdfData.numpages,
          result: parsed,
        });
        return;
      } catch (pdfErr: any) {
        res.status(500).json({
          error: `PDF extraction error: ${pdfErr.message}. Ensure the file is not password-protected.`,
          filename,
        });
        return;
      }
    }

    // D. Excel (.xlsx, .xls) and CSV (.csv)
    if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const spreadsheetData = readWorkbookSheets(buffer);
      const suggestedMapping = guessColumnMapping(spreadsheetData.headers);

      res.json({
        fileType: ext.slice(1),
        filename,
        size: file.size,
        sheetNames: spreadsheetData.sheetNames,
        activeSheet: spreadsheetData.activeSheet,
        headers: spreadsheetData.headers,
        previewRows: spreadsheetData.rows.slice(0, 10),
        totalRows: spreadsheetData.totalRows,
        suggestedMapping,
      });
      return;
    }

    res.status(400).json({ error: `Unsupported format: ${ext}` });
  } catch (err: any) {
    console.error('File import error:', err);
    res.status(500).json({ error: err.message || 'File upload and processing failed' });
  }
});

// 3. Process Spreadsheet with Custom Mapping
app.post('/api/import/spreadsheet-map', upload.single('file'), (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'Spreadsheet file is required' });
      return;
    }

    const mapping = JSON.parse(req.body.mapping || '{}');
    const sheetName = req.body.sheetName;

    const workbook = XLSX.read(file.buffer, { type: 'array' });
    const targetSheet = sheetName && workbook.Sheets[sheetName] ? workbook.Sheets[sheetName] : workbook.Sheets[workbook.SheetNames[0]];

    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(targetSheet, {
      defval: '',
      blankrows: false,
    });

    const parsed = convertMappedRowsToQuestions(rawRows, mapping, file.originalname);
    res.json({ result: parsed, totalRows: rawRows.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to process spreadsheet mapping' });
  }
});

// 4. Telegram Bot API: Test Token
app.post('/api/telegram/test-bot', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const tokenToTest = token || getActiveBotToken();
    if (!tokenToTest) {
      res.status(400).json({ error: 'Please enter a Telegram Bot Token.' });
      return;
    }

    const info = await callTelegramApi('getMe', {}, tokenToTest);
    res.json({
      success: true,
      bot: {
        id: info.id,
        firstName: info.first_name,
        username: info.username,
        canJoinGroups: info.can_join_groups,
        canReadAllGroupMessages: info.can_read_all_group_messages,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to connect to Telegram bot',
    });
  }
});

// 5. Telegram Bot API: Test Destination & Check Permissions
app.post('/api/telegram/test-destination', async (req: Request, res: Response) => {
  try {
    const { chatId, sendTestPoll } = req.body;
    if (!chatId) {
      res.status(400).json({ error: 'Chat ID is required (e.g. -1001234567890 or @channel)' });
      return;
    }

    const botToken = getActiveBotToken();
    if (!botToken) {
      res.status(400).json({ error: 'Bot token is not configured.' });
      return;
    }

    // 1. Get Chat information
    const chatInfo = await callTelegramApi('getChat', { chat_id: chatId });
    let botMemberInfo: any = null;
    let permissionsSummary = 'Basic member';

    try {
      const me = await callTelegramApi('getMe', {});
      botMemberInfo = await callTelegramApi('getChatMember', {
        chat_id: chatId,
        user_id: me.id,
      });

      if (botMemberInfo.status === 'administrator') {
        const canPost = botMemberInfo.can_post_messages !== false;
        permissionsSummary = canPost ? 'Administrator (can post polls/messages)' : 'Administrator (restricted post permissions)';
      } else if (botMemberInfo.status === 'creator') {
        permissionsSummary = 'Owner / Creator';
      } else {
        permissionsSummary = `Member (${botMemberInfo.status}) - Bot should be Admin to post in channels!`;
      }
    } catch (permErr: any) {
      permissionsSummary = 'Could not verify admin permissions. Ensure bot was added as admin.';
    }

    // 2. Optional: Send test poll to verify posting rights
    let testPollResult: any = null;
    if (sendTestPoll) {
      testPollResult = await callTelegramApi('sendPoll', {
        chat_id: chatId,
        question: '🔔 Telegram Bulk Quiz Maker: Connection Test',
        options: ['Verified & Ready', 'Re-check Settings'],
        type: 'quiz',
        correct_option_id: 0,
        explanation: 'Your bot is successfully configured to publish Quiz Polls!',
        is_anonymous: true,
      });
    }

    res.json({
      success: true,
      chat: {
        id: chatInfo.id,
        title: chatInfo.title || chatInfo.username || 'Direct Chat',
        type: chatInfo.type,
        username: chatInfo.username,
        permissionsSummary,
        canPost: botMemberInfo?.status === 'administrator' || botMemberInfo?.status === 'creator',
      },
      testPollSent: !!testPollResult,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'Failed to verify Telegram destination',
    });
  }
});

// 6. Telegram Destinations CRUD
app.get('/api/telegram/destinations', (_req: Request, res: Response) => {
  res.json(db.destinations || []);
});

app.post('/api/telegram/destinations', (req: Request, res: Response) => {
  try {
    const { name, chatId, type, platform } = req.body;
    if (!name || !chatId) {
      res.status(400).json({ error: 'Name and Chat ID are required' });
      return;
    }

    const assignedPlatform = platform || (type?.startsWith('whatsapp') ? 'whatsapp' : 'telegram');

    const newDest: TelegramDestination = {
      id: `dest_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      platform: assignedPlatform,
      name: name.trim(),
      chatId: chatId.trim(),
      type: type || (assignedPlatform === 'whatsapp' ? 'whatsapp_group' : 'channel'),
      status: 'active',
      lastTested: new Date().toISOString(),
      lastTestSuccess: true,
      botPermissions: {
        canPostMessages: true,
        isAdmin: true,
        statusText: assignedPlatform === 'whatsapp' ? 'WhatsApp Ready' : 'Configured',
      },
    };

    db.destinations.push(newDest);
    saveDB(db);
    res.json(newDest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/telegram/destinations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const idx = db.destinations.findIndex(d => d.id === id);
  if (idx === -1) {
    res.status(404).json({ error: 'Destination not found' });
    return;
  }

  const { name, chatId, type, status, platform } = req.body;
  if (name) db.destinations[idx].name = name;
  if (chatId) db.destinations[idx].chatId = chatId;
  if (type) db.destinations[idx].type = type;
  if (status) db.destinations[idx].status = status;
  if (platform) db.destinations[idx].platform = platform;

  saveDB(db);
  res.json(db.destinations[idx]);
});

app.delete('/api/telegram/destinations/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.destinations = db.destinations.filter(d => d.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// 7. Publishing Jobs API
app.get('/api/publishing/jobs', (_req: Request, res: Response) => {
  // Strip large questions payload from list response for speed
  const sanitized = db.jobs.map(job => {
    const { items, ...rest } = job;
    return {
      ...rest,
      totalItemsCount: items ? items.length : 0,
    };
  });
  res.json(sanitized);
});

app.get('/api/publishing/jobs/:id', (req: Request, res: Response) => {
  const job = db.jobs.find(j => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

app.post('/api/publishing/jobs', (req: Request, res: Response) => {
  try {
    const {
      name,
      questions,
      destinationIds,
      delaySeconds = 3,
      stopOnFailure = false,
      maxRetries = 2,
    } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      res.status(400).json({ error: 'Questions array is required' });
      return;
    }

    if (!destinationIds || !Array.isArray(destinationIds) || destinationIds.length === 0) {
      res.status(400).json({ error: 'At least one destination must be selected' });
      return;
    }

    const selectedDests = db.destinations.filter(d => destinationIds.includes(d.id));
    if (selectedDests.length === 0) {
      res.status(400).json({ error: 'No valid active destinations found for provided IDs' });
      return;
    }

    // Build flattened job item records: (questions x destinations)
    const items: JobItemRecord[] = [];
    questions.forEach((q: QuestionItem) => {
      selectedDests.forEach(dest => {
        const destPlatform = dest.platform || (dest.type.startsWith('whatsapp') ? 'whatsapp' : 'telegram');
        items.push({
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          platform: destPlatform,
          questionId: q.id,
          questionText: q.question,
          destinationId: dest.id,
          destinationName: dest.name,
          destinationChatId: dest.chatId,
          status: 'pending',
          retryCount: 0,
        });
      });
    });

    const newJob: PublishingJob = {
      id: `job_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: name || `Quiz Publish - ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      status: 'queued',
      totalQuestions: questions.length,
      destinations: selectedDests.map(d => ({
        id: d.id,
        name: d.name,
        chatId: d.chatId,
        platform: d.platform || (d.type.startsWith('whatsapp') ? 'whatsapp' : 'telegram'),
      })),
      delaySeconds: Math.max(1, Math.min(60, delaySeconds)),
      stopOnFailure: !!stopOnFailure,
      maxRetries: Math.max(0, Math.min(5, maxRetries)),
      successCount: 0,
      failedCount: 0,
      uncertainCount: 0,
      pendingCount: items.length,
      currentIndex: 0,
      items,
    };

    // Store questions payload inside the job record for the worker
    (newJob as any).questionsPayload = questions;

    db.jobs.unshift(newJob);
    saveDB(db);

    // Kick off worker in background
    queueWorker.startJob(newJob.id);

    res.json(newJob);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/publishing/jobs/:id/pause', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = db.jobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  queueWorker.pauseJob(id);
  job.status = 'paused';
  saveDB(db);
  res.json({ success: true, job });
});

app.post('/api/publishing/jobs/:id/resume', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = db.jobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  job.status = 'publishing';
  saveDB(db);
  queueWorker.resumeJob(id);
  res.json({ success: true, job });
});

app.post('/api/publishing/jobs/:id/cancel', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = db.jobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  queueWorker.cancelJob(id);
  job.status = 'cancelled';
  saveDB(db);
  res.json({ success: true, job });
});

app.post('/api/publishing/jobs/:id/retry', (req: Request, res: Response) => {
  const { id } = req.params;
  const job = db.jobs.find(j => j.id === id);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Reset only failed or uncertain items back to pending!
  let resetCount = 0;
  job.items.forEach(item => {
    if (item.status === 'failed' || item.status === 'uncertain') {
      item.status = 'pending';
      item.error = undefined;
      resetCount++;
    }
  });

  job.pendingCount += resetCount;
  job.failedCount = 0;
  job.uncertainCount = 0;
  job.status = 'queued';
  saveDB(db);

  queueWorker.startJob(job.id);
  res.json({ success: true, resetItemsCount: resetCount, job });
});

// 8. Question Bank API
app.get('/api/question-banks', (_req: Request, res: Response) => {
  res.json(db.questionBanks || []);
});

app.post('/api/question-banks', (req: Request, res: Response) => {
  try {
    const { title, description, subject, topic, questions } = req.body;
    if (!title || !questions || !Array.isArray(questions)) {
      res.status(400).json({ error: 'Title and questions array are required' });
      return;
    }

    const newSet: QuestionBankSet = {
      id: `qb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: title.trim(),
      description: (description || '').trim(),
      subject: (subject || '').trim(),
      topic: (topic || '').trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      questionsCount: questions.length,
      questions,
    };

    db.questionBanks.unshift(newSet);
    saveDB(db);
    res.json(newSet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/question-banks/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  db.questionBanks = db.questionBanks.filter(q => q.id !== id);
  saveDB(db);
  res.json({ success: true });
});

// 9. Reports Export API (CSV & JSON)
app.get('/api/reports/export', (req: Request, res: Response) => {
  const format = (req.query.format as string) || 'csv';

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="publishing-reports.json"');
    res.send(JSON.stringify(db.jobs, null, 2));
    return;
  }

  // Generate CSV format
  const rows = ['Job ID,Job Name,Started At,Destination,Question,Status,Message ID,Error,Retries'];
  db.jobs.forEach(job => {
    (job.items || []).forEach(item => {
      const qClean = (item.questionText || '').replace(/"/g, '""');
      const errClean = (item.error || '').replace(/"/g, '""');
      const destClean = (item.destinationName || '').replace(/"/g, '""');
      const line = `"${job.id}","${job.name}","${item.sentAt || job.createdAt}","${destClean}","${qClean}","${item.status}","${item.telegramMessageId || ''}","${errClean}","${item.retryCount}"`;
      rows.push(line);
    });
  });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="publishing-reports.csv"');
  // Include UTF-8 BOM for proper Excel display of Bengali characters
  res.send('\uFEFF' + rows.join('\r\n'));
});

// 10. WhatsApp Cloud API: Test Endpoint
app.post('/api/whatsapp/test', async (req: Request, res: Response) => {
  try {
    const { accessToken, phoneNumberId } = req.body;
    const { accessToken: curToken, phoneNumberId: curPhoneId } = getActiveWhatsAppConfig();
    const token = (accessToken || curToken || '').trim();
    const phoneId = (phoneNumberId || curPhoneId || '').trim();

    if (!token || !phoneId) {
      res.status(400).json({ error: 'WhatsApp Access Token and Phone Number ID are required.' });
      return;
    }

    const testUrl = `https://graph.facebook.com/v21.0/${phoneId}?access_token=${token}`;
    const testRes = await fetch(testUrl);
    const data = await testRes.json();

    if (!testRes.ok || data.error) {
      throw new Error(data.error?.message || 'Failed to verify WhatsApp Cloud API account');
    }

    res.json({
      success: true,
      verifiedName: data.verified_name || data.display_phone_number || 'WhatsApp Business Account',
      displayPhoneNumber: data.display_phone_number,
      id: data.id,
      qualityRating: data.quality_rating,
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message || 'WhatsApp verification failed',
    });
  }
});

// 11. Settings API
app.get('/api/settings', (_req: Request, res: Response) => {
  const activeToken = getActiveBotToken();
  const maskedToken = activeToken
    ? `${activeToken.slice(0, 4)}••••••••${activeToken.slice(-4)}`
    : '';

  const { accessToken: waToken, phoneNumberId: waPhoneId } = getActiveWhatsAppConfig();
  const maskedWaToken = waToken
    ? `${waToken.slice(0, 6)}••••••••${waToken.slice(-4)}`
    : '';

  const config: AppConfig = {
    hasBotToken: !!activeToken,
    botUsername: undefined,
    hasWhatsAppConfig: !!(waToken && waPhoneId),
    whatsAppPhoneNumberId: waPhoneId,
    defaultDelaySeconds: db.settings.defaultDelaySeconds || 3,
    language: db.settings.language || 'bn',
    protectContentDefault: db.settings.protectContentDefault || false,
    isAnonymousDefault: db.settings.isAnonymousDefault ?? true,
  };

  res.json({
    config,
    maskedToken,
    maskedWaToken,
  });
});

app.post('/api/settings', (req: Request, res: Response) => {
  try {
    const {
      botToken,
      whatsAppAccessToken,
      whatsAppPhoneNumberId,
      defaultDelaySeconds,
      language,
      protectContentDefault,
      isAnonymousDefault,
    } = req.body;

    if (botToken !== undefined && botToken !== '') {
      db.settings.botToken = botToken.trim();
    }
    if (whatsAppAccessToken !== undefined && whatsAppAccessToken !== '') {
      db.settings.whatsAppAccessToken = whatsAppAccessToken.trim();
    }
    if (whatsAppPhoneNumberId !== undefined && whatsAppPhoneNumberId !== '') {
      db.settings.whatsAppPhoneNumberId = whatsAppPhoneNumberId.trim();
    }
    if (defaultDelaySeconds !== undefined) {
      db.settings.defaultDelaySeconds = Math.max(1, Math.min(60, Number(defaultDelaySeconds)));
    }
    if (language) {
      db.settings.language = language;
    }
    if (protectContentDefault !== undefined) {
      db.settings.protectContentDefault = !!protectContentDefault;
    }
    if (isAnonymousDefault !== undefined) {
      db.settings.isAnonymousDefault = !!isAnonymousDefault;
    }

    saveDB(db);
    res.json({ success: true, message: 'Settings saved successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// SERVER STARTUP & VITE INTEGRATION
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Telegram Bulk Quiz Maker is running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
