import * as DM from '@radix-ui/react-dropdown-menu'
import * as CM from '@radix-ui/react-context-menu'
import { Check, ChevronRight } from 'lucide-react'
import { Drawer } from 'vaul'
import { cn } from '../../lib/cn.js'

/*
  Menus déclaratifs partagés : le même tableau d'éléments alimente
  le menu contextuel (clic droit / appui long), le menu « ⋯ » et la feuille d'actions mobile.

  { label, icon, onSelect, shortcut, danger, disabled, checked, hint }
  { type: 'separator' } | { type: 'label', label } | { type: 'sub', label, icon, items }
*/

function ItemInner({ item }) {
  const Icon = item.icon
  return (
    <>
      <span className="flex w-4 shrink-0 items-center justify-center">
        {item.checked !== undefined
          ? (item.checked ? <Check size={15} className="text-accent-500" /> : null)
          : Icon && <Icon size={15} className={cn(!item.danger && 'text-muted')} />}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.hint && <span className="text-[11px] text-subtle">{item.hint}</span>}
      {item.shortcut && <span className="ml-3 [@media(hover:none)]:hidden text-[11px] font-medium tracking-wide text-subtle">{item.shortcut}</span>}
    </>
  )
}

function renderItems(items, P) {
  return items.filter(Boolean).map((item, i) => {
    if (item.type === 'separator') return <P.Separator key={`s${i}`} className="menu-separator" />
    if (item.type === 'label') return <P.Label key={`l${i}`} className="menu-label">{item.label}</P.Label>
    if (item.type === 'sub') {
      return (
        <P.Sub key={item.label}>
          <P.SubTrigger className="menu-item data-[state=open]:bg-overlay">
            <ItemInner item={item} />
            <ChevronRight size={14} className="text-subtle" />
          </P.SubTrigger>
          <P.Portal>
            <P.SubContent sideOffset={6} alignOffset={-6} collisionPadding={8} className="menu-content max-h-[60vh] overflow-y-auto">
              {renderItems(item.items, P)}
            </P.SubContent>
          </P.Portal>
        </P.Sub>
      )
    }
    return (
      <P.Item
        key={item.key || item.label}
        disabled={item.disabled}
        onSelect={item.onSelect}
        className={cn('menu-item', item.danger && 'menu-item-danger')}
      >
        <ItemInner item={item} />
      </P.Item>
    )
  })
}

// Éléments évalués seulement à l'ouverture du menu (items peut être une fonction)
function LazyItems({ items, P }) {
  return renderItems(typeof items === 'function' ? items() : items || [], P)
}

export function DropdownMenu({ trigger, items, align = 'end', side = 'bottom', header, className, onOpenChange, open, modal = true }) {
  return (
    <DM.Root onOpenChange={onOpenChange} open={open} modal={modal}>
      <DM.Trigger asChild>{trigger}</DM.Trigger>
      <DM.Portal>
        <DM.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn('menu-content data-[state=open]:animate-fade-in', className)}
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          <LazyItems items={items} P={DM} />
        </DM.Content>
      </DM.Portal>
    </DM.Root>
  )
}

// Menu contextuel (clic droit, appui deux doigts sur pavé tactile, appui long sur écran tactile)
export function ContextMenu({ children, items, onOpenChange, disabled, header }) {
  return (
    <CM.Root onOpenChange={onOpenChange} modal={false}>
      <CM.Trigger asChild disabled={disabled}>{children}</CM.Trigger>
      <CM.Portal>
        <CM.Content collisionPadding={8} className="menu-content data-[state=open]:animate-fade-in">
          {header}
          <LazyItems items={items} P={CM} />
        </CM.Content>
      </CM.Portal>
    </CM.Root>
  )
}

// Feuille d'actions mobile (glisser vers le bas pour fermer)
export function ActionSheet({ open, onOpenChange, title, subtitle, media, items }) {
  const flat = []
  for (const it of (items || []).filter(Boolean)) {
    if (it.type === 'sub') flat.push({ type: 'label', label: it.label }, ...it.items)
    else flat.push(it)
  }
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[260] bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-[261] flex max-h-[85dvh] flex-col rounded-t-3xl border border-line bg-elevated outline-none pb-safe">
          <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong" />
          {(title || media) && (
            <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
              {media}
              <div className="min-w-0">
                <Drawer.Title className="truncate text-sm font-semibold text-fg">{title}</Drawer.Title>
                {subtitle && <Drawer.Description className="truncate text-xs text-muted">{subtitle}</Drawer.Description>}
              </div>
            </div>
          )}
          {!title && <Drawer.Title className="sr-only">Actions</Drawer.Title>}
          <div className="overflow-y-auto p-2">
            {flat.map((item, i) => {
              if (item.type === 'separator') return <div key={i} className="mx-3 my-1.5 h-px bg-line" />
              if (item.type === 'label') return <p key={i} className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-subtle">{item.label}</p>
              const Icon = item.icon
              return (
                <button
                  key={item.key || item.label}
                  disabled={item.disabled}
                  onClick={() => { onOpenChange(false); setTimeout(() => item.onSelect?.(), 120) }}
                  className={cn(
                    'flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-[15px] transition-colors active:bg-overlay disabled:opacity-40',
                    item.danger ? 'text-red-500' : 'text-fg'
                  )}
                >
                  {item.checked !== undefined
                    ? <span className="w-5">{item.checked && <Check size={18} className="text-accent-500" />}</span>
                    : Icon && <Icon size={19} className={item.danger ? '' : 'text-muted'} />}
                  <span className="flex-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
