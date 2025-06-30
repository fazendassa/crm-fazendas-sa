import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PipelineStage } from "@shared/schema";

export function useStageReorder(pipelineId: number) {
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStages, setReorderStages] = useState<PipelineStage[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update stage positions mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (stagesData: Array<{ id: number; position: number }>) => {
      console.log("=== MUTATION: Starting position update ===");
      console.log("Stages data to send:", JSON.stringify(stagesData, null, 2));
      
      // Validate data before sending
      if (!Array.isArray(stagesData) || stagesData.length === 0) {
        throw new Error("Dados de estágios inválidos");
      }
      
      for (const stage of stagesData) {
        if (!stage || typeof stage.id !== 'number' || typeof stage.position !== 'number') {
          console.error("Invalid stage data:", stage);
          throw new Error(`Dados inválidos do estágio: ${JSON.stringify(stage)}`);
        }
      }
      
      const payload = { stages: stagesData };
      console.log("Final payload:", JSON.stringify(payload, null, 2));
      
      const response = await fetch("/api/pipeline-stages/positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      
      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);
      
      if (!response.ok) {
        let errorText;
        try {
          const errorJson = await response.json();
          errorText = errorJson.message || JSON.stringify(errorJson);
        } catch {
          errorText = await response.text();
        }
        console.error("Server error response:", errorText);
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      console.log("Success response:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/pipeline-stages?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      setIsReorderModalOpen(false);
      toast({
        title: "Sucesso",
        description: "Ordem dos estágios atualizada",
      });
    },
    onError: (error) => {
      console.error("Error updating stage positions:", error);
      let errorMessage = 'Erro desconhecido';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as any).message;
      }
      
      toast({
        title: "Erro",
        description: `Erro ao reordenar estágios: ${errorMessage}`,
        variant: "destructive",
      });
    },
  });

  const openReorderModal = (stages: PipelineStage[]) => {
    const sortedStages = [...stages]
      .filter(stage => stage && typeof stage.id === 'number')
      .sort((a, b) => (a.position || 0) - (b.position || 0));
    
    if (sortedStages.length === 0) {
      toast({
        title: "Erro",
        description: "Nenhum estágio disponível para reordenar",
        variant: "destructive",
      });
      return;
    }
    
    setReorderStages(sortedStages);
    setIsReorderModalOpen(true);
  };

  const moveStageUp = (stageId: number) => {
    const currentIndex = reorderStages.findIndex(stage => stage.id === stageId);
    if (currentIndex > 0) {
      const newStages = [...reorderStages];
      [newStages[currentIndex - 1], newStages[currentIndex]] = [newStages[currentIndex], newStages[currentIndex - 1]];
      setReorderStages(newStages);
    }
  };

  const moveStageDown = (stageId: number) => {
    const currentIndex = reorderStages.findIndex(stage => stage.id === stageId);
    if (currentIndex >= 0 && currentIndex < reorderStages.length - 1) {
      const newStages = [...reorderStages];
      [newStages[currentIndex], newStages[currentIndex + 1]] = [newStages[currentIndex + 1], newStages[currentIndex]];
      setReorderStages(newStages);
    }
  };

  const saveStageOrder = () => {
    console.log("=== SAVE STAGE ORDER ===");
    console.log("Reorder stages:", reorderStages);
    
    if (!Array.isArray(reorderStages) || reorderStages.length === 0) {
      console.error("No stages to reorder");
      toast({
        title: "Erro",
        description: "Nenhum estágio válido para reordenar",
        variant: "destructive",
      });
      return;
    }
    
    const stagesData = reorderStages.map((stage, index) => {
      if (!stage || typeof stage.id !== 'number') {
        console.error("Invalid stage:", stage);
        throw new Error(`Estágio inválido: ${JSON.stringify(stage)}`);
      }
      
      return {
        id: stage.id,
        position: index,
      };
    });
    
    console.log("Stages data prepared:", stagesData);
    
    // Final validation
    const validStages = stagesData.filter(stage => 
      stage && 
      typeof stage.id === 'number' && 
      typeof stage.position === 'number' &&
      stage.id > 0 &&
      stage.position >= 0
    );
    
    if (validStages.length !== stagesData.length) {
      console.error("Some stages failed validation:", {
        original: stagesData,
        valid: validStages
      });
      toast({
        title: "Erro",
        description: "Alguns estágios têm dados inválidos",
        variant: "destructive",
      });
      return;
    }
    
    console.log("All validations passed, sending mutation...");
    updateStagePositionsMutation.mutate(validStages);
  };

  return {
    isReorderModalOpen,
    setIsReorderModalOpen,
    reorderStages,
    openReorderModal,
    moveStageUp,
    moveStageDown,
    saveStageOrder,
    isUpdating: updateStagePositionsMutation.isPending
  };
}