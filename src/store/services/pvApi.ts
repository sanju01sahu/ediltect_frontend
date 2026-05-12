"use client";

import {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
  createApi,
  fetchBaseQuery,
} from "@reduxjs/toolkit/query/react";
import { BACKEND_BASE_URL } from "@/lib/backend";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/client-auth";
import { getSessionFromAccessToken } from "@/lib/jwt";
import {
  AuditLog,
  BonusRunResponse,
  BonusSummaryItem,
  Commission,
  Contract,
  ContractStatus,
  CreateVersionResponse,
  ListFilterMode,
  ListQueryParams,
  ListRequestParams,
  LoginResponse,
  ManagerNetworkPerformance,
  MonthlyEarning,
  PaginatedResponse,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentSummaryItem,
  Role,
  SessionResponse,
  Solution,
  SolutionVersion,
  User,
} from "@/types/api";

interface LoginRequest {
  email: string;
  password: string;
}

interface RefreshRequest {
  refreshToken: string;
}

interface LogoutRequest {
  refreshToken: string;
}

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  role: Role;
  managerId?: string;
}

interface UpdateUserRequest {
  id: string;
  name?: string;
  email?: string;
  role?: Role;
  managerId?: string | null;
  password?: string;
}

interface CreateSolutionRequest {
  name: string;
}

interface CreateSolutionVersionRequest {
  id: string;
  price: number;
  baseCommission: number;
  validFrom: string;
  validTo?: string;
  retroactive?: boolean;
}

interface CreateContractRequest {
  solutionId: string;
  customerDetails: unknown;
  installationDate: string;
  status?: ContractStatus;
  agentId?: string;
}

interface CreatePaymentRequest {
  userId: string;
  totalAmount: number;
  status?: Extract<PaymentStatus, "PENDING" | "DISPUTED" | "CANCELLED">;
}

interface AddTransactionRequest {
  id: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  proofUrl?: string;
  adminNote?: string;
}

interface MonthlyQuery {
  year: number;
  month: number;
}

interface SolutionVersionsQuery extends ListQueryParams {
  solutionId: string;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: BACKEND_BASE_URL,
  prepareHeaders: (headers) => {
    headers.set("accept", "application/json");
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
    return headers;
  },
});

const RETRYABLE_AUTH_PATHS = new Set(["/users/login", "/users/refresh", "/users/logout"]);
const MAX_AUTH_FETCH_RETRIES = 2;
const AUTH_RETRY_BASE_DELAY_MS = 400;

