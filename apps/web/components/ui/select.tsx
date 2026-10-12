"use client"

import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"

import { cn } from "@/lib/utils"

const TriggerPrimitive = SelectPrimitive.Trigger as unknown as React.ForwardRefExoticComponent<any>
const IconPrimitive = SelectPrimitive.Icon as unknown as React.ForwardRefExoticComponent<any>
const ScrollUpPrimitive = SelectPrimitive.ScrollUpButton as unknown as React.ForwardRefExoticComponent<any>
const ScrollDownPrimitive = SelectPrimitive.ScrollDownButton as unknown as React.ForwardRefExoticComponent<any>
const ContentPrimitive = SelectPrimitive.Content as unknown as React.ForwardRefExoticComponent<any>
const ViewportPrimitive = SelectPrimitive.Viewport as unknown as React.ForwardRefExoticComponent<any>
const LabelPrimitive = SelectPrimitive.Label as unknown as React.ForwardRefExoticComponent<any>
const ItemPrimitive = SelectPrimitive.Item as unknown as React.ForwardRefExoticComponent<any>
const SeparatorPrimitive = SelectPrimitive.Separator as unknown as React.ForwardRefExoticComponent<any>

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <TriggerPrimitive
    ref={ref}
    className={cn(
      "ui-control flex h-11 w-full items-center justify-between whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors duration-200 hover:border-cyan-500/30 focus:outline-none focus:ring-2 focus:ring-cyan-400/25 focus:ring-offset-0 data-[placeholder]:text-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <IconPrimitive asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </IconPrimitive>
  </TriggerPrimitive>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <ScrollUpPrimitive
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </ScrollUpPrimitive>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <ScrollDownPrimitive
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </ScrollDownPrimitive>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> & React.HTMLAttributes<HTMLDivElement>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <ContentPrimitive
      ref={ref}
      className={cn(
        "finance-modal-surface relative z-50 max-h-[--radix-select-content-available-height] min-w-[11rem] overflow-hidden rounded-[22px] text-zinc-100 backdrop-blur-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-select-content-transform-origin]",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <ViewportPrimitive
        className={cn(
          "p-1.5",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </ViewportPrimitive>
      <SelectScrollDownButton />
    </ContentPrimitive>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <LabelPrimitive
    ref={ref}
    className={cn("px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <ItemPrimitive
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-2xl py-2.5 pl-3 pr-9 text-sm outline-none transition-colors focus:bg-cyan-500/10 focus:text-zinc-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[state=checked]:bg-cyan-500/12 data-[state=checked]:text-zinc-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </ItemPrimitive>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <SeparatorPrimitive
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-white/8", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
