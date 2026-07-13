"use client";

import * as React from "react";
import { ArrowDownLeft, ArrowUpRight, Filter, Plus, Tags, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionHeader, KpiCard, DataView, type DataViewColumn, EmptyState } from "@/components/finance";
import type {
  Account,
  Category,
  Counterparty,
  Transaction,
  TxTag,
  TxDirection,
  TxStatus,
  CategoryDirection,
  SplitDraft,
  AttachmentDraft,
} from "@/lib/types";
import { formatMoney, formatDate, toNumber, getStatusTone } from "@/lib/format";
import { NONE_VALUE } from "@/lib/types";

export interface TxFormState {
  transactionDate: string;
  description: string;
  amount: string;
  currency: string;
  direction: TxDirection;
  status: TxStatus;
  accountId: string;
  categoryId: string;
  counterpartyId: string;
  notes: string;
  tagIds: string[];
}
export interface CategoryFormState {
  code: string;
  name: string;
  direction: CategoryDirection;
}
export interface CounterpartyFormState {
  name: string;
  type: Counterparty["type"];
}
export interface TagFormState {
  name: string;
  color: string;
}

export interface TransactionsViewProps {
  // data
  transactions: Transaction[];
  accounts: Account[];
  categories: Category[];
  counterparties: Counterparty[];
  tags: TxTag[];
  // derived
  filteredTx: Transaction[];
  txMetrics: { inflowCount: number; outflowCount: number; pending: number };
  // filters state
  txSearch: string;
  setTxSearch: React.Dispatch<React.SetStateAction<string>>;
  txDirection: "ALL" | TxDirection;
  setTxDirection: React.Dispatch<React.SetStateAction<"ALL" | TxDirection>>;
  txStatus: "ALL" | TxStatus;
  setTxStatus: React.Dispatch<React.SetStateAction<"ALL" | TxStatus>>;
  txCategoryFilter: string;
  setTxCategoryFilter: React.Dispatch<React.SetStateAction<string>>;
  txCounterpartyFilter: string;
  setTxCounterpartyFilter: React.Dispatch<React.SetStateAction<string>>;
  txTagFilter: string;
  setTxTagFilter: React.Dispatch<React.SetStateAction<string>>;
  // tx form
  txForm: TxFormState;
  setTxForm: React.Dispatch<React.SetStateAction<TxFormState>>;
  toggleTag: (tagId: string) => void;
  useSplits: boolean;
  setUseSplits: React.Dispatch<React.SetStateAction<boolean>>;
  splitDrafts: SplitDraft[];
  setSplitDrafts: React.Dispatch<React.SetStateAction<SplitDraft[]>>;
  useAttachments: boolean;
  setUseAttachments: React.Dispatch<React.SetStateAction<boolean>>;
  attachmentDrafts: AttachmentDraft[];
  setAttachmentDrafts: React.Dispatch<React.SetStateAction<AttachmentDraft[]>>;
  onCreateTransaction: () => void;
  // catalogs
  categoryForm: CategoryFormState;
  setCategoryForm: React.Dispatch<React.SetStateAction<CategoryFormState>>;
  onCreateCategory: () => void;
  counterpartyForm: CounterpartyFormState;
  setCounterpartyForm: React.Dispatch<React.SetStateAction<CounterpartyFormState>>;
  onCreateCounterparty: () => void;
  tagForm: TagFormState;
  setTagForm: React.Dispatch<React.SetStateAction<TagFormState>>;
  onCreateTag: () => void;
  saving: boolean;
}

const inputCls = "bg-surface-1 border-surface-2";
const selectTriggerCls = "bg-surface-1 border-surface-2";