function getRequestUrl(args: string | FetchArgs) {
  return typeof args === "string" ? args : args.url;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFetchError(error?: FetchBaseQueryError) {
  if (!error || error.status !== "FETCH_ERROR") return false;
  const message = String(("error" in error ? error.error : "") ?? "").toLowerCase();
  return (
    message.includes("socket hang up") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("failed to fetch")
  );
}

async function executeWithAuthRetry(
  args: string | FetchArgs,
  api: Parameters<typeof rawBaseQuery>[1],
  extraOptions: Parameters<typeof rawBaseQuery>[2],
) {
  const url = getRequestUrl(args);
  const shouldRetry = RETRYABLE_AUTH_PATHS.has(url);
  let result = await rawBaseQuery(args, api, extraOptions);

  if (!shouldRetry) {
    return result;
  }

  for (let attempt = 1; attempt <= MAX_AUTH_FETCH_RETRIES && isRetryableFetchError(result.error); attempt += 1) {
    await wait(AUTH_RETRY_BASE_DELAY_MS * attempt);
    result = await rawBaseQuery(args, api, extraOptions);
  }

  return result;
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await executeWithAuthRetry(args, api, extraOptions);
  const url = getRequestUrl(args);

  if (result.error?.status !== 401 || url === "/users/login" || url === "/users/refresh") {
    return result;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return result;
  }

  const refreshResult = await executeWithAuthRetry(
    {
      url: "/users/refresh",
      method: "POST",
      body: { refreshToken },
    },
    api,
    extraOptions,
  );

  if (refreshResult.data) {
    setAuthTokens(refreshResult.data as LoginResponse);
    result = await executeWithAuthRetry(args, api, extraOptions);
  } else {
    clearAuthTokens();
  }

  return result;
};

function buildSession(): SessionResponse {
  const session =
    getSessionFromAccessToken(getAccessToken() ?? undefined) ??
    getSessionFromAccessToken(getRefreshToken() ?? undefined);
  return { user: session };
}

function buildListQueryString(params?: ListQueryParams) {
  if (!params) return "";

  const query = new URLSearchParams();
  if (params.search && params.search.trim().length > 0) {
    query.set("search", params.search.trim());
  }
  if (params.status && params.status.trim().length > 0) {
    query.set("status", params.status.trim());
  }
  if (params.sortBy && params.sortBy.trim().length > 0) {
    query.set("sortBy", params.sortBy.trim());
  }
  if (params.sortOrder) {
    query.set("sortOrder", params.sortOrder);
  }
  if (params.startDate && params.startDate.trim().length > 0) {
    query.set("startDate", params.startDate.trim());
  }
  if (params.endDate && params.endDate.trim().length > 0) {
    query.set("endDate", params.endDate.trim());
  }
  if (params.page) {
    query.set("page", String(params.page));
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

type ListQueryExecutor = (
  args: string | FetchArgs,
) => Promise<{ data?: unknown; error?: FetchBaseQueryError }>;

function splitListParams(params?: ListRequestParams | void) {
  if (!params) {
    return { filterMode: "client" as ListFilterMode, query: undefined as ListQueryParams | undefined };
  }
  const { filterMode = "client", ...query } = params;
  return { filterMode, query };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asPaginatedResponse<T>(payload: unknown): PaginatedResponse<T> | null {
  if (!isObject(payload)) return null;
  const items = payload.items;
  const pagination = payload.pagination;
  if (!Array.isArray(items) || !isObject(pagination)) return null;
  const page = Number(pagination.page);
  const limit = Number(pagination.limit);
  const total = Number(pagination.total);
  const totalPages = Number(pagination.totalPages);
  if (!Number.isFinite(page) || !Number.isFinite(limit) || !Number.isFinite(total) || !Number.isFinite(totalPages)) {
    return null;
  }
  return {
    items: items as T[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function textIncludes(haystack: unknown, needle: string) {
  if (!needle) return true;
  return normalizeText(haystack).includes(needle);
}

function toDateMs(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw) return Number.NaN;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? Number.NaN : ms;
}

function inDateRange(value: unknown, startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return true;
  const ms = toDateMs(value);
  if (Number.isNaN(ms)) return false;
  if (startDate) {
    const start = Date.parse(startDate);
    if (!Number.isNaN(start) && ms < start) return false;
  }
  if (endDate) {
    const end = Date.parse(endDate);
    if (!Number.isNaN(end)) {
      const endExclusive = end + 24 * 60 * 60 * 1000;
      if (ms >= endExclusive) return false;
    }
  }
  return true;
}

function paginateItems<T>(items: T[], params?: ListQueryParams): PaginatedResponse<T> {
  const page = params?.page && params.page > 0 ? params.page : 1;
  const limit = params?.limit && params.limit > 0 ? params.limit : 10;
  const total = items.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

async function fetchAllPages<T>(
  endpointPath: string,
  execute: ListQueryExecutor,
): Promise<{ data?: T[]; error?: FetchBaseQueryError }> {
  const pageSize = 100;
  let page = 1;
  let totalPages = 1;
  const collected: T[] = [];

  while (page <= totalPages) {
    const queryString = `?page=${page}&limit=${pageSize}`;
    const result = await execute(`${endpointPath}${queryString}`);
    if (result.error) {
      return { error: result.error };
    }
    const parsed = asPaginatedResponse<T>(result.data);
    if (!parsed) {
      return {
        error: {
          status: "PARSING_ERROR",
          originalStatus: 500,
          data: "Invalid list payload received from backend",
          error: "Invalid response shape",
        },
      };
    }
    collected.push(...parsed.items);
    totalPages = parsed.pagination.totalPages || 0;
    if (totalPages === 0) break;
    page += 1;
  }

  return { data: collected };
}

function sortByString<T>(items: T[], getValue: (item: T) => string, sortOrder: "asc" | "desc") {
  return [...items].sort((a, b) => {
    const compare = getValue(a).localeCompare(getValue(b), undefined, { sensitivity: "base" });
    return sortOrder === "asc" ? compare : -compare;
  });
}

function sortByDate<T>(items: T[], getValue: (item: T) => unknown, sortOrder: "asc" | "desc") {
  return [...items].sort((a, b) => {
    const left = toDateMs(getValue(a));
    const right = toDateMs(getValue(b));
    const safeLeft = Number.isNaN(left) ? 0 : left;
    const safeRight = Number.isNaN(right) ? 0 : right;
    return sortOrder === "asc" ? safeLeft - safeRight : safeRight - safeLeft;
  });
}

function contractCustomerText(customerDetails: unknown) {
  if (!isObject(customerDetails)) return "";
  return [
    customerDetails.name,
    customerDetails.phone,
    customerDetails.email,
    customerDetails.site,
    customerDetails.city,
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function applyUserClientFilters(items: User[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const status = normalizeText(params?.status);
  const filtered = items.filter((user) => {
    const matchesStatus = !status || normalizeText(user.role) === status;
    const matchesSearch =
      !query ||
      [user.name, user.email, user.role, user.manager?.name, user.manager?.email].some((value) => textIncludes(value, query));
    const matchesDate = inDateRange(user.createdAt, params?.startDate, params?.endDate);
    return matchesStatus && matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  if (params?.sortBy === "name") {
    return sortByString(filtered, (user) => user.name ?? "", sortOrder);
  }
  return sortByDate(filtered, (user) => user.createdAt, sortOrder);
}

function applySolutionClientFilters(items: Solution[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const filtered = items.filter((solution) => {
    const matchesSearch = !query || [solution.name, solution.id].some((value) => textIncludes(value, query));
    const matchesDate = inDateRange(solution.createdAt, params?.startDate, params?.endDate);
    return matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  if (params?.sortBy === "name") {
    return sortByString(filtered, (solution) => solution.name ?? "", sortOrder);
  }
  return sortByDate(filtered, (solution) => solution.createdAt, sortOrder);
}

function applyContractClientFilters(items: Contract[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const status = normalizeText(params?.status);
  const filtered = items.filter((contract) => {
    const matchesStatus = !status || normalizeText(contract.status) === status;
    const matchesSearch =
      !query ||
      [
        contract.id,
        contract.solutionVersionId,
        contract.agentId,
        contract.agent?.name,
        contract.agent?.email,
        contract.solutionVersion?.solution?.name,
        contract.status,
        contractCustomerText(contract.customerDetails),
      ].some((value) => textIncludes(value, query));
    const matchesDate = inDateRange(contract.installationDate, params?.startDate, params?.endDate);
    return matchesStatus && matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  if (params?.sortBy === "installationDate") {
    return sortByDate(filtered, (contract) => contract.installationDate, sortOrder);
  }
  return sortByDate(filtered, (contract) => contract.createdAt, sortOrder);
}

function applyCommissionClientFilters(items: Commission[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const filtered = items.filter((commission) => {
    const matchesSearch =
      !query ||
      [
        commission.id,
        commission.contractId,
        commission.userId,
        commission.type,
        commission.user?.name,
        commission.user?.email,
        contractCustomerText(commission.contract?.customerDetails),
      ].some((value) => textIncludes(value, query));
    const matchesDate = inDateRange(commission.createdAt, params?.startDate, params?.endDate);
    return matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  if (params?.sortBy === "name") {
    return sortByString(filtered, (commission) => commission.user?.name ?? "", sortOrder);
  }
  return sortByDate(filtered, (commission) => commission.createdAt, sortOrder);
}

function applyPaymentClientFilters(items: Payment[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const status = normalizeText(params?.status);
  const filtered = items.filter((payment) => {
    const matchesStatus =
      !status ||
      normalizeText(payment.status) === status ||
      normalizeText(payment.effectiveStatus) === status;
    const matchesSearch =
      !query ||
      [
        payment.id,
        payment.userId,
        payment.status,
        payment.effectiveStatus,
        payment.user?.name,
        payment.user?.email,
        payment.totalAmount,
      ].some((value) => textIncludes(value, query));
    const matchesDate = inDateRange(payment.createdAt, params?.startDate, params?.endDate);
    return matchesStatus && matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  if (params?.sortBy === "name") {
    return sortByString(filtered, (payment) => payment.user?.name ?? "", sortOrder);
  }
  return sortByDate(filtered, (payment) => payment.createdAt, sortOrder);
}

function applyAuditLogClientFilters(items: AuditLog[], params?: ListQueryParams) {
  const query = normalizeText(params?.search);
  const filtered = items.filter((log) => {
    const matchesSearch =
      !query ||
      [log.id, log.action, log.entityType, log.entityId, log.performedBy, log.timestamp].some((value) =>
        textIncludes(value, query),
      );
    const matchesDate = inDateRange(log.timestamp, params?.startDate, params?.endDate);
    return matchesSearch && matchesDate;
  });
  const sortOrder = params?.sortOrder ?? "desc";
  return sortByDate(filtered, (log) => log.timestamp, sortOrder);
}

export const pvApi = createApi({
  reducerPath: "pvApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Session",
    "Users",
    "Solutions",
    "Contracts",
    "Commissions",
    "Payments",
    "Reports",
    "Audit",
  ],
  endpoints: (builder) => ({
    getSession: builder.query<SessionResponse, void>({
      async queryFn(_arg, api, extraOptions) {
        const accessSession = getSessionFromAccessToken(getAccessToken() ?? undefined);
        if (accessSession) {
          return { data: { user: accessSession } };
        }

        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          return { data: { user: null } };
        }

        const refreshResult = await executeWithAuthRetry(
          {
            url: "/users/refresh",
            method: "POST",
            body: { refreshToken },
          },
          api,
          extraOptions,
        );

        if (refreshResult.data) {
          setAuthTokens(refreshResult.data as LoginResponse);
          return { data: buildSession() };
        }

        clearAuthTokens();
        return { data: { user: null } };
      },
      providesTags: ["Session"],
    }),
    login: builder.mutation<SessionResponse, LoginRequest>({
      async queryFn(body, api, extraOptions) {
        const result = await executeWithAuthRetry(
          {
            url: "/users/login",
            method: "POST",
            body,
          },
          api,
          extraOptions,
        );

        if (result.error) {
          return { error: result.error };
        }

        setAuthTokens(result.data as LoginResponse);
        return { data: buildSession() };
      },
      invalidatesTags: ["Session"],
    }),
    refreshSession: builder.mutation<LoginResponse, RefreshRequest>({
      async queryFn(body, api, extraOptions) {
        const result = await executeWithAuthRetry(
          {
            url: "/users/refresh",
            method: "POST",
            body,
          },
          api,
          extraOptions,
        );

        if (result.error) {
          return { error: result.error };
        }

        setAuthTokens(result.data as LoginResponse);
        return { data: result.data as LoginResponse };
      },
      invalidatesTags: ["Session"],
    }),
    logoutBackend: builder.mutation<void, LogoutRequest>({
      query: (body) => ({
        url: "/users/logout",
        method: "POST",
        body,
      }),
    }),
    logout: builder.mutation<{ ok: boolean }, void>({
      async queryFn(_arg, api, extraOptions) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          await executeWithAuthRetry(
            {
              url: "/users/logout",
              method: "POST",
              body: { refreshToken },
            },
            api,
            extraOptions,
          );
        }
        clearAuthTokens();
        return { data: { ok: true } };
      },
      invalidatesTags: ["Session"],
    }),
    getUsers: builder.query<PaginatedResponse<User>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/users${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<User>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid users response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<User>("/users", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyUserClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Users"],
    }),
    getSolutions: builder.query<PaginatedResponse<Solution>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/solutions${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<Solution>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid solutions response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<Solution>("/solutions", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applySolutionClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Solutions"],
    }),
    createUser: builder.mutation<User, CreateUserRequest>({
      query: (body) => ({
        url: "/users",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Users"],
    }),
    updateUser: builder.mutation<User, UpdateUserRequest>({
      query: ({ id, ...body }) => ({
        url: `/users/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Users"],
    }),
    createSolution: builder.mutation<Solution, CreateSolutionRequest>({
      query: (body) => ({
        url: "/solutions",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Solutions"],
    }),
    createSolutionVersion: builder.mutation<CreateVersionResponse, CreateSolutionVersionRequest>({
      query: ({ id, ...body }) => ({
        url: `/solutions/${id}/version`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Solutions", "Contracts", "Commissions"],
    }),
    getSolutionVersions: builder.query<PaginatedResponse<SolutionVersion>, SolutionVersionsQuery>({
      query: ({ solutionId, ...params }) => `/solutions/${solutionId}/versions${buildListQueryString(params)}`,
      providesTags: ["Solutions"],
    }),
    createContract: builder.mutation<Contract, CreateContractRequest>({
      query: (body) => ({
        url: "/contracts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contracts", "Commissions", "Reports"],
    }),
    getContracts: builder.query<PaginatedResponse<Contract>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/contracts${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<Contract>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid contracts response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<Contract>("/contracts", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyContractClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Contracts"],
    }),
    getCommissions: builder.query<PaginatedResponse<Commission>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/commissions${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<Commission>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid commissions response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<Commission>("/commissions", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyCommissionClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Commissions"],
    }),
    getCommissionsByUser: builder.query<PaginatedResponse<Commission>, { userId: string } & ListRequestParams>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { userId, ...rest } = params;
        const { filterMode, query } = splitListParams(rest);
        if (filterMode === "server") {
          const result = await baseQuery(`/commissions/${userId}${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<Commission>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid user commissions response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<Commission>(`/commissions/${userId}`, baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyCommissionClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Commissions"],
    }),
    runMonthlyBonus: builder.mutation<BonusRunResponse, MonthlyQuery>({
      query: (body) => ({
        url: "/bonuses/run-monthly",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Commissions", "Reports"],
    }),
    getPayments: builder.query<PaginatedResponse<Payment>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/payments${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<Payment>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid payments response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<Payment>("/payments", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyPaymentClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Payments"],
    }),
    createPayment: builder.mutation<Payment, CreatePaymentRequest>({
      query: (body) => ({
        url: "/payments",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Payments", "Reports"],
    }),
    addPaymentTransaction: builder.mutation<{ tx: unknown; payment: Payment }, AddTransactionRequest>({
      query: ({ id, ...body }) => ({
        url: `/payments/${id}/transactions`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["Payments", "Reports"],
    }),
    getAuditLogs: builder.query<PaginatedResponse<AuditLog>, ListRequestParams | void>({
      async queryFn(params, api, extraOptions, baseQuery) {
        const { filterMode, query } = splitListParams(params);
        if (filterMode === "server") {
          const result = await baseQuery(`/audit-logs${buildListQueryString(query)}`);
          if (result.error) return { error: result.error };
          const parsed = asPaginatedResponse<AuditLog>(result.data);
          if (!parsed) {
            return { error: { status: "CUSTOM_ERROR", error: "Invalid audit logs response" } };
          }
          return { data: parsed };
        }
        const all = await fetchAllPages<AuditLog>("/audit-logs", baseQuery as ListQueryExecutor);
        if (all.error) return { error: all.error };
        const filtered = applyAuditLogClientFilters(all.data ?? [], query);
        return { data: paginateItems(filtered, query) };
      },
      providesTags: ["Audit"],
    }),
    getMonthlyEarnings: builder.query<MonthlyEarning[], MonthlyQuery>({
      query: ({ year, month }) => `/reports/monthly-earnings?year=${year}&month=${month}`,
      providesTags: ["Reports"],
    }),
    getManagerNetworkPerformance: builder.query<ManagerNetworkPerformance[], void>({
      query: () => "/reports/manager-network-performance",
      providesTags: ["Reports"],
    }),
    getPaymentSummary: builder.query<PaymentSummaryItem[], void>({
      query: () => "/reports/payments-summary",
      providesTags: ["Reports"],
    }),
    getBonusSummary: builder.query<BonusSummaryItem[], void>({
      query: () => "/reports/bonus-summary",
      providesTags: ["Reports"],
    }),
  }),
});

export const {
  useGetSessionQuery,
  useLoginMutation,
  useRefreshSessionMutation,
  useLogoutBackendMutation,
  useLogoutMutation,
  useGetUsersQuery,
  useGetSolutionsQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useCreateSolutionMutation,
  useCreateSolutionVersionMutation,
  useGetSolutionVersionsQuery,
  useCreateContractMutation,
  useGetContractsQuery,
  useGetCommissionsQuery,
  useGetCommissionsByUserQuery,
  useRunMonthlyBonusMutation,
  useGetPaymentsQuery,
  useCreatePaymentMutation,
  useAddPaymentTransactionMutation,
  useGetAuditLogsQuery,
  useGetMonthlyEarningsQuery,
  useGetManagerNetworkPerformanceQuery,
  useGetPaymentSummaryQuery,
  useGetBonusSummaryQuery,
} = pvApi;
