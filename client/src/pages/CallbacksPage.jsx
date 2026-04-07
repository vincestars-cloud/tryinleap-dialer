import { useState, useEffect } from 'react';
import { callbacks as callbacksApi } from '../services/api';
import { Calendar, CheckCircle, Phone, Clock, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CallbacksPage() {
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('pending');
  const navigate = useNavigate();

  useEffect(() => { loadCallbacks(); }, [filter]);

  async function loadCallbacks() {
    const data = await callbacksApi.list({ status: filter, all: 'true' });
    setList(data || []);
  }

  async function handleComplete(id) {
    await callbacksApi.complete(id);
    loadCallbacks();
  }

  async function handleDelete(id) {
    await callbacksApi.delete(id);
    loadCallbacks();
  }

  function formatDate(dt) {
    return new Date(dt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function isOverdue(dt) {
    return new Date(dt) < new Date();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Scheduled Callbacks</h2>
        <div className="flex gap-2">
          {['pending', 'completed', 'missed'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filter === s ? 'bg-leap-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {list.map(cb => (
          <div key={cb.id} className={`card py-4 flex items-center justify-between ${isOverdue(cb.scheduled_at) && cb.status === 'pending' ? 'border-red-800/50' : ''}`}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isOverdue(cb.scheduled_at) && cb.status === 'pending' ? 'bg-red-900/30 text-red-400' : 'bg-leap-600/20 text-leap-400'}`}>
                <Calendar size={18} />
              </div>
              <div>
                <p className="font-medium">
                  {cb.leads?.first_name} {cb.leads?.last_name}
                  <span className="text-gray-500 ml-2">{cb.leads?.phone}</span>
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(cb.scheduled_at)}</span>
                  {cb.campaigns?.name && <span>{cb.campaigns.name}</span>}
                  {isOverdue(cb.scheduled_at) && cb.status === 'pending' && <span className="text-red-400">OVERDUE</span>}
                </div>
                {cb.notes && <p className="text-xs text-gray-400 mt-1">{cb.notes}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {cb.status === 'pending' && (
                <>
                  <button onClick={() => navigate(`/leads/${cb.lead_id}`)} className="btn-secondary text-sm py-1.5">
                    <Phone size={14} className="inline mr-1" /> View Lead
                  </button>
                  <button onClick={() => handleComplete(cb.id)} className="btn-primary text-sm py-1.5">
                    <CheckCircle size={14} className="inline mr-1" /> Done
                  </button>
                </>
              )}
              <button onClick={() => handleDelete(cb.id)} className="p-2 text-gray-500 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {list.length === 0 && (
          <div className="card text-center py-12 text-gray-500">
            No {filter} callbacks
          </div>
        )}
      </div>
    </div>
  );
}
