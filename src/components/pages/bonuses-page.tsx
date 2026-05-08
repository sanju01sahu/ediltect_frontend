"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { formatCompactId, formatCurrency, getErrorMessage } from "@/lib/utils";
import { useGetSessionQuery, useGetUsersQuery, useRunMonthlyBonusMutation } from "@/store/services/pvApi";
import { Commission } from "@/types/api";

const schema = z.object({
  year: z.number().int().min(2000),
  month: z.number().int().min(1).max(12),
});

type FormValues = z.infer<typeof schema>;

export default function BonusesPage() {
  const { data: session } = useGetSessionQuery();
  const isAdmin = session?.user?.role === "ADMIN";
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 }, { skip: !isAdmin });
  const users = usersResponse?.items ?? [];
  const [runBonus, runState] = useRunMonthlyBonusMutation();
  const [results, setResults] = useState<Commission[]>([]);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const userLookup = new Map(users.map((user) => [user.id, user]));

  const now = new Date();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const response = await runBonus(values).unwrap();
      setResults(response.created);
      setBanner({
        type: "success",
        text: `Bonus run completed. Created ${response.createdCount} commission entries.`,
      });
    } catch (error) {
      setBanner({ type: "error", text: getErrorMessage(error, "Failed to run monthly bonus.") });
    }
  });

  if (!isAdmin) {
    return (
      <Card>
        <EmptyState
          title="Bonus execution restricted"
          description="Only administrators can execute monthly bonus generation."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Bonuses"
        description="Run monthly bonus automation for agents and managers."
      />

      <Card className="mb-4">
        <CardHeader title="Run Monthly Bonus" description="POST /bonuses/run-monthly" />
        <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="year">Year</Label>
            <Input id="year" type="number" {...form.register("year", { valueAsNumber: true })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="month">Month</Label>
            <Input
              id="month"
              type="number"
              min={1}
              max={12}
              {...form.register("month", { valueAsNumber: true })}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={runState.isLoading}>
              {runState.isLoading ? (
                <>
                  <Spinner />
                  Running...
                </>
              ) : (
                "Run Bonus"
              )}
            </Button>
          </div>
        </form>
        {banner ? <Alert className="mt-4" type={banner.type}>{banner.text}</Alert> : null}
      </Card>

      <Card>
        <CardHeader title="Generated Bonus Rows" description="Freshly generated commission rows from the latest run." />
        {results.length === 0 ? (
          <EmptyState title="No run results yet" description="Execute monthly bonus to inspect created rows." />
        ) : (
          <DataTable columns={["User", "Type", "Amount", "Contract"]}>
            {results.map((item) => (
              <DataRow key={item.id}>
                <DataCell className="font-medium">{userLookup.get(item.userId)?.name ?? formatCompactId(item.userId)}</DataCell>
                <DataCell>
                  <Badge variant="success">{item.type}</Badge>
                </DataCell>
                <DataCell>{formatCurrency(item.amount)}</DataCell>
                <DataCell>{formatCompactId(item.contractId)}</DataCell>
              </DataRow>
            ))}
          </DataTable>
        )}
      </Card>
    </div>
  );
}
