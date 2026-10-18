import { forwardRef } from 'react'
import {
  Search, X, LayoutGrid, List, Images, Film, Layers, CalendarRange, ArrowDownWideNarrow, CheckSquare,
  ZoomIn, ZoomOut, CalendarArrowDown, CalendarArrowUp, ArrowDownAZ, ArrowUpZA, HardDrive, Rows3, Type,
} from 'lucide-react'
import { cn } from '../../lib/cn.js'
import { usePreferencesStore, GRID_SIZES } from '../../stores/preferences.store.js'
import { Segmented } from '../ui/Form.jsx'
import { DropdownMenu } from '../ui/Menu.jsx'
import { Popover } from '../ui/Popover.jsx'
import { Button, IconButton } from '../ui/Button.jsx'
import { Kbd } from '../ui/Kbd.jsx'
import { Tooltip } from '../ui/Tooltip.jsx'

const SORTS = [
  { by: 'created_at', dir: 'desc', label: 'Plus récents', icon: CalendarArrowDown },
  { by: 'created_at', dir: 'asc', label: 'Plus anciens', icon: CalendarArrowUp },
  { by: 'original_name', dir: 'asc', label: 'Nom (A → Z)', icon: ArrowDownAZ },
  { by: 'original_name', dir: 'desc', label: 'Nom (Z → A)', icon: ArrowUpZA },
  { by: 'size', dir: 'desc', label: 'Plus volumineux', icon: HardDrive },
  { by: 'size', dir: 'asc', label: 'Plus légers', icon: HardDrive },
]

