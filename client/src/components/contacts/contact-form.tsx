import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertContactSchema, type ContactWithCompany } from "@shared/schema";
import { z } from "zod";

const formSchema = insertContactSchema.extend({
  companyId: z.coerce.number().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ContactFormProps {
  contact?: ContactWithCompany | null;
  onSuccess: () => void;
}

export default function ContactForm({ contact, onSuccess }: ContactFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      name: contact?.name || '',
      email: contact?.email || '',
      phone: contact?.phone || '',
      position: contact?.position || '',
      companyId: contact?.companyId || undefined,
      status: contact?.status || 'active',
      tags: contact?.tags || [],
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (contact) {
        await apiRequest('PUT', `/api/contacts/${contact.id}`, data);
      } else {
        await apiRequest('POST', '/api/contacts', data);
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: contact ? "Contato atualizado com sucesso" : "Contato criado com sucesso",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: contact ? "Falha ao atualizar contato" : "Falha ao criar contato",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createContactMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          {...register('name')}
          className={errors.name ? 'border-red-500' : ''}
        />
        {errors.name && (
          <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className={errors.email ? 'border-red-500' : ''}
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Telefone</Label>
        <Input
          id="phone"
          {...register('phone')}
          className={errors.phone ? 'border-red-500' : ''}
        />
        {errors.phone && (
          <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="position">Cargo</Label>
        <Input
          id="position"
          {...register('position')}
          className={errors.position ? 'border-red-500' : ''}
        />
        {errors.position && (
          <p className="text-sm text-red-500 mt-1">{errors.position.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="companyId">Empresa</Label>
        <Select 
          value={watch('companyId')?.toString() || ''} 
          onValueChange={(value) => setValue('companyId', value ? parseInt(value) : undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione uma empresa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Nenhuma empresa</SelectItem>
            {companiesData?.companies?.map((company: any) => (
              <SelectItem key={company.id} value={company.id.toString()}>
                {company.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select 
          value={watch('status')} 
          onValueChange={(value) => setValue('status', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="prospect">Prospect</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
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
          disabled={createContactMutation.isPending}
        >
          {createContactMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
