"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { PageHeader } from "@/components/dashboard/page-header";
import { TableSkeleton } from "@/components/dashboard/table-skeleton";
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
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { showToast } from "@/lib/toast";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { Textarea } from "@/components/ui/textarea";
import { formatCompactId, formatDate, getCustomerDisplayName, getErrorMessage } from "@/lib/utils";
import {
  useCreateContractMutation,
  useGetContractsQuery,
  useGetSessionQuery,
  useGetSolutionsQuery,
  useGetUsersQuery,
} from "@/store/services/pvApi";

const schema = z.object({
  solutionId: z.string().min(1, "Please select a solution."),
  installationDate: z.string().min(1, "Please select an installation date."),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"] as const),
  agentId: z.string().optional(),
  customerDetails: z.string().trim().min(2, "Customer details are required."),
});

type ContractForm = z.infer<typeof schema>;

export default function ContractsPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const needsAgent = role === "ADMIN" || role === "AREA_MANAGER";
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [openModal, setOpenModal] = useState(false);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const { data: contractsResponse, isLoading } = useGetContractsQuery({
    search: debouncedSearchTerm,
    page,
    limit: pageSize,
  });
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 }, { skip: !role });
  const { data: solutionsResponse } = useGetSolutionsQuery({ page: 1, limit: 100 }, { skip: !role });
  const contracts = contractsResponse?.items ?? [];
  const users = usersResponse?.items ?? [];
  const solutions = solutionsResponse?.items ?? [];
  const totalPages = contractsResponse?.pagination.totalPages ?? 0;
  const totalItems = contractsResponse?.pagination.total ?? 0;
  const effectivePage = contractsResponse?.pagination.page ?? (totalPages === 0 ? 1 : Math.min(page, totalPages));
  const [createContract, createState] = useCreateContractMutation();

  const form = useForm<ContractForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "ACTIVE",
      customerDetails: JSON.stringify({ name: "Acme Solar", site: "CA-01" }, null, 2),
    },
  });

  const agents = users.filter((user) => user.role === "AGENT");
  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const solutionLookup = useMemo(() => new Map(solutions.map((solution) => [solution.id, solution])), [solutions]);

  const onSubmit = form.handleSubmit(async (values) => {
    setBanner(null);
    form.clearErrors();

    if (needsAgent && !values.agentId) {
      const message = "Please select an assigned agent.";
      form.setError("agentId", { type: "manual", message });
      showToast({ type: "error", title: "Missing agent", description: message });
      return;
    }

    let customerDetails: unknown;
    try {
      customerDetails = JSON.parse(values.customerDetails);
    } catch {
      const message = "Customer details must be valid JSON.";
      form.setError("customerDetails", { type: "manual", message });
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Invalid customer details", description: message });
      return;
    }

    try {
      const response = await createContract({
        solutionId: values.solutionId,
        installationDate: values.installationDate,
        status: values.status,
        agentId: needsAgent ? values.agentId || undefined : undefined,
        customerDetails,
      }).unwrap();
      const message = (response as { message?: string }).message ?? "Contract created successfully.";
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "Contract created", description: message });
      setOpenModal(false);
      form.reset({
        status: "ACTIVE",
        customerDetails: JSON.stringify({ name: "Acme Solar", site: "CA-01" }, null, 2),
      });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create contract.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Create contract failed", description: message });
    }
  });

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Installation contracts with automatic base commission generation."
        action={<Button onClick={() => setOpenModal(true)}>Create Contract</Button>}
      />

      {banner ? <Alert className="mb-4" type={banner.type}>{banner.text}</Alert> : null}

      <Card>
        <CardHeader title="Contract Ledger" description="Review contracts by customer, agent, and solution instead of internal IDs." />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search by customer, agent, status, solution, or version id"
          />
        </div>
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : contracts.length === 0 ? (
          <EmptyState
            title="No matching contracts"
            description="Try a broader query or create a new contract."
          />
        ) : (
          <>
            <DataTable columns={["Customer", "Agent", "Installation", "Status", "Solution", "Version"]}>
              {contracts.map((item) => {
                const agentName = item.agent?.name ?? userLookup.get(item.agentId)?.name;
                const solutionName =
                  item.solutionVersion?.solution?.name ??
                  (item.solutionVersion ? solutionLookup.get(item.solutionVersion.solutionId)?.name : null);

                return (
                  <DataRow key={item.id}>
                    <DataCell className="font-medium">{getCustomerDisplayName(item.customerDetails)}</DataCell>
                    <DataCell>{agentName ?? formatCompactId(item.agentId)}</DataCell>
                    <DataCell>{formatDate(item.installationDate)}</DataCell>
                    <DataCell>
                      <Badge
                        variant={
                          item.status === "COMPLETED"
                            ? "success"
                            : item.status === "CANCELLED"
                              ? "danger"
                              : "muted"
                        }
                      >
                        {item.status}
                      </Badge>
                    </DataCell>
                    <DataCell>{solutionName ?? "Unknown solution"}</DataCell>
                    <DataCell>{formatCompactId(item.solutionVersionId)}</DataCell>
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
              itemLabel="contracts"
            />
          </>
        )}
      </Card>

      <Modal
        open={openModal}
        onClose={() => setOpenModal(false)}
        title="Create Contract"
        description="Pick a solution and agent by name so contract creation mirrors a real operations workflow."
      >
        <form className="space-y-3" onSubmit={onSubmit}>
          <div className="space-y-1">
            <Label htmlFor="solutionId">Solution</Label>
            <Select id="solutionId" {...form.register("solutionId")}>
              <option value="">Select a solution</option>
              {solutions.map((solution) => (
                <option key={solution.id} value={solution.id}>
                  {solution.name}
                </option>
                ))}
              </Select>
            <FieldError message={form.formState.errors.solutionId?.message} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="installationDate">Installation Date</Label>
              <Input id="installationDate" type="date" {...form.register("installationDate")} />
              <FieldError message={form.formState.errors.installationDate?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select id="status" {...form.register("status")}>
                <option value="DRAFT">DRAFT</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </Select>
            </div>
          </div>
          {needsAgent ? (
            <div className="space-y-1">
              <Label htmlFor="agentId">Assigned Agent</Label>
              <Select id="agentId" {...form.register("agentId")}>
                <option value="">Select an agent</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} - {agent.email}
                  </option>
                ))}
              </Select>
              <FieldError message={form.formState.errors.agentId?.message} />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="customerDetails">Customer Details (JSON)</Label>
            <Textarea id="customerDetails" className="font-mono" {...form.register("customerDetails")} />
            <FieldError message={form.formState.errors.customerDetails?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={createState.isLoading}>
            {createState.isLoading ? (
              <>
                <Spinner />
                Creating...
              </>
            ) : (
              "Create Contract"
            )}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
