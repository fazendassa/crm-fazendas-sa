import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, TrendingUp, DollarSign, Phone, CheckCircle, Mail } from "lucide-react";

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  const { data: recentActivities } = useQuery({
    queryKey: ['/api/activities', { limit: 10 }],
  });

  if (metricsLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="w-4 h-4 text-blue-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-yellow-600" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-600" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'prospeccao':
        return 'bg-blue-600';
      case 'qualificacao':
        return 'bg-green-600';
      case 'proposta':
        return 'bg-yellow-600';
      case 'fechamento':
        return 'bg-purple-600';
      default:
        return 'bg-gray-600';
    }
  };

  const getStageDisplayName = (stage: string) => {
    switch (stage) {
      case 'prospeccao':
        return 'Prospecção';
      case 'qualificacao':
        return 'Qualificação';
      case 'proposta':
        return 'Proposta';
      case 'fechamento':
        return 'Fechamento';
      default:
        return stage.charAt(0).toUpperCase() + stage.slice(1);
    }
  };

  const totalDeals = metrics?.stageMetrics?.reduce((acc: number, stage: any) => acc + stage.count, 0) || 0;

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-blue-100">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Contatos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics?.totalContacts || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100">
                <Building2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Empresas Ativas</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics?.activeCompanies || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-yellow-100">
                <TrendingUp className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Deals Abertos</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics?.openDeals || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Receita Prevista</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {metrics?.projectedRevenue || 'R$ 0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Pipeline por Estágio</CardTitle>
            <CardDescription>Distribuição de deals pelos estágios do pipeline</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {metrics?.stageMetrics?.map((stage: any) => {
                const percentage = totalDeals > 0 ? (stage.count / totalDeals) * 100 : 0;
                const stageDisplayName = getStageDisplayName(stage.stage);
                
                return (
                  <div key={stage.stage} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${getStageColor(stage.stage)}`}
                        />
                        <span className="text-sm text-gray-600">{stageDisplayName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-medium">{stage.count} deals</span>
                        <div className="text-xs text-gray-500">{stage.totalValue}</div>
                      </div>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              }) || (
                <div className="text-center text-gray-500 py-4">
                  Nenhum deal encontrado
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Atividades Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities && Array.isArray(recentActivities) && recentActivities.length > 0 ? (
                recentActivities.map((activity: any) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        {activity.title}
                        {activity.contact && (
                          <span className="font-medium"> - {activity.contact.name}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhuma atividade recente encontrada</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}