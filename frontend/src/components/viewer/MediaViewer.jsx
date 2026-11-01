import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import {
  X, ChevronLeft, ChevronRight, Download, Heart, Info, ZoomIn, ZoomOut, Play, Pause,
  Trash2, MoreHorizontal, Copy, Share2, Loader2, ImageOff,
} from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { mediaUrl, isVideo, isImage } from '../../lib/media.js'
import { formatSize } from '../../lib/format.js'
import { downloadFile, copyFileLink, shareFile } from '../../lib/actions.js'
import { useHotkeys } from '../../hooks/useHotkeys.js'
import { useIsDesktop } from '../../hooks/useMediaQuery.js'
import { useConfirmStore } from '../../stores/confirm.store.js'
import { refreshAccessToken } from '../../utils/api.js'
import { useAuthStore, usePermission } from '../../stores/auth.store.js'
import { setFavorite, trashFiles, fileMenu } from '../explorer/itemActions.js'
import { IconButton } from '../ui/Button.jsx'
import { DropdownMenu } from '../ui/Menu.jsx'
import InfoPanel from './InfoPanel.jsx'

const SLIDESHOW_MS = 4500

function ImageStage({ file, onZoomChange, zoomApi, onSwipe, onClose }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [scale, setScale] = useState(1)
  useEffect(() => { setLoaded(false); setError(false); setAttempt(0) }, [file.id])

  // Échec de chargement : le token de l'URL a pu expirer → le renouveler et réessayer une fois
  const onError = () => {
    if (attempt > 0) return setError(true)
    refreshAccessToken().then(() => setAttempt(1)).catch(() => setError(true))
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-white/60">
        <ImageOff size={40} strokeWidth={1.5} />
        <p className="text-sm">Impossible d'afficher ce média</p>
      </div>
    )
  }

  return (
    <TransformWrapper
      key={file.id}
      minScale={1}
      maxScale={8}
      doubleClick={{ mode: 'toggle', step: 1.6 }}
      wheel={{ step: 0.12, activationKeys: ['Control', 'Meta'] }}
      pinch={{ step: 6 }}
      panning={{ disabled: scale <= 1, velocityDisabled: false }}
      onTransformed={(_, s) => { setScale(s.scale); onZoomChange(s.scale) }}
      onInit={(ref) => { zoomApi.current = ref }}
      centerOnInit
    >
      <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full flex items-center justify-center">
        <motion.div
          className="flex h-full w-full items-center justify-center"
          drag={scale <= 1.01 ? true : false}
          dragDirectionLock
          dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
          dragElastic={0.6}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) onSwipe(info.offset.x < 0 ? 1 : -1)
            else if (info.offset.y > 120 || info.velocity.y > 700) onClose()
          }}
        >
          {/* Miniature floue pendant le chargement de l'original */}
          {!loaded && file.thumbnail_path && (
            <img src={file.thumbnail_path} alt="" className="absolute max-h-full max-w-full scale-105 object-contain blur-md" draggable={false} />
          )}
          {!loaded && <Loader2 size={30} className="absolute animate-spin text-white/70" />}
          <img
            key={attempt}
            src={mediaUrl(file)}
            alt={file.original_name}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={onError}
            className={cn('max-h-full max-w-full select-none object-contain transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0', file.mime_type === 'image/svg+xml' && 'bg-checker')}
          />
        </motion.div>
      </TransformComponent>
    </TransformWrapper>
  )
}

