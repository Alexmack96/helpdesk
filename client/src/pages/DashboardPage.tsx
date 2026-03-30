import { useAuth } from "../context/AuthContext.js";

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome, {user?.name}</h2>
        <p className="text-gray-500 mb-4">
          {user?.email} &middot; {user?.role}
        </p>
        <button onClick={logout} className="text-sm text-red-600 hover:underline">
          Sign out
        </button>
      </div>
    </div>
  );
}
