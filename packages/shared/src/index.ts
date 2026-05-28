export type CurrencyCode = "COP" | "USD" | "EUR" | "GBP" | "MXN";

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "OTHER";

export type TransactionDirection = "INFLOW" | "OUTFLOW";
export type TransactionStatus = "PENDING" | "POSTED" | "RECONCILED" | "VOID";

export interface Account {
  id: number;
  code: string;
  name: string;
  currency: CurrencyCode;
  accountType: AccountType;
  balanceCurrent: number;
  isActive: boolean;
}

export interface Transaction {
  id: number;
  transactionDate: string;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  direction: TransactionDirection;
  status: TransactionStatus;
  accountId: number;
  categoryId: number | null;
}

export interface FinanceSummary {
  totalBalance: number;
  monthInflow: number;
  monthOutflow: number;
}
