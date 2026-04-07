import { useState } from 'react';
import { transfers as transfersApi, agents as agentsApi } from '../../services/api';
import { PhoneForwarded, X } from 'lucide-react';

export default function TransferPanel({ callControlId, callId, onClose, onTransferred }) {
  const [transferType, setTransferType] = useState('cold');
  const [toNumber, setToNumber] = useState('');
  const [transferring, setTransferring] = useState(false);

  async function handleTransfer() {
    if (!toNumber) return;
    setTransferring(true);

    try {
      if (transferType === 'cold') {
        await transfersApi.cold({ callControlId, callId, toNumber });
      } else {
        await transfersApi.warm({ callControlId, callId, toNumber });
      }
      onTransferred?.();
    } catch (err) {
      console.error('Transfer failed:', err);
    }
    setTransferring(false);
  }

  return (
    <div className="card border-orange-800/50">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PhoneForwarded size={16} className="text-orange-400" />
          <h4 className="text-sm font-semibold">Transfer Call</h4>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={16} /></button>
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTransferType('cold')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${transferType === 'cold' ? 'bg-orange-600/20 text-orange-400 border border-orange-600' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
          Cold Transfer
        </button>
        <button onClick={() => setTransferType('warm')}
          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${transferType === 'warm' ? 'bg-blue-600/20 text-blue-400 border border-blue-600' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
          Warm Transfer
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {transferType === 'cold' ? 'You will be disconnected immediately.' : 'All three parties will be on the line. You can drop when ready.'}
      </p>

      <input value={toNumber} onChange={e => setToNumber(e.target.value)} placeholder="Transfer to number..." className="input mb-3" />

      <button onClick={handleTransfer} disabled={transferring || !toNumber} className="btn-primary w-full disabled:opacity-50">
        {transferring ? 'Transferring...' : `${transferType === 'cold' ? 'Cold' : 'Warm'} Transfer`}
      </button>
    </div>
  );
}
