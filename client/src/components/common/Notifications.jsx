import { useStore } from '../../store/useStore';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const icons = {
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
  error: AlertTriangle
};

const colors = {
  success: 'bg-green-900/90 border-green-700 text-green-200',
  warning: 'bg-yellow-900/90 border-yellow-700 text-yellow-200',
  info: 'bg-blue-900/90 border-blue-700 text-blue-200',
  error: 'bg-red-900/90 border-red-700 text-red-200'
};

export default function Notifications() {
  const notifications = useStore(s => s.notifications);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map(n => {
        const Icon = icons[n.type] || Info;
        return (
          <div key={n.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${colors[n.type] || colors.info} shadow-lg animate-slide-in`}>
            <Icon size={18} />
            <span className="text-sm">{n.message}</span>
          </div>
        );
      })}
    </div>
  );
}
