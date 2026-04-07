import { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { dialer, agents as agentsApi } from '../../services/api';
import { PhoneOff, Mic, MicOff, Circle, PhoneForwarded, Calendar, Pause, Play } from 'lucide-react';
import DispositionModal from './DispositionModal';
import ScriptPanel from './ScriptPanel';
import TransferPanel from './TransferPanel';
import CallbackModal from './CallbackModal';

export default function ActiveCallBar() {
  const { activeCall, agentStatus, clearActiveCall, setAgentStatus } = useStore();
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showDisposition, setShowDisposition] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showCallback, setShowCallback] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [held, setHeld] = useState(false);
  const timerRef = useRef(null);

  // Call timer
  useEffect(() => {
    if (activeCall && agentStatus === 'on_call') {
      setCallDuration(0);
      timerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeCall?.callId, agentStatus]);

  function formatTimer(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  if (!activeCall && agentStatus !== 'wrap_up') return null;

  if (agentStatus === 'wrap_up') {
    return (
      <>
        <div className="bg-yellow-900/30 border-b border-yellow-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Circle size={10} fill="currentColor" className="text-yellow-400 animate-pulse" />
            <span className="text-sm font-medium text-yellow-300">Wrap Up — Enter disposition</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCallback(true)} className="btn-secondary text-sm py-1.5">
              <Calendar size={14} className="inline mr-1" /> Schedule Callback
            </button>
            <button onClick={() => setShowDisposition(true)} className="btn-primary text-sm py-1.5">
              Disposition Call
            </button>
          </div>
        </div>
        {showDisposition && (
          <DispositionModal
            callId={activeCall?.callId}
            leadId={activeCall?.lead?.id}
            onClose={() => { setShowDisposition(false); clearActiveCall(); }}
          />
        )}
        {showCallback && (
          <CallbackModal
            leadId={activeCall?.lead?.id}
            campaignId={activeCall?.campaignId}
            leadName={`${activeCall?.lead?.first_name || ''} ${activeCall?.lead?.last_name || ''}`}
            onClose={() => setShowCallback(false)}
          />
        )}
      </>
    );
  }

  const handleHangup = async () => {
    if (activeCall?.callControlId) {
      await dialer.hangup(activeCall.callControlId);
    }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const toggleRecording = async () => {
    if (recording) {
      await dialer.stopRecording(activeCall.callControlId);
    } else {
      await dialer.startRecording(activeCall.callControlId);
    }
    setRecording(!recording);
  };

  return (
    <>
      <div className="bg-blue-900/30 border-b border-blue-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Circle size={10} fill="currentColor" className="text-blue-400 animate-pulse" />
          <div>
            <span className="text-sm font-medium text-blue-300">
              On Call: {activeCall?.lead?.first_name} {activeCall?.lead?.last_name}
            </span>
            <span className="text-xs text-gray-400 ml-3">{activeCall?.lead?.phone}</span>
          </div>
          <span className="text-sm font-mono text-blue-300 bg-blue-900/50 px-2 py-0.5 rounded">
            {formatTimer(callDuration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setMuted(!muted)}
            className={`p-2 rounded-lg transition-colors ${muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>

          <button onClick={() => setHeld(!held)}
            className={`p-2 rounded-lg transition-colors ${held ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {held ? <Play size={16} /> : <Pause size={16} />}
          </button>

          <button onClick={toggleRecording}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${recording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            {recording ? 'REC ●' : 'Record'}
          </button>

          <button onClick={() => setShowTransfer(!showTransfer)}
            className={`p-2 rounded-lg transition-colors ${showTransfer ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
            <PhoneForwarded size={16} />
          </button>

          <button onClick={handleHangup}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
            <PhoneOff size={16} /> Hang Up
          </button>
        </div>
      </div>

      {/* Expandable panels below the call bar */}
      {(activeCall || showTransfer) && (
        <div className="bg-gray-950 border-b border-gray-800 px-6 py-4 grid grid-cols-2 gap-4">
          {/* Script panel */}
          <ScriptPanel campaignId={activeCall?.campaignId} />

          {/* Transfer panel */}
          {showTransfer && (
            <TransferPanel
              callControlId={activeCall?.callControlId}
              callId={activeCall?.callId}
              onClose={() => setShowTransfer(false)}
              onTransferred={() => { setShowTransfer(false); clearActiveCall(); }}
            />
          )}

          {/* Lead quick info */}
          {!showTransfer && activeCall?.lead && (
            <div className="card">
              <h4 className="text-sm font-semibold mb-2">Lead Info</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-xs text-gray-500">Name</span><p>{activeCall.lead.first_name} {activeCall.lead.last_name}</p></div>
                <div><span className="text-xs text-gray-500">Phone</span><p>{activeCall.lead.phone}</p></div>
                <div><span className="text-xs text-gray-500">Email</span><p>{activeCall.lead.email || '—'}</p></div>
                <div><span className="text-xs text-gray-500">Company</span><p>{activeCall.lead.company || '—'}</p></div>
                <div><span className="text-xs text-gray-500">Last Disposition</span><p>{activeCall.lead.last_disposition || 'None'}</p></div>
                <div><span className="text-xs text-gray-500">Attempts</span><p>{activeCall.lead.attempts || 0}</p></div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
