export type CurrencyCode = "COP" | "USD" | "EUR";

export type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT";

export type TransactionDirection = "INFLOW" | "OUTFLOW";

export interface Account {
  id: number;
  code: string;
  name: string;
  currency: CurrencyCode;
  accountType: AccountType;
  balanceCurrent: number;
}

export interface Transaction {
  id: number;
  transactionDate: string;
  description: string;
  amount: number;
  currency: CurrencyCode;
  direction: TransactionDirection;
  accountId: number;
}
