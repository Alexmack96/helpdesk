import { useEffect, useState } from "react";
import { useSession } from "../lib/authClient.js";

function HealthStatus() {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => setStatus(data.status === "ok" ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  const label =
    status === "loading" ? "Checking API..." : status === "ok" ? "API: OK" : "API: Unreachable";
  const colour =
    status === "ok" ? "text-green-600" : status === "error" ? "text-red-600" : "text-gray-400";

  return <span className={`text-sm font-medium ${colour}`}>{label}</span>;
}

export function Navbar({ onSignOut }: { onSignOut: () => void }) {
  const { data: session } = useSession();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-semibold text-gray-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        <HealthStatus />
        <span className="text-sm text-gray-700">{session?.user.name}</span>
        <button
          onClick={onSignOut}
          className="text-sm text-red-600 hover:underline"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
