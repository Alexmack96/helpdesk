import { useAuth } from "../context/AuthContext.js";

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome, {user?.name}</h2>
      <p className="text-gray-500">{user?.email} &middot; {user?.role}</p>
    </div>
  );
}
