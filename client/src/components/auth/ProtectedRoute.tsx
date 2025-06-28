import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";
import type { Permission } from "@shared/rbac";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: Permission;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // true = precisa de todas as permissões, false = precisa de pelo menos uma
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredPermission,
  requiredPermissions = [],
  requireAll = false,
  fallback = <div className="p-4 text-center text-muted-foreground">Acesso negado. Você não tem permissão para acessar esta área.</div>,
  redirectTo
}: ProtectedRouteProps) {
  const permissions = usePermissions();
  const { toast } = useToast();

  // Combina permissão única com array de permissões
  const allRequiredPermissions = requiredPermission 
    ? [requiredPermission, ...requiredPermissions]
    : requiredPermissions;

  // Verifica se o usuário tem as permissões necessárias
  const hasAccess = requireAll 
    ? permissions.hasAllPermissions(allRequiredPermissions)
    : permissions.hasAnyPermission(allRequiredPermissions);

  useEffect(() => {
    if (!hasAccess && allRequiredPermissions.length > 0) {
      toast({
        title: "Acesso Negado",
        description: "Você não tem permissão para acessar esta área.",
        variant: "destructive",
      });

      if (redirectTo) {
        window.location.href = redirectTo;
      }
    }
  }, [hasAccess, allRequiredPermissions.length, toast, redirectTo]);

  // Se não há permissões especificadas, permite acesso
  if (allRequiredPermissions.length === 0) {
    return <>{children}</>;
  }

  // Se tem acesso, renderiza o conteúdo
  if (hasAccess) {
    return <>{children}</>;
  }

  // Se não tem acesso, renderiza fallback
  return <>{fallback}</>;
}

// Componente específico para proteger seções administrativas
export function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute
      requiredPermission="manage:settings"
      fallback={
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Área Administrativa</h2>
          <p className="text-muted-foreground">
            Apenas administradores podem acessar esta área.
          </p>
        </div>
      }
    >
      {children}
    </ProtectedRoute>
  );
}

// Componente para proteger funcionalidades financeiras
export function FinancialProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute
      requiredPermission="view:billing"
      fallback={
        <div className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Módulo Financeiro</h2>
          <p className="text-muted-foreground">
            Apenas usuários do financeiro e administradores podem acessar esta área.
          </p>
        </div>
      }
    >
      {children}
    </ProtectedRoute>
  );
}