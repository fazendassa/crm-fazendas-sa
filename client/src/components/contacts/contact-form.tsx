
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertContactSchema, type ContactWithCompany } from "@shared/schema";
import { z } from "zod";
import { Plus, X, User, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [selectedTags, setSelectedTags] = React.useState<string[]>(contact?.tags || []);
  const [newTag, setNewTag] = React.useState("");

  const { data: companiesData } = useQuery({
    queryKey: ['/api/companies'],
  });

  const { data: availableTags } = useQuery({
    queryKey: ["/api/contacts/tags"],
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
      street: contact?.street || '',
      city: contact?.city || '',
      state: contact?.state || '',
      zipCode: contact?.zipCode || '',
      country: contact?.country || 'Brasil',
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Convert "none" to null for companyId
      const submitData = {
        ...data,
        companyId: data.companyId === 'none' ? null : data.companyId ? parseInt(data.companyId) : null,
        tags: selectedTags
      };

      if (contact) {
        await apiRequest('PUT', `/api/contacts/${contact.id}`, submitData);
      } else {
        await apiRequest('POST', '/api/contacts', submitData);
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

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const addExistingTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="main" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Dados Principais
          </TabsTrigger>
          <TabsTrigger value="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Endereço
          </TabsTrigger>
        </TabsList>

        <TabsContent value="main" className="space-y-4 mt-4">
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

          <div className="grid grid-cols-2 gap-4">
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
          </div>

          <div className="grid grid-cols-2 gap-4">
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
                <SelectItem value="none">Nenhuma empresa</SelectItem>
                {companiesData?.companies?.map((company: any) => (
                  <SelectItem key={company.id} value={company.id.toString()}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags Section */}
          <div className="space-y-2">
            <Label>Tags (Opcional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nova tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              />
              <Button type="button" onClick={addTag} size="sm" variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                    {tag}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeTag(tag)}
                      className="h-4 w-4 p-0 hover:bg-transparent"
                    >
                      <X className="h-2 w-2" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}

            {availableTags && Array.isArray(availableTags) && availableTags.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tags existentes:</Label>
                <div className="flex flex-wrap gap-1">
                  {(availableTags as string[]).map((tag: string) => (
                    <Button
                      key={tag}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addExistingTag(tag)}
                      className="h-6 text-xs"
                      disabled={selectedTags.includes(tag)}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="address" className="space-y-4 mt-4">
          <div>
            <Label htmlFor="street">Rua/Endereço</Label>
            <Input
              id="street"
              {...register('street')}
              placeholder="Ex: Rua das Flores, 123"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                {...register('city')}
                placeholder="Ex: São Paulo"
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                {...register('state')}
                placeholder="Ex: SP"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="zipCode">CEP</Label>
              <Input
                id="zipCode"
                {...register('zipCode')}
                placeholder="Ex: 01234-567"
              />
            </div>
            <div>
              <Label htmlFor="country">País</Label>
              <Input
                id="country"
                {...register('country')}
                placeholder="Brasil"
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex space-x-2 pt-4 border-t">
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
