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
import { FieldError } from "@/components/ui/field-error";
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
  name: z.string().trim().min(2, "Name must be at least 2 characters."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
  role: z.enum(["ADMIN", "AREA_MANAGER", "AGENT"] as const),
  managerId: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.role === "AGENT" && !value.managerId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["managerId"],
      message: "Please select a reporting manager for this agent."
    });
  }
});

const updateUserSchema = z
  .object({
    id: z.string().trim().min(1, "Please select a user to update."),
    name: z
      .string()
      .optional()
      .refine((value) => !value || value.trim().length >= 2, "Name must be at least 2 characters."),
    email: z
      .string()
      .optional()
      .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), "Enter a valid email address."),
    role: z.enum(["ADMIN", "AREA_MANAGER", "AGENT"] as const).optional(),
    managerId: z.string().optional(),
    password: z
      .string()
      .optional()
      .refine((value) => !value || value.length >= 12, "Password must be at least 12 characters.")
      .refine((value) => !value || /[A-Z]/.test(value), "Password must include an uppercase letter.")
      .refine((value) => !value || /[a-z]/.test(value), "Password must include a lowercase letter.")
      .refine((value) => !value || /[0-9]/.test(value), "Password must include a number.")
      .refine((value) => !value || /[^A-Za-z0-9]/.test(value), "Password must include a special character.")
  })
  .superRefine((value, ctx) => {
    if (value.role === "AGENT" && (!value.managerId || value.managerId === "null")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["managerId"],
        message: "Please assign a manager for an agent user."
      });
    }
  });

type CreateUserForm = z.infer<typeof createUserSchema>;

type UpdateUserForm = {
  id: string;
  name?: string;
  email?: string;
  role?: Role;
  managerId?: string;
  password?: string;
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
  const updateForm = useForm<UpdateUserForm>({
    resolver: zodResolver(updateUserSchema),
  });

  const selectedCreateRole = createForm.watch("role");
  const selectedUpdateId = updateForm.watch("id");
  const selectedUpdateRole = updateForm.watch("role");

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
        email: values.email || undefined,
        role: values.role || undefined,
        managerId:
          values.managerId === undefined || values.managerId === ""
            ? undefined
            : values.managerId === "null"
              ? null
              : values.managerId,
        password: values.password || undefined,
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
      email: user.email,
      role: user.role,
      managerId: user.managerId ?? "",
      password: "",
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
            <FieldError message={createForm.formState.errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...createForm.register("email")} />
            <FieldError message={createForm.formState.errors.email?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...createForm.register("password")} />
            <FieldError message={createForm.formState.errors.password?.message} />
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
              <FieldError message={createForm.formState.errors.managerId?.message} />
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
        description="Admins can update profile details, role, manager assignment, and optionally reset password."
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
            <FieldError message={updateForm.formState.errors.id?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateName">Name</Label>
            <Input id="updateName" {...updateForm.register("name")} />
            <FieldError message={updateForm.formState.errors.name?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateEmail">Email</Label>
            <Input id="updateEmail" type="email" {...updateForm.register("email")} />
            <FieldError message={updateForm.formState.errors.email?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateRole">Role</Label>
            <Select id="updateRole" {...updateForm.register("role")}>
              <option value="AGENT">AGENT</option>
              <option value="AREA_MANAGER">AREA_MANAGER</option>
              <option value="ADMIN">ADMIN</option>
            </Select>
            <FieldError message={updateForm.formState.errors.role?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updateManager">Manager</Label>
            <Select id="updateManager" {...updateForm.register("managerId")}>
              <option value="">{selectedUpdateRole === "AGENT" ? "Select a manager" : "No manager"}</option>
              <option value="null">Remove manager assignment</option>
              {managers
                .filter((manager) => manager.id !== selectedUpdateId)
                .map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name} - {manager.email}
                  </option>
                ))}
            </Select>
            <FieldError message={updateForm.formState.errors.managerId?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="updatePassword">Reset Password (optional)</Label>
            <Input
              id="updatePassword"
              type="password"
              placeholder="Leave blank to keep current password"
              {...updateForm.register("password")}
            />
            <FieldError message={updateForm.formState.errors.password?.message} />
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
