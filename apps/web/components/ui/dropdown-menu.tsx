
"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const SubTriggerPrimitive = DropdownMenuPrimitive.SubTrigger as unknown as React.ForwardRefExoticComponent<any>
const SubContentPrimitive = DropdownMenuPrimitive.SubContent as unknown as React.ForwardRefExoticComponent<any>
const ContentPrimitive = DropdownMenuPrimitive.Content as unknown as React.ForwardRefExoticComponent<any>
const ItemPrimitive = DropdownMenuPrimitive.Item as unknown as React.ForwardRefExoticComponent<any>
const CheckboxItemPrimitive = DropdownMenuPrimitive.CheckboxItem as unknown as React.ForwardRefExoticComponent<any>
const RadioItemPrimitive = DropdownMenuPrimitive.RadioItem as unknown as React.ForwardRefExoticComponent<any>
const LabelPrimitive = DropdownMenuPrimitive.Label as unknown as React.ForwardRefExoticComponent<any>
const SeparatorPrimitive = DropdownMenuPrimitive.Separator as unknown as React.ForwardRefExoticComponent<any>

const DropdownMenu = DropdownMenuPrimitive.Root

type DropdownMenuTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger as unknown as React.ForwardRefExoticComponent<DropdownMenuTriggerProps & React.RefAttributes<HTMLButtonElement>>

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & React.HTMLAttributes<HTMLDivElement> & {
        inset?: boolean
    }
>(({ className, inset, children, ...props }, ref) => (
    <SubTriggerPrimitive
        ref={ref}
        className={cn(
            "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent",
            inset && "pl-8",
            className
        )}
        {...props}
    >
        {children}
        <ChevronRight className="ml-auto h-4 w-4" />
    </SubTriggerPrimitive>
))
DropdownMenuSubTrigger.displayName =
    DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <SubContentPrimitive
        ref={ref}
        className={cn(
            "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            className
        )}
        {...props}
    />
))
DropdownMenuSubContent.displayName =
    DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & React.HTMLAttributes<HTMLDivElement>
>(({ className, sideOffset = 4, ...props }, ref) => (
    <DropdownMenuPrimitive.Portal>
        <ContentPrimitive
            ref={ref}
            sideOffset={sideOffset}
            className={cn(
                "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
                className
            )}
            {...props}
        />
    </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & React.HTMLAttributes<HTMLDivElement> & {
        inset?: boolean
    }
>(({ className, inset, ...props }, ref) => (
    <ItemPrimitive
        ref={ref}
        className={cn(
            "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            inset && "pl-8",
            className
        )}
        {...props}
    />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem> & React.HTMLAttributes<HTMLDivElement> & {
        checked?: boolean | "indeterminate"
        onCheckedChange?: (checked: boolean) => void
    }
>(({ className, children, checked, ...props }, ref) => (
    <CheckboxItemPrimitive
        ref={ref}
        className={cn(
            "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className
        )}
        checked={checked}
        {...props}
    >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                <Check className="h-4 w-4" />
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </CheckboxItemPrimitive>
))
DropdownMenuCheckboxItem.displayName =
    DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> & React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
    <RadioItemPrimitive
        ref={ref}
        className={cn(
            "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
            className
        )}
        {...props}
    >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <DropdownMenuPrimitive.ItemIndicator>
                <Circle className="h-2 w-2 fill-current" />
            </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
    </RadioItemPrimitive>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & React.HTMLAttributes<HTMLDivElement> & {
        inset?: boolean
    }
>(({ className, inset, ...props }, ref) => (
    <LabelPrimitive
        ref={ref}
        className={cn(
            "px-2 py-1.5 text-sm font-semibold",
            inset && "pl-8",
            className
        )}
        {...props}
    />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
    HTMLDivElement,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <SeparatorPrimitive
        ref={ref}
        className={cn("-mx-1 my-1 h-px bg-muted", className)}
        {...props}
    />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
    className,
    ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
    <span
        className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
        {...props}
    />
)
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuRadioGroup,
}
