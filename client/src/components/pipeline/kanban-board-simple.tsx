import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Trash2, Edit, DollarSign, Settings2 } from "lucide-react";
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
function SortableStage({ stage }: { stage: PipelineStage }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-3 bg-white border rounded-lg cursor-move hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div
          className="w-4 h-4 rounded-full"
          style={{ backgroundColor: stage.color }}
        />
        <span className="font-medium">{stage.title}</span>
        <span className="text-sm text-gray-500">
          Posição: {stage.posicaoestagio || stage.position}
        </span>
      </div>
    </div>
  );
}

export default function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStages, setReorderStages] = useState<PipelineStage[]>([]);
  const [activeStageId, setActiveStageId] = useState<UniqueIdentifier | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

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

  const handleStageReorderDragStart = (event: DragStartEvent) => {
    setActiveStageId(event.active.id);
  };

  const handleStageReorderDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStageId(null);

    if (over && active.id !== over.id) {
      setReorderStages((stages) => {
        const oldIndex = stages.findIndex((stage) => stage.id === active.id);
        const newIndex = stages.findIndex((stage) => stage.id === over.id);
        return arrayMove(stages, oldIndex, newIndex);
      });
    }
  };

  const saveStageOrder = () => {
    const stagesToUpdate = reorderStages.map((stage, index) => ({
      id: stage.id,
      position: index
    }));

    // Send as object with stages property
    updateStagePositionsMutation.mutate({ stages: stagesToUpdate });
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Pipeline</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={openReorderModal}
            className="flex items-center gap-2"
          >
            <Settings2 className="w-4 h-4" />
            Reordenar Estágios
          </Button>
        </div>
      </div>

      {/* Stage Reorder Modal */}
      <Dialog open={isReorderModalOpen} onOpenChange={setIsReorderModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reordenar Estágios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Arraste os estágios para reordená-los:
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleStageReorderDragStart}
              onDragEnd={handleStageReorderDragEnd}
            >
              <SortableContext
                items={reorderStages.map(s => s.id)}
                strategy={rectSortingStrategy}
              >
                <div className="space-y-2">
                  {reorderStages.map((stage) => (
                    <SortableStage key={stage.id} stage={stage} />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeStageId ? (
                  <SortableStage 
                    stage={reorderStages.find(s => s.id === activeStageId)!} 
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={saveStageOrder}
                disabled={updateStagePositionsMutation.isPending}
                className="flex-1"
              >
                {updateStagePositionsMutation.isPending ? "Salvando..." : "Salvar Ordem"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsReorderModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
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
        <div className="flex gap-6 overflow-x-auto pb-6">
          {kanbanColumns.map((column) => (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: column.color }}
                    />
                    <h3 className="font-semibold text-gray-900">{column.title}</h3>
                    <Badge variant="secondary">{column.deals.length}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteStage(column.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] space-y-3 ${
                        snapshot.isDraggingOver ? "bg-blue-50" : ""
                      } rounded-lg p-2`}
                    >
                      {column.deals.map((deal, index) => (
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
                                snapshot.isDragging ? "shadow-lg" : ""
                              }`}
                              onClick={() => handleEditDeal(deal)}
                            >
                              <CardContent className="p-4">
                                <div className="space-y-3">
                                  {/* Contact Name (replacing title) */}
                                  <h4 className="font-medium text-gray-900 truncate">
                                    {deal.contact?.name || "Sem contato"}
                                  </h4>

                                  {/* Deal Value */}
                                  <div className="flex items-center gap-2 text-sm">
                                    <DollarSign className="w-4 h-4 text-green-600" />
                                    <span className="font-semibold text-green-600">
                                      {formatCurrency(deal.value)}
                                    </span>
                                  </div>

                                  {/* Owner Avatar */}
                                  {deal.ownerId && (
                                    <div className="flex items-center gap-2">
                                      <Avatar className="w-6 h-6">
                                        <AvatarFallback className="text-xs">
                                          {getInitials("Responsável")}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span className="text-xs text-gray-500">
                                        Responsável
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}

                      {/* Add Deal Button */}
                      <Button
                        variant="ghost"
                        className="w-full h-20 border-2 border-dashed border-gray-300 hover:border-gray-400"
                        onClick={() => {
                          setSelectedDeal(null);
                          setIsDealDialogOpen(true);
                        }}
                      >
                        <Plus className="w-5 h-5 mr-2" />
                        Adicionar Deal
                      </Button>
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}

          {/* Add Stage Column */}
          <div className="flex-shrink-0 w-80">
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-dashed border-gray-300">
              {isAddingStage ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome do estágio"
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        handleAddStage();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleAddStage}
                      disabled={!newStageTitle.trim()}
                    >
                      Adicionar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsAddingStage(false);
                        setNewStageTitle("");
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setIsAddingStage(true)}
                  className="flex-shrink-0 h-8 px-3 text-sm"
                  disabled={stages.length >= 12}
                  title={stages.length >= 12 ? "Limite de 12 estágios atingido" : "Adicionar novo estágio"}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar Estágio {stages.length >= 12 && `(${stages.length}/12)`}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}