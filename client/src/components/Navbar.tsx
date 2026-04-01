import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSession } from "../lib/authClient.js";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../context/ThemeContext.js";
import { Button } from "./ui/button.js";

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
    status === "ok" ? "text-primary-foreground/70" : status === "error" ? "text-red-300" : "text-primary-foreground/40";

  return <span className={`text-sm font-medium ${colour}`}>{label}</span>;
}

export function Navbar({ onSignOut }: { onSignOut: () => void }) {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();

  return (
    <nav className="bg-primary px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-semibold text-primary-foreground">Helpdesk</span>
      <div className="flex items-center gap-4">
        <HealthStatus />
        {session?.user.role === "Admin" && (
          <Link to="/users" className="text-sm text-primary-foreground/80 hover:text-primary-foreground underline-offset-4 hover:underline">
            Users
          </Link>
        )}
        <span className="text-sm text-primary-foreground/80">{session?.user.name}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </Button>
        <button
          onClick={onSignOut}
          className="text-sm text-primary-foreground/80 hover:text-primary-foreground underline-offset-4 hover:underline"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
