"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { formatCompactId, formatCurrency } from "@/lib/utils";
import {
  useGetBonusSummaryQuery,
  useGetManagerNetworkPerformanceQuery,
  useGetMonthlyEarningsQuery,
  useGetPaymentSummaryQuery,
  useGetSessionQuery,
  useGetUsersQuery,
} from "@/store/services/pvApi";

export default function ReportsPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const canSee = role === "ADMIN" || role === "AREA_MANAGER";
  const isAdmin = role === "ADMIN";

  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [monthlySearch, setMonthlySearch] = useState("");
  const [bonusSearch, setBonusSearch] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [bonusPage, setBonusPage] = useState(1);
  const [managerPage, setManagerPage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [monthlyPageSize, setMonthlyPageSize] = useState(10);
  const [bonusPageSize, setBonusPageSize] = useState(10);
  const [managerPageSize, setManagerPageSize] = useState(10);
  const [paymentPageSize, setPaymentPageSize] = useState(10);

  const monthly = useGetMonthlyEarningsQuery({ year, month }, { skip: !canSee });
  const bonus = useGetBonusSummaryQuery(undefined, { skip: !canSee });
  const managers = useGetManagerNetworkPerformanceQuery(undefined, { skip: !isAdmin });
  const payments = useGetPaymentSummaryQuery(undefined, { skip: !isAdmin });
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 }, { skip: !canSee });
  const users = usersResponse?.items ?? [];

  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const filteredMonthlyRows = useMemo(() => {
    const monthlyRows = monthly.data ?? [];
    const query = monthlySearch.trim().toLowerCase();
    if (!query) return monthlyRows;
    return monthlyRows.filter((row) =>
      [
        userLookup.get(row.userId)?.name ?? "",
        row.type,
        formatCurrency(row._sum.amount),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [monthly.data, monthlySearch, userLookup]);
  const filteredBonusRows = useMemo(() => {
    const bonusRows = bonus.data ?? [];
    const query = bonusSearch.trim().toLowerCase();
    if (!query) return bonusRows;
    return bonusRows.filter((row) =>
      [
        userLookup.get(row.userId)?.name ?? "",
        String(row._count._all),
        formatCurrency(row._sum.amount),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [bonus.data, bonusSearch, userLookup]);
  const filteredManagerRows = useMemo(() => {
    const managerRows = managers.data ?? [];
    const query = managerSearch.trim().toLowerCase();
    if (!query) return managerRows;
    return managerRows.filter((row) =>
      [row.managerName, formatCompactId(row.managerId), String(row.installations)]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [managerSearch, managers.data]);
  const filteredPaymentRows = useMemo(() => {
    const paymentRows = payments.data ?? [];
    const query = paymentSearch.trim().toLowerCase();
    if (!query) return paymentRows;
    return paymentRows.filter((row) =>
      [row.status, String(row._count._all)].join(" ").toLowerCase().includes(query),
    );
  }, [paymentSearch, payments.data]);

  const monthlyTotalPages = Math.ceil(filteredMonthlyRows.length / monthlyPageSize);
  const bonusTotalPages = Math.ceil(filteredBonusRows.length / bonusPageSize);
  const managerTotalPages = Math.ceil(filteredManagerRows.length / managerPageSize);
  const paymentTotalPages = Math.ceil(filteredPaymentRows.length / paymentPageSize);
  const effectiveMonthlyPage = monthlyTotalPages === 0 ? 1 : Math.min(monthlyPage, monthlyTotalPages);
  const effectiveBonusPage = bonusTotalPages === 0 ? 1 : Math.min(bonusPage, bonusTotalPages);
  const effectiveManagerPage = managerTotalPages === 0 ? 1 : Math.min(managerPage, managerTotalPages);
  const effectivePaymentPage = paymentTotalPages === 0 ? 1 : Math.min(paymentPage, paymentTotalPages);

  const paginatedMonthlyRows = useMemo(() => {
    const start = (effectiveMonthlyPage - 1) * monthlyPageSize;
    return filteredMonthlyRows.slice(start, start + monthlyPageSize);
  }, [effectiveMonthlyPage, filteredMonthlyRows, monthlyPageSize]);
  const paginatedBonusRows = useMemo(() => {
    const start = (effectiveBonusPage - 1) * bonusPageSize;
    return filteredBonusRows.slice(start, start + bonusPageSize);
  }, [bonusPageSize, effectiveBonusPage, filteredBonusRows]);
  const paginatedManagerRows = useMemo(() => {
    const start = (effectiveManagerPage - 1) * managerPageSize;
    return filteredManagerRows.slice(start, start + managerPageSize);
  }, [effectiveManagerPage, filteredManagerRows, managerPageSize]);
  const paginatedPaymentRows = useMemo(() => {
    const start = (effectivePaymentPage - 1) * paymentPageSize;
    return filteredPaymentRows.slice(start, start + paymentPageSize);
  }, [effectivePaymentPage, filteredPaymentRows, paymentPageSize]);

  if (!canSee) {
    return (
      <Card>
        <EmptyState
          title="Reports unavailable"
          description="Reports are available to administrators and area managers."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Operational aggregates for earnings, manager performance, and payment health."
      />

      <Card className="mb-4">
        <CardHeader title="Monthly Filter" description="Applied to monthly earnings report." />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:max-w-sm">
          <Input
            type="number"
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              setMonthlyPage(1);
            }}
          />
          <Input
            type="number"
            min={1}
            max={12}
            value={month}
            onChange={(e) => {
              setMonth(Number(e.target.value));
              setMonthlyPage(1);
            }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader title="Monthly Earnings" description="By user and commission type." />
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={monthlySearch}
              onChange={(event) => {
                setMonthlySearch(event.target.value);
                setMonthlyPage(1);
              }}
              placeholder="Search by user, type, or amount"
            />
          </div>
          {monthly.isLoading ? (
            <TableSkeleton rows={6} />
          ) : filteredMonthlyRows.length === 0 ? (
            <EmptyState title="No earnings data" description="No commission rows in the selected month." />
          ) : (
            <>
              <DataTable columns={["User", "Type", "Amount"]}>
                {paginatedMonthlyRows.map((row) => (
                  <DataRow key={`${row.userId}-${row.type}`}>
                    <DataCell>{userLookup.get(row.userId)?.name ?? formatCompactId(row.userId)}</DataCell>
                    <DataCell>{row.type}</DataCell>
                    <DataCell>{formatCurrency(row._sum.amount)}</DataCell>
                  </DataRow>
                ))}
              </DataTable>
              <PaginationControls
                page={effectiveMonthlyPage}
                pageSize={monthlyPageSize}
                totalItems={filteredMonthlyRows.length}
                totalPages={monthlyTotalPages}
                onPageChange={setMonthlyPage}
                onPageSizeChange={(size) => {
                  setMonthlyPageSize(size);
                  setMonthlyPage(1);
                }}
                itemLabel="rows"
              />
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Bonus Summary" description="Bonus totals and count by user." />
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={bonusSearch}
              onChange={(event) => {
                setBonusSearch(event.target.value);
                setBonusPage(1);
              }}
              placeholder="Search by user, count, or bonus amount"
            />
          </div>
          {bonus.isLoading ? (
            <TableSkeleton rows={6} />
          ) : filteredBonusRows.length === 0 ? (
            <EmptyState title="No bonus data" description="No bonus commissions have been generated yet." />
          ) : (
            <>
              <DataTable columns={["User", "Count", "Total Bonus"]}>
                {paginatedBonusRows.map((row) => (
                  <DataRow key={row.userId}>
                    <DataCell>{userLookup.get(row.userId)?.name ?? formatCompactId(row.userId)}</DataCell>
                    <DataCell>{row._count._all}</DataCell>
                    <DataCell>{formatCurrency(row._sum.amount)}</DataCell>
                  </DataRow>
                ))}
              </DataTable>
              <PaginationControls
                page={effectiveBonusPage}
                pageSize={bonusPageSize}
                totalItems={filteredBonusRows.length}
                totalPages={bonusTotalPages}
                onPageChange={setBonusPage}
                onPageSizeChange={(size) => {
                  setBonusPageSize(size);
                  setBonusPage(1);
                }}
                itemLabel="rows"
              />
            </>
          )}
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader title="Manager Network Performance" description="Installation counts by manager team." />
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={managerSearch}
                onChange={(event) => {
                  setManagerSearch(event.target.value);
                  setManagerPage(1);
                }}
                placeholder="Search by manager, id, or installations"
              />
            </div>
            {managers.isLoading ? (
              <TableSkeleton rows={6} />
            ) : filteredManagerRows.length === 0 ? (
              <EmptyState title="No manager data" description="Area managers and team contracts are required." />
            ) : (
              <>
                <DataTable columns={["Manager", "Manager ID", "Installations"]}>
                  {paginatedManagerRows.map((row) => (
                    <DataRow key={row.managerId}>
                      <DataCell>{row.managerName}</DataCell>
                      <DataCell>{formatCompactId(row.managerId)}</DataCell>
                      <DataCell>{row.installations}</DataCell>
                    </DataRow>
                  ))}
                </DataTable>
                <PaginationControls
                  page={effectiveManagerPage}
                  pageSize={managerPageSize}
                  totalItems={filteredManagerRows.length}
                  totalPages={managerTotalPages}
                  onPageChange={setManagerPage}
                  onPageSizeChange={(size) => {
                    setManagerPageSize(size);
                    setManagerPage(1);
                  }}
                  itemLabel="rows"
                />
              </>
            )}
          </Card>
        ) : null}

        {isAdmin ? (
          <Card>
            <CardHeader title="Payment Summary" description="Count by derived effective status." />
            <div className="mb-4 flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={paymentSearch}
                onChange={(event) => {
                  setPaymentSearch(event.target.value);
                  setPaymentPage(1);
                }}
                placeholder="Search by status or count"
              />
            </div>
            {payments.isLoading ? (
              <TableSkeleton rows={6} />
            ) : filteredPaymentRows.length === 0 ? (
              <EmptyState title="No payment summary" description="Payment records are needed for status aggregation." />
            ) : (
              <>
                <DataTable columns={["Status", "Count"]}>
                  {paginatedPaymentRows.map((row) => (
                    <DataRow key={row.status}>
                      <DataCell>{row.status}</DataCell>
                      <DataCell>{row._count._all}</DataCell>
                    </DataRow>
                  ))}
                </DataTable>
                <PaginationControls
                  page={effectivePaymentPage}
                  pageSize={paymentPageSize}
                  totalItems={filteredPaymentRows.length}
                  totalPages={paymentTotalPages}
                  onPageChange={setPaymentPage}
                  onPageSizeChange={(size) => {
                    setPaymentPageSize(size);
                    setPaymentPage(1);
                  }}
                  itemLabel="rows"
                />
              </>
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
