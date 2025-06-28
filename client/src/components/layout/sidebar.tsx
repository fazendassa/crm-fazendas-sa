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
  LogOut
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
    <div className="hidden md:flex md:flex-col md:w-64 bg-white shadow-lg">
      <div className="flex items-center justify-center h-16 bg-[#2b2b2b]">
        <h1 className="text-white text-xl font-bold">Fazendas S/A crm</h1>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
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
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start text-left font-medium",
                  isActive 
                    ? "bg-primary text-white hover:bg-primary/90" 
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <Icon className="mr-3 h-4 w-4" />
                {item.name}
              </Button>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t">
        <div className="flex items-center mb-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-medium">
            {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-700">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.email
              }
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {user?.role === 'admin' ? 'Administrador' : 'Usuário'}
            </p>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full"
          onClick={() => window.location.href = '/api/logout'}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
}