export default function MediaViewer({ files, fileId, onNavigate, onClose, onNeedMore, isTrash, initialInfo = false }) {
  const index = files.findIndex((f) => f.id === fileId)
  const file = index >= 0 ? files[index] : null
  const isDesktop = useIsDesktop()
  const [showInfo, setShowInfo] = useState(() => initialInfo || window.innerWidth >= 1440)
  const [chrome, setChrome] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [playing, setPlaying] = useState(false)
  const zoomApi = useRef(null)
  const videoRef = useRef(null)
  const hideTimer = useRef(null)
  const wheelAcc = useRef(0)
  const wheelTimer = useRef(null)
  const filmRef = useRef(null)
  const confirmOpen = useConfirmStore((s) => s.open)
  const me = useAuthStore((s) => s.user)
  const can = usePermission()

  const go = useCallback((delta) => {
    if (!files.length) return
    const next = index + delta
    if (next < 0 || next >= files.length) return
    onNavigate(files[next].id)
    if (next >= files.length - 3) onNeedMore?.()
  }, [files, index, onNavigate, onNeedMore])

  // Fichier supprimé ou disparu de la liste : fermer
  useEffect(() => { if (fileId && files.length && index === -1) onClose() }, [index, fileId, files.length])

  // Précharger les voisins
  useEffect(() => {
    for (const d of [1, -1, 2]) {
      const n = files[index + d]
      if (n && isImage(n)) { const img = new Image(); img.src = mediaUrl(n) }
    }
  }, [index, files])

  // Masquer l'interface après inactivité (souris)
  const poke = useCallback(() => {
    setChrome(true)
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setChrome(false), 3200)
  }, [])
  useEffect(() => { poke(); return () => clearTimeout(hideTimer.current) }, [fileId])

  // Diaporama
  useEffect(() => {
    if (!playing || !file) return
    if (isVideo(file)) return // la vidéo avance à la fin de la lecture
    const t = setTimeout(() => (index < files.length - 1 ? go(1) : setPlaying(false)), SLIDESHOW_MS)
    return () => clearTimeout(t)
  }, [playing, fileId, index, files.length])

  useEffect(() => {
    filmRef.current?.querySelector(`[data-film="${fileId}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [fileId])

  // Un menu ouvert dans la visionneuse garde la main sur le clavier (flèches, Échap)
  const menuOpen = () => !!document.querySelector('[role="menu"]')
  useHotkeys(Object.fromEntries(Object.entries({
    arrowleft: () => go(-1),
    arrowright: () => go(1),
    escape: () => onClose(),
    i: () => setShowInfo((v) => !v),
    f: () => file && !isTrash && setFavorite([file], !file.is_favorite),
    d: () => file && downloadFile(file),
    s: () => setPlaying((v) => !v),
    '+': () => zoomApi.current?.zoomIn(0.4),
    '=': () => zoomApi.current?.zoomIn(0.4),
    '-': () => zoomApi.current?.zoomOut(0.4),
    '0': () => zoomApi.current?.resetTransform(),
    space: () => {
      const v = videoRef.current
      if (v) { v.paused ? v.play() : v.pause(); return }
      setPlaying((p) => !p)
    },
    delete: () => file && !isTrash && trashFiles([file]),
  }).map(([k, fn]) => [k, (e) => (menuOpen() ? false : fn(e))])), { enabled: !!file && !confirmOpen, overDialogs: true })

  // Balayage horizontal deux doigts sur pavé tactile → média précédent / suivant
  const onWheel = (e) => {
    if (e.ctrlKey || zoom > 1.01) return
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
    wheelAcc.current += e.deltaX
    if (Math.abs(wheelAcc.current) > 120) {
      go(wheelAcc.current > 0 ? 1 : -1)
      wheelAcc.current = 0
    }
    clearTimeout(wheelTimer.current)
    wheelTimer.current = setTimeout(() => { wheelAcc.current = 0 }, 200)
  }

  const menuCtx = useMemo(() => ({
    can, userId: me?.id, isSuperAdmin: me?.is_super_admin, isTrash,
    open: () => {}, info: () => setShowInfo(true),
  }), [can, me, isTrash])

  if (!file) return null
  const video = isVideo(file)
  // Pendant le diaporama, l'interface s'efface après quelques secondes sans mouvement
  const showChrome = chrome || !playing

  return (
    <RDialog.Root open onOpenChange={(o) => !o && onClose()}>
      <RDialog.Portal>
        <RDialog.Content
          className="fixed inset-0 z-[200] flex bg-[#070606] text-white outline-none"
          tabIndex={-1}
          // Pas de focus sur le premier bouton (évite l'infobulle « Fermer » à l'ouverture)
          onOpenAutoFocus={(e) => { e.preventDefault(); e.currentTarget?.focus?.() }}
          onPointerMove={poke}
          onEscapeKeyDown={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <RDialog.Title className="sr-only">{file.original_name}</RDialog.Title>

          <div className="relative flex min-w-0 flex-1 flex-col" onWheel={onWheel}>
            {/* Barre supérieure */}
            <motion.div
              animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : -10 }}
              className="absolute inset-x-0 top-0 z-20 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-2 pb-8 pt-2 sm:px-4 sm:pt-3"
              style={{ pointerEvents: showChrome ? 'auto' : 'none' }}
            >
              <IconButton icon={X} label="Fermer" shortcut="Échap" variant="glass" onClick={onClose} />
              <div className="min-w-0 flex-1 px-1">
                <p className="truncate text-[13px]">{file.original_name}</p>
                <p className="truncate font-mono text-[10.5px] text-white/50">
                  {index + 1} / {files.length} · {formatSize(file.size)}{file.width ? ` · ${file.width}×${file.height}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!video && isDesktop && (
                  <>
                    <IconButton icon={ZoomOut} label="Zoom arrière" shortcut="−" variant="glass" onClick={() => zoomApi.current?.zoomOut(0.4)} disabled={zoom <= 1} />
                    <button onClick={() => zoomApi.current?.resetTransform()} className="hidden h-9 min-w-[52px] px-2 font-mono text-[11px] text-white/70 hover:text-white md:block">
                      {Math.round(zoom * 100)} %
                    </button>
                    <IconButton icon={ZoomIn} label="Zoom avant" shortcut="+" variant="glass" onClick={() => zoomApi.current?.zoomIn(0.4)} />
                    <div className="mx-1 h-5 w-px bg-white/15" />
                  </>
                )}
                <IconButton icon={playing ? Pause : Play} label={playing ? 'Arrêter le diaporama' : 'Diaporama'} shortcut="S" variant="glass" onClick={() => setPlaying((v) => !v)} className="hidden sm:inline-flex" />
                {!isTrash && (
                  <IconButton
                    icon={Heart}
                    label={file.is_favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    shortcut="F"
                    variant="glass"
                    onClick={() => setFavorite([file], !file.is_favorite)}
                    iconClassName={file.is_favorite ? 'fill-current' : ''}
                  />
                )}
                <IconButton icon={Download} label="Télécharger" shortcut="D" variant="glass" onClick={() => downloadFile(file)} />
                <IconButton icon={Info} label="Informations" shortcut="I" variant="glass" active={showInfo} onClick={() => setShowInfo((v) => !v)} />
                <DropdownMenu
                  items={() => [
                    { label: 'Copier le lien public', icon: Copy, onSelect: () => copyFileLink(file) },
                    navigator.share && { label: 'Partager…', icon: Share2, onSelect: () => shareFile(file) },
                    { type: 'separator' },
                    ...fileMenu(file, menuCtx).filter((i) => i && !['Ouvrir', 'Informations', 'Télécharger', 'Sélectionner', 'Copier le lien public', 'Partager…'].includes(i.label)),
                  ]}
                  trigger={<button className="flex h-9 w-9 items-center justify-center rounded-sm text-white/75 hover:bg-white/10 hover:text-white" aria-label="Plus d'actions"><MoreHorizontal size={16} /></button>}
                />
                {!isTrash && (
                  <IconButton icon={Trash2} label="Mettre à la corbeille" shortcut="Suppr" variant="glass" onClick={() => trashFiles([file])} className="hidden hover:!bg-red-600 hover:!text-white sm:inline-flex" />
                )}
              </div>
            </motion.div>

            {/* Média */}
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-0 py-16 sm:px-16">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={file.id}
                  className="flex h-full w-full items-center justify-center"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {video ? (
                    <video
                      ref={videoRef}
                      key={file.id}
                      src={mediaUrl(file)}
                      poster={file.thumbnail_path || undefined}
                      controls
                      autoPlay
                      playsInline
                      onEnded={() => playing && go(1)}
                      className="h-full w-full object-contain outline-none"
                    />
                  ) : (
                    <ImageStage file={file} onZoomChange={setZoom} zoomApi={zoomApi} onSwipe={go} onClose={onClose} />
                  )}
                  {video && file.transcode_status === 'pending' && (
                    <p className="pointer-events-none absolute inset-x-0 bottom-20 mx-auto w-fit rounded bg-black/70 px-3 py-1.5 text-xs text-white">
                      Conversion en cours pour la lecture dans le navigateur. Le téléchargement donne déjà l'original.
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Flèches */}
              {index > 0 && (
                <motion.button
                  animate={{ opacity: showChrome ? 1 : 0 }}
                  onClick={() => go(-1)}
                  className="absolute left-0 top-1/2 z-10 hidden h-24 w-12 -translate-y-1/2 items-center justify-center text-white/50 transition-colors hover:text-white sm:flex"
                  aria-label="Précédent"
                >
                  <ChevronLeft size={28} strokeWidth={1.25} />
                </motion.button>
              )}
              {index < files.length - 1 && (
                <motion.button
                  animate={{ opacity: showChrome ? 1 : 0 }}
                  onClick={() => go(1)}
                  className="absolute right-0 top-1/2 z-10 hidden h-24 w-12 -translate-y-1/2 items-center justify-center text-white/50 transition-colors hover:text-white sm:flex"
                  aria-label="Suivant"
                >
                  <ChevronRight size={28} strokeWidth={1.25} />
                </motion.button>
              )}
            </div>

            {/* Pellicule */}
            {files.length > 1 && (
              <motion.div
                animate={{ opacity: showChrome ? 1 : 0, y: showChrome ? 0 : 10 }}
                style={{ pointerEvents: showChrome ? 'auto' : 'none' }}
                className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent pb-safe pt-8"
              >
                <div ref={filmRef} className="scrollbar-none mx-auto flex w-fit max-w-full gap-1.5 overflow-x-auto px-4 pb-3 pt-1">
                  {files.map((f) => (
                    <button
                      key={f.id}
                      data-film={f.id}
                      onClick={() => onNavigate(f.id)}
                      className={cn(
                        'relative h-11 w-11 shrink-0 overflow-hidden transition-opacity duration-150',
                        f.id === file.id ? 'outline outline-2 -outline-offset-2 outline-white' : 'opacity-40 hover:opacity-80'
                      )}
                    >
                      {f.thumbnail_path ? <img src={f.thumbnail_path} alt="" className="h-full w-full object-cover" loading="lazy" /> : <span className="flex h-full w-full items-center justify-center bg-white/10 text-[9px]">{isVideo(f) ? 'VID' : 'IMG'}</span>}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {playing && (
              <div className="absolute inset-x-0 top-0 z-30 h-0.5 bg-white/10">
                {!video && <motion.div key={file.id} className="h-full bg-accent-500" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: SLIDESHOW_MS / 1000, ease: 'linear' }} />}
              </div>
            )}
          </div>

          {/* Panneau d'informations : colonne à droite (bureau), feuille en bas (mobile) */}
          <AnimatePresence initial={false}>
            {showInfo && (isDesktop ? (
              <motion.div
                key="info-desktop"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 360, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                className="relative z-30 h-full shrink-0 overflow-hidden border-l border-[#272522]"
              >
                <div className="dark h-full w-[360px]"><InfoPanel file={file} onClose={() => setShowInfo(false)} /></div>
              </motion.div>
            ) : (
              <motion.div
                key="info-mobile"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 38 }}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                onDragEnd={(_, info) => { if (info.offset.y > 100) setShowInfo(false) }}
                className="dark absolute inset-x-0 bottom-0 z-40 h-[65dvh] overflow-hidden rounded-t-lg border-t border-[#3c3934]"
              >
                <InfoPanel file={file} onClose={() => setShowInfo(false)} className="pb-safe" />
              </motion.div>
            ))}
          </AnimatePresence>
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  )
}
