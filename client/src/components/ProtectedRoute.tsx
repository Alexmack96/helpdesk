import { Navigate, Outlet } from "react-router-dom";
import { useSession } from "../lib/authClient.js";

export function ProtectedRoute() {
  const { data: session, isPending } = useSession();
  if (isPending)
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
