import React from "react";
import { useNavigate, Navigate } from "react-router-dom";
import {
  Users,
  FolderKanban,
  Landmark,
  Package,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useAuthStore } from "../store/useAuthStore";
import logo from "../images/logo.png";
import { usePmsLaunch } from '../context/PmsLaunchContext';

type ERPModule = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  to: string;
  external?: boolean;
  disabled?: boolean;
  permission?: string;
  /** Roles allowed to see this module. Empty = all authenticated users. */
  roles?: string[];
};

const ALL_ROLES = [
  "super_admin",
  "ceo",
  "head_hr",
  "branch_hr",
  "department_hr",
  "department_head",
  "hr_manager",
  "hr_executive",
  "employee",
];

const erpModules: ERPModule[] = [
  {
    id: "ems",
    title: "HR & Employee Management",
    description:
      "Manage employees, attendance, leave, payroll, and organizational workflows",
    icon: Users,
    to: "/dashboard",
    roles: ALL_ROLES,
  },
  {
    id: "pms",
    title: "Project Management",
    description:
      "Plan projects, coordinate teams, track issues and delivery",
    icon: FolderKanban,
    to: "/project-management",
    external: true,
    permission: "project_management.access",
    roles: ALL_ROLES,
  },
  {
    id: "finance",
    title: "Finance & Accounting",
    description:
      "Invoicing, budgets, expenses, financial reporting and compliance",
    icon: Landmark,
    to: "/finance",
    disabled: true,
    roles: ALL_ROLES,
  },
  {
    id: "inventory",
    title: "Inventory & Assets",
    description:
      "Track inventory, manage assets, procurement and supply chain",
    icon: Package,
    to: "/inventory",
    disabled: true,
    roles: ALL_ROLES,
  },
];

export default function Launchpad() {
  const navigate = useNavigate();
  const { user, activeRole, logout } = useAuth();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const { launch, cancel, launchError, launching } = usePmsLaunch();
  const canLaunchPms = hasPermission('project_management.access');

  if (!user) return <Navigate to="/login" replace />;

  const visibleModules = erpModules.filter((mod) => {
    if (mod.roles && mod.roles.length > 0 && !mod.roles.includes(activeRole))
      return false;
    if (mod.permission && !hasPermission(mod.permission)) return false;
    return true;
  });

  const getEMSRoute = () => {
    if (activeRole === "employee") return "/my-dashboard";
    if (activeRole === "branch_hr") return "/hr/branch-dashboard";
    if (activeRole === "head_hr") return "/attendance-head-review";
    return "/dashboard";
  };

  const handleModuleClick = (mod: ERPModule) => {
    if (mod.disabled) return;

    if (mod.id === 'pms') {
      if (!canLaunchPms || launching) return;
      launch(); return;
    }

    if (mod.id === "ems") {
      navigate(getEMSRoute());
      return;
    }

    if (mod.external) {
      const url = mod.to;
      if (url.startsWith("http")) {
        window.location.href = url;
      } else {
        navigate(url);
      }
      return;
    }

    navigate(mod.to);
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      cancel();
      logout();
      navigate("/login");
    }
  };

  return (
    <div className="erp-launchpad">
      {/* Header */}
      <header className="erp-lp-header">
        <div className="erp-lp-brand">
          <img src={logo} alt="Company Logo" className="erp-lp-logo" />
          <div>
            <div className="erp-lp-title">ERP</div>
            <div className="erp-lp-subtitle">Enterprise Resource Planning</div>
          </div>
        </div>
        <div className="erp-lp-user">
          <div className="erp-lp-user-info">
            <span className="erp-lp-username">{user.username || "User"}</span>
            <span className="erp-lp-role">{activeRole.replace(/_/g, " ")}</span>
          </div>
          <button
            className="erp-lp-logout"
            onClick={handleLogout}
            title="Sign out"
          >
            <LogOut size={18} strokeWidth={2} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="erp-lp-main">
        <div className="erp-lp-hero">
          <h1>Select a Module</h1>
          <p>Choose a module to continue working</p>
        </div>
        {launchError && <p role="alert">{launchError}</p>}
        {launching && <p role="status" aria-live="polite">Opening Project Management…</p>}

        <div className="erp-lp-grid">
          {visibleModules.map((mod) => {
            const IconComp = mod.icon;
            return (
              <button
                key={mod.id}
                className={`erp-lp-card${mod.disabled ? " erp-lp-card--disabled" : ""}`}
                onClick={() => handleModuleClick(mod)}
                disabled={mod.disabled || mod.id === 'pms' && launching}
                type="button"
              >
                <div className="erp-lp-card-icon">
                  <IconComp size={28} strokeWidth={1.5} />
                </div>
                <div className="erp-lp-card-body">
                  <h2>{mod.title}</h2>
                  <p>{mod.description}</p>
                </div>
                {mod.disabled && (
                  <span className="erp-lp-badge">Coming Soon</span>
                )}
              </button>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="erp-lp-footer">
        <span>&copy; {new Date().getFullYear()} ERP System</span>
      </footer>
    </div>
  );
}
