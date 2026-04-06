import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.js";
import { AdminRoute } from "./components/AdminRoute.js";
import { Layout } from "./components/Layout.js";
import { LoginPage } from "./pages/LoginPage.js";
import { LoggedOutPage } from "./pages/LoggedOutPage.js";
import { DashboardPage } from "./pages/DashboardPage.js";
import { AnalyticsPage } from "./pages/AnalyticsPage.js";
import { UsersPage } from "./pages/UsersPage.js";
import { ImportPage } from "./pages/ImportPage.js";
import { UtilitiesPage } from "./pages/UtilitiesPage.js";
import { SavingsPage } from "./pages/SavingsPage.js";

export function App() {
  return (
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/logged-out" element={<LoggedOutPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/utilities" element={<UtilitiesPage />} />
            <Route path="/savings" element={<SavingsPage />} />
            <Route element={<AdminRoute />}>
              <Route path="/users" element={<UsersPage />} />
              <Route path="/import" element={<ImportPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
  );
}