export const Toolbar = forwardRef(function Toolbar({
  filter, setFilter, type, setType, dateRange, setDateRange, hideFilter, showSort = true,
  isTouch, touchSelect, setTouchSelect, countLabel,
}, filterRef) {
  const { viewMode, setViewMode, sortBy, sortDir, setSort, gridSize, setGridSize, groupByDate, showNames, set } = usePreferencesStore()
  const currentSort = SORTS.find((s) => s.by === sortBy && s.dir === sortDir) || SORTS[0]
  const hasDate = dateRange.from || dateRange.to

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideFilter && (
        <div className="relative order-last w-full sm:order-none sm:w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setFilter(''); e.currentTarget.blur() } }}
            placeholder="Filtrer ce dossier…"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-[13px] text-fg outline-none transition-all placeholder:text-subtle hover:border-line-strong focus:border-accent-500 focus:ring-4 focus:ring-accent-500/15"
          />
          {filter ? (
            <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-subtle hover:bg-overlay hover:text-fg" aria-label="Effacer">
              <X size={14} />
            </button>
          ) : (
            <Kbd className="absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">/</Kbd>
          )}
        </div>
      )}

      <Segmented
        size="sm"
        value={type}
        onChange={setType}
        layoutId="type-filter"
        options={[
          { value: 'all', label: 'Tout', icon: Layers, hideLabelOnMobile: true },
          { value: 'image', label: 'Photos', icon: Images, hideLabelOnMobile: true },
          { value: 'video', label: 'Vidéos', icon: Film, hideLabelOnMobile: true },
        ]}
      />

      <Popover
        align="start"
        trigger={
          <Button size="sm" variant={hasDate ? 'primary' : 'outline'} icon={CalendarRange} className="h-8">
            <span className="hidden sm:inline">{hasDate ? 'Période' : 'Date'}</span>
          </Button>
        }
        className="w-72 p-4"
      >
        <p className="mb-3 text-sm font-semibold text-fg">Filtrer par date d'ajout</p>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Depuis le</span>
            <input type="date" className="input py-2" value={dateRange.from} max={dateRange.to || undefined} onChange={(e) => setDateRange((d) => ({ ...d, from: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Jusqu'au</span>
            <input type="date" className="input py-2" value={dateRange.to} min={dateRange.from || undefined} onChange={(e) => setDateRange((d) => ({ ...d, to: e.target.value }))} />
          </label>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { l: '7 jours', d: 7 }, { l: '30 jours', d: 30 }, { l: '1 an', d: 365 },
            ].map(({ l, d }) => (
              <button key={l} onClick={() => setDateRange({ from: new Date(Date.now() - d * 864e5).toISOString().slice(0, 10), to: '' })}
                className="rounded-full bg-overlay px-2.5 py-1 text-xs text-muted hover:bg-accent-500/10 hover:text-accent-600">
                {l}
              </button>
            ))}
            {hasDate && (
              <button onClick={() => setDateRange({ from: '', to: '' })} className="ml-auto flex items-center gap-1 rounded-full px-2 py-1 text-xs text-red-500 hover:bg-red-500/10">
                <X size={12} /> Effacer
              </button>
            )}
          </div>
        </div>
      </Popover>

      {showSort && (
        <DropdownMenu
          align="start"
          items={[
            { type: 'label', label: 'Trier par' },
            ...SORTS.map((s) => ({ label: s.label, icon: s.icon, checked: s === currentSort, onSelect: () => setSort(s.by, s.dir) })),
          ]}
          trigger={
            <Button size="sm" variant="outline" icon={ArrowDownWideNarrow} className="h-8">
              <span className="hidden md:inline">{currentSort.label}</span>
            </Button>
          }
        />
      )}

      {countLabel && <span className="hidden text-xs text-subtle lg:inline">{countLabel}</span>}

      <div className="ml-auto flex items-center gap-1.5">
        {isTouch && (
          <Button size="sm" variant={touchSelect ? 'primary' : 'outline'} icon={CheckSquare} className="h-8" onClick={() => setTouchSelect(!touchSelect)}>
            {touchSelect ? 'Terminé' : 'Sélectionner'}
          </Button>
        )}

        {viewMode === 'grid' && (
          <Popover
            trigger={<span><IconButton icon={ZoomIn} label="Taille des vignettes" size="sm" /></span>}
            className="w-64 p-4"
          >
            <p className="mb-3 text-sm font-semibold text-fg">Affichage de la grille</p>
            <div className="flex items-center gap-3">
              <ZoomOut size={15} className="text-subtle" />
              <input
                type="range" min={0} max={GRID_SIZES.length - 1} step={1} value={gridSize}
                onChange={(e) => setGridSize(Number(e.target.value))}
                className="h-1.5 flex-1 cursor-pointer accent-[rgb(var(--accent-500))]"
                aria-label="Taille des vignettes"
              />
              <ZoomIn size={15} className="text-subtle" />
            </div>
            <p className="mt-2 text-[11px] text-subtle">Astuce : pincez le pavé tactile ou Ctrl + molette sur la grille.</p>
            <div className="mt-4 space-y-1">
              <button onClick={() => set({ groupByDate: !groupByDate })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-fg hover:bg-overlay">
                <Rows3 size={15} className="text-muted" /> <span className="flex-1 text-left">Grouper par date</span>
                <span className={cn('h-2 w-2 rounded-full', groupByDate ? 'bg-accent-500' : 'bg-line-strong')} />
              </button>
              <button onClick={() => set({ showNames: !showNames })} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] text-fg hover:bg-overlay">
                <Type size={15} className="text-muted" /> <span className="flex-1 text-left">Afficher les noms</span>
                <span className={cn('h-2 w-2 rounded-full', showNames ? 'bg-accent-500' : 'bg-line-strong')} />
              </button>
            </div>
          </Popover>
        )}

        <Tooltip content="Basculer grille / liste" shortcut="V">
          <span>
            <Segmented
              size="sm"
              value={viewMode}
              onChange={setViewMode}
              layoutId="view-mode"
              options={[{ value: 'grid', icon: LayoutGrid, title: 'Grille' }, { value: 'list', icon: List, title: 'Liste' }]}
            />
          </span>
        </Tooltip>
      </div>
    </div>
  )
})
