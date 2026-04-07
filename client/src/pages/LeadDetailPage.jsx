import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leads as leadsApi, sms as smsApi } from '../services/api';
import { ArrowLeft, Phone, MessageSquare, FileText, Clock, Send, Trash2 } from 'lucide-react';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [noteText, setNoteText] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { loadLead(); }, [id]);

  async function loadLead() {
    const d = await leadsApi.get(id);
    setData(d);
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    await leadsApi.addNote(id, noteText);
    setNoteText('');
    loadLead();
  }

  async function handleSendSMS() {
    if (!smsText.trim()) return;
    setSending(true);
    await smsApi.send({ to: data.lead.phone, body: smsText, leadId: id });
    setSmsText('');
    setSending(false);
    loadLead();
  }

  async function handleDelete() {
    if (!confirm('Delete this lead?')) return;
    await leadsApi.delete(id);
    navigate('/leads');
  }

  if (!data) return <div className="text-gray-500">Loading...</div>;

  const { lead, calls, notes, messages } = data;

  const tabs = [
    { key: 'info', label: 'Info', icon: FileText },
    { key: 'calls', label: `Calls (${calls?.length || 0})`, icon: Phone },
    { key: 'notes', label: `Notes (${notes?.length || 0})`, icon: FileText },
    { key: 'sms', label: `SMS (${messages?.length || 0})`, icon: MessageSquare }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/leads')} className="text-gray-500 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h2>
            <p className="text-gray-500">{lead.phone} · {lead.email || 'No email'}</p>
          </div>
        </div>
        <button onClick={handleDelete} className="btn-danger text-sm">
          <Trash2 size={14} className="inline mr-1" /> Delete
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-leap-500 text-leap-400'
                : 'border-transparent text-gray-500 hover:text-white'
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <div className="card">
          <div className="grid grid-cols-2 gap-4">
            <Field label="First Name" value={lead.first_name} />
            <Field label="Last Name" value={lead.last_name} />
            <Field label="Phone" value={lead.phone} />
            <Field label="Email" value={lead.email} />
            <Field label="Company" value={lead.company} />
            <Field label="Address" value={[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')} />
            <Field label="Status" value={lead.status} />
            <Field label="Campaign" value={lead.campaigns?.name} />
            <Field label="Attempts" value={lead.attempts} />
            <Field label="Last Disposition" value={lead.last_disposition} />
            <Field label="Priority" value={lead.priority} />
            <Field label="DNC" value={lead.is_dnc ? 'Yes' : 'No'} />
          </div>
          {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-800">
              <h4 className="text-sm font-semibold text-gray-400 mb-3">Custom Fields</h4>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(lead.custom_fields).map(([k, v]) => (
                  <Field key={k} label={k} value={v} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'calls' && (
        <div className="space-y-3">
          {calls?.length === 0 && <p className="text-gray-500">No call history</p>}
          {calls?.map(call => (
            <div key={call.id} className="card py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Phone size={16} className={call.status === 'completed' ? 'text-green-400' : 'text-gray-500'} />
                <div>
                  <p className="text-sm font-medium">
                    {call.status} {call.disposition_code && `· ${call.disposition_code}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {call.agents?.name || 'No agent'} · {call.duration_seconds}s · AMD: {call.amd_result || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{new Date(call.started_at).toLocaleString()}</p>
                {call.recording_url && (
                  <a href={call.recording_url} target="_blank" className="text-xs text-leap-400 hover:underline">
                    Play Recording
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddNote()}
              placeholder="Add a note..."
              className="input flex-1"
            />
            <button onClick={handleAddNote} className="btn-primary text-sm">Add</button>
          </div>
          {notes?.map(note => (
            <div key={note.id} className="card py-3">
              <p className="text-sm">{note.content}</p>
              <p className="text-xs text-gray-500 mt-2">
                {note.agents?.name} · {new Date(note.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'sms' && (
        <div className="space-y-4">
          <div className="card max-h-96 overflow-y-auto space-y-3">
            {messages?.length === 0 && <p className="text-gray-500 text-sm">No messages</p>}
            {messages?.map(msg => (
              <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                  msg.direction === 'outbound'
                    ? 'bg-leap-600 text-white'
                    : 'bg-gray-800 text-gray-200'
                }`}>
                  <p>{msg.body}</p>
                  <p className="text-xs opacity-60 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={smsText}
              onChange={e => setSmsText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendSMS()}
              placeholder="Type a message..."
              className="input flex-1"
            />
            <button onClick={handleSendSMS} disabled={sending || !smsText.trim()} className="btn-primary text-sm disabled:opacity-50">
              <Send size={14} className="inline mr-1" /> Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-sm">{value || '—'}</p>
    </div>
  );
}
