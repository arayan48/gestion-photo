import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../stores/toast.store.js'

const STYLES = {
  success: { icon: CheckCircle,     bar: 'bg-green-500',  bg: 'bg-white dark:bg-gray-900 border-green-200 dark:border-green-800',  text: 'text-green-600 dark:text-green-400' },
  error:   { icon: XCircle,         bar: 'bg-red-500',    bg: 'bg-white dark:bg-gray-900 border-red-200 dark:border-red-800',      text: 'text-red-600 dark:text-red-400' },
  warn:    { icon: AlertTriangle,   bar: 'bg-amber-500',  bg: 'bg-white dark:bg-gray-900 border-amber-200 dark:border-amber-800',  text: 'text-amber-600 dark:text-amber-400' },
  info:    { icon: Info,            bar: 'bg-blue-500',   bg: 'bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-800',    text: 'text-blue-600 dark:text-blue-400' },
}

function ToastItem({ toast }) {
  const [visible, setVisible] = useState(false)
  const remove = useToastStore((s) => s.remove)
  const s = STYLES[toast.type] || STYLES.info
  const Icon = s.icon

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
  }, [])

  const dismiss = () => {
    setVisible(false)
    setTimeout(() => remove(toast.id), 200)
  }

  return (
    <div
      className={`flex items-start gap-3 w-80 rounded-xl border shadow-lg overflow-hidden pl-0 pr-3 py-3 transition-all duration-200 ${s.bg} ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <div className={`w-1 self-stretch rounded-r-full ${s.bar} shrink-0`} />
      <Icon size={16} className={`${s.text} shrink-0 mt-0.5`} />
      <p className="text-sm text-slate-700 dark:text-gray-200 flex-1 leading-snug">{toast.message}</p>
      <button onClick={dismiss} className="text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300 shrink-0">
        <X size={14} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (!toasts.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} />
        </div>
      ))}
    </div>
  )
}
