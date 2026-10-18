import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Command } from 'cmdk'
import * as RDialog from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Search, FolderOpen, Globe, Clock, Heart, Trash2, LayoutDashboard, Wrench, Settings, Upload,
  FolderPlus, Sun, Moon, Keyboard, LogOut, Folder, FileImage, FileVideo, CornerDownLeft, Palette, Camera,
} from 'lucide-react'
import api from '../../utils/api.js'
import { useUiStore } from '../../stores/ui.store.js'
import { useThemeStore } from '../../stores/theme.store.js'
import { useAuthStore, usePermission } from '../../stores/auth.store.js'
import { useDebounce } from '../../hooks/useDebounce.js'
import { pickFiles, createFolder } from '../../lib/actions.js'
import { formatSize, formatRelative } from '../../lib/format.js'
import { isVideo } from '../../lib/media.js'
import { useAdminLinks } from './Sidebar.jsx'
import { Kbd } from '../ui/Kbd.jsx'
import { Spinner } from '../ui/Spinner.jsx'

function Item({ icon: Icon, children, onSelect, shortcut, value, thumb, sub }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-default items-center gap-3 px-3 py-2 text-[13px] text-fg outline-none data-[selected=true]:bg-accent-600 data-[selected=true]:text-white"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden text-subtle group-data-[selected=true]:text-white">
        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Icon size={15} strokeWidth={1.75} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{children}</span>
        {sub && <span className="block truncate font-mono text-[10.5px] opacity-60">{sub}</span>}
      </span>
      {shortcut && <Kbd>{shortcut}</Kbd>}
      <CornerDownLeft size={13} className="hidden opacity-70 group-data-[selected=true]:block" />
    </Command.Item>
  )
}

function Group({ heading, children }) {
  return (
    <Command.Group heading={heading} className="pb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:text-subtle">
      {children}
    </Command.Group>
  )
}

