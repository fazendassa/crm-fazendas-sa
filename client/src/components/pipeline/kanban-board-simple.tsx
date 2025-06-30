
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
import { Plus, DollarSign, ArrowUpDown } from "lucide-react";
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
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStages, setReorderStages] = useState<PipelineStage[]>([]);
  

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
      const response = await fetch("/api/pipeline-stages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title,
          pipelineId,
          position: Array.isArray(stages) ? stages.length : 0,
          isDefault: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create stage: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      // Force complete cache refresh for pipeline stages
      queryClient.removeQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.removeQueries({ queryKey: ["/api/pipeline-stages"] });
      queryClient.removeQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      
      // Immediate refetch
      queryClient.refetchQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.refetchQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      
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
      // Data is already updated optimistically, just ensure all related queries are fresh
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
      // Revert optimistic update by refetching data
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Erro",
        description: `Erro ao mover oportunidade: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Update stage positions mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (stages: Array<{ id: number; position: number }>) => {
      console.log('\n=== CLIENT MUTATION: Updating stage positions ===');
      console.log('Stages to send:', JSON.stringify(stages, null, 2));
      
      const payload = { stages };
      console.log('Request payload:', JSON.stringify(payload, null, 2));
      
      const response = await fetch('/api/pipeline-stages/positions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
          console.error('Parsed error data:', errorData);
        } catch {
          errorData = { message: errorText };
        }
        
        const errorMessage = errorData.message || errorText || 'Unknown error';
        console.error('Final error message:', errorMessage);
        
        throw new Error(`Failed to update stage positions: ${response.status} - ${errorMessage}`);
      }

      const responseData = await response.json();
      console.log('✓ Success response:', responseData);
      return responseData;
    },
    onSuccess: (data) => {
      console.log('✓ CLIENT MUTATION: Success callback triggered');
      console.log('Success data:', data);
      
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      setIsReorderModalOpen(false);
      
      toast({
        title: "Sucesso",
        description: "Ordem dos estágios atualizada com sucesso",
      });
    },
    onError: (error) => {
      console.error('\n=== CLIENT MUTATION: Error callback triggered ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      toast({
        title: "Erro",
        description: `Erro ao atualizar ordem dos estágios: ${error.message}`,
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

  const handleOpenReorderModal = () => {
    if (Array.isArray(stages)) {
      const sortedStages = [...stages].sort((a, b) => a.position - b.position);
      setReorderStages(sortedStages);
      setIsReorderModalOpen(true);
    }
  };

  const handleStagePositionChange = (stageId: number, newPosition: number) => {
    console.log('handleStagePositionChange called:', { stageId, newPosition });
    
    setReorderStages(prev => {
      console.log('Previous stages:', prev);
      
      // Find the stage being updated
      const stageToUpdate = prev.find(stage => stage.id === stageId);
      if (!stageToUpdate) {
        console.error('Stage not found:', stageId);
        return prev;
      }
      
      // Create a new array without the stage being moved
      const otherStages = prev.filter(stage => stage.id !== stageId);
      
      // Insert the stage at the new position
      const newStages = [...otherStages];
      newStages.splice(newPosition, 0, { ...stageToUpdate });
      
      // Reassign sequential positions
      const finalStages = newStages.map((stage, index) => ({
        ...stage,
        position: index
      }));
      
      console.log('Final stages after reorder:', finalStages);
      
      return finalStages;
    });
  };

  const handleSaveReorder = () => {
    console.log('\n=== 1. CLIENT: VERIFICAÇÃO INICIAL ===');
    console.log('Current reorderStages:', JSON.stringify(reorderStages, null, 2));
    console.log('Tipo de reorderStages:', typeof reorderStages);
    console.log('É array:', Array.isArray(reorderStages));
    console.log('Tamanho:', reorderStages?.length);
    
    if (!Array.isArray(reorderStages) || reorderStages.length === 0) {
      console.error('❌ CLIENT ERROR: No stages to reorder');
      toast({
        title: "Erro",
        description: "Nenhum estágio para reordenar",
        variant: "destructive",
      });
      return;
    }
    
    console.log(`✓ CLIENT: Processing ${reorderStages.length} stages...`);
    
    console.log('\n=== 2. CLIENT: VERIFICAÇÃO DOS DADOS ORIGINAIS ===');
    reorderStages.forEach((stage, index) => {
      console.log(`Estágio ${index + 1}:`, {
        id: stage.id,
        title: stage.title,
        position: stage.position,
        idType: typeof stage.id,
        positionType: typeof stage.position
      });
    });
    
    console.log('\n=== 3. CLIENT: CONVERSÃO E VALIDAÇÃO ===');
    // Create the stage updates with strict integer conversion and validation
    const stageUpdates = reorderStages.map((stage, index) => {
      console.log(`\n--- CLIENT: Processing stage ${index + 1}/${reorderStages.length} ---`);
      console.log('Original stage:', stage);
      console.log('Original ID type:', typeof stage.id, 'Value:', stage.id);
      console.log('Original position type:', typeof stage.position, 'Value:', stage.position);
      
      // Force conversion to integers
      const id = Number(stage.id);
      const position = Number(stage.position);
      
      console.log('After Number() conversion:');
      console.log('- ID:', id, 'Type:', typeof id, 'IsInteger:', Number.isInteger(id));
      console.log('- Position:', position, 'Type:', typeof position, 'IsInteger:', Number.isInteger(position));
      
      if (!Number.isInteger(id) || id <= 0) {
        console.error(`❌ CLIENT ERROR: Invalid ID conversion for stage ${index + 1}:`, { original: stage.id, converted: id });
        throw new Error(`Invalid stage ID: ${stage.id}`);
      }
      
      if (!Number.isInteger(position) || position < 0) {
        console.error(`❌ CLIENT ERROR: Invalid position conversion for stage ${index + 1}:`, { original: stage.position, converted: position });
        throw new Error(`Invalid stage position: ${stage.position}`);
      }
      
      const update = { id, position };
      console.log(`✓ CLIENT: Stage ${index + 1} converted:`, update);
      return update;
    });
    
    console.log('\n=== 4. CLIENT: PAYLOAD FINAL ===');
    console.log('Stage updates to send:', JSON.stringify(stageUpdates, null, 2));
    
    console.log('\n=== 5. CLIENT: VALIDAÇÕES ADICIONAIS ===');
    const validationResults = stageUpdates.map((update, index) => {
      const idValid = Number.isInteger(update.id) && update.id > 0;
      const positionValid = Number.isInteger(update.position) && update.position >= 0;
      const valid = idValid && positionValid;
      
      console.log(`Stage ${index + 1}: ID valid=${idValid}, Position valid=${positionValid}, Overall=${valid}`);
      
      return { valid, idValid, positionValid, update };
    });
    
    const allValid = validationResults.every(result => result.valid);
    console.log('All validations passed:', allValid);
    
    if (!allValid) {
      const invalidStages = validationResults.filter(result => !result.valid);
      console.error('❌ CLIENT ERROR: Validation failed for stages:', invalidStages);
      toast({
        title: "Erro",
        description: `Dados de estágio inválidos: ${invalidStages.length} estágio(s) com erro`,
        variant: "destructive",
      });
      return;
    }
    
    console.log('\n=== 6. CLIENT: TESTE COM IDs FIXOS ===');
    // Check for duplicate positions
    const positions = stageUpdates.map(update => update.position);
    const uniquePositions = new Set(positions);
    console.log('Posições enviadas:', positions);
    console.log('Posições únicas:', Array.from(uniquePositions));
    
    if (positions.length !== uniquePositions.size) {
      console.error('❌ CLIENT ERROR: Duplicate positions detected:', positions);
      toast({
        title: "Erro",
        description: "Posições duplicadas detectadas",
        variant: "destructive",
      });
      return;
    }
    
    // Check for gaps in positions
    const sortedPositions = [...positions].sort((a, b) => a - b);
    console.log('Posições ordenadas:', sortedPositions);
    
    for (let i = 0; i < sortedPositions.length; i++) {
      if (sortedPositions[i] !== i) {
        console.error('❌ CLIENT ERROR: Position gaps detected:', sortedPositions);
        toast({
          title: "Erro",
          description: "Posições devem ser sequenciais começando em 0",
          variant: "destructive",
        });
        return;
      }
    }
    
    console.log('✅ CLIENT: All validations passed, sending mutation...');
    console.log('Final payload being sent:', JSON.stringify({ stages: stageUpdates }, null, 2));
    
    updateStagePositionsMutation.mutate(stageUpdates);
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
              onClick={handleOpenReorderModal}
              size="sm"
              variant="outline"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Reordenar Etapas
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

        {/* Kanban columns */}
        <div className="flex gap-6 overflow-x-auto pb-6">
          {Array.isArray(stages) &&
            stages
            .sort((a: any, b: any) => a.position - b.position)
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

        

        {/* Reorder stages modal */}
        <Dialog open={isReorderModalOpen} onOpenChange={setIsReorderModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reordenar Etapas do Pipeline</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Defina a ordem das etapas numerando de 1 a {reorderStages.length}:
              </p>
              {reorderStages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-3">
                  <Label className="w-4 text-sm font-medium">{index + 1}.</Label>
                  <div className="flex-1">
                    <Label className="text-sm">{stage.title}</Label>
                  </div>
                  <div className="w-20">
                    <Input
                      type="number"
                      min="1"
                      max={reorderStages.length}
                      value={stage.position + 1}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        console.log('Input value changed:', inputValue, 'for stage', stage.id);
                        
                        // Allow temporary empty state while typing
                        if (inputValue === '') {
                          return;
                        }
                        
                        const parsedValue = parseInt(inputValue, 10);
                        console.log('Parsed value:', parsedValue);
                        
                        if (isNaN(parsedValue)) {
                          console.log('NaN detected, skipping');
                          return;
                        }
                        
                        // Convert to 0-based position
                        const newPosition = parsedValue - 1;
                        console.log('New position calculated:', newPosition);
                        
                        // Allow any valid position within range
                        if (newPosition >= 0 && newPosition < reorderStages.length) {
                          handleStagePositionChange(stage.id, newPosition);
                        } else {
                          console.log('Position out of range:', { newPosition, min: 0, max: reorderStages.length - 1 });
                        }
                      }}
                      onBlur={(e) => {
                        // Reset to current position if invalid value
                        const inputValue = e.target.value;
                        if (inputValue === '') {
                          e.target.value = (stage.position + 1).toString();
                          return;
                        }
                        
                        const parsedValue = parseInt(inputValue, 10);
                        const newPosition = parsedValue - 1;
                        
                        if (
                          isNaN(parsedValue) || 
                          newPosition < 0 || 
                          newPosition >= reorderStages.length
                        ) {
                          e.target.value = (stage.position + 1).toString();
                        }
                      }}
                      className="text-center"
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleSaveReorder}
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
