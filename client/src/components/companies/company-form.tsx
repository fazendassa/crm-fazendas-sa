import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertCompanySchema, type Company } from "@shared/schema";
import { z } from "zod";

type FormData = z.infer<typeof insertCompanySchema>;

interface CompanyFormProps {
  company?: Company | null;
  onSuccess: () => void;
}

export default function CompanyForm({ company, onSuccess }: CompanyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(insertCompanySchema),
    defaultValues: {
      name: company?.name || '',
      sector: company?.sector || '',
      location: company?.location || '',
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: (data: FormData) => {
      if (company) {
        return apiRequest(`/api/companies/${company.id}`, 'PUT', data).then(() => {});
      } else {
        return apiRequest('/api/companies', 'POST', data).then(() => {});
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: company ? "Empresa atualizada com sucesso" : "Empresa criada com sucesso",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: company ? "Falha ao atualizar empresa" : "Falha ao criar empresa",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createCompanyMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome da Empresa *</Label>
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
        <Label htmlFor="sector">Setor</Label>
        <Input
          id="sector"
          {...register('sector')}
          className={errors.sector ? 'border-red-500' : ''}
        />
        {errors.sector && (
          <p className="text-sm text-red-500 mt-1">{errors.sector.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="location">Localização</Label>
        <Input
          id="location"
          {...register('location')}
          className={errors.location ? 'border-red-500' : ''}
        />
        {errors.location && (
          <p className="text-sm text-red-500 mt-1">{errors.location.message}</p>
        )}
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
          disabled={createCompanyMutation.isPending}
        >
          {createCompanyMutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
