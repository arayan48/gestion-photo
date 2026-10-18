import { Link, useLocation } from 'react-router-dom'
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
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-safe md:hidden">
        <div className="mx-auto flex h-14 max-w-md items-center justify-around px-2">
          {TABS.map((tab, i) => {
            if (tab.fab) {
              return (
                <button
                  key="fab"
                  onClick={() => setCreateSheetOpen(true)}
                  aria-label="Créer"
                  className="flex h-10 w-12 items-center justify-center rounded-sm bg-accent-600 text-white active:bg-accent-700"
                >
                  <Plus size={20} strokeWidth={2} />
                </button>
              )
            }
            if (tab.menu) {
              return (
                <button key="menu" onClick={() => setMobileNavOpen(true)} className="flex w-16 flex-col items-center gap-1 py-1 text-subtle">
                  <Menu size={19} strokeWidth={1.75} />
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              )
            }
            const active = pathname.startsWith('/explorer') && (tab.view === null ? !view : view === tab.view)
            const Icon = tab.icon
            return (
              <Link key={i} to={tab.to} className={cn('relative flex w-16 flex-col items-center gap-1 py-1', active ? 'text-fg' : 'text-subtle')}>
                {active && <span className="absolute -top-2 h-[2px] w-8 bg-accent-500" />}
                <Icon size={19} strokeWidth={1.75} />
                <span className="text-[10px]">{tab.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <ActionSheet open={createSheetOpen} onOpenChange={setCreateSheetOpen} title="Ajouter" items={items} />
    </>
  )
}
