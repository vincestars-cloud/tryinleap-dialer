import { useState, useEffect } from 'react';
import { reporting as reportingApi } from '../services/api';
import { BarChart3, TrendingUp, Phone, Clock, Users, Target } from 'lucide-react';

export default function ReportingPage() {
  const [overview, setOverview] = useState(null);
  const [agentPerf, setAgentPerf] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [campaignSummary, setCampaignSummary] = useState([]);
  const [dateRange, setDateRange] = useState('today');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [dateRange]);

  async function loadData() {
    setLoading(true);
    const params = getDateParams();
    const [o, a, h, c] = await Promise.all([
      reportingApi.overview(params),
      reportingApi.agentPerformance(params),
      reportingApi.hourly(params),
      reportingApi.campaignSummary()
    ]);
    setOverview(o);
    setAgentPerf(a);
    setHourly(h);
    setCampaignSummary(c);
    setLoading(false);
  }

  function getDateParams() {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (dateRange === 'today') return { start_date: `${today}T00:00:00Z`, end_date: now.toISOString(), date: today };
    if (dateRange === 'week') {
      const weekAgo = new Date(now - 7 * 86400000).toISOString();
      return { start_date: weekAgo, end_date: now.toISOString(), date: today };
    }
    const monthAgo = new Date(now - 30 * 86400000).toISOString();
    return { start_date: monthAgo, end_date: now.toISOString(), date: today };
  }

  function formatTime(seconds) {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 ? `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}` : `${m}:${s.toString().padStart(2,'0')}`;
  }

  if (loading) return <div className="text-gray-500">Loading reports...</div>;

  const maxHourlyCalls = Math.max(...hourly.map(h => h.calls), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reporting Dashboard</h2>
        <div className="flex gap-2">
          {['today', 'week', 'month'].map(r => (
            <button key={r} onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${dateRange === r ? 'bg-leap-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-6 gap-3">
          <KPI icon={Phone} label="Total Calls" value={overview.totalCalls} color="blue" />
          <KPI icon={Users} label="Connected" value={overview.connected} color="green" />
          <KPI icon={Target} label="Contact Rate" value={`${overview.contactRate}%`} color="purple" />
          <KPI icon={TrendingUp} label="Conversion" value={`${overview.conversionRate}%`} color="yellow" />
          <KPI icon={Clock} label="Avg Duration" value={formatTime(overview.avgDuration)} color="cyan" />
          <KPI icon={BarChart3} label="Talk Time" value={formatTime(overview.totalTalkTime)} color="orange" />
        </div>
      )}

      {/* Hourly Call Volume Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Hourly Call Volume</h3>
        <div className="flex items-end gap-1 h-40">
          {hourly.map(h => (
            <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '120px' }}>
                <div className="w-full bg-blue-500/60 rounded-t transition-all" style={{ height: `${(h.calls / maxHourlyCalls) * 100}%`, minHeight: h.calls > 0 ? '2px' : '0' }} />
                <div className="w-full bg-green-500/60 rounded-t transition-all" style={{ height: `${(h.connected / maxHourlyCalls) * 100}%`, minHeight: h.connected > 0 ? '2px' : '0' }} />
              </div>
              <span className="text-[10px] text-gray-600">{h.hour}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500/60 rounded" /> Calls</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500/60 rounded" /> Connected</span>
        </div>
      </div>

      {/* Disposition Breakdown */}
      {overview?.dispositions && Object.keys(overview.dispositions).length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Disposition Breakdown</h3>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(overview.dispositions).sort((a, b) => b[1] - a[1]).map(([code, count]) => (
              <div key={code} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-medium">{code}</span>
                <span className="text-lg font-bold text-leap-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Agent Performance */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-800">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Total Calls</th>
                <th className="px-4 py-3">Connected</th>
                <th className="px-4 py-3">Sales</th>
                <th className="px-4 py-3">Appointments</th>
                <th className="px-4 py-3">Avg Talk Time</th>
                <th className="px-4 py-3">Total Talk Time</th>
                <th className="px-4 py-3">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {agentPerf.map(a => (
                <tr key={a.agentId} className="border-b border-gray-800/50">
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">{a.totalCalls}</td>
                  <td className="px-4 py-3">{a.connectedCalls}</td>
                  <td className="px-4 py-3 text-green-400">{a.sales}</td>
                  <td className="px-4 py-3 text-blue-400">{a.appointments}</td>
                  <td className="px-4 py-3">{formatTime(a.avgTalkTime)}</td>
                  <td className="px-4 py-3">{formatTime(a.totalTalkTime)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${a.conversionRate > 10 ? 'badge-green' : a.conversionRate > 5 ? 'badge-yellow' : 'badge-gray'}`}>
                      {a.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
              {agentPerf.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No data yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Campaign Summary */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Campaign Summary</h3>
        <div className="space-y-3">
          {campaignSummary.map(c => (
            <div key={c.id} className="bg-gray-800 rounded-lg px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium">{c.name}</span>
                  <span className={`ml-2 badge ${c.status === 'active' ? 'badge-green' : 'badge-gray'}`}>{c.status}</span>
                </div>
                <span className="text-sm text-gray-400">{c.dial_mode}</span>
              </div>
              <div className="grid grid-cols-5 gap-4 text-sm">
                <div><span className="text-xs text-gray-500">Leads</span><p className="font-medium">{c.totalLeads}</p></div>
                <div><span className="text-xs text-gray-500">Contacted</span><p className="font-medium">{c.contactedLeads}</p></div>
                <div><span className="text-xs text-gray-500">Calls</span><p className="font-medium">{c.totalCalls}</p></div>
                <div><span className="text-xs text-gray-500">Conversions</span><p className="font-medium text-green-400">{c.conversions}</p></div>
                <div><span className="text-xs text-gray-500">Penetration</span><p className="font-medium">{c.penetration}%</p></div>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full mt-2">
                <div className="h-full bg-leap-500 rounded-full" style={{ width: `${c.penetration}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }) {
  const colors = {
    blue: 'text-blue-400 bg-blue-900/30',
    green: 'text-green-400 bg-green-900/30',
    purple: 'text-purple-400 bg-purple-900/30',
    yellow: 'text-yellow-400 bg-yellow-900/30',
    cyan: 'text-cyan-400 bg-cyan-900/30',
    orange: 'text-orange-400 bg-orange-900/30'
  };
  return (
    <div className="card flex items-center gap-3">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}><Icon size={18} /></div>
      <div><p className="text-xl font-bold">{value}</p><p className="text-[10px] text-gray-500 uppercase">{label}</p></div>
    </div>
  );
}
