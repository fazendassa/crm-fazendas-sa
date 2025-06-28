import { useAuth } from "./useAuth";
import type { Permission, UserRole } from "@shared/rbac";

// Definições de permissões locais para evitar problemas de importação
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'view:dashboard', 'view:analytics', 'create:users', 'update:users', 'delete:users', 'view:users', 'manage:settings',
    'create:companies', 'update:companies', 'delete:companies', 'view:companies', 'view:all_companies',
    'create:contacts', 'update:contacts', 'delete:contacts', 'view:contacts', 'view:all_contacts',
    'create:deals', 'update:deals', 'delete:deals', 'view:deals', 'view:all_deals',
    'create:activities', 'update:activities', 'delete:activities', 'view:activities', 'view:all_activities',
    'create:pipelines', 'update:pipelines', 'delete:pipelines', 'view:pipelines',
    'view:billing', 'create:billing', 'update:billing', 'delete:billing', 'view:financial_reports',
    'view:team_reports', 'view:own_reports'
  ],
  gestor: [
    'view:dashboard', 'view:analytics', 'view:users',
    'view:companies', 'view:all_companies', 'create:companies', 'update:companies',
    'view:contacts', 'view:all_contacts', 'create:contacts', 'update:contacts',
    'view:deals', 'view:all_deals', 'create:deals', 'update:deals',
    'view:activities', 'view:all_activities', 'create:activities', 'update:activities',
    'view:pipelines', 'create:pipelines', 'update:pipelines',
    'view:team_reports', 'view:own_reports'
  ],
  vendedor: [
    'view:dashboard', 'view:companies', 'view:contacts', 'create:contacts', 'update:contacts',
    'view:deals', 'view:own_deals', 'create:deals', 'update:deals',
    'view:activities', 'view:own_activities', 'create:activities', 'update:activities',
    'view:pipelines', 'view:own_reports'
  ],
  financeiro: [
    'view:dashboard', 'view:billing', 'create:billing', 'update:billing', 'view:financial_reports',
    'view:companies', 'view:contacts', 'view:deals'
  ],
  externo: [
    'view:dashboard', 'view:companies', 'view:contacts', 'view:deals', 'view:activities', 'view:pipelines'
  ]
};

function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) || false;
}

function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function usePermissions() {
  const { user } = useAuth();
  const userRole = ((user as any)?.role as UserRole) || 'externo';

  return {
    // Verificações básicas de permissão
    hasPermission: (permission: Permission) => hasPermission(userRole, permission),
    hasAnyPermission: (permissions: Permission[]) => hasAnyPermission(userRole, permissions),
    hasAllPermissions: (permissions: Permission[]) => permissions.every(permission => hasPermission(userRole, permission)),
    
    // Informações do usuário
    userRole,
    isAdmin: userRole === 'admin',
    isGestor: userRole === 'gestor',
    isVendedor: userRole === 'vendedor',
    isFinanceiro: userRole === 'financeiro',
    isExterno: userRole === 'externo',
    
    // Verificações específicas de acesso
    canViewAllData: userRole === 'admin' || userRole === 'gestor',
    canViewOwnDataOnly: userRole === 'vendedor',
    canAccessFinancial: userRole === 'admin' || userRole === 'financeiro',
    isReadOnlyUser: userRole === 'externo',
    
    // Verificações específicas para recursos do CRM
    canManageUsers: hasPermission(userRole, 'create:users'),
    canManageCompanies: hasPermission(userRole, 'create:companies'),
    canManageContacts: hasPermission(userRole, 'create:contacts'),
    canManageDeals: hasPermission(userRole, 'create:deals'),
    canManagePipelines: hasPermission(userRole, 'create:pipelines'),
    canViewReports: hasAnyPermission(userRole, ['view:team_reports', 'view:own_reports']),
  };
}

// Hook para verificar se o usuário pode acessar uma rota específica
export function useRoutePermissions() {
  const permissions = usePermissions();
  
  return {
    canAccessDashboard: () => permissions.hasPermission('view:dashboard'),
    canAccessCompanies: () => permissions.hasPermission('view:companies'),
    canAccessContacts: () => permissions.hasPermission('view:contacts'),
    canAccessDeals: () => permissions.hasPermission('view:deals'),
    canAccessActivities: () => permissions.hasPermission('view:activities'),
    canAccessPipelines: () => permissions.hasPermission('view:pipelines'),
    canAccessAdmin: () => permissions.hasPermission('manage:settings'),
    canAccessBilling: () => permissions.hasPermission('view:billing'),
    canAccessReports: () => permissions.canViewReports,
  };
}