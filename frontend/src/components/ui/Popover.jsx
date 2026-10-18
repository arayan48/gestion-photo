import * as RPopover from '@radix-ui/react-popover'
import { cn } from '../../lib/cn.js'

export function Popover({ trigger, children, align = 'end', side = 'bottom', className, open, onOpenChange }) {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={8}
          className={cn('z-[300] rounded-2xl border border-line bg-elevated/95 shadow-float outline-none backdrop-blur-xl data-[state=open]:animate-fade-in', className)}
        >
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  )
}

export const PopoverClose = RPopover.Close
