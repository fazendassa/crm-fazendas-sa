import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, TrendingUp, Activity } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            CRM Professional
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Gerencie seus contatos, empresas e oportunidades de negócio de forma eficiente e profissional.
          </p>
          <Button 
            size="lg" 
            className="bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-lg text-lg"
            onClick={() => window.location.href = '/api/login'}
          >
            Entrar no Sistema
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="text-center">
            <CardHeader>
              <Users className="w-12 h-12 text-primary mx-auto mb-2" />
              <CardTitle>Gestão de Contatos</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Organize e gerencie todos os seus contatos de forma centralizada com informações detalhadas.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Building2 className="w-12 h-12 text-primary mx-auto mb-2" />
              <CardTitle>Empresas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Mantenha um cadastro completo de empresas e seus relacionamentos com contatos.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <TrendingUp className="w-12 h-12 text-primary mx-auto mb-2" />
              <CardTitle>Pipeline de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Acompanhe oportunidades através de um funil visual com estágios personalizáveis.
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader>
              <Activity className="w-12 h-12 text-primary mx-auto mb-2" />
              <CardTitle>Atividades</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Registre interações, notas e tarefas vinculadas aos seus contatos e deals.
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Transforme seu relacionamento com clientes
              </h2>
              <p className="text-gray-600 mb-6">
                Nossa plataforma CRM oferece todas as ferramentas necessárias para gerenciar 
                eficientemente seus contatos B2B e B2C, pipeline de vendas e atividades comerciais.
              </p>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Interface moderna e intuitiva
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Relatórios e métricas em tempo real
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Gestão completa de oportunidades
                </li>
                <li className="flex items-center">
                  <div className="w-2 h-2 bg-primary rounded-full mr-3"></div>
                  Histórico detalhado de interações
                </li>
              </ul>
            </div>
            <div className="text-center">
              <div className="bg-gradient-to-br from-primary to-blue-600 text-white p-8 rounded-lg">
                <h3 className="text-2xl font-bold mb-4">Pronto para começar?</h3>
                <p className="mb-6">
                  Acesse agora e comece a gerenciar seus contatos de forma profissional.
                </p>
                <Button 
                  variant="secondary" 
                  size="lg"
                  className="bg-white text-primary hover:bg-gray-100"
                  onClick={() => window.location.href = '/api/login'}
                >
                  Fazer Login
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
