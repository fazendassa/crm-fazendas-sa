import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Edit, Trash2 } from "lucide-react";
import KanbanBoard from "@/components/pipeline/kanban-board-simple";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertPipelineSchema, type Pipeline } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

type FormData = z.infer<typeof insertPipelineSchema>;

export default function Pipeline() {
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<Pipeline | null>(null);
  const { toast } = useToast();

  const { data: pipelines = [], isLoading: pipelinesLoading } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(insertPipelineSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const createPipelineMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/pipelines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      setIsCreateModalOpen(false);
      form.reset();
      toast({
        title: "Sucesso",
        description: "Pipeline criado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao criar pipeline",
        variant: "destructive",
      });
    },
  });

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      return await apiRequest("PUT", `/api/pipelines/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      setIsEditModalOpen(false);
      setEditingPipeline(null);
      toast({
        title: "Sucesso",
        description: "Pipeline atualizado com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao atualizar pipeline",
        variant: "destructive",
      });
    },
  });

  const deletePipelineMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipelines"] });
      if (selectedPipelineId === deletePipelineMutation.variables) {
        setSelectedPipelineId(null);
      }
      toast({
        title: "Sucesso",
        description: "Pipeline removido com sucesso!",
      });
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: "Erro ao remover pipeline",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createPipelineMutation.mutate(data);
  };

  const handleEditPipeline = (pipeline: Pipeline) => {
    setEditingPipeline(pipeline);
    form.reset({
      name: pipeline.name,
      description: pipeline.description || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdatePipeline = (data: FormData) => {
    if (editingPipeline) {
      updatePipelineMutation.mutate({ id: editingPipeline.id, data });
    }
  };

  const handleDeletePipeline = (id: number) => {
    deletePipelineMutation.mutate(id);
  };

  // Set default pipeline if none selected
  if (!selectedPipelineId && pipelines.length > 0) {
    setSelectedPipelineId(pipelines[0].id);
  }

  if (pipelinesLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pipeline de Vendas</h1>
        <div className="flex items-center gap-4">
          <Select 
            value={selectedPipelineId?.toString() || ""} 
            onValueChange={(value) => setSelectedPipelineId(parseInt(value))}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecionar Pipeline" />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((pipeline) => (
                <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                  {pipeline.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Pipeline Management Buttons */}
          {selectedPipelineId && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const pipeline = pipelines.find(p => p.id === selectedPipelineId);
                  if (pipeline) handleEditPipeline(pipeline);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja excluir este pipeline? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleDeletePipeline(selectedPipelineId)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pipeline
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Novo Pipeline</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="Nome do pipeline"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    {...form.register("description")}
                    placeholder="Descrição do pipeline"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createPipelineMutation.isPending}>
                    {createPipelineMutation.isPending ? "Criando..." : "Criar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Pipeline Modal */}
          <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Editar Pipeline</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleUpdatePipeline)} className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    {...form.register("name")}
                    placeholder="Nome do pipeline"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit-description">Descrição</Label>
                  <Input
                    id="edit-description"
                    {...form.register("description")}
                    placeholder="Descrição do pipeline"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={updatePipelineMutation.isPending}>
                    {updatePipelineMutation.isPending ? "Atualizando..." : "Atualizar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {pipelines.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum Pipeline Encontrado</CardTitle>
            <CardDescription>
              Crie seu primeiro pipeline para começar a gerenciar negócios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Primeiro Pipeline
            </Button>
          </CardContent>
        </Card>
      ) : selectedPipelineId ? (
        <KanbanBoard pipelineId={selectedPipelineId} />
      ) : null}
    </div>
  );
}