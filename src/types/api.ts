export type Role = "ADMIN" | "AREA_MANAGER" | "AGENT";
export type ContractStatus = "DRAFT" | "ACTIVE" | "COMPLETED" | "CANCELLED";
export type CommissionType = "BASE" | "BONUS";
export type PaymentStatus =
  | "PENDING"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "DISPUTED"
  | "CANCELLED";
export type PaymentMethod = "BANK_TRANSFER" | "UPI" | "CASH" | "CARD" | "OTHER";

export interface ListQueryParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
  aud?: string;
  iss?: string;
}

export interface UserLite {
  id: string;
  name: string;
  email: string;
  role: Role;
  managerId: string | null;
  createdAt: string;
}

export interface User extends UserLite {
  manager?: UserLite | null;
  team?: UserLite[];
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthSession {
  userId: string;
  role: Role;
}

export interface SessionResponse {
  user: AuthSession | null;
}

export interface Solution {
  id: string;
  name: string;
  createdAt: string;
}

export interface SolutionVersion {
  id: string;
  solutionId: string;
  price: string;
  baseCommission: string;
  validFrom: string;
  validTo: string | null;
  createdBy: string;
  createdAt: string;
  solution?: Solution;
}

export interface CreateVersionResponse {
  version: SolutionVersion;
  recalculatedContracts: number;
  adjustmentsCreated: number;
}

export interface Contract {
  id: string;
  agentId: string;
  solutionVersionId: string;
  customerDetails: unknown;
  installationDate: string;
  status: ContractStatus;
  createdAt: string;
  agent?: UserLite;
  solutionVersion?: SolutionVersion;
  commissions?: Commission[];
}

export interface Commission {
  id: string;
  contractId: string;
  userId: string;
  amount: string;
  type: CommissionType;
  createdAt: string;
  user?: UserLite;
  contract?: Contract;
}

export interface PaymentTransaction {
  id: string;
  paymentId: string;
  amount: string;
  method: PaymentMethod;
  referenceNumber: string | null;
  proofUrl: string | null;
  adminNote: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  totalAmount: string;
  status: PaymentStatus;
  effectiveStatus: PaymentStatus;
  createdAt: string;
  transactions: PaymentTransaction[];
  user?: UserLite;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  oldValue: unknown;
  newValue: unknown;
  performedBy: string;
  timestamp: string;
}

export interface MonthlyEarning {
  userId: string;
  type: CommissionType;
  _sum: { amount: string | null };
}

export interface ManagerNetworkPerformance {
  managerId: string;
  managerName: string;
  installations: number;
}

export interface PaymentSummaryItem {
  status: PaymentStatus;
  _count: { _all: number };
}

export interface BonusSummaryItem {
  userId: string;
  _sum: { amount: string | null };
  _count: { _all: number };
}
