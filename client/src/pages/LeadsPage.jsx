import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { leads, leads as leadsApi, campaigns as campaignsApi } from '../services/api';
import { Plus, Upload, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function LeadsPage() {
  const [leadsList, setLeadsList] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [campaigns, setCampaigns] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    loadLeads();
  }, [page, search, statusFilter, campaignFilter]);

  async function loadCampaigns() {
    const data = await campaignsApi.list();
    setCampaigns(data);
  }

  async function loadLeads() {
    const params = { page, limit: 50 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (campaignFilter) params.campaign_id = campaignFilter;
    const data = await leadsApi.list(params);
    setLeadsList(data.leads || []);
    setTotal(data.total || 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Leads</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm">
            <Upload size={14} className="inline mr-1" /> Import CSV
          </button>
          <button onClick={() => setShowAdd(true)} className="btn-primary text-sm">
            <Plus size={14} className="inline mr-1" /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search leads..."
            className="input pl-10"
          />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="input w-40">
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="converted">Converted</option>
          <option value="dnc">DNC</option>
          <option value="dead">Dead</option>
        </select>
        <select value={campaignFilter} onChange={e => { setCampaignFilter(e.target.value); setPage(1); }} className="input w-48">
          <option value="">All Campaigns</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800 text-left text-xs text-gray-500 uppercase">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Last Disposition</th>
            </tr>
          </thead>
          <tbody>
            {leadsList.map(lead => (
              <tr
                key={lead.id}
                onClick={() => navigate(`/leads/${lead.id}`)}
                className="border-b border-gray-800/50 hover:bg-gray-800/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-medium">{lead.first_name} {lead.last_name}</td>
                <td className="px-4 py-3 text-gray-400">{lead.phone}</td>
                <td className="px-4 py-3 text-gray-400">{lead.email || '—'}</td>
                <td className="px-4 py-3 text-gray-400">{lead.campaigns?.name || '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3 text-gray-400">{lead.attempts}</td>
                <td className="px-4 py-3 text-gray-400">{lead.last_disposition || '—'}</td>
              </tr>
            ))}
            {leadsList.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No leads found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">{total} total leads</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary text-sm py-1.5 disabled:opacity-50">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={leadsList.length < 50} className="btn-secondary text-sm py-1.5 disabled:opacity-50">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAdd && <AddLeadModal campaigns={campaigns} onClose={() => { setShowAdd(false); loadLeads(); }} />}
      {showImport && <ImportModal campaigns={campaigns} onClose={() => { setShowImport(false); loadLeads(); }} />}
    </div>
  );
}

function StatusBadge({ status }) {
  const classes = {
    new: 'badge-blue',
    contacted: 'badge-yellow',
    qualified: 'badge-green',
    converted: 'badge-green',
    dnc: 'badge-red',
    dead: 'badge-gray'
  };
  return <span className={`badge ${classes[status] || 'badge-gray'}`}>{status}</span>;
}

function AddLeadModal({ campaigns, onClose }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', campaign_id: '' });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await leadsApi.create(form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="card w-full max-w-md space-y-4">
        <h3 className="text-lg font-semibold">Add Lead</h3>
        <div className="grid grid-cols-2 gap-3">
          <input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} placeholder="First name" className="input" required />
          <input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} placeholder="Last name" className="input" required />
        </div>
        <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone (+1...)" className="input" required />
        <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" className="input" />
        <select value={form.campaign_id} onChange={e => setForm({ ...form, campaign_id: e.target.value })} className="input">
          <option value="">No Campaign</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 disabled:opacity-50">{saving ? 'Saving...' : 'Add Lead'}</button>
        </div>
      </form>
    </div>
  );
}

function ImportModal({ campaigns, onClose }) {
  const [file, setFile] = useState(null);
  const [campaignId, setCampaignId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFile(f) {
    if (!f) return;
    setFile(f);
    // Preview first 5 rows
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.trim().split(/\r?\n/);
      const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
      const rows = lines.slice(1, 6).map(l => l.split(',').map(v => v.trim().replace(/^["']|["']$/g, '')));
      setPreview({ headers, rows, total: lines.length - 1 });
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    try {
      const res = await leads.uploadCSV(file, campaignId);
      setResult(res);
    } catch (err) {
      setResult({ error: err.message });
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card w-full max-w-lg space-y-4">
        <h3 className="text-lg font-semibold">Import Leads from CSV</h3>

        <select value={campaignId} onChange={e => setCampaignId(e.target.value)} className="input">
          <option value="">Assign to Campaign (optional)</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragOver ? 'border-leap-500 bg-leap-600/10' : 'border-gray-700 hover:border-gray-600'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onClick={() => document.getElementById('csv-upload').click()}
        >
          <input id="csv-upload" type="file" accept=".csv,.txt" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div>
              <p className="text-leap-400 font-medium">{file.name}</p>
              <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          ) : (
            <div>
              <p className="text-gray-400">Drop a CSV file here or click to browse</p>
              <p className="text-xs text-gray-600 mt-2">Supports: first_name, last_name, phone, email, company, address, city, state, zip</p>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-400">Preview ({preview.total} rows)</span>
              <span className="text-xs text-gray-500">{preview.headers.join(', ')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500">
                    {preview.headers.map((h, i) => <th key={i} className="px-2 py-1 text-left">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-700/50">
                      {row.map((val, j) => <td key={j} className="px-2 py-1 text-gray-300 truncate max-w-[120px]">{val}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && !result.error && (
          <div className="bg-green-900/30 border border-green-800 text-green-300 text-sm px-4 py-2 rounded-lg">
            Imported {result.imported} of {result.total_rows} leads.
            {result.skipped_dnc > 0 && ` Skipped ${result.skipped_dnc} DNC numbers.`}
          </div>
        )}
        {result?.error && (
          <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm px-4 py-2 rounded-lg">
            {result.error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          <button onClick={handleImport} disabled={loading || !file} className="btn-primary flex-1 disabled:opacity-50">
            {loading ? 'Importing...' : `Import${preview ? ` ${preview.total} Leads` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
