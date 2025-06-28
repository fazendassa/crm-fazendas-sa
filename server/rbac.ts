import type { Request, Response, NextFunction } from "express";
import { hasPermission, type Permission, type UserRole } from "@shared/rbac";

// Middleware para verificar permissões
export function requirePermission(permission: Permission) {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      // Verificar se o usuário está autenticado
      if (!req.user || !req.user.claims) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      // Buscar o papel do usuário no banco de dados
      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);

      if (!userRole) {
        return res.status(403).json({ message: "Papel de usuário não encontrado" });
      }

      // Verificar se o usuário tem a permissão necessária
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({ 
          message: "Acesso negado. Você não tem permissão para realizar esta ação." 
        });
      }

      // Adicionar informações de permissão ao request para uso posterior
      req.user.role = userRole;
      req.user.permissions = { hasPermission: (p: Permission) => hasPermission(userRole, p) };

      next();
    } catch (error) {
      console.error("Erro na verificação de permissões:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  };
}

// Middleware para verificar múltiplas permissões (OR logic)
export function requireAnyPermission(permissions: Permission[]) {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.claims) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);

      if (!userRole) {
        return res.status(403).json({ message: "Papel de usuário não encontrado" });
      }

      // Verificar se o usuário tem pelo menos uma das permissões
      const hasAnyPermission = permissions.some(permission => hasPermission(userRole, permission));
      
      if (!hasAnyPermission) {
        return res.status(403).json({ 
          message: "Acesso negado. Você não tem permissão para realizar esta ação." 
        });
      }

      req.user.role = userRole;
      req.user.permissions = { hasPermission: (p: Permission) => hasPermission(userRole, p) };

      next();
    } catch (error) {
      console.error("Erro na verificação de permissões:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  };
}

// Middleware para filtrar dados baseado no papel do usuário
export function applyDataFiltering() {
  return async (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.claims) {
        return res.status(401).json({ message: "Não autenticado" });
      }

      const userId = req.user.claims.sub;
      const userRole = await getUserRole(userId);

      if (!userRole) {
        return res.status(403).json({ message: "Papel de usuário não encontrado" });
      }

      req.user.role = userRole;
      req.user.userId = userId;
      
      // Adicionar filtros baseados no papel
      req.user.filters = {
        // Vendedores só veem seus próprios dados
        shouldFilterByOwner: userRole === 'vendedor',
        // Usuários externos têm acesso somente leitura
        isReadOnly: userRole === 'externo',
        // Administradores e gestores veem todos os dados
        canViewAll: userRole === 'admin' || userRole === 'gestor',
        // Financeiro vê apenas dados relevantes para cobrança
        isFinancialOnly: userRole === 'financeiro'
      };

      next();
    } catch (error) {
      console.error("Erro na aplicação de filtros:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  };
}

// Função auxiliar para buscar o papel do usuário
async function getUserRole(userId: string): Promise<UserRole | null> {
  try {
    // Importar storage aqui para evitar dependência circular
    const { storage } = await import("./storage");
    const user = await storage.getUser(userId);
    return (user?.role as UserRole) || null;
  } catch (error) {
    console.error("Erro ao buscar papel do usuário:", error);
    return null;
  }
}

// Função para verificar se o usuário é proprietário do recurso
export function isResourceOwner(resourceOwnerId: string | null, userId: string): boolean {
  return resourceOwnerId === userId;
}

// Middleware específico para verificar propriedade de recursos
export function requireResourceOwnership() {
  return (req: Request & { user?: any }, res: Response, next: NextFunction) => {
    // Este middleware será usado em conjunto com verificações específicas em cada rota
    // A lógica de verificação de propriedade será implementada em cada endpoint
    next();
  };
}