import { forwardRef } from 'react'
import {
  Search, X, LayoutGrid, List, ArrowDownWideNarrow,
  ZoomIn, ZoomOut, CalendarArrowDown, CalendarArrowUp, ArrowDownAZ, ArrowUpZA, HardDrive,
} from 'lucide-react'
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
  isTouch, touchSelect, setTouchSelect, countLabel, filterPlaceholder = 'Filtrer…',
}, filterRef) {
  const { viewMode, setViewMode, sortBy, sortDir, setSort, gridSize, setGridSize, groupByDate, showNames, set } = usePreferencesStore()
  const currentSort = SORTS.find((s) => s.by === sortBy && s.dir === sortDir) || SORTS[0]
  const hasDate = dateRange.from || dateRange.to

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hideFilter && (
        <div className="relative order-last w-full sm:order-none sm:w-64">
          <Search size={14} strokeWidth={1.75} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            ref={filterRef}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setFilter(''); e.currentTarget.blur() } }}
            placeholder={filterPlaceholder}
            className="h-[34px] w-full rounded-sm border border-line bg-transparent pl-8 pr-8 text-[13px] text-fg outline-none transition-colors placeholder:text-subtle hover:border-line-strong focus:border-fg/60"
          />
          {filter ? (
            <button onClick={() => setFilter('')} className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-subtle hover:text-fg" aria-label="Effacer">
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
          { value: 'all', label: 'Tout' },
          { value: 'image', label: 'Photos' },
          { value: 'video', label: 'Vidéos' },
        ]}
      />

      <Popover
        align="start"
        trigger={
          <Button size="sm" variant={hasDate ? 'primary' : 'outline'} className="h-[34px]">
            {hasDate ? 'Période' : 'Date'}
          </Button>
        }
        className="w-72 p-4"
      >
        <p className="label-mono mb-3">Date d'ajout</p>
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
                className="rounded-sm border border-line px-2 py-1 font-mono text-[11px] text-muted hover:border-fg/40 hover:text-fg">
                {l}
              </button>
            ))}
            {hasDate && (
              <button onClick={() => setDateRange({ from: '', to: '' })} className="ml-auto px-1 py-1 text-xs text-subtle underline underline-offset-4 hover:text-fg">
                Effacer
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
            <Button size="sm" variant="outline" className="h-[34px]">
              <ArrowDownWideNarrow size={14} strokeWidth={1.75} className="md:hidden" />
              <span className="hidden md:inline">{currentSort.label}</span>
            </Button>
          }
        />
      )}

      {countLabel && <span className="hidden font-mono text-[11px] text-subtle lg:inline">{countLabel}</span>}

      <div className="ml-auto flex items-center gap-1.5">
        {isTouch && (
          <Button size="sm" variant={touchSelect ? 'primary' : 'outline'} className="h-[34px]" onClick={() => setTouchSelect(!touchSelect)}>
            {touchSelect ? 'Terminé' : 'Sélectionner'}
          </Button>
        )}

        {viewMode === 'grid' && (
          <Popover
            trigger={<span><IconButton icon={ZoomIn} label="Taille des vignettes" size="sm" /></span>}
            className="w-64 p-4"
          >
            <p className="label-mono mb-3">Grille</p>
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
            <p className="mt-2 text-[11px] text-subtle">Ou pincez le pavé tactile sur la grille.</p>
            <div className="mt-4 space-y-1">
              <button onClick={() => set({ groupByDate: !groupByDate })} className="flex w-full items-center gap-2.5 px-2 py-1.5 text-[13px] text-fg hover:bg-overlay">
                <span className="flex-1 text-left">Grouper par date</span>
                <span className="font-mono text-[11px] text-subtle">{groupByDate ? 'oui' : 'non'}</span>
              </button>
              <button onClick={() => set({ showNames: !showNames })} className="flex w-full items-center gap-2.5 px-2 py-1.5 text-[13px] text-fg hover:bg-overlay">
                <span className="flex-1 text-left">Afficher les noms</span>
                <span className="font-mono text-[11px] text-subtle">{showNames ? 'oui' : 'non'}</span>
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
