import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, X, Check, AlertCircle, RotateCcw, FileVideo, Loader2, CloudUpload, Ban } from 'lucide-react'
import { useUploadStore } from '../../stores/upload.store.js'
import { formatSize } from '../../lib/format.js'
import { QUALITY_LABELS } from '../../lib/media.js'
import { cn } from '../../lib/cn.js'
import { IconButton } from '../ui/Button.jsx'

const ACTIVE = ['queued', 'uploading', 'processing']

function Ring({ value, size = 36 }) {
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2" className="stroke-line" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2" strokeLinecap="butt"
        className="stroke-accent-500 transition-[stroke-dashoffset] duration-300"
        strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
    </svg>
  )
}

// Panneau flottant façon Google Drive : suit les envois pendant la navigation
export default function UploadManager() {
  const { items, panelOpen, collapsed, setCollapsed, cancel, retry, retryFailed, cancelAll, clearFinished } = useUploadStore()
  const active = items.filter((i) => ACTIVE.includes(i.status))
  const done = items.filter((i) => i.status === 'done').length
  const failed = items.filter((i) => i.status === 'error').length
  const totalBytes = items.filter((i) => i.status !== 'canceled').reduce((s, i) => s + i.size, 0)
  const sentBytes = items.filter((i) => i.status !== 'canceled').reduce((s, i) => s + (i.size * i.progress) / 100, 0)
  const overall = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0

  const title = active.length
    ? `Envoi de ${active.length} fichier${active.length > 1 ? 's' : ''}…`
    : failed ? `${done} envoyé${done > 1 ? 's' : ''}, ${failed} en échec` : `${done} fichier${done > 1 ? 's' : ''} envoyé${done > 1 ? 's' : ''}`

  return (
    <AnimatePresence>
      {panelOpen && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          className="fixed bottom-20 right-3 z-[120] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-sm border border-line-strong bg-elevated shadow-float md:bottom-5 md:right-5"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex h-9 w-9 items-center justify-center">
              {active.length ? <Ring value={overall} /> : failed ? <AlertCircle size={22} className="text-amber-500" /> : <Check size={18} className="text-emerald-500" />}
              {active.length > 0 && <span className="absolute font-mono text-[9px] text-fg">{overall}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] text-fg">{title}</p>
              <p className="font-mono text-[10.5px] text-subtle">{active.length ? `${overall} % · ${formatSize(sentBytes)} / ${formatSize(totalBytes)}` : 'Terminé'}</p>
            </div>
            <IconButton size="sm" icon={ChevronDown} label={collapsed ? 'Afficher' : 'Réduire'} onClick={() => setCollapsed(!collapsed)} iconClassName={cn('transition-transform', collapsed && 'rotate-180')} />
            <IconButton size="sm" icon={X} label={active.length ? 'Tout annuler' : 'Fermer'} onClick={() => (active.length ? cancelAll() : clearFinished())} />
          </div>

          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-line">
                <div className="max-h-72 overflow-y-auto py-1">
                  {items.map((it) => (
                    <div key={it.id} className="group flex items-center gap-3 px-3 py-2 hover:bg-overlay/60">
                      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden bg-overlay">
                        {it.preview ? <img src={it.preview} alt="" className="h-full w-full object-cover" /> : <FileVideo size={16} strokeWidth={1.5} className="text-subtle" />}
                        {it.status === 'done' && <span className="absolute bottom-0 right-0 flex h-3.5 w-3.5 items-center justify-center bg-fg"><Check size={10} strokeWidth={3} className="text-bg" /></span>}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-fg">{it.name}</p>
                        {it.status === 'error' ? (
                          <p className="truncate text-[11px] text-red-500">{it.error}</p>
                        ) : it.status === 'uploading' || it.status === 'processing' ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-[3px] flex-1 overflow-hidden bg-line">
                              <div className={cn('h-full bg-accent-500 transition-[width] duration-300', it.status === 'processing' && 'animate-pulse')} style={{ width: `${it.progress}%` }} />
                            </div>
                            <span className="w-16 text-right font-mono text-[10px] text-subtle">{it.status === 'processing' ? 'Traitement…' : `${it.progress} %`}</span>
                          </div>
                        ) : (
                          <p className="truncate font-mono text-[10.5px] text-subtle">
                            {formatSize(it.size)} · {it.folderName}
                            {it.status === 'queued' && (it.retries ? ' · nouvelle tentative…' : ' · en attente')}
                            {it.status === 'canceled' && ' · annulé'}
                            {it.status === 'done' && it.quality !== 'original' && ` · ${QUALITY_LABELS[it.quality]}`}
                          </p>
                        )}
                      </div>
                      {ACTIVE.includes(it.status) && (
                        it.status === 'uploading' ? <IconButton size="xs" icon={X} label="Annuler" onClick={() => cancel(it.id)} />
                          : it.status === 'processing' ? <Loader2 size={15} className="mx-1.5 animate-spin text-subtle" />
                            : <IconButton size="xs" icon={Ban} label="Retirer" onClick={() => cancel(it.id)} />
                      )}
                      {(it.status === 'error' || it.status === 'canceled') && <IconButton size="xs" icon={RotateCcw} label="Réessayer" onClick={() => retry(it.id)} />}
                    </div>
                  ))}
                </div>
                {failed > 0 && !active.length && (
                  <div className="border-t border-line p-2">
                    <button onClick={retryFailed} className="w-full py-2 text-xs text-fg underline underline-offset-4 hover:text-accent-500">
                      Réessayer les {failed} envoi(s) en échec
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
