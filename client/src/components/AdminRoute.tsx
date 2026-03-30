import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";

export function AdminRoute() {
  const { user } = useAuth();
  if (user?.role !== "Admin") return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
