import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.js";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { LoginPage } from "./pages/LoginPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";

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

  return <p className={`text-sm font-medium ${colour}`}>{label}</p>;
}

export function App() {
  return (
    <>
      <div className="fixed top-2 right-2 z-50 bg-white/80 px-3 py-1 rounded shadow">
        <HealthStatus />
      </div>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </>
  );
}
