import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { insertActivitySchema, type ActivityWithRelations } from "@shared/schema";
import { z } from "zod";

const formSchema = insertActivitySchema.extend({
  contactId: z.coerce.number().optional(),
  dealId: z.coerce.number().optional(),
  companyId: z.coerce.number().optional(),
  dueDate: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ActivityFormProps {
  activity?: ActivityWithRelations | null;
  onSuccess: () => void;
}

export default function ActivityForm({ activity, onSuccess }: ActivityFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: contactsData } = useQuery({
    queryKey: ['/api/contacts'],
  });

  const { data: dealsData } = useQuery({
    queryKey: ['/api/deals'],
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
      type: activity?.type || 'note',
      title: activity?.title || '',
      description: activity?.description || '',
      contactId: activity?.contactId || undefined,
      dealId: activity?.dealId || undefined,
      companyId: activity?.companyId || undefined,
      completed: activity?.completed || false,
      dueDate: activity?.dueDate 
        ? new Date(activity.dueDate).toISOString().slice(0, 16)
        : '',
      userId: activity?.userId || user?.id,
    },
  });

  const createActivityMutation = useMutation({
        mutationFn: (data: FormData) => {
      // Convert form data to proper types
      const activityData = {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        contactId: data.contactId ? Number(data.contactId) : null,
        dealId: data.dealId ? Number(data.dealId) : null,
        companyId: data.companyId ? Number(data.companyId) : null,
        userId: user?.id,
      };

      if (activity) {
        return apiRequest(`/api/activities/${activity.id}`, 'PUT', activityData);
      } else {
        return apiRequest('/api/activities', 'POST', activityData);
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: activity ? "Atividade atualizada com sucesso" : "Atividade criada com sucesso",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: activity ? "Falha ao atualizar atividade" : "Falha ao criar atividade",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createActivityMutation.mutate(data);
  };

  const activityTypes = [
    { value: 'call', label: 'Ligação' },
    { value: 'email', label: 'E-mail' },
    { value: 'meeting', label: 'Reunião' },
    { value: 'task', label: 'Tarefa' },
    { value: 'note', label: 'Nota' },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="type">Tipo de Atividade</Label>
        <Select 
          value={watch('type')} 
          onValueChange={(value) => setValue('type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            {activityTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="title">Título *</Label>
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

      {watch('type') === 'task' && (
        <div>
          <Label htmlFor="dueDate">Data de Vencimento</Label>
          <Input
            id="dueDate"
            type="datetime-local"
            {...register('dueDate')}
            className={errors.dueDate ? 'border-red-500' : ''}
          />
          {errors.dueDate && (
            <p className="text-sm text-red-500 mt-1">{errors.dueDate.message}</p>
          )}
        </div>
      )}

      <div>
        <Label htmlFor="contactId">Contato</Label>
        <Select 
          value={watch('contactId')?.toString() || ''} 
          onValueChange={(value) => setValue('contactId', value ? parseInt(value) : undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione um contato (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nenhum contato</SelectItem>
            {contactsData?.contacts?.map((contact: any) => (
              <SelectItem key={contact.id} value={contact.id.toString()}>
                {contact.name} {contact.company?.name && `(${contact.company.name})`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="dealId">Oportunidade</Label>
        <Select 
          value={watch('dealId')?.toString() || ''} 
          onValueChange={(value) => setValue('dealId', value ? parseInt(value) : undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma oportunidade (opcional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nenhuma oportunidade</SelectItem>
            {dealsData?.map((deal: any) => (
              <SelectItem key={deal.id} value={deal.id.toString()}>
                {deal.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="companyId">Empresa</Label>
        <Select 
          value={watch('companyId')?.toString() || ''} 
          onValueChange={(value) => setValue('companyId', value ? parseInt(value) : undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma empresa (opcional)" />
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

      {watch('type') === 'task' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id="completed"
            checked={watch('completed')}
            onCheckedChange={(checked) => setValue('completed', checked as boolean)}
          />
          <Label htmlFor="completed">Marcar como concluída</Label>
        </div>
      )}

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
          disabled={createActivityMutation.isPending}
        >
          {createActivityMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
