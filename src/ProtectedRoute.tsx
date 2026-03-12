import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { getLoginPath, isLoggedIn } from "./auth";

interface IProtectedRouteProps {
  children: ReactNode;
}

/**
 * 需登录才能访问的路由：无 token 时重定向到登录页
 */
export function ProtectedRoute({ children }: IProtectedRouteProps) {
  const location = useLocation();
  if (!isLoggedIn()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
