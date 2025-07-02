import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
// Removed @dnd-kit dependencies - now using simple arrow buttons
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Trash2, Edit, DollarSign, Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  position: number;
  deals: DealWithRelations[];
}

interface KanbanBoardProps {
  pipelineId: number;
}

// Sortable stage component for reordering
// Removed SortableStage component - now using simple arrow buttons in modal

export default function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStages, setReorderStages] = useState<PipelineStage[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pipeline stages - ensure they're ordered by posicaoestagio
  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`],
    select: (data) => data.sort((a, b) => (a.posicaoestagio || a.position) - (b.posicaoestagio || b.position))
  });

  // Get deals by stage for this pipeline
  const { data: dealsData = [], isLoading: dealsLoading } = useQuery<{ stage: string; count: number; deals: DealWithRelations[] }[]>({
    queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`],
  });

  // Update deal mutation
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      return apiRequest(`/api/deals/${dealId}`, "PUT", { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      toast({
        title: "Sucesso",
        description: "Deal movido com sucesso",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Erro ao mover deal",
        variant: "destructive",
      });
    },
  });

  // Create stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxPosition = Math.max(...stages.map(s => s.posicaoestagio || s.position), -1);
      return apiRequest("/api/pipeline-stages", "POST", {
        pipelineId,
        title,
        position: maxPosition + 1,
        posicaoestagio: maxPosition + 1,
        color: "#3b82f6",
        isDefault: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      setNewStageTitle("");
      setIsAddingStage(false);
      toast({
        title: "Sucesso",
        description: "Estágio criado",
      });
    },
    onError: (error: any) => {
      console.error("Error creating stage:", error);
      const errorMessage = error.message?.includes("more than 12 stages") 
        ? "Pipeline não pode ter mais de 12 estágios"
        : "Erro ao criar estágio";

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Delete stage mutation
  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: number) => {
      return apiRequest("DELETE", `/api/pipeline-stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      toast({
        title: "Sucesso",
        description: "Estágio excluído",
      });
    },
  });

  // Update stage positions mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (stagesData: { stages: { id: number; position: number }[] }) => {
      console.log("=== FRONT-END DEBUG: Before mutationFn ===");
      console.log("Stages data received:", stagesData);

      const { stages } = stagesData;
      const payload = {
        stages: stages.map((stage, index) => ({
          id: Number(stage.id),
          position: index
        }))
      };

      console.log("=== FRONT-END DEBUG: Payload to send ===");
      console.log("Payload:", payload);

      return apiRequest("/api/pipeline-stages/positions", "PUT", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      setIsReorderModalOpen(false);
      toast({
        title: "Sucesso",
        description: "Ordem dos estágios atualizada",
      });
    },
    onError: (error: any) => {
      console.error("Error updating stage positions:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar ordem dos estágios",
        variant: "destructive",
      });
    },
  });

  // Build columns from stages and deals
  const kanbanColumns = useMemo(() => {
    if (!stages || stages.length === 0) {
      return [];
    }

    const columns: KanbanColumn[] = stages
      .sort((a, b) => (a.posicaoestagio || a.position) - (b.posicaoestagio || b.position))
      .map((stage) => ({
        id: stage.id.toString(),
        title: stage.title,
        color: stage.color || "#3b82f6",
        position: stage.position,
        deals: Array.isArray(dealsData) 
          ? dealsData.find((d: any) => d.stage === stage.title.toLowerCase())?.deals || []
          : [],
      }));

    return columns;
  }, [stages, dealsData]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId !== destination.droppableId) {
      // Moving deal between stages
      const dealId = parseInt(draggableId.replace("deal-", ""));
      const destinationColumn = kanbanColumns.find(col => col.id === destination.droppableId);

      if (destinationColumn) {
        updateDealMutation.mutate({ 
          dealId, 
          stage: destinationColumn.title.toLowerCase() 
        });
      }
    }
  };

  const handleEditDeal = (deal: DealWithRelations) => {
    setSelectedDeal(deal);
    setIsDealDialogOpen(true);
  };

  const handleAddStage = () => {
    if (newStageTitle.trim()) {
      createStageMutation.mutate(newStageTitle.trim());
    }
  };

  const handleDeleteStage = (stageId: string) => {
    deleteStageMutation.mutate(parseInt(stageId));
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(parseFloat(value));
  };

  const openReorderModal = () => {
    setReorderStages([...stages].sort((a, b) => (a.posicaoestagio || a.position) - (b.posicaoestagio || b.position)));
    setIsReorderModalOpen(true);
  };

  // Removed drag handlers - now using simple arrow buttons

  const saveStageOrder = () => {
    console.log("=== FRONTEND: saveStageOrder called ===");
    console.log("reorderStages:", reorderStages);

    const stagesToUpdate = reorderStages.map((stage, index) => {
      console.log(`Stage ${index}:`, { id: stage.id, type: typeof stage.id, position: index });
      return {
        id: Number(stage.id), // Ensure it's a number
        position: index
      };
    });

    console.log("stagesToUpdate:", stagesToUpdate);

    // Send as object with stages property
    updateStagePositionsMutation.mutate({ stages: stagesToUpdate });
  };

  // Function to move stage up in the reorder list
  const moveStageUp = (stageId: number) => {
    setReorderStages(prevStages => {
      const currentIndex = prevStages.findIndex(stage => stage.id === stageId);
      if (currentIndex <= 0) return prevStages; // Can't move up if it's already first

      const newStages = [...prevStages];
      // Swap with previous item
      [newStages[currentIndex - 1], newStages[currentIndex]] = [newStages[currentIndex], newStages[currentIndex - 1]];
      return newStages;
    });
  };

  // Function to move stage down in the reorder list
  const moveStageDown = (stageId: number) => {
    setReorderStages(prevStages => {
      const currentIndex = prevStages.findIndex(stage => stage.id === stageId);
      if (currentIndex >= prevStages.length - 1) return prevStages; // Can't move down if it's already last

      const newStages = [...prevStages];
      // Swap with next item
      [newStages[currentIndex], newStages[currentIndex + 1]] = [newStages[currentIndex + 1], newStages[currentIndex]];
      return newStages;
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (stagesLoading || dealsLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="apple-title text-3xl text-gray-900 mb-1">Pipeline</h2>
          <p className="apple-text-muted">Gerencie seus deals em cada estágio</p>
        </div>
        <div className="flex gap-3">
          <div
            className="apple-button-secondary flex items-center gap-2 cursor-pointer"
            onClick={openReorderModal}
          >
            <Settings2 className="w-4 h-4" />
            <span>Reordenar Estágios</span>
          </div>
        </div>
      </div>

      {/* Stage Reorder Modal */}
      <Dialog open={isReorderModalOpen} onOpenChange={setIsReorderModalOpen}>
        <DialogContent className="apple-dialog max-w-md">
          <DialogHeader>
            <DialogTitle className="apple-title text-xl text-gray-900">Reordenar Estágios</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="apple-text-muted">
              Use as setas para reordenar os estágios:
            </p>
            <div className="space-y-3">
              {reorderStages.map((stage, index) => {
                const isProspecção = stage.title === "Prospecção";
                const isFechamento = stage.title === "Fechamento";
                const isFixed = isProspecção || isFechamento;

                // Determine if buttons should be disabled
                const canMoveUp = !isProspecção && index > 0 && 
                  !(index === 1 && reorderStages[0].title === "Prospecção");
                const canMoveDown = !isFechamento && index < reorderStages.length - 1 && 
                  !(index === reorderStages.length - 2 && reorderStages[reorderStages.length - 1].title === "Fechamento");

                return (
                  <div
                    key={stage.id}
                    className={`flex items-center justify-between p-4 rounded-xl transition-all duration-200 ${
                      isFixed ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-5 h-5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: stage.color || "#3b82f6" }}
                      ></div>
                      <span className="apple-subheader">{stage.title}</span>
                      {isFixed && (
                        <span className="apple-badge-blue">
                          Fixo
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          canMoveUp 
                            ? 'bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        onClick={() => canMoveUp && moveStageUp(stage.id)}
                        title={!canMoveUp ? "Não pode mover para cima" : "Mover para cima"}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </div>
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer ${
                          canMoveDown 
                            ? 'bg-white border border-gray-200 hover:bg-gray-50 active:bg-gray-100' 
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        onClick={() => canMoveDown && moveStageDown(stage.id)}
                        title={!canMoveDown ? "Não pode mover para baixo" : "Mover para baixo"}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 pt-6">
              <div 
                className={`apple-button flex-1 text-center cursor-pointer ${
                  updateStagePositionsMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                onClick={() => !updateStagePositionsMutation.isPending && saveStageOrder()}
              >
                {updateStagePositionsMutation.isPending ? "Salvando..." : "Salvar Ordem"}
              </div>
              <div 
                className="apple-button-secondary flex-1 text-center cursor-pointer"
                onClick={() => setIsReorderModalOpen(false)}
              >
                Cancelar
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deal Form Dialog */}
      <Dialog open={isDealDialogOpen} onOpenChange={setIsDealDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {selectedDeal ? "Editar Negócio" : "Novo Negócio"}
            </DialogTitle>
          </DialogHeader>
          <DealForm
            deal={selectedDeal}
            pipelineId={pipelineId}
            onSuccess={() => {
              setIsDealDialogOpen(false);
              setSelectedDeal(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-8 overflow-x-auto pb-8">
          {kanbanColumns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="apple-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <h3 className="apple-subheader text-gray-900">{column.title}</h3>
                    <span className="apple-badge">{column.deals.length}</span>
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-all duration-200"
                    onClick={() => handleDeleteStage(column.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </div>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[300px] space-y-4 ${
                        snapshot.isDraggingOver ? "bg-blue-50/50" : "bg-gray-50"
                      } rounded-2xl p-4 transition-all duration-200`}
                    >
                      {column.deals.map((deal, index) => (
                        <Draggable
                          key={deal.id}
                          draggableId={`deal-${deal.id}`}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`apple-card p-5 cursor-pointer transition-all duration-200 apple-fade-in ${
                                snapshot.isDragging ? "shadow-xl scale-105" : "hover:shadow-lg hover:scale-[1.02]"
                              }`}
                              onClick={() => handleEditDeal(deal)}
                            >
                              <div className="space-y-3">
                                {/* Contact Name */}
                                <h4 className="apple-subheader text-gray-900 truncate">
                                  {deal.contact?.name || "Sem contato"}
                                </h4>

                                {/* Deal Value */}
                                <div className="flex items-center gap-2">
                                  <DollarSign className="w-4 h-4 text-green-500" />
                                  <span className="apple-text font-semibold text-green-500">
                                    {formatCurrency(deal.value)}
                                  </span>
                                </div>

                                {/* Owner Avatar */}
                                {deal.ownerId && (
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                      <span className="text-xs font-medium text-blue-600">
                                        {getInitials("Responsável")}
                                      </span>
                                    </div>
                                    <span className="apple-text-muted text-xs">
                                      Responsável
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Add Deal Button */}
                      <div
                        className="w-full h-20 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50/30 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-200 apple-fade-in"
                        onClick={() => {
                          setSelectedDeal(null);
                          setIsDealDialogOpen(true);
                        }}
                      >
                        <Plus className="w-5 h-5 mr-2 text-gray-500" />
                        <span className="apple-text text-gray-500">Adicionar Deal</span>
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}

          {/* Add Stage Column */}
          <div className="flex-shrink-0 w-80">
            <div className="apple-card p-6 border-2 border-dashed border-gray-300">
              {isAddingStage ? (
                <div className="space-y-4">
                  <input
                    type="text"
                    placeholder="Nome do estágio"
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddStage();
                      }
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-200 apple-text"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <div
                      className="apple-button-primary flex-1 text-center py-3"
                      onClick={handleAddStage}
                      style={{ opacity: !newStageTitle.trim() ? 0.5 : 1, pointerEvents: !newStageTitle.trim() ? 'none' : 'auto' }}
                    >
                      Adicionar
                    </div>
                    <div
                      className="apple-button-secondary w-12 h-12 flex items-center justify-center"
                      onClick={() => {
                        setIsAddingStage(false);
                        setNewStageTitle("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full h-20 flex items-center justify-center cursor-pointer hover:bg-gray-50 rounded-xl transition-all duration-200"
                  onClick={() => setIsAddingStage(true)}
                  style={{ opacity: stages.length >= 12 ? 0.5 : 1, pointerEvents: stages.length >= 12 ? 'none' : 'auto' }}
                  title={stages.length >= 12 ? "Limite de 12 estágios atingido" : "Adicionar novo estágio"}
                >
                  <Plus className="w-5 h-5 mr-2 text-gray-500" />
                  <span className="apple-text text-gray-500">
                    Adicionar Estágio {stages.length >= 12 && `(${stages.length}/12)`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}