import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { getApiBaseUrl } from "./api";
import App from "./App";
import { ProtectedRoute } from "./ProtectedRoute";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import "./styles.css";

const baseUrl = import.meta.env.BASE_URL ?? "/";
const useApiMode = !!getApiBaseUrl();

function Root() {
  if (!useApiMode) {
    return <App />;
  }
  return (
    <BrowserRouter basename={baseUrl}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><App /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
