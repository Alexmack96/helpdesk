import { Outlet, useNavigate } from "react-router-dom";
import { signOut } from "../lib/authClient.js";
import { Navbar } from "./Navbar.js";

export function Layout() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar onSignOut={handleSignOut} />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
