import { Outlet, useNavigate } from "react-router-dom";
import { signOut } from "../lib/authClient.js";
import { Navbar } from "./Navbar.js";

export function Layout() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/logged-out");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar onSignOut={handleSignOut} />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
