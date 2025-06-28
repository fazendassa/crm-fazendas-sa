import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealForm from "@/components/pipeline/deal-form";
import type { DealWithRelations } from "@shared/schema";

const stageLabels = {
  prospecting: 'Prospecção',
  qualification: 'Qualificação', 
  proposal: 'Proposta',
  closing: 'Fechamento',
};

const stageColors = {
  prospecting: 'border-blue-500',
  qualification: 'border-green-500',
  proposal: 'border-yellow-500',
  closing: 'border-purple-500',
};

export default function Pipeline() {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dealsByStage, isLoading } = useQuery({
    queryKey: ['/api/deals/by-stage'],
  });

  const updateDealStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: string }) => {
      await apiRequest('PUT', `/api/deals/${id}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals/by-stage'] });
      toast({
        title: "Sucesso",
        description: "Deal movido para novo estágio",
      });
    },
  });

  const handleEdit = (deal: DealWithRelations) => {
    setSelectedDeal(deal);
    setIsDialogOpen(true);
  };

  const handleFormSuccess = () => {
    setIsDialogOpen(false);
    setSelectedDeal(null);
    queryClient.invalidateQueries({ queryKey: ['/api/deals/by-stage'] });
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return 'R$ 0';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(parseFloat(value));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-8">
          <p>Carregando pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Pipeline de Oportunidades</h1>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setSelectedDeal(null)}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Oportunidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {selectedDeal ? 'Editar Oportunidade' : 'Nova Oportunidade'}
                </DialogTitle>
              </DialogHeader>
              <DealForm
                deal={selectedDeal}
                onSuccess={handleFormSuccess}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {Object.entries(stageLabels).map(([stage, label]) => {
          const stageData = dealsByStage?.find((s: any) => s.stage === stage);
          const deals = stageData?.deals || [];
          
          return (
            <div key={stage} className="bg-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">{label}</h4>
                <Badge variant="secondary">
                  {deals.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {deals.map((deal: DealWithRelations) => (
                  <Card 
                    key={deal.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${stageColors[stage as keyof typeof stageColors]}`}
                    onClick={() => handleEdit(deal)}
                  >
                    <CardContent className="p-4">
                      <h5 className="font-medium text-gray-900 mb-1">{deal.title}</h5>
                      <p className="text-sm text-gray-600 mb-3">
                        {deal.company?.name || deal.contact?.name || 'N/A'}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(deal.value)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {deal.expectedCloseDate 
                            ? new Date(deal.expectedCloseDate).toLocaleDateString('pt-BR')
                            : 'Sem data'
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {deals.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 text-sm">Nenhuma oportunidade</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
