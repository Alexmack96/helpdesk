import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar.js";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
