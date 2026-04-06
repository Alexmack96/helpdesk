import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.js";
import { CreateUserDialog } from "../components/CreateUserDialog.js";
import { UsersTable } from "../components/UsersTable.js";
import api from "../lib/api.js";

type User = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "User";
  createdAt: string;
};

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
          <UsersTable users={users} isPending={isPending} />
        </CardContent>
      </Card>
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
