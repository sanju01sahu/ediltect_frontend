"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatCompactId, formatDateTime } from "@/lib/utils";
import { useGetAuditLogsQuery, useGetSessionQuery, useGetUsersQuery } from "@/store/services/pvApi";

export default function AuditLogsPage() {
  const { data: session } = useGetSessionQuery();
  const isAdmin = session?.user?.role === "ADMIN";
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const { data: logsResponse, isLoading } = useGetAuditLogsQuery(
    {
      search: debouncedSearchTerm,
      sortBy,
      sortOrder,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: pageSize,
    },
    { skip: !isAdmin },
  );
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 }, { skip: !isAdmin });
  const logs = logsResponse?.items ?? [];
  const users = usersResponse?.items ?? [];
  const totalPages = logsResponse?.pagination.totalPages ?? 0;
  const totalItems = logsResponse?.pagination.total ?? 0;
  const effectivePage = logsResponse?.pagination.page ?? (totalPages === 0 ? 1 : Math.min(page, totalPages));
  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState
          title="Audit logs restricted"
          description="Only administrators can access security audit trails."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Critical write and authentication events with server-side pagination."
      />

      <Card>
        <CardHeader title="Security Timeline" description="Ordered by newest timestamp first." />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search by time, action, entity, or performer"
          />
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="auditSortBy">Sort By</Label>
            <Select
              id="auditSortBy"
              value={sortBy}
              onChange={(event) => {
                setSortBy(event.target.value);
                setPage(1);
              }}
            >
              <option value="timestamp">Timestamp</option>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="auditSortOrder">Sort Order</Label>
            <Select
              id="auditSortOrder"
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
            <Label htmlFor="auditStartDate">Start Date</Label>
            <Input
              id="auditStartDate"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="auditEndDate">End Date</Label>
            <Input
              id="auditEndDate"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {isLoading ? (
          <TableSkeleton rows={10} />
        ) : logs.length === 0 ? (
          <EmptyState title="No audit logs" description="Audit entries will appear after critical mutations." />
        ) : (
          <>
            <DataTable columns={["Time", "Action", "Entity", "Entity ID", "Performed By"]}>
              {logs.map((log) => (
                <DataRow key={log.id}>
                  <DataCell>{formatDateTime(log.timestamp)}</DataCell>
                  <DataCell>
                    <Badge variant={log.action === "DELETE" ? "danger" : log.action === "CREATE" ? "success" : "warning"}>
                      {log.action}
                    </Badge>
                  </DataCell>
                  <DataCell>{log.entityType}</DataCell>
                  <DataCell>{formatCompactId(log.entityId)}</DataCell>
                  <DataCell>{userLookup.get(log.performedBy)?.name ?? formatCompactId(log.performedBy)}</DataCell>
                </DataRow>
              ))}
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
              itemLabel="logs"
            />
          </>
        )}
      </Card>
    </div>
  );
}
