"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataCell, DataRow, DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Spinner } from "@/components/ui/spinner";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
import { showToast } from "@/lib/toast";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatCompactId, formatCurrency, getErrorMessage } from "@/lib/utils";
import {
  useCreateSolutionMutation,
  useCreateSolutionVersionMutation,
  useGetSessionQuery,
  useGetSolutionsQuery,
  useGetSolutionVersionsQuery,
} from "@/store/services/pvApi";

const solutionSchema = z.object({
  name: z.string().trim().min(1, "Solution name is required."),
});

const versionSchema = z
  .object({
    solutionId: z.string().min(1, "Please select a solution."),
    price: z.number({ error: "Price is required." }).positive("Price must be greater than zero."),
    baseCommission: z
      .number({ error: "Base commission is required." })
      .nonnegative("Base commission cannot be negative."),
    validFrom: z.string().min(1, "Valid from date is required."),
    validTo: z.string().optional(),
    retroactive: z.boolean(),
  })
  .refine(
    (value) => !value.validTo || value.validTo >= value.validFrom,
    { path: ["validTo"], message: "Valid to date cannot be before valid from date." }
  );

type SolutionForm = z.infer<typeof solutionSchema>;
type VersionForm = z.infer<typeof versionSchema>;

export default function SolutionsPage() {
  const { data: session } = useGetSessionQuery();
  const isAdmin = session?.user?.role === "ADMIN";

  const [searchTerm, setSearchTerm] = useState("");
  const [activeSolutionId, setActiveSolutionId] = useState("");
  const [versionSearchTerm, setVersionSearchTerm] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(10);
  const [versionPage, setVersionPage] = useState(1);
  const [versionPageSize, setVersionPageSize] = useState(10);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);
  const debouncedVersionSearchTerm = useDebouncedValue(versionSearchTerm);
  const { data: solutionsResponse, isLoading: solutionsLoading } = useGetSolutionsQuery({
    search: debouncedSearchTerm,
    page: catalogPage,
    limit: catalogPageSize,
  });
  const { data: allSolutionsResponse } = useGetSolutionsQuery({ page: 1, limit: 100 });
  const { data: versionsResponse, isLoading: versionsLoading } = useGetSolutionVersionsQuery(
    {
      solutionId: activeSolutionId,
      search: debouncedVersionSearchTerm,
      page: versionPage,
      limit: versionPageSize,
    },
    {
      skip: !activeSolutionId,
    },
  );
  const solutions = solutionsResponse?.items ?? [];
  const allSolutions = allSolutionsResponse?.items ?? solutions;
  const versions = versionsResponse?.items ?? [];
  const catalogTotalPages = solutionsResponse?.pagination.totalPages ?? 0;
  const catalogTotalItems = solutionsResponse?.pagination.total ?? 0;
  const versionTotalPages = versionsResponse?.pagination.totalPages ?? 0;
  const versionTotalItems = versionsResponse?.pagination.total ?? 0;
  const effectiveCatalogPage =
    solutionsResponse?.pagination.page ?? (catalogTotalPages === 0 ? 1 : Math.min(catalogPage, catalogTotalPages));
  const effectiveVersionPage =
    versionsResponse?.pagination.page ?? (versionTotalPages === 0 ? 1 : Math.min(versionPage, versionTotalPages));

  const [createSolution, solutionState] = useCreateSolutionMutation();
  const [createVersion, versionState] = useCreateSolutionVersionMutation();
  const [openSolutionModal, setOpenSolutionModal] = useState(false);
  const [openVersionModal, setOpenVersionModal] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);

  const solutionForm = useForm<SolutionForm>({
    resolver: zodResolver(solutionSchema),
  });
  const versionForm = useForm<VersionForm>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      retroactive: false,
    },
  });

  useEffect(() => {
    if (!activeSolutionId && solutions.length > 0) {
      setActiveSolutionId(solutions[0].id);
    }
  }, [activeSolutionId, solutions]);

  const versionSolutionOptions = useMemo(
    () =>
      allSolutions.map((solution) => ({
        value: solution.id,
        label: solution.name,
        keywords: [solution.id, formatCompactId(solution.id)],
      })),
    [allSolutions],
  );

  const activeSolution =
    allSolutions.find((solution) => solution.id === activeSolutionId) ??
    solutions.find((solution) => solution.id === activeSolutionId) ??
    null;

  const onSolutionSubmit = solutionForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const created = await createSolution(values).unwrap();
      const message = (created as { message?: string }).message ?? `Created solution ${created.name}.`;
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "Solution created", description: message });
      setActiveSolutionId(created.id);
      setOpenSolutionModal(false);
      solutionForm.reset();
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create solution.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Create solution failed", description: message });
    }
  });

  const onVersionSubmit = versionForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const created = await createVersion({
        id: values.solutionId,
        price: values.price,
        baseCommission: values.baseCommission,
        validFrom: values.validFrom,
        validTo: values.validTo || undefined,
        retroactive: values.retroactive,
      }).unwrap();
      const message =
        (created as { message?: string }).message ??
        `Version created. Recalculated ${created.recalculatedContracts} contracts.`;
      setBanner({
        type: "success",
        text: message,
      });
      showToast({ type: "success", title: "Solution version created", description: message });
      setActiveSolutionId(values.solutionId);
      setOpenVersionModal(false);
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create version.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Create version failed", description: message });
    }
  });

  return (
    <div>
      <PageHeader
        title="Solutions"
        description="Versioned pricing and commission plans."
        action={
          isAdmin ? (
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setOpenVersionModal(true)}>
                New Version
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => setOpenSolutionModal(true)}>New Solution</Button>
            </div>
          ) : null
        }
      />

      {banner ? <Alert className="mb-4" type={banner.type}>{banner.text}</Alert> : null}

      <Card className="mb-4">
        <CardHeader
          title="Solution Catalog"
          description="Search and select a solution by name to inspect version history."
        />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCatalogPage(1);
            }}
            placeholder="Search solutions by name"
          />
        </div>
        {solutionsLoading ? (
          <TableSkeleton rows={5} />
        ) : solutions.length === 0 ? (
          <EmptyState
            title="No matching solutions"
            description="Create a solution or broaden the search query."
          />
        ) : (
          <>
            <DataTable columns={["Solution", "Created", "Select"]}>
              {solutions.map((solution) => (
                <DataRow key={solution.id}>
                  <DataCell className="font-medium">{solution.name}</DataCell>
                  <DataCell>{new Date(solution.createdAt).toLocaleDateString()}</DataCell>
                  <DataCell>
                    <Button
                      size="sm"
                      variant={solution.id === activeSolutionId ? "primary" : "secondary"}
                      onClick={() => {
                        setActiveSolutionId(solution.id);
                        setVersionPage(1);
                      }}
                    >
                      {solution.id === activeSolutionId ? "Selected" : "View Versions"}
                    </Button>
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
            <PaginationControls
              page={effectiveCatalogPage}
              pageSize={catalogPageSize}
              totalItems={catalogTotalItems}
              totalPages={catalogTotalPages}
              onPageChange={setCatalogPage}
              onPageSizeChange={(size) => {
                setCatalogPageSize(size);
                setCatalogPage(1);
              }}
              itemLabel="solutions"
            />
          </>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Version Explorer"
          description={
            activeSolution
              ? `Version history for ${activeSolution.name}.`
              : "Select a solution from the catalog to see version history."
          }
        />

        {!activeSolutionId || versionsLoading ? null : (
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={versionSearchTerm}
              onChange={(event) => {
                setVersionSearchTerm(event.target.value);
                setVersionPage(1);
              }}
              placeholder="Search versions by id or creator"
            />
          </div>
        )}

        {versionsLoading ? (
          <TableSkeleton />
        ) : !activeSolutionId ? (
          <EmptyState
            title="Select a solution"
            description="Choose a solution by name to see its version history."
          />
        ) : versions.length === 0 ? (
          <EmptyState
            title="No versions found"
            description="This solution has no version history yet."
          />
        ) : (
          <>
            <DataTable columns={["Version", "Price", "Base Commission", "Valid From", "Valid To"]}>
              {versions.map((version) => (
                <DataRow key={version.id}>
                  <DataCell className="font-medium">{formatCompactId(version.id)}</DataCell>
                  <DataCell>{formatCurrency(version.price)}</DataCell>
                  <DataCell>{formatCurrency(version.baseCommission)}</DataCell>
                  <DataCell>{new Date(version.validFrom).toLocaleDateString()}</DataCell>
                  <DataCell>
                    {version.validTo ? (
                      new Date(version.validTo).toLocaleDateString()
                    ) : (
                      <Badge variant="muted">Open</Badge>
                    )}
                  </DataCell>
                </DataRow>
              ))}
            </DataTable>
            <PaginationControls
              page={effectiveVersionPage}
              pageSize={versionPageSize}
              totalItems={versionTotalItems}
              totalPages={versionTotalPages}
              onPageChange={setVersionPage}
              onPageSizeChange={(size) => {
                setVersionPageSize(size);
                setVersionPage(1);
              }}
              itemLabel="versions"
            />
          </>
        )}
      </Card>

      <Modal open={openSolutionModal} onClose={() => setOpenSolutionModal(false)} title="Create Solution">
        <form className="space-y-3" onSubmit={onSolutionSubmit}>
          <div className="space-y-1">
            <Label htmlFor="solutionName">Name</Label>
            <Input id="solutionName" {...solutionForm.register("name")} />
            <FieldError message={solutionForm.formState.errors.name?.message} />
          </div>
          <Button className="w-full" type="submit" disabled={solutionState.isLoading}>
            {solutionState.isLoading ? (
              <>
                <Spinner />
                Creating...
              </>
            ) : (
              "Create Solution"
            )}
          </Button>
        </form>
      </Modal>

      <Modal
        open={openVersionModal}
        onClose={() => setOpenVersionModal(false)}
        title="Create Solution Version"
        description="Select the solution by name; retroactive updates create immutable adjustment commissions."
      >
        <form className="space-y-3" onSubmit={onVersionSubmit}>
          <div className="space-y-1">
            <Label htmlFor="versionSolutionId">Solution</Label>
            <Controller
              control={versionForm.control}
              name="solutionId"
              render={({ field }) => (
                <SearchableSelect
                  id="versionSolutionId"
                  value={field.value ?? ""}
                  onChange={field.onChange}
                  options={versionSolutionOptions}
                  placeholder="Select a solution"
                  searchPlaceholder="Search solutions..."
                  emptyMessage="No solution matches your search"
                />
              )}
            />
            <FieldError message={versionForm.formState.errors.solutionId?.message} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                {...versionForm.register("price", { valueAsNumber: true })}
              />
              <FieldError message={versionForm.formState.errors.price?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseCommission">Base Commission</Label>
              <Input
                id="baseCommission"
                type="number"
                step="0.01"
                {...versionForm.register("baseCommission", { valueAsNumber: true })}
              />
              <FieldError message={versionForm.formState.errors.baseCommission?.message} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="validFrom">Valid From</Label>
              <Input id="validFrom" type="date" {...versionForm.register("validFrom")} />
              <FieldError message={versionForm.formState.errors.validFrom?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="validTo">Valid To</Label>
              <Input id="validTo" type="date" {...versionForm.register("validTo")} />
              <FieldError message={versionForm.formState.errors.validTo?.message} />
            </div>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600 dark:text-slate-300 sm:min-h-0">
            <input className="h-5 w-5" type="checkbox" {...versionForm.register("retroactive")} />
            Apply retroactive recalculation
          </label>
          <Button className="w-full" type="submit" disabled={versionState.isLoading}>
            {versionState.isLoading ? (
              <>
                <Spinner />
                Saving...
              </>
            ) : (
              "Create Version"
            )}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
