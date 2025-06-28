import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Users, Settings, Plus, Edit } from "lucide-react";

export default function Admin() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'admin')) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    }
  }, [isAuthenticated, isLoading, user, toast]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">Administração</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Usuários do Sistema
              </CardTitle>
              <Button size="sm" disabled>
                <Plus className="w-4 h-4 mr-2" />
                Novo Usuário
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-medium">
                      {user.firstName?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="ml-4">
                      <h4 className="text-sm font-medium text-gray-900">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.email
                        }
                      </h4>
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                    <Badge className="bg-primary text-white">Admin</Badge>
                    <Button variant="ghost" size="sm" disabled>
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
              
              <div className="text-center py-4 text-gray-500">
                <p>Funcionalidade de gerenciamento de usuários será implementada em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Configurações do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="company-name" className="text-sm font-medium text-gray-700">
                  Nome da Empresa
                </Label>
                <Input
                  id="company-name"
                  defaultValue="Minha Empresa Ltda"
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="currency" className="text-sm font-medium text-gray-700">
                  Moeda Padrão
                </Label>
                <Select defaultValue="BRL">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a moeda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">BRL - Real Brasileiro</SelectItem>
                    <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="timezone" className="text-sm font-medium text-gray-700">
                  Fuso Horário
                </Label>
                <Select defaultValue="America/Sao_Paulo">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione o fuso horário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                    <SelectItem value="America/New_York">America/New_York</SelectItem>
                    <SelectItem value="Europe/London">Europe/London</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notifications" className="text-sm font-medium text-gray-700">
                    Notificações por E-mail
                  </Label>
                  <p className="text-xs text-gray-500">
                    Receber notificações sobre atividades importantes
                  </p>
                </div>
                <Switch id="email-notifications" defaultChecked />
              </div>

              <Button className="w-full" disabled>
                Salvar Configurações
              </Button>

              <div className="text-center text-sm text-gray-500">
                <p>Configurações serão implementadas em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
