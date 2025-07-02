import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  Home,
  Users,
  Building2,
  BarChart3,
  Activity,
  Settings,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Upload
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";

const sidebarItems = [
  { icon: Home, label: "Dashboard", href: "/" },
  { icon: Users, label: "Contatos", href: "/contacts" },
  { icon: Building2, label: "Empresas", href: "/companies" },
  { icon: BarChart3, label: "Pipeline", href: "/pipeline" },
  { icon: Activity, label: "Atividades", href: "/activities" },
  { icon: Upload, label: "Importar Contatos", href: "/contact-import" },
];

const adminItems = [
  { icon: Settings, label: "Administração", href: "/admin" },
  { icon: UserCog, label: "Usuários", href: "/user-management" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useAuth();
  const { canManageUsers } = usePermissions();

  return (
    <div className={cn(
      "bg-white border-r border-gray-200 transition-all duration-300 flex flex-col h-full",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!collapsed && (
          <h2 className="text-lg font-semibold text-gray-900">CRM</h2>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <a className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive 
                  ? "bg-blue-50 text-blue-600 border border-blue-200" 
                  : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              )}>
                <Icon size={18} className={cn(
                  "flex-shrink-0",
                  collapsed ? "mx-auto" : "mr-3"
                )} />
                {!collapsed && <span>{item.label}</span>}
              </a>
            </Link>
          );
        })}

        {canManageUsers && (
          <>
            <div className="my-4 border-t border-gray-200"></div>
            {adminItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <a className={cn(
                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    isActive 
                      ? "bg-blue-50 text-blue-600 border border-blue-200" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                  )}>
                    <Icon size={18} className={cn(
                      "flex-shrink-0",
                      collapsed ? "mx-auto" : "mr-3"
                    )} />
                    {!collapsed && <span>{item.label}</span>}
                  </a>
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User Info */}
      {user && (
        <div className="p-4 border-t border-gray-200">
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "space-x-3"
          )}>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-xs font-medium text-white">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user.email}
                </p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}