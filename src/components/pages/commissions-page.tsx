"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { showToast } from "@/lib/toast";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatCompactId, formatCurrency, formatDate, getCustomerDisplayName } from "@/lib/utils";
import {
  useGetCommissionsByUserQuery,
  useGetCommissionsQuery,
  useGetSessionQuery,
  useGetUsersQuery,
} from "@/store/services/pvApi";

export default function CommissionsPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const canSeeAll = role === "ADMIN" || role === "AREA_MANAGER";

  const [userFilterSearchTerm, setUserFilterSearchTerm] = useState("");
  const debouncedUserFilterSearchTerm = useDebouncedValue(userFilterSearchTerm);
  const { data: usersResponse } = useGetUsersQuery(
    { search: debouncedUserFilterSearchTerm, page: 1, limit: 50 },
    { skip: !role },
  );
  const users = usersResponse?.items ?? [];
  const [userIdFilter, setUserIdFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const allCommissions = useGetCommissionsQuery(
    {
      search: debouncedSearchTerm,
      sortBy,
      sortOrder,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: pageSize,
    },
    { skip: !canSeeAll }
  );
  const filteredCommissions = useGetCommissionsByUserQuery(
    {
      userId: activeFilter ?? "",
      search: debouncedSearchTerm,
      sortBy,
      sortOrder,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: pageSize,
    },
    {
      skip: !activeFilter,
    },
  );
  const ownCommissions = useGetCommissionsByUserQuery(
    {
      userId: session?.user?.userId ?? "",
      search: debouncedSearchTerm,
      sortBy,
      sortOrder,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: pageSize,
    },
    {
      skip: !session?.user?.userId || canSeeAll,
    },
  );

  const activeResponse = activeFilter
    ? filteredCommissions.data
    : canSeeAll
      ? allCommissions.data
      : ownCommissions.data;
  const rows = activeResponse?.items ?? [];
  const totalPages = activeResponse?.pagination.totalPages ?? 0;
  const totalItems = activeResponse?.pagination.total ?? 0;
  const effectivePage = activeResponse?.pagination.page ?? (totalPages === 0 ? 1 : Math.min(page, totalPages));

  const loading = activeFilter
    ? filteredCommissions.isLoading
    : canSeeAll
      ? allCommissions.isLoading
      : ownCommissions.isLoading;

  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  return (
    <div>
      <PageHeader
        title="Commissions"
        description="Track base and bonus commissions by user and contract."
      />

      {canSeeAll ? (
        <Card className="relative z-10 mb-4">
          <CardHeader title="User Filter" description="Inspect commissions by selecting a user from the directory." />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="commissionUserFilter">User</Label>
              <Select
                id="commissionUserFilter"
                searchable
                searchValue={userFilterSearchTerm}
                onSearchChange={setUserFilterSearchTerm}
                value={userIdFilter}
                onChange={(event) => setUserIdFilter(event.target.value)}
              >
                <option value="">All users</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name} - {user.email}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1 sm:flex-none"
                variant="secondary"
                onClick={() => {
                  setActiveFilter(userIdFilter || null);
                  setPage(1);
                  showToast({
                    type: "info",
                    title: "Commission filter applied",
                    description: userIdFilter
                      ? "Showing commissions for the selected user."
                      : "Showing commissions for all users.",
                  });
                }}
              >
                Apply
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                variant="ghost"
                onClick={() => {
                  setUserIdFilter("");
                  setActiveFilter(null);
                  setPage(1);
                  showToast({
                    type: "info",
                    title: "Commission filter cleared",
                    description: "Showing commissions without user filtering.",
                  });
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="relative z-10">
        <CardHeader
          title={activeFilter ? "Filtered Commissions" : canSeeAll ? "All Commissions" : "My Commissions"}
          description="Immutable rows across base and bonus types."
        />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search by type, user, customer, contract, or date"
          />
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="commissionsSortBy">Sort By</Label>
            <Select
              id="commissionsSortBy"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setPage(1);
              }}
            >
              <option value="createdAt">Created Date</option>
              <option value="name">User Name</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="commissionsSortOrder">Sort Order</Label>
            <Select
              id="commissionsSortOrder"
              value={sortOrder}
              onChange={(event) => {
                setSortOrder(event.target.value as "asc" | "desc");
                setPage(1);
              }}
            >
              <option value="desc">Newest first</option>
              <option value="asc">Oldest first</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="commissionsStartDate">Start Date</Label>
            <Input
              id="commissionsStartDate"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="commissionsEndDate">End Date</Label>
            <Input
              id="commissionsEndDate"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={8} />
        ) : rows.length === 0 ? (
          <EmptyState title="No commission records" description="Try a broader search query." />
        ) : (
          <>
            <DataTable columns={["Type", "Amount", "User", "Customer", "Contract", "Created"]}>
              {rows.map((item) => {
                const user = item.user ?? userLookup.get(item.userId);
                return (
                  <DataRow key={item.id}>
                    <DataCell label="Type">
                      <Badge variant={item.type === "BONUS" ? "success" : "default"}>{item.type}</Badge>
                    </DataCell>
                    <DataCell label="Amount">{formatCurrency(item.amount)}</DataCell>
                    <DataCell label="User">{user?.name ?? formatCompactId(item.userId)}</DataCell>
                    <DataCell label="Customer">{item.contract ? getCustomerDisplayName(item.contract.customerDetails) : "-"}</DataCell>
                    <DataCell label="Contract">{formatCompactId(item.contractId)}</DataCell>
                    <DataCell label="Created">{formatDate(item.createdAt)}</DataCell>
                  </DataRow>
                );
              })}
            </DataTable>
            <PaginationControls
              page={effectivePage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="commissions"
            />
          </>
        )}
      </Card>
    </div>
  );
}
