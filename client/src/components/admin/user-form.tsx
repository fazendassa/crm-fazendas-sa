import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { z } from "zod";

const userFormSchema = z.object({
  email: z.string().email("E-mail inválido"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  role: z.enum(['admin', 'user']),
});

type FormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  user?: User | null;
  onSuccess: () => void;
}

export default function UserForm({ user, onSuccess }: UserFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: user?.email || '',
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      role: user?.role || 'user',
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Note: This is a placeholder since user management endpoints aren't fully implemented
      // In a real implementation, you would have proper user creation/update endpoints
      if (user) {
        // Update user endpoint would go here
        throw new Error("Atualização de usuários não implementada ainda");
      } else {
        // Create user endpoint would go here
        throw new Error("Criação de usuários não implementada ainda");
      }
    },
    onSuccess: () => {
      toast({
        title: "Sucesso",
        description: user ? "Usuário atualizado com sucesso" : "Usuário criado com sucesso",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Funcionalidade não disponível",
        description: "O gerenciamento de usuários será implementado em breve",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createUserMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="text-center mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          Esta funcionalidade está em desenvolvimento. O gerenciamento completo de usuários será implementado em breve.
        </p>
      </div>

      <div>
        <Label htmlFor="email">E-mail *</Label>
        <Input
          id="email"
          type="email"
          {...register('email')}
          className={errors.email ? 'border-red-500' : ''}
          disabled
        />
        {errors.email && (
          <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="firstName">Nome *</Label>
          <Input
            id="firstName"
            {...register('firstName')}
            className={errors.firstName ? 'border-red-500' : ''}
            disabled
          />
          {errors.firstName && (
            <p className="text-sm text-red-500 mt-1">{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="lastName">Sobrenome *</Label>
          <Input
            id="lastName"
            {...register('lastName')}
            className={errors.lastName ? 'border-red-500' : ''}
            disabled
          />
          {errors.lastName && (
            <p className="text-sm text-red-500 mt-1">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="role">Função</Label>
        <Select 
          value={watch('role')} 
          onValueChange={(value) => setValue('role', value as 'admin' | 'user')}
          disabled
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a função" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
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
          disabled={true}
        >
          Salvar (Em breve)
        </Button>
      </div>
    </form>
  );
}
