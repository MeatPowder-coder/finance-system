"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

// Radix v2's polymorphic primitive declarations resolve to `{}` under the
// repository's React 18 type set. Keep the public wrappers typed with their
// native element props and loosen only the internal Radix boundary.
const OverlayPrimitive = DialogPrimitive.Overlay as unknown as React.ForwardRefExoticComponent<any>
const ContentPrimitive = DialogPrimitive.Content as unknown as React.ForwardRefExoticComponent<any>
const TitlePrimitive = DialogPrimitive.Title as unknown as React.ForwardRefExoticComponent<any>
const DescriptionPrimitive = DialogPrimitive.Description as unknown as React.ForwardRefExoticComponent<any>

const Dialog = DialogPrimitive.Root

type DialogButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
const DialogTrigger = DialogPrimitive.Trigger as unknown as React.ForwardRefExoticComponent<DialogButtonProps & React.RefAttributes<HTMLButtonElement>>

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close as unknown as React.ForwardRefExoticComponent<DialogButtonProps & React.RefAttributes<HTMLButtonElement>>

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay> & React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <OverlayPrimitive
    ref={ref}
      className={cn(
      "finance-modal-overlay fixed inset-0 z-50 bg-black/72 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <ContentPrimitive
      ref={ref}
      className={cn(
        "finance-modal-surface fixed left-[50%] top-[50%] z-50 w-[calc(100vw-1.25rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-[30px] backdrop-blur-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
        className
      )}
      {...props}
    >
      <div aria-hidden className="finance-modal-accent pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90" />
      <div aria-hidden className="finance-modal-orb finance-modal-orb-primary pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl" />
      <div aria-hidden className="finance-modal-orb finance-modal-orb-secondary pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full blur-3xl" />
      <div className="relative max-h-[calc(100vh-1.25rem)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
        {children}
      </div>
      <DialogClose className="ui-action absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full ui-muted shadow-sm transition-colors hover:text-fg focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-0 disabled:pointer-events-none">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogClose>
    </ContentPrimitive>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mb-5 flex flex-col space-y-2 pr-10 text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title> & React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <TitlePrimitive
    ref={ref}
    className={cn(
      "text-xl font-semibold tracking-tight text-fg sm:text-2xl",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description> & React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <DescriptionPrimitive
    ref={ref}
    className={cn("text-sm leading-6 ui-muted", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
