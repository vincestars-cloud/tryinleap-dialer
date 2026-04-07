import { useState, useEffect } from 'react';
import { sms as smsApi } from '../services/api';
import { Send, MessageSquare } from 'lucide-react';

export default function SMSPage() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => { loadHistory(); }, [page]);

  async function loadHistory() {
    const data = await smsApi.history({ page, limit: 50 });
    setMessages(data.messages || []);
    setTotal(data.total || 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">SMS Messages</h2>
        <button onClick={() => setShowCompose(true)} className="btn-primary text-sm">
          <Send size={14} className="inline mr-1" /> Compose
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">To/From</th>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody>
            {messages.map(msg => (
              <tr key={msg.id} className="border-b border-gray-800/50 hover:bg-gray-800/50">
                <td className="px-4 py-3">
                  <span className={`badge ${msg.direction === 'outbound' ? 'badge-blue' : 'badge-green'}`}>
                    {msg.direction}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{msg.direction === 'outbound' ? msg.to_number : msg.from_number}</td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {msg.leads ? `${msg.leads.first_name} ${msg.leads.last_name}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-300 max-w-xs truncate">{msg.body}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${msg.status === 'delivered' ? 'badge-green' : msg.status === 'failed' ? 'badge-red' : 'badge-yellow'}`}>
                    {msg.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(msg.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {messages.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No messages yet</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{total} total messages</span>
        <div className="flex gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 disabled:opacity-50">Prev</button>
          <button onClick={() => setPage(p => p + 1)} disabled={messages.length < 50} className="btn-secondary text-sm py-1.5 disabled:opacity-50">Next</button>
        </div>
      </div>

      {showCompose && <ComposeModal onClose={() => { setShowCompose(false); loadHistory(); }} />}
    </div>
  );
}

function ComposeModal({ onClose }) {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    setSending(true);
    await smsApi.send({ to, body });
    setSending(false);
    setSent(true);
    setTimeout(onClose, 1000);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={handleSend} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Compose SMS</h3>

        {sent && <div className="bg-green-900/30 border border-green-800 text-green-300 text-sm px-4 py-2 rounded-lg">Message sent!</div>}

        <div>
          <label className="block text-sm text-gray-400 mb-1">To (phone number)</label>
          <input value={to} onChange={e => setTo(e.target.value)} placeholder="+15551234567" className="input" required />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} className="input h-32 resize-none" required />
          <p className="text-xs text-gray-500 mt-1">{body.length}/160 characters</p>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={sending} className="btn-primary flex-1 disabled:opacity-50">
            {sending ? 'Sending...' : 'Send SMS'}
          </button>
        </div>
      </form>
    </div>
  );
}
