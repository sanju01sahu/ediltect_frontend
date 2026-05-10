"use client";

import { RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader, StatCard } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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

type RangePreset = "THIS_MONTH" | "LAST_30_DAYS" | "CUSTOM";

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthStartDate() {
  const now = new Date();
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function todayDate() {
  return toIsoDate(new Date());
}

function lastThirtyDaysStart() {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - 29);
  return toIsoDate(start);
}

function formatRate(numerator: number, denominator: number) {
  if (denominator <= 0) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export default function OverviewPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const canSeeOrg = role === "ADMIN" || role === "AREA_MANAGER";

  const [rangePreset, setRangePreset] = useState<RangePreset>("THIS_MONTH");
  const [startDate, setStartDate] = useState(monthStartDate());
  const [endDate, setEndDate] = useState(todayDate());
  const [contractStatusFilter, setContractStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");

  const listScope = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const usersQuery = useGetUsersQuery(
    { ...listScope, sortBy: "createdAt", sortOrder: "desc", page: 1, limit: 1 },
    { skip: !canSeeOrg },
  );
  const contractsQuery = useGetContractsQuery({
    ...listScope,
    status: contractStatusFilter || undefined,
    sortBy: "installationDate",
    sortOrder: "desc",
    page: 1,
    limit: 10,
  });
  const contractsCompletedQuery = useGetContractsQuery(
    { ...listScope, status: "COMPLETED", page: 1, limit: 1 },
    { skip: !canSeeOrg },
  );
  const paymentsQuery = useGetPaymentsQuery(
    {
      ...listScope,
      status: paymentStatusFilter || undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      limit: 1,
    },
    { skip: !canSeeOrg },
  );
  const paymentsFullyPaidQuery = useGetPaymentsQuery(
    { ...listScope, status: "FULLY_PAID", page: 1, limit: 1 },
    { skip: !canSeeOrg },
  );
  const solutionsQuery = useGetSolutionsQuery(
    { sortBy: "name", sortOrder: "asc", page: 1, limit: 100 },
    { skip: !canSeeOrg },
  );

  const now = new Date(endDate);
  const monthlyQuery = useGetMonthlyEarningsQuery(
    {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    },
    { skip: !canSeeOrg },
  );
  const bonusQuery = useGetBonusSummaryQuery(undefined, {
    skip: !canSeeOrg,
  });

  const users = usersQuery.data?.items ?? [];
  const contracts = contractsQuery.data?.items ?? [];
  const solutions = solutionsQuery.data?.items ?? [];
  const bonuses = bonusQuery.data ?? [];

  const usersTotal = usersQuery.data?.pagination.total ?? 0;
  const contractsTotal = contractsQuery.data?.pagination.total ?? 0;
  const completedContractsTotal = contractsCompletedQuery.data?.pagination.total ?? 0;
  const paymentsTotal = paymentsQuery.data?.pagination.total ?? 0;
  const fullyPaidTotal = paymentsFullyPaidQuery.data?.pagination.total ?? 0;
  const totalBonus = bonuses.reduce((acc, item) => acc + Number(item._sum.amount ?? 0), 0);

  const userLookup = new Map(users.map((user) => [user.id, user]));
  const solutionLookup = new Map(solutions.map((solution) => [solution.id, solution]));

  const overviewLoading =
    usersQuery.isLoading ||
    contractsQuery.isLoading ||
    paymentsQuery.isLoading ||
    contractsCompletedQuery.isLoading ||
    paymentsFullyPaidQuery.isLoading;

  const topEarners = useMemo(() => {
    const monthlyRows = monthlyQuery.data ?? [];
    const aggregates = new Map<string, number>();
    for (const row of monthlyRows) {
      aggregates.set(row.userId, (aggregates.get(row.userId) ?? 0) + Number(row._sum.amount ?? 0));
    }
    return Array.from(aggregates.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [monthlyQuery.data]);

  const refreshAll = () => {
    usersQuery.refetch();
    contractsQuery.refetch();
    contractsCompletedQuery.refetch();
    paymentsQuery.refetch();
    paymentsFullyPaidQuery.refetch();
    solutionsQuery.refetch();
    monthlyQuery.refetch();
    bonusQuery.refetch();
  };

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live operational snapshot across contracts, payouts, and incentives."
        action={
          <Button variant="secondary" onClick={refreshAll} disabled={overviewLoading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {canSeeOrg ? (
        <Card className="mb-4">
          <CardHeader title="Overview Scope" description="Apply date and status filters across overview KPIs." />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1">
              <Label htmlFor="overviewPreset">Range</Label>
              <Select
                id="overviewPreset"
                value={rangePreset}
                onChange={(event) => {
                  const preset = event.target.value as RangePreset;
                  setRangePreset(preset);
                  if (preset === "THIS_MONTH") {
                    setStartDate(monthStartDate());
                    setEndDate(todayDate());
                    return;
                  }
                  if (preset === "LAST_30_DAYS") {
                    setStartDate(lastThirtyDaysStart());
                    setEndDate(todayDate());
                  }
                }}
              >
                <option value="THIS_MONTH">This Month</option>
                <option value="LAST_30_DAYS">Last 30 Days</option>
                <option value="CUSTOM">Custom</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="overviewStartDate">Start Date</Label>
              <Input
                id="overviewStartDate"
                type="date"
                value={startDate}
                onChange={(event) => {
                  setRangePreset("CUSTOM");
                  setStartDate(event.target.value || monthStartDate());
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="overviewEndDate">End Date</Label>
              <Input
                id="overviewEndDate"
                type="date"
                value={endDate}
                onChange={(event) => {
                  setRangePreset("CUSTOM");
                  setEndDate(event.target.value || todayDate());
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="overviewContractStatus">Contract Status</Label>
              <Select
                id="overviewContractStatus"
                value={contractStatusFilter}
                onChange={(event) => setContractStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="overviewPaymentStatus">Payment Status</Label>
              <Select
                id="overviewPaymentStatus"
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="PENDING">PENDING</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="FULLY_PAID">FULLY_PAID</option>
                <option value="DISPUTED">DISPUTED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={usersQuery.isLoading ? "-" : usersTotal} hint="Active organization members" />
        <StatCard
          label="Contracts"
          value={contractsQuery.isLoading ? "-" : contractsTotal}
          hint="Includes own-only scope for agents"
        />
        <StatCard
          label="Payments"
          value={paymentsQuery.isLoading ? "-" : paymentsTotal}
          hint="Current payment records"
        />
        <StatCard
          label="Bonus Payout"
          value={bonusQuery.isLoading ? "-" : formatCurrency(totalBonus)}
          hint="Total bonus amount tracked"
        />
      </div>

      {canSeeOrg ? (
        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            label="Contract Completion Rate"
            value={contractsQuery.isLoading ? "-" : formatRate(completedContractsTotal, contractsTotal)}
            hint="Completed contracts / total contracts in scope"
          />
          <StatCard
            label="Payment Collection Rate"
            value={paymentsQuery.isLoading ? "-" : formatRate(fullyPaidTotal, paymentsTotal)}
            hint="Fully paid records / total payments in scope"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Top Earners"
            description="Highest monthly commission totals for selected end-month."
          />
          {monthlyQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : topEarners.length === 0 ? (
            <EmptyState
              title="No earnings rows"
              description="Once commissions are created this report will populate here."
            />
          ) : (
            <DataTable columns={["User", "Total"]}>
              {topEarners.map(([userId, amount]) => (
                <DataRow key={userId}>
                  <DataCell>{userLookup.get(userId)?.name ?? formatCompactId(userId)}</DataCell>
                  <DataCell>{formatCurrency(amount)}</DataCell>
                </DataRow>
              ))}
            </DataTable>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Contracts" description="Latest contract records in your scope." />
          {contractsQuery.isLoading ? (
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
                      ? solutionLookup.get(item.solutionVersion.solutionId)?.name ??
                        formatCompactId(item.solutionVersion.solutionId)
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