export default function CommandPalette() {
  const { commandOpen: open, setCommandOpen: setOpen, setShortcutsOpen } = useUiStore()
  const { resolvedTheme, toggle } = useThemeStore()
  const logout = useAuthStore((s) => s.logout)
  const can = usePermission()
  const adminLinks = useAdminLinks()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const q = useDebounce(query.trim(), 220)

  useEffect(() => { if (!open) setQuery('') }, [open])

  const { data: files = [], isFetching } = useQuery({
    queryKey: ['palette-search', q],
    queryFn: () => api.get('/files', { params: { view: 'mine', global: 'true', search: q, limit: 8 } }).then((r) => r.data.files),
    enabled: open && q.length >= 2,
    staleTime: 10_000,
  })

  const { data: folders = [] } = useQuery({
    queryKey: ['folder-tree'],
    queryFn: () => api.get('/files/folders/tree').then((r) => r.data),
    enabled: open,
    staleTime: 30_000,
  })

  const matchingFolders = useMemo(() => {
    if (!q) return folders.slice(0, 5)
    const needle = q.toLowerCase()
    return folders.filter((f) => f.name.toLowerCase().includes(needle)).slice(0, 6)
  }, [folders, q])

  const run = (fn) => { setOpen(false); setTimeout(fn, 50) }

  return (
    <RDialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <RDialog.Portal forceMount>
            <RDialog.Overlay asChild forceMount>
              <motion.div className="fixed inset-0 z-[270] bg-black/60" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} />
            </RDialog.Overlay>
            <div className="pointer-events-none fixed inset-0 z-[271] flex items-start justify-center px-3 pt-[8vh] sm:pt-[14vh]">
              <RDialog.Content asChild forceMount>
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="pointer-events-auto w-full max-w-xl overflow-hidden rounded-sm border border-line-strong bg-elevated shadow-float"
                >
                  <RDialog.Title className="sr-only">Palette de commandes</RDialog.Title>
                  <RDialog.Description className="sr-only">Rechercher des fichiers, dossiers et actions</RDialog.Description>
                  <Command loop shouldFilter={true} filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                    <div className="flex items-center gap-3 border-b border-line px-4">
                      <Search size={16} strokeWidth={1.75} className="shrink-0 text-subtle" />
                      <Command.Input
                        value={query}
                        onValueChange={setQuery}
                        placeholder="Rechercher un fichier, un dossier, une action…"
                        className="h-12 w-full bg-transparent text-[15px] text-fg outline-none placeholder:text-subtle"
                      />
                      {isFetching ? <Spinner size={16} /> : <Kbd>Échap</Kbd>}
                    </div>
                    <Command.List className="max-h-[min(460px,60vh)] overflow-y-auto overscroll-contain py-1">
                      <Command.Empty className="py-12 text-center text-sm text-muted">
                        {q.length >= 2 && isFetching ? 'Recherche…' : 'Aucun résultat'}
                      </Command.Empty>

                      {files.length > 0 && (
                        <Group heading="Fichiers">
                          {files.map((f) => (
                            <Item
                              key={f.id}
                              value={`fichier ${f.original_name} ${q}`}
                              icon={isVideo(f) ? FileVideo : FileImage}
                              thumb={f.thumbnail_path}
                              sub={`${formatSize(f.size)} · ${formatRelative(f.created_at)}`}
                              onSelect={() => run(() => navigate(`/explorer${f.folder_id ? `/${f.folder_id}` : ''}?file=${f.id}`))}
                            >
                              {f.original_name}
                            </Item>
                          ))}
                        </Group>
                      )}

                      {matchingFolders.length > 0 && (
                        <Group heading="Dossiers">
                          {matchingFolders.map((f) => (
                            <Item key={f.id} value={`dossier ${f.name}`} icon={Folder} onSelect={() => run(() => navigate(`/explorer/${f.id}`))}>
                              {f.name}
                            </Item>
                          ))}
                        </Group>
                      )}

                      {q.length >= 2 && (
                        <Group heading="Recherche">
                          <Item value={`rechercher partout ${q}`} icon={Search} onSelect={() => run(() => navigate(`/explorer?view=search&q=${encodeURIComponent(q)}`))}>
                            Rechercher « {q} » dans tout mon espace
                          </Item>
                        </Group>
                      )}

                      <Group heading="Actions">
                        {can('files.upload') && <Item value="importer upload envoyer fichiers" icon={Upload} shortcut="U" onSelect={() => run(() => pickFiles())}>Importer des fichiers</Item>}
                        {can('files.upload') && <Item value="prendre photo appareil camera" icon={Camera} onSelect={() => run(() => pickFiles({ capture: true }))}>Prendre une photo</Item>}
                        {can('files.create_folder') && <Item value="nouveau dossier créer" icon={FolderPlus} shortcut="N" onSelect={() => run(() => createFolder())}>Nouveau dossier</Item>}
                        <Item value="thème sombre clair basculer" icon={resolvedTheme === 'dark' ? Sun : Moon} onSelect={() => run(toggle)}>
                          {resolvedTheme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
                        </Item>
                        <Item value="apparence couleur accent personnaliser" icon={Palette} onSelect={() => run(() => navigate('/settings?tab=appearance'))}>Personnaliser l'apparence</Item>
                        <Item value="raccourcis clavier aide" icon={Keyboard} shortcut="?" onSelect={() => run(() => setShortcutsOpen(true))}>Raccourcis clavier</Item>
                      </Group>

                      <Group heading="Navigation">
                        <Item value="aller mon espace accueil" icon={FolderOpen} onSelect={() => run(() => navigate('/explorer'))}>Mon espace</Item>
                        {can('files.view_others') && <Item value="aller espace commun" icon={Globe} onSelect={() => run(() => navigate('/explorer?view=others'))}>Espace commun</Item>}
                        <Item value="aller récents" icon={Clock} onSelect={() => run(() => navigate('/explorer?view=recent'))}>Récents</Item>
                        <Item value="aller favoris" icon={Heart} onSelect={() => run(() => navigate('/explorer?view=favorites'))}>Favoris</Item>
                        <Item value="aller corbeille" icon={Trash2} onSelect={() => run(() => navigate('/explorer?view=trash'))}>Corbeille</Item>
                        {adminLinks.map((l) => (
                          <Item key={l.to} value={`aller ${l.label} admin`} icon={l.to === '/dashboard' ? LayoutDashboard : Wrench} onSelect={() => run(() => navigate(l.to))}>{l.label}</Item>
                        ))}
                        <Item value="paramètres compte profil" icon={Settings} onSelect={() => run(() => navigate('/settings'))}>Paramètres</Item>
                        <Item value="déconnexion quitter" icon={LogOut} onSelect={() => run(async () => { await logout(); navigate('/login') })}>Déconnexion</Item>
                      </Group>
                    </Command.List>
                    <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10.5px] text-subtle">
                      <span className="flex items-center gap-1.5"><Kbd>↑</Kbd><Kbd>↓</Kbd> naviguer</span>
                      <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> ouvrir</span>
                      <span className="ml-auto hidden sm:block">2 lettres minimum pour les fichiers</span>
                    </div>
                  </Command>
                </motion.div>
              </RDialog.Content>
            </div>
          </RDialog.Portal>
        )}
      </AnimatePresence>
    </RDialog.Root>
  )
}
