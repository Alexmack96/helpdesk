import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AdminRoute } from "./components/AdminRoute.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { LoggedOutPage } from "./pages/LoggedOutPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { UsersPage } from "./pages/UsersPage.js";
import { ImportPage } from "./pages/ImportPage.js";

export function App() {
  return (
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logged-out" element={<LoggedOutPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/import" element={<ImportPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
  );
}
