"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PencilLine, Search, UserPlus, Users2 } from "lucide-react";
import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { showToast } from "@/lib/toast";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { getErrorMessage } from "@/lib/utils";
import {
  useCreateUserMutation,
  useGetSessionQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
} from "@/store/services/pvApi";
import { Role } from "@/types/api";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z
    .string()
    .min(12)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/)
    .regex(/[^A-Za-z0-9]/),
  role: z.enum(["ADMIN", "AREA_MANAGER", "AGENT"] as const),
  managerId: z.string().optional(),
});

type CreateUserForm = z.infer<typeof createUserSchema>;

type UpdateUserForm = {
  id: string;
  name?: string;
  managerId?: string;
};

function roleBadge(role: Role): "danger" | "warning" | "default" {
  if (role === "ADMIN") return "danger";
  if (role === "AREA_MANAGER") return "warning";
  return "default";
}

export default function UsersPage() {
  const { data: session } = useGetSessionQuery();
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN";
  const [openCreate, setOpenCreate] = useState(false);
  const [openUpdate, setOpenUpdate] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [banner, setBanner] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const debouncedSearchTerm = useDebouncedValue(searchTerm);

  const { data: usersResponse, isLoading } = useGetUsersQuery(
    { search: debouncedSearchTerm, page, limit: pageSize },
    {
      skip: !role || role === "AGENT",
    },
  );
  const { data: directoryResponse } = useGetUsersQuery(
    { page: 1, limit: 100 },
    {
      skip: !role || role === "AGENT",
    },
  );
  const users = usersResponse?.items ?? [];
  const directoryUsers = directoryResponse?.items ?? users;
  const managers = directoryUsers.filter((user) => user.role === "AREA_MANAGER" || user.role === "ADMIN");
  const totalPages = usersResponse?.pagination.totalPages ?? 0;
  const totalItems = usersResponse?.pagination.total ?? 0;
  const effectivePage = usersResponse?.pagination.page ?? (totalPages === 0 ? 1 : Math.min(page, totalPages));

  const [createUser, createState] = useCreateUserMutation();
  const [updateUser, updateState] = useUpdateUserMutation();

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: "AGENT" },
  });
  const updateForm = useForm<UpdateUserForm>({});

  const selectedCreateRole = createForm.watch("role");
  const selectedUpdateId = updateForm.watch("id");

  const onCreate = createForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const response = await createUser({
        ...values,
        managerId: values.role === "AGENT" ? values.managerId || undefined : undefined,
      }).unwrap();
      const message = (response as { message?: string }).message ?? "User created successfully.";
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "User created", description: message });
      setOpenCreate(false);
      createForm.reset({ role: "AGENT" });
    } catch (error) {
      const message = getErrorMessage(error, "Failed to create user.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Create user failed", description: message });
    }
  });

  const onUpdate = updateForm.handleSubmit(async (values) => {
    setBanner(null);
    try {
      const response = await updateUser({
        id: values.id,
        name: values.name || undefined,
        managerId:
          values.managerId === undefined || values.managerId === ""
            ? undefined
            : values.managerId === "null"
              ? null
              : values.managerId,
      }).unwrap();
      const message = (response as { message?: string }).message ?? "User updated successfully.";
      setBanner({ type: "success", text: message });
      showToast({ type: "success", title: "User updated", description: message });
      setOpenUpdate(false);
      updateForm.reset();
    } catch (error) {
      const message = getErrorMessage(error, "Failed to update user.");
      setBanner({ type: "error", text: message });
      showToast({ type: "error", title: "Update user failed", description: message });
    }
  });

  const openUpdateForUser = (id: string) => {
    const user = directoryUsers.find((entry) => entry.id === id);
    if (!user) return;
    updateForm.reset({
      id: user.id,
      name: user.name,
      managerId: user.managerId ?? "",
    });
    setOpenUpdate(true);
  };

  if (!role || role === "AGENT") {
    return (
      <Card>
        <EmptyState
          title="Users module unavailable"
          description="Only administrators and area managers can view organization users."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users"
        description="Manage hierarchy, roles, and team assignments."
        action={
          isAdmin ? (
            <Button onClick={() => setOpenCreate(true)}>
              <UserPlus className="h-4 w-4" />
              Create User
            </Button>
          ) : null
        }
      />

      {banner ? <Alert type={banner.type}>{banner.text}</Alert> : null}

      <Card className="mt-4">
        <CardHeader
          title="Team Directory"
          description="Search by name, email, role, or manager instead of navigating by internal IDs."
          action={<Users2 className="h-4 w-4 text-slate-400" />}
        />
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search users by name, email, role, or manager"
          />
        </div>
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : users.length === 0 ? (
          <EmptyState
            title="No users match this search"
            description="Try a different name, role, or manager query."
          />
        ) : (
          <>
            <DataTable columns={["Name", "Email", "Role", "Manager", "Team size", "Created", "Actions"]}>
              {users.map((user) => (
                <DataRow key={user.id}>
                  <DataCell className="font-medium">{user.name}</DataCell>
                  <DataCell>{user.email}</DataCell>
                  <DataCell>
                    <Badge variant={roleBadge(user.role)}>{user.role}</Badge>
                  </DataCell>
                  <DataCell>{user.manager?.name ?? "-"}</DataCell>
                  <DataCell>{user.team?.length ?? 0}</DataCell>
                  <DataCell>{new Date(user.createdAt).toLocaleDateString()}</DataCell>
                  <DataCell>
                    {isAdmin ? (
                      <Button size="sm" variant="secondary" onClick={() => openUpdateForUser(user.id)}>
                        <PencilLine className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : (
                      "-"
                    )}
                  </DataCell>
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
              itemLabel="users"
            />
          </>
        )}
      </Card>

      <Modal
        open={openCreate}
        onClose={() => setOpenCreate(false)}
        title="Create User"
        description="Create users with role-aware manager selection so admins never need to enter a UUID."
      >
        <form className="space-y-3" onSubmit={onCreate}>
          <div className="space-y-1">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...createForm.register("name")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...createForm.register("email")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...createForm.register("password")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="role">Role</Label>
            <Select id="role" {...createForm.register("role")}>
              <option value="AGENT">AGENT</option>
              <option value="AREA_MANAGER">AREA_MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
          </div>
          {selectedCreateRole === "AGENT" ? (
            <div className="space-y-1">
              <Label htmlFor="managerId">Reporting Manager</Label>
              <Select id="managerId" {...createForm.register("managerId")}>
                <option value="">Select a manager</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} - {manager.email}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={createState.isLoading}>
            {createState.isLoading ? (
              <>
                <Spinner />
                Creating...
              </>
            ) : (
              "Create User"
            )}
          </Button>
        </form>
      </Modal>

      <Modal
        open={openUpdate}
        onClose={() => setOpenUpdate(false)}
        title="Update User"
        description="Update a person by selecting them from the directory and reassigning their manager by name."
      >
        <form className="space-y-3" onSubmit={onUpdate}>
          <div className="space-y-1">
            <Label htmlFor="updateUser">User</Label>
            <Select
              id="updateUser"
              value={selectedUpdateId ?? ""}
              onChange={(event) => openUpdateForUser(event.target.value)}
            >
              <option value="">Select a user</option>
              {directoryUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} - {user.email}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateName">Name</Label>
            <Input id="updateName" {...updateForm.register("name")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateManager">Manager</Label>
            <Select id="updateManager" {...updateForm.register("managerId")}>
              <option value="">Keep current manager</option>
              <option value="null">Remove manager assignment</option>
              {managers
                .filter((manager) => manager.id !== selectedUpdateId)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} - {manager.email}
                  </option>
                ))}
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={updateState.isLoading}>
            {updateState.isLoading ? (
              <>
                <Spinner />
                Updating...
              </>
            ) : (
              "Update User"
            )}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
