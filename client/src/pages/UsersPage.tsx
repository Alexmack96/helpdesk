import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table.js";
import { Badge } from "../components/ui/badge.js";
import { Button } from "../components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import { Input } from "../components/ui/input.js";
import { Label } from "../components/ui/label.js";
import api from "../lib/api.js";
import { Skeleton } from "../components/ui/skeleton.js";
import type { AxiosError } from "axios";

type User = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "User";
  createdAt: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function CreateUserDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState({ name: "", email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (data: typeof fields) =>
      api.post<User>("/api/admin/users", data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
    },
    onError: (err: AxiosError<{ error?: string }>) => {
      setServerError(err.response?.data?.error ?? "Something went wrong");
    },
  });

  function handleOpenChange(v: boolean) {
    if (!v) {
      setFields({ name: "", email: "", password: "" });
      setFieldErrors({});
      setServerError(null);
      mutation.reset();
    }
    onOpenChange(v);
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (fields.name.trim().length < 3) errs.name = "Name must be at least 3 characters";
    if (!EMAIL_RE.test(fields.email)) errs.email = "Invalid email address";
    if (fields.password.length < 8) errs.password = "Password must be at least 8 characters";
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    mutation.mutate(fields);
  }

  function set(field: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setFields((prev) => ({ ...prev, [field]: e.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: "" }));
    };
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Add a new user account. Role defaults to User.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} noValidate autoComplete="off">
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="cu-name">Name</Label>
              <Input
                id="cu-name"
                value={fields.name}
                onChange={set("name")}
                placeholder="Jane Smith"
                autoComplete="off"
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">{fieldErrors.name}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cu-email">Email</Label>
              <Input
                id="cu-email"
                type="email"
                value={fields.email}
                onChange={set("email")}
                placeholder="jane@example.com"
              />
              {fieldErrors.email && (
                <p className="text-sm text-destructive">{fieldErrors.email}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="cu-password">Password</Label>
              <Input
                id="cu-password"
                type="password"
                value={fields.password}
                onChange={set("password")}
                placeholder="Min 8 characters"
                autoComplete="new-password"
              />
              {fieldErrors.password && (
                <p className="text-sm text-destructive">{fieldErrors.password}</p>
              )}
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          </div>
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);

  const { data: users = [], isPending } = useQuery<User[]>({
    queryKey: ["users"],
    queryFn: () => api.get("/api/admin/users").then((r) => r.data),
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground uppercase tracking-wide mt-1">
            Manage user accounts
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Create User</Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === "Admin" ? "default" : "secondary"}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
