
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, ArrowUpDown, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";

interface KanbanBoardProps {
  pipelineId: number;
}

export default function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string | undefined>();
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isManagingStages, setIsManagingStages] = useState(false);
  const [managementStages, setManagementStages] = useState<PipelineStage[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get pipeline stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`],
  });

  // Get deals by stage for this pipeline
  const { data: dealsData = [], isLoading: dealsLoading } = useQuery<{ stage: string; count: number; deals: DealWithRelations[] }[]>({
    queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`],
  });

  // Create new stage with auto-positioned next number
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      // Auto-assign the next position based on existing stages
      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position || 0)) : -1;
      const nextPosition = maxPosition + 1;

      console.log(`Creating new stage "${title}" at position ${nextPosition}`);

      return apiRequest("POST", "/api/pipeline-stages", {
        title,
        pipelineId,
        position: nextPosition,
        color: "#3b82f6",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      setIsAddingStage(false);
      setNewStageTitle("");
      toast({
        title: "Sucesso",
        description: "Estágio criado com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error creating stage:", error);
      toast({
        title: "Erro",
        description: "Erro ao criar estágio",
        variant: "destructive",
      });
    },
  });

  // Update stage positions mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (updatedStages: PipelineStage[]) => {
      // Send all stage updates in a single batch request
      const stageUpdates = updatedStages.map((stage, index) => ({
        id: stage.id,
        position: index
      }));

      console.log("=== MUTATION: Starting position update ===");
      console.log("Stages data to send:", JSON.stringify(stageUpdates, null, 2));

      const response = await fetch("/api/pipeline-stages/positions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ stages: stageUpdates }),
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Server error response:", errorText);
        throw new Error(`Failed to update stage positions: ${response.status} ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      setIsManagingStages(false);
      toast({
        title: "Sucesso",
        description: "Posições dos estágios atualizadas com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error updating stage positions:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar posições dos estágios",
        variant: "destructive",
      });
    },
  });

  // Update deal mutation for drag and drop
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ stage }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to update deal: ${response.status} ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });

      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error updating deal stage:", error);
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Erro",
        description: `Erro ao mover oportunidade: ${error.message}`,
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

  const openStageManagement = () => {
    // Sort stages by position for management
    const sortedStages = [...stages].sort((a, b) => (a.position || 0) - (b.position || 0));
    setManagementStages(sortedStages);
    setIsManagingStages(true);
  };

  const handleStageReorder = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(managementStages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setManagementStages(items);
  };

  const saveStagePositions = () => {
    updateStagePositionsMutation.mutate(managementStages);
  };

  // Handle drag and drop for deals only
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If no destination, return
    if (!destination) return;

    // If dropped in the same position, return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Handle deal movement between stages
    const dealId = parseInt(draggableId.replace("deal-", ""));
    const newStage = destination.droppableId;

    // Validate deal ID
    if (isNaN(dealId)) {
      toast({
        title: "Erro",
        description: "ID da oportunidade inválido",
        variant: "destructive",
      });
      return;
    }

    // Find the deal that's being moved
    const sourceStageData = Array.isArray(dealsData) 
      ? dealsData.find((s: any) => s.stage === source.droppableId)
      : null;

    const dealToMove = sourceStageData?.deals.find((deal: any) => deal.id === dealId);

    if (!dealToMove) {
      toast({
        title: "Erro",
        description: "Oportunidade não encontrada",
        variant: "destructive",
      });
      return;
    }

    // Optimistically update the cache first
    queryClient.setQueryData([`/api/deals/by-stage?pipelineId=${pipelineId}`], (oldData: any) => {
      if (!Array.isArray(oldData)) return oldData;

      return oldData.map((stageData: any) => {
        // Remove deal from source stage
        if (stageData.stage === source.droppableId) {
          return {
            ...stageData,
            deals: stageData.deals.filter((deal: any) => deal.id !== dealId),
            count: Math.max(0, stageData.count - 1)
          };
        }

        // Add deal to destination stage
        if (stageData.stage === destination.droppableId) {
          return {
            ...stageData,
            deals: [...stageData.deals, { ...dealToMove, stage: newStage }],
            count: stageData.count + 1
          };
        }

        return stageData;
      });
    });

    // Update the deal stage on server
    updateDealMutation.mutate({ dealId, stage: newStage });
  };

  if (stagesLoading || dealsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Carregando kanban...</div>
      </div>
    );
  }

  // Group deals by stage
  const stageDealsMap = new Map<string, DealWithRelations[]>();
  if (Array.isArray(dealsData)) {
    dealsData.forEach((stageData: any) => {
      stageDealsMap.set(stageData.stage, stageData.deals);
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Pipeline Kanban</h3>
          <div className="flex gap-2">
            <Button
              onClick={openStageManagement}
              size="sm"
              variant="outline"
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar Estágios
            </Button>
            <Button
              onClick={() => setIsAddingStage(true)}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Estágio
            </Button>
          </div>
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

        {/* Stage Management Modal */}
        <Dialog open={isManagingStages} onOpenChange={setIsManagingStages}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerenciar Posições dos Estágios</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Arraste os estágios para reordená-los. A ordem aqui será refletida no kanban.
              </p>
              
              <DragDropContext onDragEnd={handleStageReorder}>
                <Droppable droppableId="stage-management">
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-2"
                    >
                      {managementStages.map((stage, index) => (
                        <Draggable
                          key={stage.id}
                          draggableId={`stage-${stage.id}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`flex items-center justify-between p-3 border rounded-lg bg-white ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: stage.color }}
                                />
                                <span className="font-medium">{stage.title}</span>
                                {stage.isDefault && (
                                  <Badge variant="outline" className="text-xs">
                                    Padrão
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Nova posição: {index + 1} | DB atual: {stage.position ?? 'N/A'}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={saveStagePositions}
                  disabled={updateStagePositionsMutation.isPending}
                >
                  {updateStagePositionsMutation.isPending ? "Salvando..." : "Salvar Posições"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsManagingStages(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Kanban columns */}
        <div className="flex gap-6 overflow-x-auto pb-6">
          {Array.isArray(stages) &&
            stages
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))
            .map((stage: any) => {
              const stageDeals = stageDealsMap.get(stage.title) || [];

              return (
                <div key={stage.id} className="flex-shrink-0 w-80 space-y-4">
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

                  <Droppable droppableId={stage.title}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-3 min-h-[200px] bg-gray-50 rounded-lg p-4"
                      >
                        {stageDeals.map((deal, index) => (
                          <Draggable
                            key={deal.id}
                            draggableId={`deal-${deal.id}`}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`cursor-pointer hover:shadow-md transition-shadow bg-white ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                }`}
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
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* Add new deal button */}
                        <Button
                          variant="outline"
                          className="w-full h-20 border-2 border-dashed"
                          onClick={() => {
                            setSelectedDeal(null);
                            setDefaultStage(stage.title);
                            setIsDealDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Nova Oportunidade
                        </Button>
                      </div>
                    )}
                  </Droppable>
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
                queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage", pipelineId] });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </DragDropContext>
  );
}
