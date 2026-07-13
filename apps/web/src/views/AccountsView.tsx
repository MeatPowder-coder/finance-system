"use client";

import * as React from "react";
import { Wallet, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, KpiCard, DataView, type DataViewColumn, EmptyState } from "@/components/finance";
import type { Account, AccountType } from "@/lib/types";
import { formatMoney, toNumber, getAccountTypeLabel } from "@/lib/format";

export interface AccountFormState {
  code: string;
  name: string;
  currency: string;
  accountType: AccountType;
  balanceCurrent: string;
}

export interface AccountsViewProps {
  accounts: Account[];
  accountTotals: { active: number; positive: number; negative: number };
  accountForm: AccountFormState;
  setAccountForm: React.Dispatch<React.SetStateAction<AccountFormState>>;
  onCreateAccount: () => void;
  saving: boolean;
}

const ACCOUNT_TYPES: AccountType[] = ["CHECKING", "SAVINGS", "CREDIT_CARD", "CASH", "INVESTMENT", "LOAN", "OTHER"];

export function AccountsView({
  accounts,
  accountTotals,
  accountForm,
  setAccountForm,
  onCreateAccount,
  saving,
}: AccountsViewProps) {
  const columns: DataViewColumn<Account>[] = [
    { key: "code", header: "Código", render: (a) => <span className="font-mono text-xs text-fg-subtle">{a.code}</span> },
    { key: "name", header: "Nombre", render: (a) => <span className="font-medium">{a.name}</span>, cardTitle: true },
    {
      key: "accountType",
      header: "Tipo",
      render: (a) => <span className="text-fg-secondary">{getAccountTypeLabel(a.account_type)}</span>,
    },
    {
      key: "balance",
      header: "Saldo",
      align: "right",
      render: (a) => (
        <span
          className={
            toNumber(a.balance_current) < 0
              ? "font-semibold text-danger"
              : "font-semibold text-fg"
          }
        >
          {formatMoney(toNumber(a.balance_current), a.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      align: "right",
      render: (a) => (
        <span
          className={
            a.is_active
              ? "inline-flex items-center rounded-full border border-positive/40 bg-positive-soft px-2.5 py-0.5 text-xs font-medium text-positive"
              : "inline-flex items-center rounded-full border border-zinc-500/40 bg-zinc-500/10 px-2.5 py-0.5 text-xs font-medium text-fg-subtle"
          }
        >
          {a.is_active ? "Activa" : "Inactiva"}
        </span>
      ),
      hideOnCard: true,
    },
  ];

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Cuentas"
        subtitle="Dónde está tu dinero ahora mismo."
        icon={<Wallet className="h-5 w-5" />}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KpiCard label="Cuentas activas" value={String(accountTotals.active)} tone="accent" />
        <KpiCard
          label="Saldo positivo"
          value={formatMoney(accountTotals.positive, "COP")}
          tone="positive"
        />
        <KpiCard
          label="Sobregiros"
          value={formatMoney(accountTotals.negative, "COP")}
          tone="danger"
        />
      </div>

      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          {accounts.length === 0 ? (
            <EmptyState
              icon={<Building2 className="h-7 w-7" />}
              title="Aún no hay cuentas"
            >
              Crea tu primera cuenta desde el formulario de abajo para empezar a registrar movimientos.
            </EmptyState>
          ) : (
            <DataView columns={columns} rows={accounts} rowKey={(a) => a.id} />
          )}
        </CardContent>
      </Card>

      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <div className="mb-4 flex items-center gap-2 text-base font-medium text-fg">
            <Plus className="h-4 w-4 text-brand" />
            Nueva cuenta
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <Label className="text-xs text-fg-subtle">Código</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.code}
                onChange={(e) => setAccountForm((p) => ({ ...p, code: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Nombre</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.name}
                onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Moneda</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                value={accountForm.currency}
                onChange={(e) => setAccountForm((p) => ({ ...p, currency: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Tipo</Label>
              <Select
                value={accountForm.accountType}
                onValueChange={(v) => setAccountForm((p) => ({ ...p, accountType: v as AccountType }))}
              >
                <SelectTrigger className="bg-surface-1 border-surface-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {getAccountTypeLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Saldo inicial</Label>
              <Input
                className="bg-surface-1 border-surface-2"
                type="number"
                value={accountForm.balanceCurrent}
                onChange={(e) => setAccountForm((p) => ({ ...p, balanceCurrent: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5">
              <Button
                onClick={() => onCreateAccount()}
                disabled={saving}
                className="bg-brand hover:bg-brand/90 text-surface"
              >
                Crear cuenta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsView;
