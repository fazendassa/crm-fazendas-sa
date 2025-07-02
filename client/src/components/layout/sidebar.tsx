import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, useRoutePermissions } from "@/hooks/usePermissions";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  TrendingUp, 
  Activity, 
  Settings,
  DollarSign,
  BarChart3,
  LogOut,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@shared/rbac";

const navigation = [
  { 
    name: 'Dashboard', 
    href: '/', 
    icon: LayoutDashboard,
    permission: 'view:dashboard' as const
  },
  { 
    name: 'Contatos', 
    href: '/contacts', 
    icon: Users,
    permission: 'view:contacts' as const
  },
  { 
    name: 'Empresas', 
    href: '/companies', 
    icon: Building2,
    permission: 'view:companies' as const
  },
  { 
    name: 'Pipeline', 
    href: '/pipeline', 
    icon: TrendingUp,
    permission: 'view:pipelines' as const
  },
  { 
    name: 'Atividades', 
    href: '/activities', 
    icon: Activity,
    permission: 'view:activities' as const
  },
  { 
    name: 'Financeiro', 
    href: '/billing', 
    icon: DollarSign,
    permission: 'view:billing' as const
  },
  { 
    name: 'Relatórios', 
    href: '/reports', 
    icon: BarChart3,
    permission: 'view:team_reports' as const,
    fallbackPermission: 'view:own_reports' as const
  },
  { 
    name: 'Usuários', 
    href: '/users', 
    icon: Users,
    permission: 'view:users' as const
  },
  { 
    name: 'ActiveCampaign', 
    href: '/integrations/activecampaign', 
    icon: Zap,
    permission: 'manage:settings' as const
  },
  { 
    name: 'Administração', 
    href: '/admin', 
    icon: Settings,
    permission: 'manage:settings' as const
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const permissions = usePermissions();

  return (
    <div className="hidden md:flex md:flex-col md:w-64 apple-sidebar">
      <div className="flex items-center justify-center h-16 px-6 border-b apple-divider">
        <h1 className="apple-title text-lg text-black font-semibold">Fazendas S/A</h1>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          // Verificar permissões para mostrar o item do menu
          const hasAccess = (item as any).fallbackPermission 
            ? permissions.hasPermission((item as any).permission) || permissions.hasPermission((item as any).fallbackPermission)
            : permissions.hasPermission((item as any).permission);
          
          if (!hasAccess) {
            return null;
          }
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-150 cursor-pointer",
                  isActive 
                    ? "bg-blue-500 text-white" 
                    : "text-black hover:bg-gray-100"
                )}
              >
                <Icon className="mr-3 h-4 w-4" />
                <span className="apple-body text-sm">{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t apple-divider">
        <div className="flex items-center mb-3 p-2 rounded-lg bg-gray-50">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium text-sm">
            {(user as any)?.firstName?.[0] || (user as any)?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="ml-2 flex-1">
            <p className="apple-subheader text-xs">
              {(user as any)?.firstName && (user as any)?.lastName 
                ? `${(user as any).firstName} ${(user as any).lastName}`
                : (user as any)?.email
              }
            </p>
            <p className="apple-text-muted text-xs">
              {(user as any)?.role === 'admin' ? 'Administrador' : 'Usuário'}
            </p>
          </div>
        </div>
        <div 
          className="flex items-center justify-center px-3 py-2 rounded-lg apple-button-secondary cursor-pointer transition-all duration-150"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span className="apple-body font-medium text-sm">Sair</span>
        </div>
      </div>
    </div>
  );
}