export function TransactionsView(props: TransactionsViewProps) {
  const {
    accounts,
    categories,
    counterparties,
    tags,
    filteredTx,
    txMetrics,
    txSearch,
    setTxSearch,
    txDirection,
    setTxDirection,
    txStatus,
    setTxStatus,
    txCategoryFilter,
    setTxCategoryFilter,
    txCounterpartyFilter,
    setTxCounterpartyFilter,
    txTagFilter,
    setTxTagFilter,
    txForm,
    setTxForm,
    toggleTag,
    useSplits,
    setUseSplits,
    splitDrafts,
    setSplitDrafts,
    useAttachments,
    setUseAttachments,
    attachmentDrafts,
    setAttachmentDrafts,
    onCreateTransaction,
    categoryForm,
    setCategoryForm,
    onCreateCategory,
    counterpartyForm,
    setCounterpartyForm,
    onCreateCounterparty,
    tagForm,
    setTagForm,
    onCreateTag,
    saving,
  } = props;

  const columns: DataViewColumn<Transaction>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (t) => <span className="text-xs text-fg-subtle">{formatDate(t.transaction_date)}</span>,
      hideOnCard: true,
    },
    {
      key: "description",
      header: "Descripción",
      render: (t) => <span className="font-medium">{t.description || "Sin descripción"}</span>,
      cardTitle: true,
    },
    { key: "account", header: "Cuenta", render: (t) => <span className="text-fg-secondary">{t.account_name}</span>, hideOnCard: true },
    {
      key: "category",
      header: "Categoría",
      render: (t) => <span className="text-fg-secondary">{t.category_name || "—"}</span>,
      hideOnCard: true,
    },
    {
      key: "counterparty",
      header: "Contraparte",
      render: (t) => <span className="text-fg-secondary">{t.counterparty_name || "—"}</span>,
      hideOnCard: true,
    },
    {
      key: "tags",
      header: "Tags",
      render: (t) => (
        <span className="text-xs text-fg-subtle">
          {t.tags.length ? t.tags.map((x) => x.name).join(", ") : "—"}
        </span>
      ),
      hideOnCard: true,
    },
    {
      key: "status",
      header: "Estado",
      render: (t) => (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusTone(t.status)}`}>
          {t.status}
        </span>
      ),
    },
    {
      key: "direction",
      header: "Flujo",
      render: (t) => {
        const inflow = t.direction === "INFLOW";
        return inflow ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-positive">
            <ArrowUpRight className="h-3.5 w-3.5" /> Ingreso
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
            <ArrowDownLeft className="h-3.5 w-3.5" /> Egreso
          </span>
        );
      },
      hideOnCard: true,
    },
    {
      key: "extras",
      header: "Extras",
      render: (t) => (
        <span className="text-xs text-fg-subtle">
          {t.splits.length}s · {t.attachments.length}a
        </span>
      ),
      hideOnCard: true,
    },
    {
      key: "amount",
      header: "Monto",
      align: "right",
      render: (t) => {
        const inflow = t.direction === "INFLOW";
        return (
          <span className={inflow ? "font-semibold text-positive" : "font-semibold text-fg"}>
            {inflow ? "+" : "−"}
            {formatMoney(toNumber(t.amount), t.currency)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="section-enter space-y-5">
      <PageHeader
        title="Movimientos"
        subtitle="Lee qué entró, qué salió y por qué."
        icon={<Filter className="h-5 w-5" />}
      />

      {/* Filtros + mini métricas */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <div className="relative md:col-span-3 xl:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none" />
              <Input
                className="pl-9 bg-surface-1 border-surface-2"
                placeholder="Buscar por descripción..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
              />
            </div>
            <Select value={txDirection} onValueChange={(v) => setTxDirection(v as "ALL" | TxDirection)}>
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las direcciones</SelectItem>
                <SelectItem value="INFLOW">Ingresos</SelectItem>
                <SelectItem value="OUTFLOW">Egresos</SelectItem>
              </SelectContent>
            </Select>
            <Select value={txStatus} onValueChange={(v) => setTxStatus(v as "ALL" | TxStatus)}>
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="POSTED">Confirmado</SelectItem>
                <SelectItem value="RECONCILED">Reconciliado</SelectItem>
                <SelectItem value="VOID">Anulado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={txCategoryFilter} onValueChange={setTxCategoryFilter}>
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las categorías</SelectItem>
                {categories.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={txCounterpartyFilter} onValueChange={setTxCounterpartyFilter}>
              <SelectTrigger className={selectTriggerCls}>
                <SelectValue placeholder="Contraparte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las contrapartes</SelectItem>
                {counterparties.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Resultados" value={String(filteredTx.length)} tone="neutral" />
            <KpiCard label="Ingresos" value={String(txMetrics.inflowCount)} tone="positive" />
            <KpiCard label="Egresos" value={String(txMetrics.outflowCount)} tone="danger" />
            <KpiCard label="Pendientes" value={String(txMetrics.pending)} tone="warning" />
          </div>
        </CardContent>
      </Card>

      {/* Tabla responsive */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <SectionHeader title="Movimientos del mes" caption="Detalle filtrado, ordenado por fecha." className="pb-3" />
          {filteredTx.length === 0 ? (
            <EmptyState icon={<Filter className="h-7 w-7" />} title="Sin resultados">
              Ajusta los filtros para ver movimientos.
            </EmptyState>
          ) : (
            <DataView columns={columns} rows={filteredTx} rowKey={(t) => t.id} />
          )}
        </CardContent>
      </Card>

      {/* Form nueva transacción */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <SectionHeader
            title="Nueva transacción"
            caption="Captura un movimiento sin salir del flujo."
            icon={<Plus className="h-4 w-4" />}
            className="pb-3"
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label className="text-xs text-fg-subtle">Fecha</Label>
              <Input
                className={inputCls}
                type="date"
                value={txForm.transactionDate}
                onChange={(e) => setTxForm((p) => ({ ...p, transactionDate: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Cuenta</Label>
              <Select value={txForm.accountId} onValueChange={(v) => setTxForm((p) => ({ ...p, accountId: v }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Selecciona cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Dirección</Label>
              <Select value={txForm.direction} onValueChange={(v) => setTxForm((p) => ({ ...p, direction: v as TxDirection }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFLOW">Ingreso</SelectItem>
                  <SelectItem value="OUTFLOW">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Estado</Label>
              <Select value={txForm.status} onValueChange={(v) => setTxForm((p) => ({ ...p, status: v as TxStatus }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING">Pendiente</SelectItem>
                  <SelectItem value="POSTED">Confirmado</SelectItem>
                  <SelectItem value="RECONCILED">Reconciliado</SelectItem>
                  <SelectItem value="VOID">Anulado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-fg-subtle">Descripción</Label>
              <Input
                className={inputCls}
                value={txForm.description}
                onChange={(e) => setTxForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Moneda</Label>
              <Input
                className={inputCls}
                value={txForm.currency}
                onChange={(e) => setTxForm((p) => ({ ...p, currency: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Monto</Label>
              <Input
                className={inputCls}
                type="number"
                value={txForm.amount}
                onChange={(e) => setTxForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Categoría</Label>
              <Select
                value={txForm.categoryId || NONE_VALUE}
                onValueChange={(v) => setTxForm((p) => ({ ...p, categoryId: v === NONE_VALUE ? "" : v }))}
              >
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sin categoría</SelectItem>
                  {categories.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-fg-subtle">Contraparte</Label>
              <Select
                value={txForm.counterpartyId || NONE_VALUE}
                onValueChange={(v) => setTxForm((p) => ({ ...p, counterpartyId: v === NONE_VALUE ? "" : v }))}
              >
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>Sin contraparte</SelectItem>
                  {counterparties.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs text-fg-subtle">Notas</Label>
              <Input
                className={inputCls}
                value={txForm.notes}
                onChange={(e) => setTxForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <div className="md:col-span-4">
              <Label className="mb-2 block text-xs text-fg-subtle">Tags</Label>
              <div className="flex flex-wrap gap-2">
                {tags.map((item) => {
                  const active = txForm.tagIds.includes(String(item.id));
                  return (
                    <Button
                      key={item.id}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      className={active ? "bg-brand hover:bg-brand/90 text-surface" : "border-surface-2 bg-surface-1 text-fg-secondary"}
                      onClick={() => toggleTag(String(item.id))}
                    >
                      {item.name}
                    </Button>
                  );
                })}
                {tags.length === 0 && <span className="text-xs text-fg-subtle">No hay tags creados.</span>}
              </div>
            </div>

            <div className="md:col-span-4 flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                variant={useSplits ? "default" : "outline"}
                size="sm"
                className={useSplits ? "bg-brand hover:bg-brand/90 text-surface" : "border-surface-2 bg-surface-1 text-fg-secondary"}
                onClick={() => setUseSplits((prev) => !prev)}
              >
                Splits {useSplits ? "ON" : "OFF"}
              </Button>
              <Button
                type="button"
                variant={useAttachments ? "default" : "outline"}
                size="sm"
                className={useAttachments ? "bg-brand hover:bg-brand/90 text-surface" : "border-surface-2 bg-surface-1 text-fg-secondary"}
                onClick={() => setUseAttachments((prev) => !prev)}
              >
                Adjuntos {useAttachments ? "ON" : "OFF"}
              </Button>
            </div>

            {useSplits && (
              <div className="md:col-span-4 space-y-3 rounded-xl border border-surface-2 bg-surface-1 p-3">
                <div className="text-sm font-medium text-fg">Splits</div>
                {splitDrafts.map((split, idx) => (
                  <div key={`split-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Input
                      className={inputCls}
                      placeholder="Descripción"
                      value={split.description}
                      onChange={(e) => setSplitDrafts((prev) => prev.map((item, i) => (i === idx ? { ...item, description: e.target.value } : item)))}
                    />
                    <Input
                      className={inputCls}
                      placeholder="Monto"
                      type="number"
                      value={split.amount}
                      onChange={(e) => setSplitDrafts((prev) => prev.map((item, i) => (i === idx ? { ...item, amount: e.target.value } : item)))}
                    />
                    <Select
                      value={split.categoryId || NONE_VALUE}
                      onValueChange={(v) => setSplitDrafts((prev) => prev.map((item, i) => (i === idx ? { ...item, categoryId: v === NONE_VALUE ? "" : v } : item)))}
                    >
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sin categoría</SelectItem>
                        {categories.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={split.counterpartyId || NONE_VALUE}
                      onValueChange={(v) => setSplitDrafts((prev) => prev.map((item, i) => (i === idx ? { ...item, counterpartyId: v === NONE_VALUE ? "" : v } : item)))}
                    >
                      <SelectTrigger className={selectTriggerCls}>
                        <SelectValue placeholder="Contraparte" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE_VALUE}>Sin contraparte</SelectItem>
                        {counterparties.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-surface-2 bg-surface-1 text-fg-secondary"
                    onClick={() => setSplitDrafts((prev) => [...prev, { description: "", amount: "", categoryId: "", counterpartyId: "" }])}
                  >
                    Agregar split
                  </Button>
                  {splitDrafts.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-surface-2 bg-surface-1 text-fg-secondary"
                      onClick={() => setSplitDrafts((prev) => prev.slice(0, -1))}
                    >
                      Quitar último
                    </Button>
                  )}
                </div>
              </div>
            )}

            {useAttachments && (
              <div className="md:col-span-4 space-y-3 rounded-xl border border-surface-2 bg-surface-1 p-3">
                <div className="text-sm font-medium text-fg">Adjuntos</div>
                {attachmentDrafts.map((item, idx) => (
                  <div key={`att-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-4">
                    <Input
                      className={inputCls}
                      placeholder="Nombre archivo"
                      value={item.fileName}
                      onChange={(e) => setAttachmentDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, fileName: e.target.value } : row)))}
                    />
                    <Input
                      className={inputCls}
                      placeholder="URL archivo"
                      value={item.fileUrl}
                      onChange={(e) => setAttachmentDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, fileUrl: e.target.value } : row)))}
                    />
                    <Input
                      className={inputCls}
                      placeholder="MIME type"
                      value={item.mimeType}
                      onChange={(e) => setAttachmentDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, mimeType: e.target.value } : row)))}
                    />
                    <Input
                      className={inputCls}
                      placeholder="Tamaño (bytes)"
                      type="number"
                      value={item.fileSize}
                      onChange={(e) => setAttachmentDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, fileSize: e.target.value } : row)))}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-surface-2 bg-surface-1 text-fg-secondary"
                    onClick={() => setAttachmentDrafts((prev) => [...prev, { fileName: "", fileUrl: "", mimeType: "", fileSize: "" }])}
                  >
                    Agregar adjunto
                  </Button>
                  {attachmentDrafts.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-surface-2 bg-surface-1 text-fg-secondary"
                      onClick={() => setAttachmentDrafts((prev) => prev.slice(0, -1))}
                    >
                      Quitar último
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="md:col-span-4">
              <Button onClick={() => onCreateTransaction()} disabled={saving} className="bg-brand hover:bg-brand/90 text-surface">
                Guardar transacción
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Catálogos rápidos */}
      <Card className="ds-soft-card">
        <CardContent className="p-4 md:p-5">
          <SectionHeader
            title="Catálogos rápidos"
            caption="Crea categorías, contrapartes y tags en segundos."
            icon={<Tags className="h-4 w-4" />}
            className="pb-3"
          />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="space-y-2 rounded-xl border border-surface-2 bg-surface-1 p-3">
              <Label className="text-xs text-fg-subtle">Nueva categoría</Label>
              <Input
                className={inputCls}
                placeholder="Código"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm((p) => ({ ...p, code: e.target.value }))}
              />
              <Input
                className={inputCls}
                placeholder="Nombre"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Select value={categoryForm.direction} onValueChange={(v) => setCategoryForm((p) => ({ ...p, direction: v as CategoryDirection }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOTH">Ambos</SelectItem>
                  <SelectItem value="INFLOW">Ingreso</SelectItem>
                  <SelectItem value="OUTFLOW">Egreso</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => onCreateCategory()} disabled={saving} className="bg-brand hover:bg-brand/90 text-surface">
                Crear categoría
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border border-surface-2 bg-surface-1 p-3">
              <Label className="text-xs text-fg-subtle">Nueva contraparte</Label>
              <Input
                className={inputCls}
                placeholder="Nombre"
                value={counterpartyForm.name}
                onChange={(e) => setCounterpartyForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Select value={counterpartyForm.type} onValueChange={(v) => setCounterpartyForm((p) => ({ ...p, type: v as Counterparty["type"] }))}>
                <SelectTrigger className={selectTriggerCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OTHER">Otro</SelectItem>
                  <SelectItem value="PERSON">Persona</SelectItem>
                  <SelectItem value="BUSINESS">Empresa</SelectItem>
                  <SelectItem value="INTERNAL">Interno</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => onCreateCounterparty()} disabled={saving} className="bg-brand hover:bg-brand/90 text-surface">
                Crear contraparte
              </Button>
            </div>
            <div className="space-y-2 rounded-xl border border-surface-2 bg-surface-1 p-3">
              <Label className="text-xs text-fg-subtle">Nuevo tag</Label>
              <Input
                className={inputCls}
                placeholder="Nombre"
                value={tagForm.name}
                onChange={(e) => setTagForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                className={inputCls}
                placeholder="Color (opcional)"
                value={tagForm.color}
                onChange={(e) => setTagForm((p) => ({ ...p, color: e.target.value }))}
              />
              <Button onClick={() => onCreateTag()} disabled={saving} className="bg-brand hover:bg-brand/90 text-surface">
                Crear tag
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TransactionsView;
