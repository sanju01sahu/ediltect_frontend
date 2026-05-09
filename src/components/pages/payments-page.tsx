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
import { formatCompactId, formatCurrency, formatDate, getErrorMessage } from "@/lib/utils";
import {
  useAddPaymentTransactionMutation,
  useCreatePaymentMutation,
  useGetPaymentsQuery,
  useGetSessionQuery,
  useGetUsersQuery,
} from "@/store/services/pvApi";

const createPaymentSchema = z.object({
  userId: z.string().min(1, "Please select a user."),
  totalAmount: z.number({ error: "Total amount is required." }).positive("Total amount must be greater than zero."),
  status: z.enum(["PENDING", "DISPUTED", "CANCELLED"] as const).optional(),
});

const createTransactionSchema = z.object({
  paymentId: z.string().min(1, "Please select a payment."),
  amount: z.number({ error: "Amount is required." }).positive("Amount must be greater than zero."),
  method: z.enum(["BANK_TRANSFER", "UPI", "CASH", "CARD", "OTHER"] as const),
  referenceNumber: z.string().optional(),
  proofUrl: z.string().url("Proof URL must be a valid URL.").optional().or(z.literal("")),
  adminNote: z.string().optional(),
});

type PaymentForm = z.infer<typeof createPaymentSchema>;
type TxForm = z.infer<typeof createTransactionSchema>;

function statusVariant(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "FULLY_PAID") return "success";
  if (status === "PARTIALLY_PAID") return "warning";
  if (status === "DISPUTED" || status === "CANCELLED") return "danger";
  return "muted";
}

