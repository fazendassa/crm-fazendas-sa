
// This file has been replaced by integrated stage management functionality
// in kanban-board-simple.tsx. Stage positions are now managed through
// a dedicated modal with drag and drop reordering.

export function useStageReorder() {
  // Legacy compatibility - functionality moved to main kanban component
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
