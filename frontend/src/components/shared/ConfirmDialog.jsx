import { useConfirmStore } from '../../stores/confirm.store.js'
import { AlertTriangle, X } from 'lucide-react'

export default function ConfirmDialog() {
  const { open, title, message, confirmLabel, danger, close } = useConfirmStore()

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60" onClick={() => close(false)}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Icône + titre */}
          <div className="flex items-start gap-4 mb-4">
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
            }`}>
              <AlertTriangle size={20} className={danger ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-900 dark:text-gray-100">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">{message}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => close(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-gray-800 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={() => close(true)}
              className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                danger
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-violet-600 hover:bg-violet-700'
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
