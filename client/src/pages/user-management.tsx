import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePermissions } from "@/hooks/usePermissions";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Edit, Trash2, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type UserRole } from "@shared/rbac";

interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  createdAt: string;
}

export default function UserManagement() {
  const permissions = usePermissions();
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('vendedor');
  const [copied, setCopied] = useState(false);

  // Buscar lista de usuários
  const { data: users, isLoading } = useQuery({
    queryKey: ['/api/users'],
    enabled: permissions.hasPermission('view:users'),
  });

  // Mutation para atualizar papel do usuário
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserRole }) => {
      return await apiRequest(`/api/users/${userId}/role`, "PUT", { role });
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: "Papel do usuário atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar papel do usuário.",
        variant: "destructive",
      });
    },
  });

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setIsEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (!editingUser) return;
    updateUserMutation.mutate({
      userId: editingUser.id,
      role: selectedRole,
    });
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'gestor': return 'default';
      case 'vendedor': return 'secondary';
      case 'financeiro': return 'outline';
      case 'externo': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <ProtectedRoute requiredPermission="view:users">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
            <p className="text-muted-foreground">
              Gerencie usuários e suas permissões no sistema
            </p>
          </div>
        </div>

        {/* Instruções para criar novos usuários */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800">Como criar novos usuários</CardTitle>
            <CardDescription className="text-blue-700">
              Processo de criação de usuários no sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="text-blue-700">
            <div className="space-y-3">
              <p><strong>1. Login automático:</strong> Novos usuários são criados automaticamente quando fazem login pela primeira vez usando Replit Auth.</p>
              <p><strong>2. Papel padrão:</strong> Todos os novos usuários recebem o papel "Vendedor" por padrão.</p>
              <p><strong>3. Alteração de papéis:</strong> Como administrador, você pode alterar o papel de qualquer usuário usando o botão "Editar" na tabela abaixo.</p>
              <p><strong>4. Convite:</strong> Para convidar alguém, compartilhe o link do sistema abaixo:</p>
              <div className="flex items-center gap-2 mt-2 p-3 bg-white rounded border">
                <code className="flex-1 text-sm">{window.location.origin}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.origin);
                      // setCopied(true);
                      // setTimeout(() => setCopied(false), 2000);
                      toast({
                        title: "Link copiado!",
                        description: "O link foi copiado para a área de transferência.",
                      });
                    } catch (err) {
                      toast({
                        title: "Erro ao copiar",
                        description: "Não foi possível copiar o link.",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copiar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo dos papéis */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => {
            const userCount = users?.filter((u: User) => u.role === role).length || 0;
            return (
              <Card key={role}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {ROLE_LABELS[role as UserRole]}
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{userCount}</div>
                  <p className="text-xs text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Lista de usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
            <CardDescription>
              Lista completa de usuários cadastrados com seus respectivos papéis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="text-sm text-muted-foreground">Carregando usuários...</div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || 'Nome não informado'
                        }
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {ROLE_LABELS[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        {permissions.hasPermission('update:users') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog para editar usuário */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Papel do Usuário</DialogTitle>
              <DialogDescription>
                Altere o papel de acesso do usuário no sistema
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4">
                <div>
                  <Label>Usuário</Label>
                  <div className="text-sm text-muted-foreground">
                    {editingUser.firstName && editingUser.lastName 
                      ? `${editingUser.firstName} ${editingUser.lastName}`
                      : editingUser.firstName || editingUser.email
                    }
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Papel</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um papel" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([role, label]) => (
                        <SelectItem key={role} value={role}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleUpdateRole}
                    disabled={updateUserMutation.isPending}
                  >
                    {updateUserMutation.isPending ? "Atualizando..." : "Atualizar"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}