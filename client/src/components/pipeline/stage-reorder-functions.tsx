import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { PipelineStage } from "@shared/schema";

export function useStageReorder(pipelineId: number) {
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [reorderStages, setReorderStages] = useState<PipelineStage[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple position update mutation
  const updateStagePositionsMutation = useMutation({
    mutationFn: async (stagesData: Array<{ id: number; position: number }>) => {
      const response = await fetch("/api/pipeline-stages/positions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stages: stagesData }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ${response.status}: ${errorText}`);
      }

      return response.json();
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
      toast({
        title: "Erro",
        description: `Erro ao reordenar estágios: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    },
  });

  const openReorderModal = (stages: PipelineStage[]) => {
    const sortedStages = [...stages].sort((a, b) => a.position - b.position);
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
    const stagesData = reorderStages.map((stage, index) => ({
      id: stage.id,
      position: index,
    }));

    updateStagePositionsMutation.mutate(stagesData);
  };

  return {
    isReorderModalOpen,
    setIsReorderModalOpen,
    reorderStages,
    openReorderModal,
    moveStageUp,
    moveStageDown,
    saveStageOrder,
    isUpdating: updateStagePositionsMutation.isPending,
  };
}