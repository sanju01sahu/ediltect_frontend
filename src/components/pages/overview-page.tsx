"use client";

import { PageHeader, StatCard } from "@/components/dashboard/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetBonusSummaryQuery,
  useGetContractsQuery,
  useGetMonthlyEarningsQuery,
  useGetPaymentsQuery,
  useGetSessionQuery,
  useGetSolutionsQuery,
  useGetUsersQuery,
} from "@/store/services/pvApi";
import { formatCompactId, formatCurrency, getCustomerDisplayName } from "@/lib/utils";

export default function OverviewPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const canSeeOrg = role === "ADMIN" || role === "AREA_MANAGER";

  const { data: usersResponse, isLoading: usersLoading } = useGetUsersQuery({ page: 1, limit: 100 }, {
    skip: !canSeeOrg,
  });
  const { data: contractsResponse, isLoading: contractsLoading } = useGetContractsQuery({ page: 1, limit: 10 });
  const { data: paymentsResponse, isLoading: paymentsLoading } = useGetPaymentsQuery({ page: 1, limit: 1 }, {
    skip: !canSeeOrg,
  });
  const { data: solutionsResponse } = useGetSolutionsQuery({ page: 1, limit: 100 }, { skip: !canSeeOrg });
  const now = new Date();
  const { data: monthly = [], isLoading: monthlyLoading } = useGetMonthlyEarningsQuery(
    {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    },
    { skip: !canSeeOrg },
  );
  const { data: bonuses = [], isLoading: bonusLoading } = useGetBonusSummaryQuery(undefined, {
    skip: !canSeeOrg,
  });

  const users = usersResponse?.items ?? [];
  const contracts = contractsResponse?.items ?? [];
  const solutions = solutionsResponse?.items ?? [];
  const usersTotal = usersResponse?.pagination.total ?? 0;
  const contractsTotal = contractsResponse?.pagination.total ?? 0;
  const paymentsTotal = paymentsResponse?.pagination.total ?? 0;
  const totalBonus = bonuses.reduce((acc, item) => acc + Number(item._sum.amount ?? 0), 0);
  const userLookup = new Map(users.map((user) => [user.id, user]));
  const solutionLookup = new Map(solutions.map((solution) => [solution.id, solution]));

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live operational snapshot across contracts, payouts, and incentives."
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={usersLoading ? "-" : usersTotal} hint="Active organization members" />
        <StatCard
          label="Contracts"
          value={contractsLoading ? "-" : contractsTotal}
          hint="Includes own-only scope for agents"
        />
        <StatCard
          label="Payments"
          value={paymentsLoading ? "-" : paymentsTotal}
          hint="Current payment records"
        />
        <StatCard
          label="Bonus Payout"
          value={bonusLoading ? "-" : formatCurrency(totalBonus)}
          hint="Total bonus amount tracked"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Monthly Earnings"
            description="Current UTC month grouped by user and commission type."
          />
          {monthlyLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : monthly.length === 0 ? (
            <EmptyState
              title="No earnings rows"
              description="Once commissions are created this report will populate here."
            />
          ) : (
            <DataTable columns={["User", "Type", "Amount"]}>
              {monthly.slice(0, 10).map((item) => (
                <DataRow key={`${item.userId}-${item.type}`}>
                  <DataCell>{userLookup.get(item.userId)?.name ?? formatCompactId(item.userId)}</DataCell>
                  <DataCell>{item.type}</DataCell>
                  <DataCell>{formatCurrency(item._sum.amount)}</DataCell>
                </DataRow>
              ))}
            </DataTable>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Contracts" description="Latest contract records in your scope." />
          {contractsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : contracts.length === 0 ? (
            <EmptyState
              title="No contracts yet"
              description="Create a contract from the contracts module to get started."
            />
          ) : (
            <DataTable columns={["Customer", "Agent", "Status", "Solution"]}>
              {contracts.slice(0, 10).map((item) => (
                <DataRow key={item.id}>
                  <DataCell className="font-medium">{getCustomerDisplayName(item.customerDetails)}</DataCell>
                  <DataCell>{userLookup.get(item.agentId)?.name ?? formatCompactId(item.agentId)}</DataCell>
                  <DataCell>{item.status}</DataCell>
                  <DataCell>
                    {item.solutionVersion
                      ? solutionLookup.get(item.solutionVersion.solutionId)?.name ?? formatCompactId(item.solutionVersion.solutionId)
                      : formatCompactId(item.solutionVersionId)}
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </div>
  );
}
