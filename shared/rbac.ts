// Sistema de Controle de Acesso Baseado em Papéis (RBAC)

export type UserRole = 'admin' | 'gestor' | 'vendedor' | 'financeiro' | 'externo';

export type Permission = 
  // Recursos gerais
  | 'view:dashboard'
  | 'view:analytics'
  
  // Usuários e administração
  | 'create:users'
  | 'update:users' 
  | 'delete:users'
  | 'view:users'
  | 'manage:settings'
  
  // Empresas
  | 'create:companies'
  | 'update:companies'
  | 'delete:companies'
  | 'view:companies'
  | 'view:all_companies'
  
  // Contatos
  | 'create:contacts'
  | 'update:contacts'
  | 'delete:contacts'
  | 'view:contacts'
  | 'view:all_contacts'
  
  // Oportunidades/Deals
  | 'create:deals'
  | 'update:deals'
  | 'delete:deals'
  | 'view:deals'
  | 'view:all_deals'
  | 'view:own_deals'
  
  // Atividades
  | 'create:activities'
  | 'update:activities'
  | 'delete:activities'
  | 'view:activities'
  | 'view:all_activities'
  | 'view:own_activities'
  
  // Pipelines
  | 'create:pipelines'
  | 'update:pipelines'
  | 'delete:pipelines'
  | 'view:pipelines'
  
  // Financeiro
  | 'view:billing'
  | 'create:billing'
  | 'update:billing'
  | 'delete:billing'
  | 'view:financial_reports'
  
  // Relatórios
  | 'view:team_reports'
  | 'view:own_reports';

// Definição das permissões para cada papel
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    // Acesso total ao sistema
    'view:dashboard',
    'view:analytics',
    'create:users',
    'update:users',
    'delete:users',
    'view:users',
    'manage:settings',
    'create:companies',
    'update:companies',
    'delete:companies',
    'view:companies',
    'view:all_companies',
    'create:contacts',
    'update:contacts',
    'delete:contacts',
    'view:contacts',
    'view:all_contacts',
    'create:deals',
    'update:deals',
    'delete:deals',
    'view:deals',
    'view:all_deals',
    'create:activities',
    'update:activities',
    'delete:activities',
    'view:activities',
    'view:all_activities',
    'create:pipelines',
    'update:pipelines',
    'delete:pipelines',
    'view:pipelines',
    'view:billing',
    'create:billing',
    'update:billing',
    'delete:billing',
    'view:financial_reports',
    'view:team_reports',
    'view:own_reports'
  ],
  
  gestor: [
    // Gerencia equipe, vê todos os leads e relatórios
    'view:dashboard',
    'view:analytics',
    'view:users',
    'view:companies',
    'view:all_companies',
    'create:companies',
    'update:companies',
    'view:contacts',
    'view:all_contacts',
    'create:contacts',
    'update:contacts',
    'view:deals',
    'view:all_deals',
    'create:deals',
    'update:deals',
    'view:activities',
    'view:all_activities',
    'create:activities',
    'update:activities',
    'view:pipelines',
    'create:pipelines',
    'update:pipelines',
    'view:team_reports',
    'view:own_reports'
  ],
  
  vendedor: [
    // Vê apenas seus próprios leads e oportunidades
    'view:dashboard',
    'view:companies',
    'view:contacts',
    'create:contacts',
    'update:contacts',
    'view:deals',
    'view:own_deals',
    'create:deals',
    'update:deals',
    'view:activities',
    'view:own_activities',
    'create:activities',
    'update:activities',
    'view:pipelines',
    'view:own_reports'
  ],
  
  financeiro: [
    // Acesso apenas ao módulo de cobranças
    'view:dashboard',
    'view:billing',
    'create:billing',
    'update:billing',
    'view:financial_reports',
    'view:companies', // Para vincular cobranças
    'view:contacts',  // Para vincular cobranças
    'view:deals'      // Para ver valores de negócios
  ],
  
  externo: [
    // Visualiza básico, sem poder editar
    'view:dashboard',
    'view:companies',
    'view:contacts',
    'view:deals',
    'view:activities',
    'view:pipelines'
  ]
};

// Funções utilitárias para verificar permissões
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole].includes(permission);
}

export function hasAnyPermission(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

export function hasAllPermissions(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

export function getUserPermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole];
}

// Verificações específicas para recursos
export function canViewAllData(userRole: UserRole): boolean {
  return userRole === 'admin' || userRole === 'gestor';
}

export function canViewOwnDataOnly(userRole: UserRole): boolean {
  return userRole === 'vendedor';
}

export function canAccessFinancial(userRole: UserRole): boolean {
  return userRole === 'admin' || userRole === 'financeiro';
}

export function isReadOnlyUser(userRole: UserRole): boolean {
  return userRole === 'externo';
}

// Descrições dos papéis em português
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: 'Administrador - Acesso total ao sistema',
  gestor: 'Gestor - Gerencia equipe e todos os leads',
  vendedor: 'Vendedor - Acesso aos próprios leads',
  financeiro: 'Financeiro - Acesso ao módulo de cobranças',
  externo: 'Externo - Visualização básica, sem edição'
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  financeiro: 'Financeiro',
  externo: 'Externo'
};