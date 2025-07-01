import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "react-beautiful-dnd";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, DollarSign, ArrowUpDown, Settings, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import DealForm from "./deal-form";
import type { DealWithRelations, PipelineStage } from "@shared/schema";

interface KanbanBoardProps {
  pipelineId: number;
}

// Dynamic functions for user initials and display name using real user data
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

const getUserDisplayName = (ownerId: string) => {
  const user = usersData?.find((u: any) => u.id === ownerId);
  if (user?.firstName && user?.lastName) {
    return `${user.firstName} ${user.lastName}`;
  }
  if (user?.email) {
    return user.email;
  }
  return `User ${ownerId}`;
};

export default function KanbanBoard({ pipelineId }: KanbanBoardProps) {
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null);
  const [isDealDialogOpen, setIsDealDialogOpen] = useState(false);
  const [defaultStage, setDefaultStage] = useState<string | undefined>();
  const [isAddingStage, setIsAddingStage] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState("");
  const [isManagingStages, setIsManagingStages] = useState(false);
  const [managementStages, setManagementStages] = useState<PipelineStage[]>([]);
  const [ownerChangePopover, setOwnerChangePopover] = useState<{ dealId: number; isOpen: boolean } | null>(null);

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

  // Get users for owner selection
  const { data: usersData = [] } = useQuery({
    queryKey: ['/api/users'],
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
    onError: (error: any) => {
      console.error("Error creating stage:", error);

      const errorMessage = `
ERRO AO CRIAR ESTÁGIO:
• Mensagem: ${error.message || 'Erro desconhecido'}
• Origem: Criação de novo estágio
• Timestamp: ${new Date().toISOString()}
• Pipeline ID: ${pipelineId}
• Título do estágio: ${newStageTitle}

Detalhes técnicos:
${JSON.stringify(error, null, 2)}
      `.trim();

      toast({
        title: "Erro ao criar estágio",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  // Update stage positions mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (updatedStages: PipelineStage[]) => {
      console.log("=== FRONT-END DEBUG: Before mutationFn ===");
      console.log("Raw updatedStages:", updatedStages);
      console.log("updatedStages length:", updatedStages.length);

      // Verificar cada stage individualmente
      updatedStages.forEach((stage, index) => {
        console.log(`Stage ${index + 1}:`);
        console.log("  - Raw stage:", stage);
        console.log("  - stage.id:", stage.id);
        console.log("  - stage.id type:", typeof stage.id);
        console.log("  - stage.id is string:", typeof stage.id === 'string');
        console.log("  - stage.id is number:", typeof stage.id === 'number');
        console.log("  - stage.id toString():", stage.id.toString());
        console.log("  - Number(stage.id):", Number(stage.id));
        console.log("  - parseInt(stage.id):", parseInt(stage.id.toString()));
      });

      // Send all stage updates in a single batch request
      const stageUpdates = updatedStages.map((stage, index) => {
        const stageId = stage.id;
        const position = index;

        // Validação explícita no front-end
        if (!stageId || (typeof stageId !== 'number' && typeof stageId !== 'string')) {
          console.error(`❌ FRONT-END: Invalid stage ID detected:`, {
            stage,
            stageId,
            type: typeof stageId,
            index
          });
          throw new Error(`Invalid stage ID: ${stageId} (type: ${typeof stageId})`);
        }

        if (typeof position !== 'number' || position < 0) {
          console.error(`❌ FRONT-END: Invalid position detected:`, {
            stage,
            position,
            type: typeof position,
            index
          });
          throw new Error(`Invalid position: ${position} (type: ${typeof position})`);
        }

        const processedUpdate = {
          id: typeof stageId === 'string' ? parseInt(stageId) : stageId,
          position: position
        };

        console.log(`✅ FRONT-END: Processed stage ${index + 1}:`, processedUpdate);

        return processedUpdate;
      });

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

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }

        const detailedError = {
          status: response.status,
          statusText: response.statusText,
          message: errorData.message || "Erro desconhecido",
          url: response.url,
          method: "PUT",
          payload: stageUpdates,
          timestamp: new Date().toISOString(),
          stageCount: stageUpdates.length,
          stageIds: stageUpdates.map((s: any) => s.id),
          positions: stageUpdates.map((s: any) => s.position)
        };

        throw detailedError;
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
    onError: (error: any) => {
      console.error("Error updating stage positions:", error);

      // Criar mensagem de erro detalhada
      const errorDetails = typeof error === 'object' && error !== null ? error : { message: String(error) };

      const errorMessage = `
ERRO DETALHADO:
• Status: ${errorDetails.status || 'N/A'}
• Mensagem: ${errorDetails.message || 'Erro desconhecido'}
• URL: ${errorDetails.url || '/api/pipeline-stages/positions'}
• Método: ${errorDetails.method || 'PUT'}
• Timestamp: ${errorDetails.timestamp || new Date().toISOString()}
• Quantidade de estágios: ${errorDetails.stageCount || 'N/A'}
• IDs dos estágios: ${errorDetails.stageIds ? errorDetails.stageIds.join(', ') : 'N/A'}
• Posições: ${errorDetails.positions ? errorDetails.positions.join(', ') : 'N/A'}

Payload enviado:
${errorDetails.payload ? JSON.stringify(errorDetails.payload, null, 2) : 'N/A'}
      `.trim();

      toast({
        title: "Erro ao atualizar posições dos estágios",
        description: errorMessage,
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
    onError: (error: any) => {
      console.error("Error updating deal stage:", error);
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });

      const errorMessage = `
ERRO AO MOVER OPORTUNIDADE:
• Mensagem: ${error.message || 'Erro desconhecido'}
• Origem: Movimentação de deal no kanban
• Timestamp: ${new Date().toISOString()}
• Pipeline ID: ${pipelineId}

Detalhes técnicos:
${JSON.stringify(error, null, 2)}
      `.trim();

      toast({
        title: "Erro ao mover oportunidade",
        description: errorMessage,
        variant: "destructive",
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
        const errorData = await response.text();
        throw new Error(`Failed to update deal owner: ${response.status} ${errorData}`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      
      setOwnerChangePopover(null);
      
      toast({
        title: "Sucesso",
        description: "Responsável atualizado com sucesso",
      });
    },
    onError: (error: any) => {
      console.error("Error updating deal owner:", error);
      
      toast({
        title: "Erro ao atualizar responsável",
        description: error.message || "Erro desconhecido",
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
                                Nova posição: {index} | DB atual: {stage.position ?? 'N/A'}
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
                                className={`group cursor-pointer hover:shadow-md transition-shadow bg-white ${
                                  snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                                }`}
                                onClick={() => handleEditDeal(deal)}
                              >
                                <CardContent className="p-3">
                                  <div className="space-y-3">
                                    {/* Contact/Company Name - NO TITLE */}
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

                                    {/* Owner Avatar - Larger and Centered */}
                                    <div className="flex items-center justify-center">
                                      <Popover
                                        open={ownerChangePopover?.dealId === deal.id && ownerChangePopover.isOpen}
                                        onOpenChange={(open) => {
                                          if (open) {
                                            setOwnerChangePopover({ dealId: deal.id, isOpen: true });
                                          } else {
                                            setOwnerChangePopover(null);
                                          }
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <div className="relative cursor-pointer group">
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
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                              <Users className="h-2 w-2 text-white" />
                                            </div>
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
                                                updateDealOwnerMutation.mutate({
                                                  dealId: deal.id,
                                                  ownerId: newOwnerId
                                                });
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