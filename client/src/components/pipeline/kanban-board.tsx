import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, X, Trash2, Edit, DollarSign } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  position: number;
  deals: DealWithRelations[];
}

export default function KanbanBoard() {
  const [kanbanColumns, setKanbanColumns] = useState<KanbanColumn[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  const { data: dealsData } = useQuery({
    queryKey: ["/api/deals/by-stage"],
  });

  // Initialize default stages
  const initializeStagesMutation = useMutation({
    mutationFn: async () => {
      const defaultStages = [
        { title: "Prospecção", position: 0, color: "#3b82f6" },
        { title: "Qualificação", position: 1, color: "#f59e0b" },
        { title: "Proposta", position: 2, color: "#8b5cf6" },
        { title: "Negociação", position: 3, color: "#ef4444" },
        { title: "Fechado", position: 4, color: "#10b981" },
      ];
      
      for (const stage of defaultStages) {
        await apiRequest("POST", "/api/pipeline-stages", stage);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      setHasInitialized(true);
    },
  });

  // Create new stage
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxPosition = Math.max(...stages.map(s => s.position), -1);
      return apiRequest("POST", "/api/pipeline-stages", {
        title,
        position: maxPosition + 1,
        color: "#3b82f6",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      setNewStageTitle("");
      setIsAddingStage(false);
      toast({
        title: "Sucesso",
        description: "Novo estágio criado",
      });
    },
  });

  // Delete stage
  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: number) => {
      return apiRequest("DELETE", `/api/pipeline-stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      toast({
        title: "Sucesso",
        description: "Estágio excluído",
      });
    },
  });

  // Update deal stage
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      return apiRequest("PUT", `/api/deals/${dealId}`, { stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
    },
  });

  // Delete deal
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: number) => {
      return apiRequest("DELETE", `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
      toast({
        title: "Sucesso",
        description: "Negócio excluído",
      });
    },
  });

  // Build columns from stages and deals
  useEffect(() => {
    if (stages.length === 0 && !hasInitialized) {
      initializeStagesMutation.mutate();
      return;
    }

    const columns: KanbanColumn[] = stages
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        id: stage.id.toString(),
        title: stage.title,
        color: stage.color,
        position: stage.position,
        deals: dealsData?.find((d: any) => d.stage === stage.title.toLowerCase())?.deals || [],
      }));

    setKanbanColumns(columns);
  }, [stages, dealsData, hasInitialized]);

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

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Pipeline Kanban</h1>
          <div className="flex gap-2">
            <Dialog open={isDealDialogOpen} onOpenChange={setIsDealDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setSelectedDeal(null)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Negócio
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedDeal ? "Editar Negócio" : "Novo Negócio"}
                  </DialogTitle>
                </DialogHeader>
                <DealForm
                  deal={selectedDeal}
                  onSuccess={() => {
                    setIsDealDialogOpen(false);
                    setSelectedDeal(null);
                    queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

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
                      className={`space-y-3 min-h-[200px] ${
                        snapshot.isDraggingOver ? "bg-blue-50" : ""
                      }`}
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
                              className={`${snapshot.isDragging ? "opacity-75" : ""}`}
                            >
                              <Card className="cursor-pointer hover:shadow-md transition-shadow">
                                <CardHeader className="pb-2">
                                  <div className="flex items-start justify-between">
                                    <CardTitle className="text-sm font-medium">
                                      {deal.title}
                                    </CardTitle>
                                    <div className="flex gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditDeal(deal);
                                        }}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteDealMutation.mutate(deal.id);
                                        }}
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-1 font-semibold text-green-600">
                                      <DollarSign className="w-3 h-3" />
                                      {formatCurrency(deal.value)}
                                    </div>
                                    {deal.contact && (
                                      <div className="text-gray-600">
                                        {deal.contact.name}
                                      </div>
                                    )}
                                    {deal.company && (
                                      <div className="text-gray-600">
                                        {deal.company.name}
                                      </div>
                                    )}
                                    {deal.expectedCloseDate && (
                                      <div className="text-xs text-gray-500">
                                        {new Date(deal.expectedCloseDate).toLocaleDateString("pt-BR")}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>
          ))}

          {/* Add new stage column */}
          <div className="flex-shrink-0 w-80">
            <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4">
              {isAddingStage ? (
                <div className="space-y-3">
                  <Input
                    placeholder="Nome do estágio"
                    value={newStageTitle}
                    onChange={(e) => setNewStageTitle(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddStage()}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddStage}>
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
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full h-full min-h-[100px] text-gray-500 hover:text-gray-700"
                  onClick={() => setIsAddingStage(true)}
                >
                  <Plus className="w-6 h-6 mr-2" />
                  Adicionar Estágio
                </Button>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}