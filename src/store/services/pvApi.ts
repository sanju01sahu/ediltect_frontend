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
  ListQueryParams,
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
  managerId?: string | null;
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

function getRequestUrl(args: string | FetchArgs) {
  return typeof args === "string" ? args : args.url;
}

const baseQueryWithReauth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const url = getRequestUrl(args);

  if (result.error?.status !== 401 || url === "/users/login" || url === "/users/refresh") {
    return result;
  }

  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthTokens();
    return result;
  }

  const refreshResult = await rawBaseQuery(
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
    result = await rawBaseQuery(args, api, extraOptions);
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
  if (params.page) {
    query.set("page", String(params.page));
  }
  if (params.limit) {
    query.set("limit", String(params.limit));
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
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

        const refreshResult = await rawBaseQuery(
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
        const result = await rawBaseQuery(
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
        const result = await rawBaseQuery(
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
          await rawBaseQuery(
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
    getUsers: builder.query<PaginatedResponse<User>, ListQueryParams | void>({
      query: (params) => `/users${buildListQueryString(params ?? undefined)}`,
      providesTags: ["Users"],
    }),
    getSolutions: builder.query<PaginatedResponse<Solution>, ListQueryParams | void>({
      query: (params) => `/solutions${buildListQueryString(params ?? undefined)}`,
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
    getContracts: builder.query<PaginatedResponse<Contract>, ListQueryParams | void>({
      query: (params) => `/contracts${buildListQueryString(params ?? undefined)}`,
      providesTags: ["Contracts"],
    }),
    getCommissions: builder.query<PaginatedResponse<Commission>, ListQueryParams | void>({
      query: (params) => `/commissions${buildListQueryString(params ?? undefined)}`,
      providesTags: ["Commissions"],
    }),
    getCommissionsByUser: builder.query<PaginatedResponse<Commission>, { userId: string } & ListQueryParams>({
      query: ({ userId, ...params }) => `/commissions/${userId}${buildListQueryString(params)}`,
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
    getPayments: builder.query<PaginatedResponse<Payment>, ListQueryParams | void>({
      query: (params) => `/payments${buildListQueryString(params ?? undefined)}`,
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
    getAuditLogs: builder.query<PaginatedResponse<AuditLog>, ListQueryParams | void>({
      query: (params) => `/audit-logs${buildListQueryString(params ?? undefined)}`,
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
