import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign } from "lucide-react";
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

  // Create new stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      await apiRequest("/api/pipeline-stages", "POST", {
        title,
        pipelineId,
        position: Array.isArray(stages) ? stages.length : 0,
        isDefault: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages", pipelineId] });
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

  // Update deal mutation for drag and drop
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      await apiRequest(`/api/deals/${dealId}`, "PUT", { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage", pipelineId] });
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
    onError: (error) => {
      console.error("Error updating deal stage:", error);
      toast({
        title: "Erro",
        description: "Erro ao mover oportunidade",
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

  // Handle drag and drop
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

    // Get the deal ID from draggableId
    const dealId = parseInt(draggableId.replace("deal-", ""));
    const newStage = destination.droppableId;

    // Update the deal stage
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
          {Array.isArray(stages) &&
            stages
            .sort((a: any, b: any) => a.position - b.position)
            .map((stage: any) => {
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

                  <Droppable droppableId={stage.title}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-3 min-h-[200px]"
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
                                className={`cursor-pointer hover:shadow-md transition-shadow ${
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