export default function PaymentsPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const canView = role === "ADMIN" || role === "AREA_MANAGER";
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [openTxModal, setOpenTxModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const { data: paymentsResponse, isLoading } = useGetPaymentsQuery(
    { search: debouncedSearchTerm, page, limit: pageSize },
    { skip: !canView },
  );
  const { data: allPaymentsResponse } = useGetPaymentsQuery({ page: 1, limit: 100 }, { skip: !canView });
  const { data: usersResponse } = useGetUsersQuery({ page: 1, limit: 100 }, { skip: !canView });
  const payments = paymentsResponse?.items ?? [];
  const paymentOptions = allPaymentsResponse?.items ?? payments;
  const users = usersResponse?.items ?? [];
  const totalPages = paymentsResponse?.pagination.totalPages ?? 0;
  const totalItems = paymentsResponse?.pagination.total ?? 0;
  const effectivePage = paymentsResponse?.pagination.page ?? (totalPages === 0 ? 1 : Math.min(page, totalPages));
  const [createPayment, createState] = useCreatePaymentMutation();
  const [addTransaction, txState] = useAddPaymentTransactionMutation();

  const paymentForm = useForm<PaymentForm>({
    resolver: zodResolver(createPaymentSchema),
    defaultValues: {
      status: "PENDING",
    },
  });
  const txForm = useForm<TxForm>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      method: "UPI",
    },
  });

  const userLookup = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);

  const onCreatePayment = paymentForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const response = await createPayment(values).unwrap();
      const message = (response as { message?: string }).message ?? "Payment created successfully.";
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "Payment created", description: message });
      setOpenPaymentModal(false);
      paymentForm.reset({ status: "PENDING" });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create payment.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Create payment failed", description: message });
    }
  });

  const onAddTransaction = txForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const response = await addTransaction({
        id: values.paymentId,
        amount: values.amount,
        method: values.method,
        referenceNumber: values.referenceNumber || undefined,
        proofUrl: values.proofUrl || undefined,
        adminNote: values.adminNote || undefined,
      }).unwrap();
      const message = (response as { message?: string }).message ?? "Transaction added successfully.";
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "Transaction added", description: message });
      setOpenTxModal(false);
      txForm.reset({ method: "UPI" });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to add transaction.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Add transaction failed", description: message });
    }
  });

  if (!canView) {
    return (
      <Card>
        <EmptyState
          title="Payments module unavailable"
          description="Only administrators and area managers can access payments."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Track effective payment status and settlement transactions."
        action={
          isAdmin ? (
            <div className="flex w-full flex-wrap gap-2 md:w-auto">
              <Button className="w-full sm:w-auto" variant="secondary" onClick={() => setOpenTxModal(true)}>
                Add Transaction
              </Button>
              <Button className="w-full sm:w-auto" onClick={() => setOpenPaymentModal(true)}>Create Payment</Button>
            </div>
          ) : null
        }
      />

      {banner ? <Alert className="mb-4" type={banner.type}>{banner.text}</Alert> : null}

      <Card>
        <CardHeader title="Payment Records" description="Review payouts by person and status rather than scanning UUID fragments." />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search by payment id, user, amount, status, or date"
          />
        </div>
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : payments.length === 0 ? (
          <EmptyState
            title="No matching payment records"
            description="Try a broader query or create a new payment."
          />
        ) : (
          <>
            <DataTable columns={["Payment", "User", "Total", "Effective Status", "Transactions", "Created"]}>
              {payments.map((item) => (
                <DataRow key={item.id}>
                  <DataCell className="font-medium">{formatCompactId(item.id)}</DataCell>
                  <DataCell>{item.user?.name ?? userLookup.get(item.userId)?.name ?? formatCompactId(item.userId)}</DataCell>
                  <DataCell>{formatCurrency(item.totalAmount)}</DataCell>
                  <DataCell>
                    <Badge variant={statusVariant(item.effectiveStatus)}>{item.effectiveStatus}</Badge>
                  </DataCell>
                  <DataCell>{item.transactions.length}</DataCell>
                  <DataCell>{formatDate(item.createdAt)}</DataCell>
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
              itemLabel="payments"
            />
          </>
        )}
      </Card>

      <Modal
        open={openPaymentModal}
        onClose={() => setOpenPaymentModal(false)}
        title="Create Payment"
        description="Pick a user by name to start a payout record."
      >
        <form className="space-y-3" onSubmit={onCreatePayment}>
          <div className="space-y-1">
            <Label htmlFor="userId">User</Label>
            <Select id="userId" {...paymentForm.register("userId")}>
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.email}
                </option>
                ))}
              </Select>
            <FieldError message={paymentForm.formState.errors.userId?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="totalAmount">Total Amount</Label>
            <Input
              id="totalAmount"
              type="number"
              step="0.01"
                {...paymentForm.register("totalAmount", { valueAsNumber: true })}
              />
            <FieldError message={paymentForm.formState.errors.totalAmount?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="status">Forced Status</Label>
            <Select id="status" {...paymentForm.register("status")}>
              <option value="PENDING">PENDING</option>
              <option value="DISPUTED">DISPUTED</option>
              <option value="CANCELLED">CANCELLED</option>
            </Select>
          </div>
          <Button className="w-full" type="submit" disabled={createState.isLoading}>
            {createState.isLoading ? (
              <>
                <Spinner />
                Creating...
              </>
            ) : (
              "Create Payment"
            )}
          </Button>
        </form>
      </Modal>

      <Modal
        open={openTxModal}
        onClose={() => setOpenTxModal(false)}
        title="Add Transaction"
        description="Choose an existing payment by user and created date."
      >
        <form className="space-y-3" onSubmit={onAddTransaction}>
          <div className="space-y-1">
            <Label htmlFor="paymentId">Payment</Label>
            <Select id="paymentId" {...txForm.register("paymentId")}>
              <option value="">Select a payment</option>
              {paymentOptions.map((payment) => {
                const userLabel = payment.user?.name ?? userLookup.get(payment.userId)?.name ?? formatCompactId(payment.userId);
                return (
                  <option key={payment.id} value={payment.id}>
                    {userLabel} - {formatCurrency(payment.totalAmount)} - {formatDate(payment.createdAt)}
                  </option>
                );
              })}
            </Select>
            <FieldError message={txForm.formState.errors.paymentId?.message} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...txForm.register("amount", { valueAsNumber: true })}
              />
              <FieldError message={txForm.formState.errors.amount?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="method">Method</Label>
              <Select id="method" {...txForm.register("method")}>
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">BANK_TRANSFER</option>
                <option value="CASH">CASH</option>
                <option value="CARD">CARD</option>
                <option value="OTHER">OTHER</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="referenceNumber">Reference Number</Label>
            <Input id="referenceNumber" {...txForm.register("referenceNumber")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="proofUrl">Proof URL</Label>
            <Input id="proofUrl" {...txForm.register("proofUrl")} />
            <FieldError message={txForm.formState.errors.proofUrl?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="adminNote">Admin Note</Label>
            <Input id="adminNote" {...txForm.register("adminNote")} />
          </div>
          <Button className="w-full" type="submit" disabled={txState.isLoading}>
            {txState.isLoading ? (
              <>
                <Spinner />
                Adding...
              </>
            ) : (
              "Add Transaction"
            )}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
