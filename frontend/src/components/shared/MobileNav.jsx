import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FolderOpen, Clock, Heart, Plus, Menu, Upload, Camera, FolderPlus } from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { useUiStore } from '../../stores/ui.store.js'
import { usePermission } from '../../stores/auth.store.js'
import { pickFiles, createFolder } from '../../lib/actions.js'
import { ActionSheet } from '../ui/Menu.jsx'

const TABS = [
  { view: null, to: '/explorer', icon: FolderOpen, label: 'Espace' },
  { view: 'recent', to: '/explorer?view=recent', icon: Clock, label: 'Récents' },
  { fab: true },
  { view: 'favorites', to: '/explorer?view=favorites', icon: Heart, label: 'Favoris' },
  { menu: true, icon: Menu, label: 'Plus' },
]

// Barre de navigation basse (téléphone) avec bouton central de création
export default function MobileNav() {
  const { pathname, search } = useLocation()
  const view = new URLSearchParams(search).get('view')
  const { setMobileNavOpen, createSheetOpen, setCreateSheetOpen } = useUiStore()
  const can = usePermission()

  const items = [
    can('files.upload') && { label: 'Importer des photos et vidéos', icon: Upload, onSelect: () => pickFiles() },
    can('files.upload') && { label: 'Prendre une photo ou une vidéo', icon: Camera, onSelect: () => pickFiles({ capture: true }) },
    can('files.create_folder') && { label: 'Nouveau dossier', icon: FolderPlus, onSelect: () => createFolder() },
  ]

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-safe backdrop-blur-xl md:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
          {TABS.map((tab, i) => {
            if (tab.fab) {
              return (
                <button
                  key="fab"
                  onClick={() => setCreateSheetOpen(true)}
                  aria-label="Créer"
                  className="-mt-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-600 text-white shadow-glow ring-4 ring-bg transition-transform active:scale-90"
                >
                  <Plus size={26} strokeWidth={2.4} />
                </button>
              )
            }
            if (tab.menu) {
              return (
                <button key="menu" onClick={() => setMobileNavOpen(true)} className="flex w-16 flex-col items-center gap-1 py-1 text-subtle">
                  <Menu size={21} />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              )
            }
            const active = pathname.startsWith('/explorer') && (tab.view === null ? !view : view === tab.view)
            const Icon = tab.icon
            return (
              <Link key={i} to={tab.to} className={cn('relative flex w-16 flex-col items-center gap-1 py-1', active ? 'text-accent-600 dark:text-accent-400' : 'text-subtle')}>
                {active && <motion.span layoutId="mobile-tab" className="absolute -top-2 h-1 w-8 rounded-full bg-accent-500" />}
                <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <ActionSheet open={createSheetOpen} onOpenChange={setCreateSheetOpen} title="Créer" subtitle="Ajouter du contenu à votre espace" items={items} />
    </>
  )
}
