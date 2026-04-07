import { useState, useEffect } from 'react';
import { scripts as scriptsApi } from '../../services/api';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';

export default function ScriptPanel({ campaignId }) {
  const [scriptList, setScriptList] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [activeScript, setActiveScript] = useState(0);

  useEffect(() => {
    if (campaignId) loadScripts();
  }, [campaignId]);

  async function loadScripts() {
    const data = await scriptsApi.list(campaignId);
    setScriptList(data || []);
  }

  if (scriptList.length === 0) return null;

  return (
    <div className="card border-leap-800/50">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-leap-400" />
          <h4 className="text-sm font-semibold">Call Script</h4>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </div>

      {expanded && (
        <div className="mt-3">
          {scriptList.length > 1 && (
            <div className="flex gap-1 mb-3">
              {scriptList.map((s, i) => (
                <button key={s.id} onClick={() => setActiveScript(i)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${activeScript === i ? 'bg-leap-600/20 text-leap-400' : 'bg-gray-800 text-gray-500 hover:text-white'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="bg-gray-800/50 rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
            {scriptList[activeScript]?.content}
          </div>
        </div>
      )}
    </div>
  );
}
