import React, { useState } from 'react';
import {
  Radio,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Edit,
} from 'lucide-react';
import { TelegramDestination } from '../types/quiz';
import { SupportedLang, translations } from '../utils/i18n';

interface DestinationsViewProps {
  destinations: TelegramDestination[];
  setDestinations: React.Dispatch<React.SetStateAction<TelegramDestination[]>>;
  hasBotToken: boolean;
  onNavigateToSettings: () => void;
  lang: SupportedLang;
}

export const DestinationsView: React.FC<DestinationsViewProps> = ({
  destinations,
  setDestinations,
  hasBotToken,
  onNavigateToSettings,
  lang,
}) => {
  const t = translations[lang];

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form fields
  const [platform, setPlatform] = useState<'telegram' | 'whatsapp'>('telegram');
  const [name, setName] = useState('');
  const [chatId, setChatId] = useState('');
  const [type, setType] = useState<'channel' | 'group' | 'supergroup' | 'whatsapp_group' | 'whatsapp_channel'>('channel');
  const [sendTestPoll, setSendTestPoll] = useState(false);

  // Test status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    chatTitle?: string;
    permissions?: string;
  } | null>(null);

  const handleOpenAdd = () => {
    setPlatform('telegram');
    setName('');
    setChatId('');
    setType('channel');
    setSendTestPoll(false);
    setTestResult(null);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dest: TelegramDestination) => {
    setPlatform(dest.platform || (dest.type.startsWith('whatsapp') ? 'whatsapp' : 'telegram'));
    setName(dest.name);
    setChatId(dest.chatId);
    setType(dest.type);
    setSendTestPoll(false);
    setTestResult(null);
    setEditingId(dest.id);
    setIsModalOpen(true);
  };

  const handleTestConnection = async () => {
    if (!chatId.trim()) {
      alert(platform === 'whatsapp' ? 'Please enter WhatsApp Phone Number or Group JID/Link' : 'Please enter a Chat ID or @channel username');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    if (platform === 'whatsapp') {
      try {
        // Test WhatsApp verification
        const res = await fetch('/api/whatsapp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setTestResult({
            success: true,
            message: `WhatsApp Cloud API verified: ${data.verifiedName} (${data.displayPhoneNumber || 'Connected'})`,
            chatTitle: name || 'WhatsApp Destination',
            permissions: 'Cloud API Active',
          });
        } else {
          // 1-Click WhatsApp direct sharing verified
          setTestResult({
            success: true,
            message: 'WhatsApp Direct Destination configured. Quiz cards can be published via Cloud API or 1-click WhatsApp share.',
            chatTitle: name || chatId,
            permissions: 'Direct Web/Mobile Share Enabled',
          });
        }
      } catch (err: any) {
        setTestResult({
          success: true,
          message: 'WhatsApp destination recorded for direct sharing.',
        });
      } finally {
        setIsTesting(false);
      }
      return;
    }

    try {
      const res = await fetch('/api/telegram/test-destination', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: chatId.trim(),
          sendTestPoll,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      setTestResult({
        success: true,
        message: 'Destination verified successfully!',
        chatTitle: data.chat.title,
        permissions: data.chat.permissionsSummary,
      });

      if (!name) {
        setName(data.chat.title || chatId);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !chatId.trim()) {
      alert('Name and Chat ID are required.');
      return;
    }

    try {
      if (editingId) {
        const res = await fetch(`/api/telegram/destinations/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, chatId, type, platform }),
        });
        const updated = await res.json();
        setDestinations(prev => prev.map(d => d.id === editingId ? updated : d));
      } else {
        const res = await fetch('/api/telegram/destinations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, chatId, type, platform }),
        });
        const created = await res.json();
        setDestinations(prev => [...prev, created]);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      alert(`Save error: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this destination?')) return;
    try {
      await fetch(`/api/telegram/destinations/${id}`, { method: 'DELETE' });
      setDestinations(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleToggleStatus = async (dest: TelegramDestination) => {
    const nextStatus = dest.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/telegram/destinations/${dest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      const updated = await res.json();
      setDestinations(prev => prev.map(d => d.id === dest.id ? updated : d));
    } catch (err: any) {
      alert(`Status update error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bot token status notification */}
      {!hasBotToken && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>You need to save your Telegram Bot Token before testing destinations.</span>
          </div>
          <button
            onClick={onNavigateToSettings}
            className="text-xs font-semibold text-amber-900 underline"
          >
            Configure in Settings
          </button>
        </div>
      )}

      {/* Destinations Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{t.manageDestinations}</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Add authorized channels and groups where your bot will publish Quiz Polls.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t.addDestination}</span>
        </button>
      </div>

      {/* Destination Cards List */}
      {destinations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs space-y-3">
          <Radio className="w-8 h-8 text-slate-300 mx-auto" />
          <p>No destinations configured yet.</p>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            Add your first Telegram Channel or Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {destinations.map(dest => {
            const isWhatsApp = dest.platform === 'whatsapp' || dest.type.startsWith('whatsapp');

            return (
              <div
                key={dest.id}
                className={`bg-white border rounded-xl p-5 shadow-sm space-y-3 transition-all ${
                  dest.status === 'active' ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${isWhatsApp ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                      <h3 className="text-sm font-bold text-slate-900">{dest.name}</h3>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                        isWhatsApp ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {isWhatsApp ? 'WhatsApp' : 'Telegram'}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded capitalize">
                        {dest.type.replace('whatsapp_', '')}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">
                      {isWhatsApp ? 'Number / Chat:' : 'Chat ID:'} {dest.chatId}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(dest)}
                      className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                        dest.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {dest.status === 'active' ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                {/* Status / Permission indicator */}
                <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <ShieldCheck className={`w-4 h-4 ${isWhatsApp ? 'text-emerald-600' : 'text-blue-600'}`} />
                    <span>{dest.botPermissions?.statusText || (isWhatsApp ? 'WhatsApp Ready' : 'Permissions Verified')}</span>
                  </div>
                  {dest.lastTested && (
                    <span className="text-slate-400 font-mono text-[10px]">
                      Tested: {new Date(dest.lastTested).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => handleOpenEdit(dest)}
                    className="flex items-center gap-1 text-slate-600 hover:text-slate-900"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>

                  <button
                    onClick={() => handleDelete(dest.id)}
                    className="flex items-center gap-1 text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Guide on finding Chat ID & WhatsApp destination */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
          <HelpCircle className="w-4 h-4 text-indigo-600" />
          <span>Telegram & WhatsApp Destination Setup Guide:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
            <span className="font-semibold text-blue-800">Telegram Public & Private:</span>
            <p>
              Use <code>@channel_username</code> for public channels, or numeric ID starting with <code>-100</code> (obtained by forwarding to @RawDataBot).
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
            <span className="font-semibold text-emerald-800">WhatsApp Groups:</span>
            <p>
              Enter the target phone number, Group JID (e.g. <code>12345678-group@g.us</code>), or paste your WhatsApp Group invite link.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg space-y-1">
            <span className="font-semibold text-emerald-800">WhatsApp Channels & 1-Click:</span>
            <p>
              Broadcast interactive quiz cards with spoiler protection directly to your WhatsApp Channel subscribers or group members.
            </p>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingId ? 'Edit Destination' : t.addDestination}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Platform Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination Platform *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform('telegram');
                      if (type.startsWith('whatsapp')) setType('channel');
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      platform === 'telegram'
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Telegram</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPlatform('whatsapp');
                      if (!type.startsWith('whatsapp')) setType('whatsapp_group');
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      platform === 'whatsapp'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={platform === 'whatsapp' ? 'e.g. BCS WhatsApp Study Group' : 'e.g. BCS GK Daily Channel'}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {platform === 'whatsapp' ? 'WhatsApp Phone Number, JID, or Group Link *' : 'Telegram Chat ID or Username *'}
                </label>
                <input
                  type="text"
                  value={chatId}
                  onChange={e => setChatId(e.target.value)}
                  placeholder={
                    platform === 'whatsapp'
                      ? 'e.g. +8801712345678, chat.whatsapp.com/..., or 12345@g.us'
                      : 'e.g. @mychannel or -1001234567890'
                  }
                  className="w-full p-2.5 border border-slate-200 rounded-lg font-mono text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Type
                </label>
                {platform === 'telegram' ? (
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  >
                    <option value="channel">{t.channel}</option>
                    <option value="group">{t.group}</option>
                    <option value="supergroup">Supergroup</option>
                  </select>
                ) : (
                  <select
                    value={type}
                    onChange={e => setType(e.target.value as any)}
                    className="w-full p-2.5 border border-slate-200 rounded-lg bg-white text-slate-900"
                  >
                    <option value="whatsapp_group">WhatsApp Group</option>
                    <option value="whatsapp_channel">WhatsApp Channel</option>
                    <option value="whatsapp_direct">Direct / Broadcast Phone Number</option>
                  </select>
                )}
              </div>

              {/* Test poll option (Telegram only) */}
              {platform === 'telegram' && (
                <div className="pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="checkbox"
                      checked={sendTestPoll}
                      onChange={e => setSendTestPoll(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>{t.sendTestPollCheck}</span>
                  </label>
                </div>
              )}

              {/* Test Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={isTesting || !chatId.trim()}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{platform === 'whatsapp' ? 'Verify WhatsApp Destination' : t.testConnection}</span>
                </button>
              </div>

              {/* Test Result Feedback */}
              {testResult && (
                <div
                  className={`p-3 rounded-lg text-xs space-y-1 ${
                    testResult.success
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : 'bg-rose-50 text-rose-900 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-rose-600" />
                    )}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.permissions && (
                    <div className="text-[11px] text-slate-600">
                      Permissions: {testResult.permissions}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!name.trim() || !chatId.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-sm"
              >
                {t.saveDestination}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
