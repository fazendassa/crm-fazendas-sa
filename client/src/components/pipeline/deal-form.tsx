import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertDealSchema, type DealWithRelations } from "@shared/schema";
import { z } from "zod";

const formSchema = z.object({
  title: z.string().min(1, "Título é obrigatório"),
  description: z.string().optional(),
  stage: z.string().min(1, "Estágio é obrigatório"),
  contactId: z.coerce.number().optional(),
  companyId: z.coerce.number().optional(),
  ownerId: z.string().optional(),
  value: z.string().optional(),
  expectedCloseDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DealFormProps {
  deal?: DealWithRelations | null;
  defaultStage?: string;
  pipelineId: number;
  onSuccess: () => void;
}

export default function DealForm({ deal, pipelineId, onSuccess, defaultStage }: DealFormProps) {
  console.log('DealForm rendered with pipelineId:', pipelineId);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery({
    queryKey: ['/api/contacts'],
  });

  const { data: companiesData } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: pipelineStages = [] } = useQuery<any[]>({
    queryKey: [`/api/pipelines/${pipelineId}/stages`],
    queryFn: () => apiRequest(`/api/pipelines/${pipelineId}/stages`, 'GET'),
    enabled: !!pipelineId,
  });

  const { data: usersData } = useQuery({
    queryKey: ['/api/users'],
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: deal?.title || '',
      description: deal?.description || '',
      value: deal?.value || '',
      stage: deal?.stage || defaultStage || '',
      contactId: deal?.contactId || undefined,
      companyId: deal?.companyId || undefined,
      ownerId: deal?.ownerId || undefined,
      expectedCloseDate: deal?.expectedCloseDate 
        ? new Date(deal.expectedCloseDate).toISOString().split('T')[0]
        : '',
    },
  });

  useEffect(() => {
    console.log('Pipeline stages query result:', { pipelineStages });
  }, [pipelineStages]);

  // Set default stage from prop or fallback to the first stage
  useEffect(() => {
    if (defaultStage) {
      setValue('stage', defaultStage);
    } else if (pipelineStages && pipelineStages.length > 0 && !deal) {
      const stageToSelect = pipelineStages.find(s => s.position === 0) || pipelineStages[0];
      if (stageToSelect) {
        setValue('stage', stageToSelect.title);
      }
    }
  }, [defaultStage, pipelineStages, deal, setValue]);

  const createDealMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log("=== MUTATION FUNCTION CALLED ===");
      console.log("Form data received:", data);
      console.log("Deal object:", deal);
      console.log("Pipeline ID:", pipelineId);

      // Convert form data to proper types
      const dealData = {
        ...data,
        pipelineId,
        value: data.value ? parseFloat(data.value).toString() : null,
        expectedCloseDate: data.expectedCloseDate || null,
        contactId: data.contactId || null,
        companyId: data.companyId || null,
        ownerId: data.ownerId || null,
      };

      console.log("Processed deal data:", dealData);

      if (deal && deal.id) {
        console.log("Updating existing deal with ID:", deal.id);
        return await apiRequest(`/api/deals/${deal.id}`, 'PUT', dealData);
      } else {
        console.log("Creating new deal");
        return await apiRequest(`/api/pipelines/${pipelineId}/deals`, 'POST', dealData);
      }
    },
    onSuccess: () => {
      // Invalidate multiple related queries to ensure UI updates instantly
      queryClient.invalidateQueries({ queryKey: [`/api/deals/by-stage?pipelineId=${pipelineId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      
      toast({
        title: "Sucesso",
        description: deal ? "Oportunidade atualizada com sucesso" : "Oportunidade criada com sucesso",
      });
      onSuccess();
    },
        onError: (error) => {
      console.error("Deal creation/update failed:", error);
      console.error("Deal form error:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      toast({
        title: "Erro",
        description: `${deal ? "Falha ao atualizar" : "Falha ao criar"} oportunidade: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Validation passed. Submitting data:", data);
    createDealMutation.mutate(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, (errors) => console.error("Validation Errors:", errors))}
      className="space-y-6"
    > 
      <div>
        <Label htmlFor="title">Título da Oportunidade *</Label>
        <Input
          id="title"
          {...register('title')}
          className={errors.title ? 'border-red-500' : ''}
        />
        {errors.title && (
          <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          {...register('description')}
          className={errors.description ? 'border-red-500' : ''}
          rows={3}
        />
        {errors.description && (
          <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="value">Valor (R$)</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            min="0"
            {...register('value')}
            className={errors.value ? 'border-red-500' : ''}
          />
          {errors.value && (
            <p className="text-sm text-red-500 mt-1">{errors.value.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="expectedCloseDate">Data Prevista</Label>
          <Input
            id="expectedCloseDate"
            type="date"
            {...register('expectedCloseDate')}
            className={errors.expectedCloseDate ? 'border-red-500' : ''}
          />
          {errors.expectedCloseDate && (
            <p className="text-sm text-red-500 mt-1">{errors.expectedCloseDate.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="stage">Estágio</Label>
        <Select 
          value={watch('stage')} 
          onValueChange={(value) => setValue('stage', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o estágio" />
          </SelectTrigger>
          <SelectContent>
            {pipelineStages?.map((stage: any) => (
              <SelectItem key={stage.id} value={stage.title}>
                {stage.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="contactId">Contato</Label>
        <Select 
          value={watch('contactId')?.toString() || 'none'} 
          onValueChange={(value) => setValue('contactId', value === 'none' ? undefined : parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um contato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum contato</SelectItem>
            {contactsData?.contacts?.map((contact: any) => (
              <SelectItem key={contact.id} value={contact.id.toString()}>
                {contact.name} {contact.company?.name && `(${contact.company.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="companyId">Empresa</Label>
        <Select 
          value={watch('companyId')?.toString() || 'none'} 
          onValueChange={(value) => setValue('companyId', value === 'none' ? undefined : parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma empresa</SelectItem>
            {companiesData?.companies?.map((company: any) => (
              <SelectItem key={company.id} value={company.id.toString()}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="ownerId">Responsável</Label>
        <Select 
          value={watch('ownerId') || 'none'} 
          onValueChange={(value) => setValue('ownerId', value === 'none' ? undefined : value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhum responsável</SelectItem>
            {usersData?.map((user: any) => (
              <SelectItem key={user.id} value={user.id}>
                {user.firstName && user.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user.email || user.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex space-x-2 pt-4">
        <Button 
          type="button" 
          variant="outline" 
          className="flex-1"
          onClick={onSuccess}
        >
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          disabled={createDealMutation.isPending}
          onClick={() => console.log("=== SAVE BUTTON CLICKED ===")}
        >
          {createDealMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
