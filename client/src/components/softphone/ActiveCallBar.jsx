import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { dialer, agents as agentsApi } from '../../services/api';
import { PhoneOff, Mic, MicOff, Circle } from 'lucide-react';
import DispositionModal from './DispositionModal';

export default function ActiveCallBar() {
  const { activeCall, agentStatus, clearActiveCall, setAgentStatus } = useStore();
  const [muted, setMuted] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showDisposition, setShowDisposition] = useState(false);
  const [callTimer, setCallTimer] = useState(0);

  if (!activeCall && agentStatus !== 'wrap_up') return null;

  if (agentStatus === 'wrap_up') {
    return (
      <>
        <div className="bg-yellow-900/30 border-b border-yellow-800 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Circle size={10} fill="currentColor" className="text-yellow-400 animate-pulse" />
            <span className="text-sm font-medium text-yellow-300">Wrap Up — Enter disposition</span>
          </div>
          <button onClick={() => setShowDisposition(true)} className="btn-primary text-sm py-1.5">
            Disposition Call
          </button>
        </div>
        {showDisposition && (
          <DispositionModal
            callId={activeCall?.callId}
            leadId={activeCall?.lead?.id}
            onClose={() => {
              setShowDisposition(false);
              clearActiveCall();
            }}
          />
        )}
      </>
    );
  }

  const handleHangup = async () => {
    if (activeCall?.callControlId) {
      await dialer.hangup(activeCall.callControlId);
    }
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
    <div className="bg-blue-900/30 border-b border-blue-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Circle size={10} fill="currentColor" className="text-blue-400 animate-pulse" />
        <div>
          <span className="text-sm font-medium text-blue-300">
            On Call: {activeCall?.lead?.first_name} {activeCall?.lead?.last_name}
          </span>
          <span className="text-xs text-gray-400 ml-3">{activeCall?.lead?.phone}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setMuted(!muted)}
          className={`p-2 rounded-lg transition-colors ${muted ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          {muted ? <MicOff size={16} /> : <Mic size={16} />}
        </button>

        <button
          onClick={toggleRecording}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${recording ? 'bg-red-600 text-white animate-pulse' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          {recording ? 'REC ●' : 'Record'}
        </button>

        <button onClick={handleHangup} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <PhoneOff size={16} />
          Hang Up
        </button>
      </div>
    </div>
  );
}
