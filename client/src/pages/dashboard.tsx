import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, TrendingUp, DollarSign, Phone, CheckCircle, Mail } from "lucide-react";

interface DashboardMetrics {
  totalContacts: number;
  activeCompanies: number;
  openDeals: number;
  projectedRevenue: string;
  stageMetrics: Array<{ stage: string; count: number; }>;
}

export default function Dashboard() {
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  // Define default values to avoid TypeScript errors
  const metricsData: DashboardMetrics = metrics || {
    totalContacts: 0,
    activeCompanies: 0,
    openDeals: 0,
    projectedRevenue: "0",
    stageMetrics: []
  };

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

  const totalDeals = metricsData.stageMetrics.reduce((acc: number, stage: any) => acc + stage.count, 0);

  return (
    <div className="p-8 bg-gray-50/50 min-h-screen">
      <div className="mb-10">
        <h1 className="apple-title text-4xl text-gray-900 mb-2">Dashboard</h1>
        <p className="apple-text-muted text-lg">Visão geral do seu negócio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="apple-card p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 rounded-2xl bg-blue-50">
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <div>
            <p className="apple-text-muted text-sm mb-1">Total Contatos</p>
            <p className="apple-title text-3xl text-gray-900">
              {metricsData.totalContacts}
            </p>
          </div>
        </div>

        <div className="apple-card p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 rounded-2xl bg-green-50">
              <Building2 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          <div>
            <p className="apple-text-muted text-sm mb-1">Empresas Ativas</p>
            <p className="apple-title text-3xl text-gray-900">
              {metricsData.activeCompanies}
            </p>
          </div>
        </div>

        <div className="apple-card p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 rounded-2xl bg-yellow-50">
              <TrendingUp className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          <div>
            <p className="apple-text-muted text-sm mb-1">Deals Abertos</p>
            <p className="apple-title text-3xl text-gray-900">
              {metricsData.openDeals}
            </p>
          </div>
        </div>

        <div className="apple-card p-8">
          <div className="flex items-center justify-between mb-4">
            <div className="p-4 rounded-2xl bg-purple-50">
              <DollarSign className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <div>
            <p className="apple-text-muted text-sm mb-1">Receita Prevista</p>
            <p className="apple-title text-3xl text-gray-900">
              R$ {metricsData.projectedRevenue}
            </p>
          </div>
        </div>
      </div>

      {/* Charts and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pipeline Chart */}
        <div className="apple-card p-8">
          <div className="mb-6">
            <h3 className="apple-title text-xl text-gray-900 mb-2">Pipeline por Estágio</h3>
            <p className="apple-text-muted">Distribuição de deals pelos estágios do pipeline</p>
          </div>
          <div className="space-y-6">
            {(metrics as any)?.stageMetrics?.map((stage: any) => {
              const percentage = totalDeals > 0 ? (stage.count / totalDeals) * 100 : 0;
              const stageDisplayName = getStageDisplayName(stage.stage);
              
              return (
                <div key={stage.stage} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div 
                        className={`w-4 h-4 rounded-full ${getStageColor(stage.stage)}`}
                      />
                      <span className="apple-text font-medium">{stageDisplayName}</span>
                    </div>
                    <div className="text-right">
                      <p className="apple-subheader text-sm">{stage.count} deals</p>
                      <p className="apple-text-muted text-xs">{stage.totalValue}</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            }) || (
              <div className="text-center apple-text-muted py-8">
                Nenhum deal encontrado
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="apple-card p-8">
          <div className="mb-6">
            <h3 className="apple-title text-xl text-gray-900">Atividades Recentes</h3>
          </div>
          <div className="space-y-4">
            {recentActivities && Array.isArray(recentActivities) && recentActivities.length > 0 ? (
              recentActivities.map((activity: any) => (
                <div key={activity.id} className="flex items-start space-x-4 p-4 rounded-xl bg-gray-50 apple-fade-in">
                  <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center flex-shrink-0">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="apple-text text-sm mb-1">
                      {activity.title}
                      {activity.contact && (
                        <span className="apple-subheader"> - {activity.contact.name}</span>
                      )}
                    </p>
                    <p className="apple-text-muted text-xs">
                      {new Date(activity.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="apple-text-muted">Nenhuma atividade recente encontrada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}