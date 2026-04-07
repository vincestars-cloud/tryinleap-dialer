import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { leads as leadsApi, sms as smsApi, dialer as dialerApi, campaigns as campaignsApi } from '../services/api';
import { useStore } from '../store/useStore';
import { ArrowLeft, Phone, MessageSquare, FileText, Clock, Send, Trash2, Save, PhoneCall, RotateCcw, Edit2 } from 'lucide-react';

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { agent, setActiveCall, setAgentStatus, webrtcMakeCall, webrtcStatus } = useStore();
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [noteText, setNoteText] = useState('');
  const [smsText, setSmsText] = useState('');
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [calling, setCalling] = useState(false);
  const [campaigns, setCampaigns] = useState([]);

  useEffect(() => { loadLead(); loadCampaigns(); }, [id]);

  async function loadLead() {
    const d = await leadsApi.get(id);
    setData(d);
    setEditForm({
      first_name: d.lead.first_name || '',
      last_name: d.lead.last_name || '',
      phone: d.lead.phone || '',
      email: d.lead.email || '',
      company: d.lead.company || '',
      address: d.lead.address || '',
      city: d.lead.city || '',
      state: d.lead.state || '',
      zip: d.lead.zip || '',
      status: d.lead.status || 'new',
      priority: d.lead.priority || 0,
      campaign_id: d.lead.campaign_id || ''
    });
  }

  async function loadCampaigns() {
    const c = await campaignsApi.list();
    setCampaigns(c || []);
  }

  async function handleSave() {
    setSaving(true);
    await leadsApi.update(id, editForm);
    setEditing(false);
    setSaving(false);
    loadLead();
  }

  async function handleManualCall() {
    if (calling) return;
    setCalling(true);
    try {
      // Step 1: Create DB record on server (no PSTN dial)
      const result = await dialerApi.manualCall({ leadId: id });

      // Step 2: Dial via WebRTC from browser — this creates BOTH legs
      // (WebRTC for PC audio + PSTN to lead's phone, bridged automatically)
      if (webrtcMakeCall && webrtcStatus === 'ready') {
        const call = webrtcMakeCall(
          data.lead.phone,       // destination number (PSTN)
          '+14048500482',        // caller ID
          'TryInLeap'
        );
        console.log('WebRTC call placed to', data.lead.phone);

        setActiveCall({
          callId: result.callId,
          callControlId: result.callControlId,
          lead: data.lead,
          campaignId: data.lead.campaign_id,
          webrtcCall: call
        });
        setAgentStatus('on_call');
      } else {
        // Fallback: server-only dial (no browser audio)
        console.warn('WebRTC not ready (status:', webrtcStatus, '). Call will have no browser audio.');
        setActiveCall({
          callId: result.callId,
          callControlId: result.callControlId,
          lead: data.lead,
          campaignId: data.lead.campaign_id
        });
        setAgentStatus('on_call');
      }
    } catch (err) {
      alert('Call failed: ' + err.message);
    }
    setCalling(false);
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
      {/* Header with call + edit buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/leads')} className="text-gray-500 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold">{lead.first_name} {lead.last_name}</h2>
            <p className="text-gray-500">{lead.phone} · {lead.email || 'No email'}</p>
          </div>
          <span className={`badge ${lead.status === 'new' ? 'badge-blue' : lead.status === 'contacted' ? 'badge-yellow' : lead.status === 'converted' ? 'badge-green' : lead.status === 'dnc' ? 'badge-red' : 'badge-gray'}`}>
            {lead.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleManualCall} disabled={calling || lead.is_dnc} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
            {calling ? <RotateCcw size={16} className="animate-spin" /> : <PhoneCall size={16} />}
            {calling ? 'Calling...' : 'Call Now'}
          </button>
          <button onClick={handleDelete} className="btn-danger text-sm">
            <Trash2 size={14} className="inline mr-1" /> Delete
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card py-3 text-center">
          <p className="text-xl font-bold">{lead.attempts}</p>
          <p className="text-xs text-gray-500">Attempts</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xl font-bold">{calls?.length || 0}</p>
          <p className="text-xs text-gray-500">Calls</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xl font-bold">{lead.last_disposition || '—'}</p>
          <p className="text-xs text-gray-500">Last Disposition</p>
        </div>
        <div className="card py-3 text-center">
          <p className="text-xl font-bold">{messages?.length || 0}</p>
          <p className="text-xs text-gray-500">Messages</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key ? 'border-leap-500 text-leap-400' : 'border-transparent text-gray-500 hover:text-white'
            }`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Info Tab — Editable */}
      {activeTab === 'info' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase">Lead Information</h3>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="btn-secondary text-sm py-1.5">
                <Edit2 size={14} className="inline mr-1" /> Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(false)} className="btn-secondary text-sm py-1.5">Cancel</button>
                <button onClick={handleSave} disabled={saving} className="btn-primary text-sm py-1.5 disabled:opacity-50">
                  <Save size={14} className="inline mr-1" /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <div className="grid grid-cols-2 gap-4">
              <EditField label="First Name" value={editForm.first_name} onChange={v => setEditForm({ ...editForm, first_name: v })} />
              <EditField label="Last Name" value={editForm.last_name} onChange={v => setEditForm({ ...editForm, last_name: v })} />
              <EditField label="Phone" value={editForm.phone} onChange={v => setEditForm({ ...editForm, phone: v })} />
              <EditField label="Email" value={editForm.email} onChange={v => setEditForm({ ...editForm, email: v })} />
              <EditField label="Company" value={editForm.company} onChange={v => setEditForm({ ...editForm, company: v })} />
              <EditField label="Address" value={editForm.address} onChange={v => setEditForm({ ...editForm, address: v })} />
              <EditField label="City" value={editForm.city} onChange={v => setEditForm({ ...editForm, city: v })} />
              <EditField label="State" value={editForm.state} onChange={v => setEditForm({ ...editForm, state: v })} />
              <EditField label="Zip" value={editForm.zip} onChange={v => setEditForm({ ...editForm, zip: v })} />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="input">
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="qualified">Qualified</option>
                  <option value="converted">Converted</option>
                  <option value="dnc">DNC</option>
                  <option value="dead">Dead</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Priority</label>
                <input type="number" min="0" max="100" value={editForm.priority} onChange={e => setEditForm({ ...editForm, priority: parseInt(e.target.value) || 0 })} className="input" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Campaign</label>
                <select value={editForm.campaign_id} onChange={e => setEditForm({ ...editForm, campaign_id: e.target.value })} className="input">
                  <option value="">No Campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label="First Name" value={lead.first_name} />
              <Field label="Last Name" value={lead.last_name} />
              <Field label="Phone" value={lead.phone} />
              <Field label="Email" value={lead.email} />
              <Field label="Company" value={lead.company} />
              <Field label="Address" value={[lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(', ')} />
              <Field label="Status" value={lead.status} />
              <Field label="Campaign" value={lead.campaigns?.name} />
              <Field label="Priority" value={lead.priority} />
              <Field label="DNC" value={lead.is_dnc ? 'Yes' : 'No'} />
              <Field label="Last Attempt" value={lead.last_attempt_at ? new Date(lead.last_attempt_at).toLocaleString() : '—'} />
              <Field label="Created" value={new Date(lead.created_at).toLocaleString()} />
            </div>
          )}

          {!editing && lead.custom_fields && Object.keys(lead.custom_fields).length > 0 && (
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

      {/* Calls Tab */}
      {activeTab === 'calls' && (
        <div className="space-y-3">
          {/* Redial button */}
          <div className="flex justify-end">
            <button onClick={handleManualCall} disabled={calling || lead.is_dnc} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50">
              <PhoneCall size={14} /> Redial
            </button>
          </div>

          {calls?.length === 0 && <p className="text-gray-500">No call history</p>}
          {calls?.map(call => (
            <div key={call.id} className="card py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Phone size={16} className={call.status === 'completed' ? 'text-green-400' : call.status === 'failed' ? 'text-red-400' : 'text-gray-500'} />
                <div>
                  <p className="text-sm font-medium">
                    {call.status} {call.disposition_code && <span className="badge badge-blue ml-2">{call.disposition_code}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {call.agents?.name || 'No agent'} · {call.duration_seconds}s · AMD: {call.amd_result || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">{new Date(call.started_at).toLocaleString()}</p>
                {call.recording_url && (
                  <audio controls className="mt-1 h-8" src={call.recording_url} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === 'notes' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddNote()} placeholder="Add a note..." className="input flex-1" />
            <button onClick={handleAddNote} className="btn-primary text-sm">Add</button>
          </div>
          {notes?.map(note => (
            <div key={note.id} className="card py-3">
              <p className="text-sm">{note.content}</p>
              <p className="text-xs text-gray-500 mt-2">{note.agents?.name} · {new Date(note.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* SMS Tab */}
      {activeTab === 'sms' && (
        <div className="space-y-4">
          <div className="card max-h-96 overflow-y-auto space-y-3">
            {messages?.length === 0 && <p className="text-gray-500 text-sm">No messages</p>}
            {messages?.map(msg => (
              <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${msg.direction === 'outbound' ? 'bg-leap-600 text-white' : 'bg-gray-800 text-gray-200'}`}>
                  <p>{msg.body}</p>
                  <p className="text-xs opacity-60 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={smsText} onChange={e => setSmsText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendSMS()} placeholder="Type a message..." className="input flex-1" />
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

function EditField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} className="input" />
    </div>
  );
}
