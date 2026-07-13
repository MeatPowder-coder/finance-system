"use client";

import { type LucideIcon } from "lucide-react";

type Section = {
  key: string;
  label: string;
  icon: LucideIcon;
};

export default function PlanningSegmentedNav({
  sections,
  activeKey,
  onChange,
}: {
  sections: Section[];
  activeKey: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="ui-panel-soft flex flex-wrap gap-1.5 rounded-2xl p-1.5">
      {sections.map((section) => {
        const Icon = section.icon;
        const active = section.key === activeKey;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => onChange(section.key)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
              active
                ? "bg-cyan-500/15 text-cyan-100 shadow-[0_0_0_1px_rgba(6,182,212,0.18)]"
                : "ui-muted hover:bg-white/5 hover:text-zinc-100"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-cyan-300" : "text-zinc-500"}`} />
            <span className="font-medium">{section.label}</span>
          </button>
        );
      })}
    </div>
  );
}
