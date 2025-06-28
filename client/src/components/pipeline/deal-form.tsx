import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertDealSchema, type DealWithRelations } from "@shared/schema";
import { z } from "zod";

const formSchema = insertDealSchema.extend({
  contactId: z.coerce.number().optional(),
  companyId: z.coerce.number().optional(),
  value: z.string().optional(),
  expectedCloseDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface DealFormProps {
  deal?: DealWithRelations | null;
  onSuccess: () => void;
}

export default function DealForm({ deal, onSuccess }: DealFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery({
    queryKey: ['/api/contacts'],
  });

  const { data: companiesData } = useQuery({
    queryKey: ['/api/companies'],
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
      stage: deal?.stage || 'prospecting',
      contactId: deal?.contactId || undefined,
      companyId: deal?.companyId || undefined,
      expectedCloseDate: deal?.expectedCloseDate 
        ? new Date(deal.expectedCloseDate).toISOString().split('T')[0]
        : '',
    },
  });

  const createDealMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert form data to proper types
      const dealData = {
        ...data,
        value: data.value ? parseFloat(data.value).toString() : null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate + 'T00:00:00.000Z') : null,
        contactId: data.contactId || null,
        companyId: data.companyId || null,
      };

      if (deal) {
        await apiRequest('PUT', `/api/deals/${deal.id}`, dealData);
      } else {
        await apiRequest('POST', '/api/deals', dealData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: deal ? "Oportunidade atualizada com sucesso" : "Oportunidade criada com sucesso",
      });
      onSuccess();
    },
    onError: (error) => {
      console.error("Deal form error:", error);
      toast({
        title: "Erro",
        description: deal ? "Falha ao atualizar oportunidade" : "Falha ao criar oportunidade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log("Form data before submission:", data);
    console.log("Form errors:", errors);
    createDealMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <SelectItem value="prospecting">Prospecção</SelectItem>
            <SelectItem value="qualification">Qualificação</SelectItem>
            <SelectItem value="proposal">Proposta</SelectItem>
            <SelectItem value="closing">Fechamento</SelectItem>
            <SelectItem value="won">Ganho</SelectItem>
            <SelectItem value="lost">Perdido</SelectItem>
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
        >
          {createDealMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
