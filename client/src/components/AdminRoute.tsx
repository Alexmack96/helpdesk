import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/authClient.js";

export function AdminRoute() {
  const { data: session, isPending } = useSession();
  if (isPending)
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  // "Admin" mirrors server-side UserRole.Admin enum value
  if (!session || session.user.role !== "Admin")
    return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
