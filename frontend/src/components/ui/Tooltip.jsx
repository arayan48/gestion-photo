import * as RTooltip from '@radix-ui/react-tooltip'
import { Kbd } from './Kbd.jsx'

export const TooltipProvider = ({ children }) => (
  <RTooltip.Provider delayDuration={350} skipDelayDuration={150}>{children}</RTooltip.Provider>
)

export function Tooltip({ children, content, shortcut, side = 'bottom', align = 'center', disabled }) {
  if (disabled || !content) return children
  return (
    <RTooltip.Root>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className="z-[400] flex items-center gap-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-float data-[state=delayed-open]:animate-fade-in dark:bg-zinc-800 dark:ring-1 dark:ring-white/10"
        >
          {content}
          {shortcut && <Kbd className="border-white/15 bg-white/10 text-white/80">{shortcut}</Kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
