
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Edit } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function UserManagement() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'user',
    isActive: true
  });

  useEffect(() => {
    if (hasPermission('users:read')) {
      loadUsers();
    }
  }, [hasPermission]);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      } else {
        setError('Erro ao carregar usuários');
      }
    } catch (err) {
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser 
        ? `/api/admin/users/${editingUser.id}`
        : '/api/admin/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowForm(false);
        setEditingUser(null);
        setFormData({
          email: '',
          name: '',
          role: 'user',
          isActive: true
        });
        loadUsers();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao salvar usuário');
      }
    } catch (err) {
      setError('Erro ao salvar usuário');
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (response.ok) {
        loadUsers();
      } else {
        setError('Erro ao excluir usuário');
      }
    } catch (err) {
      setError('Erro ao excluir usuário');
    }
  };

  if (!hasPermission('users:read')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">
            Você não tem permissão para acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">Gerenciamento de Usuários</h1>
            <p className="text-gray-500 mt-1">Gerencie usuários do sistema</p>
          </div>
          {hasPermission('users:create') && (
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Novo Usuário
            </Button>
          )}
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {showForm && (
          <Card className="mb-8 border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-lg font-semibold text-gray-900">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </CardTitle>
              <CardDescription className="text-gray-500">
                {editingUser ? 'Atualize as informações do usuário' : 'Adicione um novo usuário ao sistema'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="usuario@exemplo.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nome
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Nome do usuário"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Função
                    </label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="user">Usuário</option>
                      <option value="admin">Administrador</option>
                      <option value="manager">Gerente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={formData.isActive ? 'true' : 'false'}
                      onChange={(e) => setFormData({...formData, isActive: e.target.value === 'true'})}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="true">Ativo</option>
                      <option value="false">Inativo</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingUser(null);
                      setFormData({
                        email: '',
                        name: '',
                        role: 'user',
                        isActive: true
                      });
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Atualizar' : 'Criar'} Usuário
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {users.map((user) => (
            <Card key={user.id} className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {user.name}
                  </CardTitle>
                  <div className="flex gap-2">
                    {hasPermission('users:update') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(user)}
                        className="flex items-center gap-1"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    {hasPermission('users:delete') && user.id !== user.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(user.id)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <CardDescription className="text-gray-500">
                  {user.email}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Função:</span>
                    <Badge variant="secondary">
                      {user.role}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <Badge variant={user.isActive ? 'default' : 'secondary'}>
                      {user.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700">Criado em:</span>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {users.length === 0 && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">
                Nenhum usuário encontrado
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Clique em "Novo Usuário" para começar
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
