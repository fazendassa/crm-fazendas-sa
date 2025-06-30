// This file is no longer needed since stages are automatically ordered by position field
// The kanban board now sorts stages by position automatically without manual reordering

export function useStageReorder(pipelineId: number) {
  // Legacy hook kept for compatibility - stages are now auto-ordered by position
  return {
    isReorderModalOpen: false,
    setIsReorderModalOpen: () => {},
    reorderStages: [],
    openReorderModal: () => {},
    moveStageUp: () => {},
    moveStageDown: () => {},
    saveStageOrder: () => {},
    isUpdating: false,
    updateStagePositionsMutation: { isPending: false }
  };
}