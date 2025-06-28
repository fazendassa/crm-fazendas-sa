import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";

interface KanbanBoardProps {
  pipelineId: number;
}

export default function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string | undefined>(undefined);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages", pipelineId],
    queryFn: () => fetch(`/api/pipeline-stages?pipelineId=${pipelineId}`, {
      credentials: 'include'
    }).then(res => res.json()),
  });

  const { data: dealsData = [], isLoading: dealsLoading } = useQuery<{ stage: string; count: number; deals: DealWithRelations[] }[]>({
    queryKey: ["/api/deals/by-stage", pipelineId],
    queryFn: () => fetch(`/api/deals/by-stage?pipelineId=${pipelineId}`, {
      credentials: 'include'
    }).then(res => res.json()),
  });

  // Create new stage
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxPosition = Math.max(...stages.map(s => s.position), -1);
      return apiRequest("POST", "/api/pipeline-stages", {
        title,
        pipelineId,
        position: maxPosition + 1,
        color: "#3b82f6",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages", pipelineId] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage", pipelineId] });
      setNewStageTitle("");
      setIsAddingStage(false);
      toast({
        title: "Estágio criado",
        description: "O novo estágio foi adicionado ao pipeline.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível criar o estágio.",
        variant: "destructive",
      });
    },
  });

  const handleCreateStage = () => {
    if (newStageTitle.trim()) {
      createStageMutation.mutate(newStageTitle.trim());
    }
  };

  const handleEditDeal = (deal: DealWithRelations) => {
    setSelectedDeal(deal);
    setIsDealDialogOpen(true);
  };

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Group deals by stage
  const stageDealsMap = new Map<string, DealWithRelations[]>();
  console.log("Kanban deals data:", dealsData);
  dealsData.forEach(stageData => {
    console.log("Setting stage deals:", stageData.stage, "->", stageData.deals);
    stageDealsMap.set(stageData.stage, stageData.deals);
  });
  console.log("Stage deals map:", stageDealsMap);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pipeline Kanban</h3>
        <Button
          onClick={() => setIsAddingStage(true)}
          size="sm"
          variant="outline"
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo Estágio
        </Button>
      </div>

      {/* Add new stage form */}
      {isAddingStage && (
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Estágio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={newStageTitle}
              onChange={(e) => setNewStageTitle(e.target.value)}
              placeholder="Nome do estágio"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateStage();
                if (e.key === "Escape") setIsAddingStage(false);
              }}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleCreateStage}
                disabled={!newStageTitle.trim() || createStageMutation.isPending}
              >
                Criar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsAddingStage(false);
                  setNewStageTitle("");
                }}
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stages
          .sort((a, b) => a.position - b.position)
          .map((stage) => {
            const stageDeals = stageDealsMap.get(stage.title) || [];
            
            return (
              <div key={stage.id} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                      {stage.title}
                    </h4>
                    {stage.isDefault && (
                      <Badge variant="outline" className="text-xs">
                        Padrão
                      </Badge>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {stageDeals.length}
                  </Badge>
                </div>

                <div className="space-y-3 min-h-[200px]">
                  {stageDeals.map((deal) => (
                    <Card 
                      key={deal.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleEditDeal(deal)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">
                          {deal.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          {deal.value && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <DollarSign className="h-3 w-3 mr-1" />
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL'
                              }).format(parseFloat(deal.value))}
                            </div>
                          )}
                          {deal.company && (
                            <div className="text-xs text-muted-foreground">
                              {deal.company.name}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add new deal button */}
                  <Button
                    variant="outline"
                    className="w-full h-20 border-2 border-dashed"
                    onClick={() => {
                      setSelectedDeal(null);
                      setDefaultStage(stage.title.toLowerCase());
                      setIsDealDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Oportunidade
                  </Button>
                </div>
              </div>
            );
          })}
      </div>

      {/* Deal form dialog */}
      <Dialog open={isDealDialogOpen} onOpenChange={setIsDealDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDeal ? "Editar Oportunidade" : "Nova Oportunidade"}
            </DialogTitle>
          </DialogHeader>
          <DealForm
            deal={selectedDeal}
            defaultStage={defaultStage}
            pipelineId={pipelineId}
            onSuccess={() => {
              setIsDealDialogOpen(false);
              setSelectedDeal(null);
              setDefaultStage(undefined);
              queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}