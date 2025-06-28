import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Phone, Mail, Calendar, FileText, CheckSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import ActivityForm from "@/components/activities/activity-form";
import type { ActivityWithRelations } from "@shared/schema";

export default function Activities() {
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithRelations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['/api/activities'],
  });

  const { data: dashboardMetrics } = useQuery({
    queryKey: ['/api/dashboard/metrics'],
  });

  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: number; completed: boolean }) => {
      await apiRequest('PUT', `/api/activities/${id}`, { completed });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      toast({
        title: "Sucesso",
        description: "Atividade atualizada",
      });
    },
  });

  const handleEdit = (activity: ActivityWithRelations) => {
    setSelectedActivity(activity);
    setIsDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsDialogOpen(false);
    setSelectedActivity(null);
    queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
  };

  const handleToggleComplete = (activity: ActivityWithRelations) => {
    updateActivityMutation.mutate({
      id: activity.id,
      completed: !activity.completed,
    });
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call':
        return <Phone className="w-4 h-4 text-blue-600" />;
      case 'email':
        return <Mail className="w-4 h-4 text-green-600" />;
      case 'meeting':
        return <Calendar className="w-4 h-4 text-purple-600" />;
      case 'task':
        return <CheckSquare className="w-4 h-4 text-orange-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityTypeBadge = (type: string) => {
    const variants: { [key: string]: string } = {
      call: 'bg-blue-100 text-blue-800',
      email: 'bg-green-100 text-green-800',
      meeting: 'bg-purple-100 text-purple-800',
      task: 'bg-orange-100 text-orange-800',
      note: 'bg-gray-100 text-gray-800',
    };

    const labels: { [key: string]: string } = {
      call: 'Ligação',
      email: 'E-mail',
      meeting: 'Reunião',
      task: 'Tarefa',
      note: 'Nota',
    };

    return (
      <Badge className={variants[type] || 'bg-gray-100 text-gray-800'}>
        {labels[type] || type}
      </Badge>
    );
  };

  const upcomingTasks = activities?.filter((activity: ActivityWithRelations) => 
    activity.type === 'task' && 
    !activity.completed && 
    activity.dueDate &&
    new Date(activity.dueDate) >= new Date()
  ).slice(0, 5) || [];

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activities List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Atividades e Notas</CardTitle>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setSelectedActivity(null)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Atividade
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {selectedActivity ? 'Editar Atividade' : 'Nova Atividade'}
                      </DialogTitle>
                    </DialogHeader>
                    <ActivityForm
                      activity={selectedActivity}
                      onSuccess={handleFormSuccess}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">
                  <p>Carregando atividades...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities && activities.length > 0 ? (
                    activities.map((activity: ActivityWithRelations) => (
                      <div 
                        key={activity.id} 
                        className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleEdit(activity)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-medium text-gray-900">
                                {activity.title}
                              </h4>
                              <div className="flex items-center space-x-2">
                                {getActivityTypeBadge(activity.type)}
                                <span className="text-xs text-gray-500">
                                  {new Date(activity.createdAt!).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            </div>
                            {activity.description && (
                              <p className="text-sm text-gray-600 mb-2">
                                {activity.description}
                              </p>
                            )}
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              {activity.contact && (
                                <span>Contato: {activity.contact.name}</span>
                              )}
                              {activity.deal && (
                                <span>Deal: {activity.deal.title}</span>
                              )}
                              {activity.type === 'task' && (
                                <div className="flex items-center space-x-1">
                                  <Checkbox
                                    checked={activity.completed}
                                    onCheckedChange={() => handleToggleComplete(activity)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span>
                                    {activity.completed ? 'Concluída' : 'Pendente'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">Nenhuma atividade encontrada</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Próximas Tarefas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {upcomingTasks.length > 0 ? (
                  upcomingTasks.map((task: ActivityWithRelations) => (
                    <div key={task.id} className="flex items-center space-x-3">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => handleToggleComplete(task)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{task.title}</p>
                        <p className="text-xs text-gray-500">
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem data'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">Nenhuma tarefa pendente</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Atividades hoje</span>
                  <span className="text-sm font-medium">
                    {activities?.filter((a: ActivityWithRelations) => 
                      new Date(a.createdAt!).toDateString() === new Date().toDateString()
                    ).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tarefas pendentes</span>
                  <span className="text-sm font-medium">
                    {activities?.filter((a: ActivityWithRelations) => 
                      a.type === 'task' && !a.completed
                    ).length || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total de contatos</span>
                  <span className="text-sm font-medium">
                    {dashboardMetrics?.totalContacts || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
