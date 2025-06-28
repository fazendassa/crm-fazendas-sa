import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  TrendingUp, 
  Activity, 
  Settings,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Contatos', href: '/contacts', icon: Users },
  { name: 'Empresas', href: '/companies', icon: Building2 },
  { name: 'Pipeline', href: '/pipeline', icon: TrendingUp },
  { name: 'Atividades', href: '/activities', icon: Activity },
  { name: 'Administração', href: '/admin', icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="hidden md:flex md:flex-col md:w-64 bg-white shadow-lg">
      <div className="flex items-center justify-center h-16 bg-primary">
        <h1 className="text-white text-xl font-bold">CRM Professional</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          // Hide admin section for non-admin users
          if (item.href === '/admin' && user?.role !== 'admin') {
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
