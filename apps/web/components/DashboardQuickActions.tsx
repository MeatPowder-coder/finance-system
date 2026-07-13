"use client";

import { Button } from "@/components/ui/button";
import { type LucideIcon } from "lucide-react";

type QuickAction = {
  key: string;
  label: string;
  caption: string;
  icon: LucideIcon;
  onClick: () => void;
  tone?: "primary" | "neutral";
};

export default function DashboardQuickActions({
  actions,
}: {
  actions: QuickAction[];
}) {
  return (
    <section className="ui-panel-soft rounded-[24px] px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-0.5 lg:w-[210px] lg:flex-none xl:w-[240px]">
          <p className="text-[10px] uppercase tracking-[0.18em] ui-subtle">Acciones rapidas</p>
          <p className="text-[13px] ui-muted">Crear sin perder el contexto.</p>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
          {actions.map((action) => {
            const Icon = action.icon;
            const primary = action.tone === "primary";
            return (
              <Button
                key={action.key}
                type="button"
                variant="outline"
                onClick={action.onClick}
                className={`h-9 shrink-0 justify-start rounded-full px-3 text-left transition-all ${primary ? "ui-action-primary" : "ui-action"}`}
              >
                <div className="flex items-center gap-2">
                  <div className={`rounded-full p-1 ${primary ? "bg-cyan-500/15 text-cyan-200" : "bg-white/5 text-zinc-400"}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="whitespace-nowrap text-[11px] font-medium">{action.label}</span>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
