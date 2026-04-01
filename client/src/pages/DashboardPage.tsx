import { useSession } from "../lib/authClient.js";

export function DashboardPage() {
  const { data: session } = useSession();

  return (
    <div>
      <h2 className="text-xl font-semibold text-foreground mb-2">Welcome, {session?.user.name}</h2>
      <p className="text-muted-foreground">{session?.user.email} &middot; {session?.user.role as string}</p>
    </div>
  );
}
