import { useSession } from "../lib/authClient.js";

export function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome, {session?.user.name}</h2>
      <p className="text-gray-500">{session?.user.email} &middot; {session?.user.role as string}</p>
    </div>
  );
}
