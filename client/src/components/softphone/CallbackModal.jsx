import { useState } from 'react';
import { callbacks as callbacksApi } from '../../services/api';
import { Calendar, X } from 'lucide-react';

export default function CallbackModal({ leadId, campaignId, leadName, onClose }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSchedule() {
    if (!date || !time) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time}`).toISOString();
    await callbacksApi.create({ leadId, campaignId, scheduledAt, notes });
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-leap-400" />
            <h3 className="text-lg font-semibold">Schedule Callback</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        {leadName && <p className="text-sm text-gray-400 mb-4">For: {leadName}</p>}

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="input" required />
          </div>
        </div>

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Callback notes..." className="input mb-4 h-20 resize-none" />

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSchedule} disabled={saving || !date || !time} className="btn-primary flex-1 disabled:opacity-50">
            {saving ? 'Scheduling...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
