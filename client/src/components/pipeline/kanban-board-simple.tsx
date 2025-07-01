import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, Settings, Users, GripVertical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";

// Sortable Deal Card Component
function SortableDealCard({ deal, usersData, onEdit, onOwnerChange }: {
  deal: DealWithRelations;
  usersData: any[];
  onEdit: (deal: DealWithRelations) => void;
  onOwnerChange: (dealId: number, ownerId: string | null) => void;
}) {
  const [ownerPopoverOpen, setOwnerPopoverOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `deal-${deal.id}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getUserInitials = (ownerId: string) => {
    const user = usersData?.find((u: any) => u.id === ownerId);
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return ownerId.substring(0, 2).toUpperCase();
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="group cursor-pointer hover:shadow-md transition-shadow bg-white mb-3"
      onClick={() => onEdit(deal)}
    >
      <CardContent className="p-3">
        <div className="space-y-3">
          {/* Drag Handle */}
          <div 
            {...listeners}
            className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>

          {/* Contact/Company Name */}
          <div className="font-medium text-base text-gray-900">
            {deal.contact ? deal.contact.name : 
             deal.company ? deal.company.name : 
             'Sem contato'}
          </div>

          {/* Deal Value */}
          {deal.value && (
            <div className="flex items-center text-green-600 font-semibold text-sm">
              <DollarSign className="h-4 w-4 mr-1" />
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(parseFloat(deal.value))}
            </div>
          )}

          {/* Owner Avatar */}
          <div className="flex items-center justify-center">
            <Popover
              open={ownerPopoverOpen}
              onOpenChange={setOwnerPopoverOpen}
            >
              <PopoverTrigger asChild>
                <div 
                  className="relative cursor-pointer group"
                  onClick={(e) => e.stopPropagation()}
                >
                  {deal.ownerId ? (
                    <Avatar className="w-10 h-10 border-2 border-gray-200 hover:border-blue-400 transition-all">
                      <AvatarFallback className="text-sm font-medium">
                        {getUserInitials(deal.ownerId)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-10 h-10 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center hover:border-blue-400 transition-all">
                      <Users className="h-4 w-4 text-gray-400" />
                    </div>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent 
                className="w-64 p-2" 
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Alterar Responsável</Label>
                  <Select
                    value={deal.ownerId || 'none'}
                    onValueChange={(value) => {
                      const newOwnerId = value === 'none' ? null : value;
                      onOwnerChange(deal.id, newOwnerId);
                      setOwnerPopoverOpen(false);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum responsável</SelectItem>
                      {usersData?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center space-x-2">
                            <Avatar className="w-4 h-4">
                              <AvatarFallback className="text-xs">
                                {getUserInitials(user.id)}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {user.firstName && user.lastName 
                                ? `${user.firstName} ${user.lastName}` 
                                : user.email || user.id}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Sortable Stage Management Component
function SortableStageItem({ stage, onMove }: { 
  stage: PipelineStage; 
  onMove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `stage-${stage.id}`,
  });

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
      className="flex items-center justify-between p-3 border rounded-lg bg-white cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
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
    </div>
  );
}

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
  const [activeDeal, setActiveDeal] = useState<DealWithRelations | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Get pipeline stages
  const { data: stages = [], isLoading: stagesLoading } = useQuery<PipelineStage[]>({
    queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`],
  });

  // Get deals by stage for this pipeline
  const { data: dealsData = [], isLoading: dealsLoading } = useQuery<{ stage: string; count: number; deals: DealWithRelations[] }[]>({
    queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`],
  });

  // Get users for owner selection
  const { data: usersData = [] } = useQuery({
    queryKey: ['/api/users'],
  });

  // Create new stage mutation
  const createStageMutation = useMutation({
    mutationFn: async (title: string) => {
      const maxPosition = stages.length > 0 ? Math.max(...stages.map(s => s.position || 0)) : -1;
      const nextPosition = maxPosition + 1;

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
    onError: (error: any) => {
      toast({
        title: "Erro ao criar estágio",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Update stage positions mutation - SIMPLIFIED
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (orderedStages: PipelineStage[]) => {
      const stageUpdates = orderedStages.map((stage, index) => ({
        id: typeof stage.id === 'string' ? parseInt(stage.id) : stage.id,
        position: index
      }));

      console.log("Sending simple stage updates:", stageUpdates);

      const response = await fetch("/api/pipeline-stages/positions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ stages: stageUpdates }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status}: ${errorText}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      setIsManagingStages(false);
      toast({
        title: "Sucesso",
        description: "Ordem dos estágios atualizada",
      });
    },
    onError: (error: any) => {
      console.error("Error updating stage positions:", error);
      toast({
        title: "Erro ao reordenar estágios",
        description: error.message || "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Update deal mutation
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
        throw new Error(`Failed to update deal: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
  });

  // Update deal owner mutation
  const updateDealOwnerMutation = useMutation({
    mutationFn: async ({ dealId, ownerId }: { dealId: number; ownerId: string | null }) => {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ ownerId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update deal owner: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      toast({
        title: "Sucesso",
        description: "Responsável atualizado",
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

  const handleOwnerChange = (dealId: number, ownerId: string | null) => {
    updateDealOwnerMutation.mutate({ dealId, ownerId });
  };

  const openStageManagement = () => {
    const sortedStages = [...stages].sort((a, b) => (a.position || 0) - (b.position || 0));
    setManagementStages(sortedStages);
    setIsManagingStages(true);
  };

  // Handle stage reordering
  const handleStageReorder = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = managementStages.findIndex(stage => `stage-${stage.id}` === active.id);
    const newIndex = managementStages.findIndex(stage => `stage-${stage.id}` === over.id);

    const newOrder = arrayMove(managementStages, oldIndex, newIndex);
    setManagementStages(newOrder);
  };

  const saveStagePositions = () => {
    updateStagePositionsMutation.mutate(managementStages);
  };

  // Handle deal drag between stages
  const handleDealDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

    const dealId = parseInt(active.id.toString().replace("deal-", ""));
    const newStageTitle = over.id.toString();

    // Find current stage
    let currentStage = '';
    for (const stageData of dealsData) {
      if (stageData.deals.some(deal => deal.id === dealId)) {
        currentStage = stageData.stage;
        break;
      }
    }

    if (currentStage !== newStageTitle) {
      updateDealMutation.mutate({ dealId, stage: newStageTitle });
    }
  };

  const handleDealDragStart = (event: DragStartEvent) => {
    const dealId = parseInt(event.active.id.toString().replace("deal-", ""));
    const deal = dealsData
      .flatMap(stage => stage.deals)
      .find(deal => deal.id === dealId);
    setActiveDeal(deal || null);
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pipeline Kanban - Versão Simples</h3>
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
          <CardContent className="p-4 space-y-4">
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
            <DialogTitle>Reordenar Estágios</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Arraste os estágios para reordená-los.
            </p>

            <DndContext
              sensors={sensors}
              onDragEnd={handleStageReorder}
            >
              <SortableContext
                items={managementStages.map(stage => `stage-${stage.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {managementStages.map((stage) => (
                    <SortableStageItem
                      key={stage.id}
                      stage={stage}
                      onMove={() => {}}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={saveStagePositions}
                disabled={updateStagePositionsMutation.isPending}
              >
                {updateStagePositionsMutation.isPending ? "Salvando..." : "Salvar Ordem"}
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

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDealDragStart}
        onDragEnd={handleDealDragEnd}
      >
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

                  {/* Drop Zone */}
                  <div
                    id={stage.title}
                    className="space-y-3 min-h-[200px] bg-gray-50 rounded-lg p-4"
                  >
                    <SortableContext
                      items={stageDeals.map(deal => `deal-${deal.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {stageDeals.map((deal) => (
                        <SortableDealCard
                          key={deal.id}
                          deal={deal}
                          usersData={usersData}
                          onEdit={handleEditDeal}
                          onOwnerChange={handleOwnerChange}
                        />
                      ))}
                    </SortableContext>

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
                </div>
              );
            })}
        </div>

        <DragOverlay>
          {activeDeal ? (
            <Card className="cursor-grabbing opacity-80 rotate-3 shadow-lg">
              <CardContent className="p-3">
                <div className="font-medium text-base text-gray-900">
                  {activeDeal.contact ? activeDeal.contact.name : 
                   activeDeal.company ? activeDeal.company.name : 
                   'Sem contato'}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>

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
              queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}