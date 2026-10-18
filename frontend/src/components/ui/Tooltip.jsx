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
          className="z-[400] flex items-center gap-2 rounded-sm bg-fg px-2 py-1 text-xs text-bg data-[state=delayed-open]:animate-fade-in"
        >
          {content}
          {shortcut && <Kbd className="border-bg/30 text-bg/70">{shortcut}</Kbd>}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  )
}
