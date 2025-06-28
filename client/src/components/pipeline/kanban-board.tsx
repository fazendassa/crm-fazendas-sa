import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "react-beautiful-dnd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, GripVertical, MoreVertical, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type DealWithRelations, type PipelineStage } from "@shared/schema";
import DealForm from "./deal-form";

interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  position: number;
  deals: DealWithRelations[];
}

export default function KanbanBoard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [editingDeal, setEditingDeal] = useState<DealWithRelations | null>(null);
  const [showDealForm, setShowDealForm] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>("");

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery<PipelineStage[]>({
    queryKey: ["/api/pipeline-stages"],
  });

  // Fetch deals by stage
  const { data: dealsData } = useQuery({
    queryKey: ["/api/deals/by-stage"],
  });

  // Initialize default stages if none exist
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
        await apiRequest("/api/pipeline-stages", {
          method: "POST",
          body: JSON.stringify(stage),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
    },
  });

  // Create new stage
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxPosition = Math.max(...stages.map(s => s.position), -1);
      return apiRequest("/api/pipeline-stages", {
        method: "POST",
        body: JSON.stringify({
          title,
          position: maxPosition + 1,
          color: "#3b82f6",
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      setIsAddingStage(false);
      setNewStageTitle("");
      toast({
        title: "Etapa criada",
        description: "Nova etapa adicionada ao pipeline.",
      });
    },
  });

  // Delete stage
  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: number) => {
      return apiRequest(`/api/pipeline-stages/${stageId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline-stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
      toast({
        title: "Etapa excluída",
        description: "Etapa removida do pipeline.",
      });
    },
  });

  // Update deal stage
  const updateDealMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: number; stage: string }) => {
      return apiRequest(`/api/deals/${dealId}`, {
        method: "PUT",
        body: JSON.stringify({ stage }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
    },
  });

  // Delete deal
  const deleteDealMutation = useMutation({
    mutationFn: async (dealId: number) => {
      return apiRequest(`/api/deals/${dealId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
      toast({
        title: "Negócio excluído",
        description: "Negócio removido do pipeline.",
      });
    },
  });

  // Update stage positions after drag
  const updatePositionsMutation = useMutation({
    mutationFn: async (stages: Array<{ id: number; position: number }>) => {
      return apiRequest("/api/pipeline-stages/positions", {
        method: "PUT",
        body: JSON.stringify({ stages }),
      });
    },
  });

  // Build columns from stages and deals
  useEffect(() => {
    if (stages.length === 0) {
      // Initialize default stages if none exist
      initializeStagesMutation.mutate();
      return;
    }

    const stageDealsMap: { [key: string]: DealWithRelations[] } = {};
    
    if (dealsData && Array.isArray(dealsData)) {
      dealsData.forEach((stageGroup: any) => {
        stageDealsMap[stageGroup.stage] = stageGroup.deals || [];
      });
    }

    const newColumns: KanbanColumn[] = stages.map(stage => ({
      id: stage.title.toLowerCase(),
      title: stage.title,
      color: stage.color || "#3b82f6",
      position: stage.position,
      deals: stageDealsMap[stage.title.toLowerCase()] || [],
    }));

    setColumns(newColumns.sort((a, b) => a.position - b.position));
  }, [stages, dealsData]);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (type === "COLUMN") {
      // Reorder columns
      const newColumns = Array.from(columns);
      const [reorderedColumn] = newColumns.splice(source.index, 1);
      newColumns.splice(destination.index, 0, reorderedColumn);

      // Update positions
      const updatedStages = newColumns.map((col, index) => {
        const stage = stages.find(s => s.title.toLowerCase() === col.id);
        return stage ? { id: stage.id, position: index } : null;
      }).filter(Boolean) as Array<{ id: number; position: number }>;

      updatePositionsMutation.mutate(updatedStages);
      setColumns(newColumns);
      return;
    }

    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    // Move deal between columns
    const sourceColumn = columns.find(col => col.id === source.droppableId);
    const destColumn = columns.find(col => col.id === destination.droppableId);

    if (!sourceColumn || !destColumn) return;

    const deal = sourceColumn.deals[source.index];
    if (!deal) return;

    // Update deal stage in database
    updateDealMutation.mutate({
      dealId: deal.id,
      stage: destColumn.title.toLowerCase(),
    });
  };

  const handleAddStage = () => {
    if (newStageTitle.trim()) {
      createStageMutation.mutate(newStageTitle.trim());
    }
  };

  const handleDeleteStage = (stageTitle: string) => {
    const stage = stages.find(s => s.title === stageTitle);
    if (stage) {
      deleteStageMutation.mutate(stage.id);
    }
  };

  const handleAddDeal = (stageId: string) => {
    const stage = columns.find(col => col.id === stageId);
    if (stage) {
      setSelectedStage(stage.title.toLowerCase());
      setEditingDeal(null);
      setShowDealForm(true);
    }
  };

  const handleEditDeal = (deal: DealWithRelations) => {
    setEditingDeal(deal);
    setShowDealForm(true);
  };

  const handleDeleteDeal = (dealId: number) => {
    deleteDealMutation.mutate(dealId);
  };

  const formatCurrency = (value: string | null) => {
    if (!value) return "R$ 0,00";
    const num = parseFloat(value);
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipeline de Vendas</h1>
          <p className="text-muted-foreground">
            Gerencie seus negócios com drag-and-drop
          </p>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="board" direction="horizontal" type="COLUMN">
          {(provided) => (
            <div
              className="flex gap-6 overflow-x-auto pb-4"
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {columns.map((column, index) => (
                <Draggable
                  key={column.id}
                  draggableId={column.id}
                  index={index}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={`min-w-80 bg-muted/50 rounded-lg p-4 ${
                        snapshot.isDragging ? "shadow-lg" : ""
                      }`}
                    >
                      {/* Column Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab"
                          >
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <h3 className="font-semibold text-lg">
                            {column.title}
                          </h3>
                          <Badge variant="secondary">
                            {column.deals.length}
                          </Badge>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem
                              onClick={() => handleAddDeal(column.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar negócio
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeleteStage(column.title)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir etapa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Column Content */}
                      <Droppable droppableId={column.id} type="DEAL">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`space-y-3 min-h-32 ${
                              snapshot.isDraggingOver ? "bg-muted/30 rounded-md" : ""
                            }`}
                          >
                            {column.deals.map((deal, index) => (
                              <Draggable
                                key={deal.id}
                                draggableId={deal.id.toString()}
                                index={index}
                              >
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`cursor-grab ${
                                      snapshot.isDragging ? "shadow-lg rotate-2" : ""
                                    }`}
                                  >
                                    <CardHeader className="pb-2">
                                      <div className="flex items-start justify-between">
                                        <CardTitle className="text-sm font-medium leading-tight">
                                          {deal.title}
                                        </CardTitle>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0"
                                            >
                                              <MoreVertical className="h-3 w-3" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent>
                                            <DropdownMenuItem
                                              onClick={() => handleEditDeal(deal)}
                                            >
                                              <Edit className="h-4 w-4 mr-2" />
                                              Editar
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                              onClick={() => handleDeleteDeal(deal.id)}
                                              className="text-destructive"
                                            >
                                              <X className="h-4 w-4 mr-2" />
                                              Excluir
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    </CardHeader>
                                    <CardContent className="pt-0">
                                      <div className="space-y-2 text-sm">
                                        <div className="font-semibold text-primary">
                                          {formatCurrency(deal.value)}
                                        </div>
                                        {deal.contact && (
                                          <div className="text-muted-foreground">
                                            👤 {deal.contact.name}
                                          </div>
                                        )}
                                        {deal.company && (
                                          <div className="text-muted-foreground">
                                            🏢 {deal.company.name}
                                          </div>
                                        )}
                                        {deal.expectedCloseDate && (
                                          <div className="text-muted-foreground">
                                            📅 {new Date(deal.expectedCloseDate).toLocaleDateString('pt-BR')}
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
                              className="w-full border-2 border-dashed"
                              onClick={() => handleAddDeal(column.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Adicionar negócio
                            </Button>
                          </div>
                        )}
                      </Droppable>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}

              {/* Add New Stage */}
              <div className="min-w-80">
                {isAddingStage ? (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <div className="space-y-3">
                      <Input
                        placeholder="Nome da etapa"
                        value={newStageTitle}
                        onChange={(e) => setNewStageTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddStage();
                          if (e.key === "Escape") setIsAddingStage(false);
                        }}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleAddStage}>
                          Adicionar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setIsAddingStage(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full h-32 border-2 border-dashed"
                    onClick={() => setIsAddingStage(true)}
                  >
                    <Plus className="h-6 w-6 mr-2" />
                    Nova Etapa
                  </Button>
                )}
              </div>
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Deal Form Dialog */}
      <Dialog open={showDealForm} onOpenChange={setShowDealForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? "Editar Negócio" : "Novo Negócio"}
            </DialogTitle>
          </DialogHeader>
          <DealForm
            deal={editingDeal}
            defaultStage={selectedStage}
            onSuccess={() => {
              setShowDealForm(false);
              setEditingDeal(null);
              queryClient.invalidateQueries({ queryKey: ["/api/deals/by-stage"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}