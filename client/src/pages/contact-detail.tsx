
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Edit, MapPin, Building, User, Tag, GitMerge } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import ContactForm from "@/components/contacts/contact-form";
import type { ContactWithCompany, DealWithRelations } from "@shared/schema";

export default function ContactDetail() {
  const [, params] = useRoute("/contacts/:id");
  const contactId = params?.id ? parseInt(params.id) : null;
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contact, isLoading } = useQuery({
    queryKey: ['/api/contacts', contactId],
    queryFn: () => apiRequest('GET', `/api/contacts/${contactId}`),
    enabled: !!contactId,
  });

  const { data: contactDeals } = useQuery({
    queryKey: ['/api/deals', { contactId }],
    queryFn: () => apiRequest('GET', `/api/deals?contactId=${contactId}`),
    enabled: !!contactId,
  });

  const { data: pipelines } = useQuery({
    queryKey: ['/api/pipelines'],
  });

  if (isLoading) {
    return <div className="p-6">Carregando...</div>;
  }

  if (!contact) {
    return <div className="p-6">Contato não encontrado</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Ativo</Badge>;
      case 'prospect':
        return <Badge className="bg-yellow-100 text-yellow-800">Prospect</Badge>;
      default:
        return <Badge variant="secondary">Inativo</Badge>;
    }
  };

  const getRelatedPipelines = () => {
    if (!contactDeals?.length || !pipelines?.length) return [];
    
    const pipelineIds = [...new Set(contactDeals.map((deal: DealWithRelations) => deal.pipelineId))];
    return pipelines.filter((pipeline: any) => pipelineIds.includes(pipeline.id));
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="h-12 w-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {contact.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{contact.name}</h1>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusBadge(contact.status)}
              {contact.position && (
                <Badge variant="outline">{contact.position}</Badge>
              )}
            </div>
          </div>
        </div>
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Contato</DialogTitle>
            </DialogHeader>
            <ContactForm
              contact={contact}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ['/api/contacts', contactId] });
                toast({
                  title: "Sucesso",
                  description: "Contato atualizado com sucesso",
                });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Informações</TabsTrigger>
          <TabsTrigger value="address">Endereço</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Nome</label>
                  <p className="text-lg">{contact.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">{getStatusBadge(contact.status)}</div>
                </div>
                {contact.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">E-mail</label>
                    <p className="text-lg">{contact.email}</p>
                  </div>
                )}
                {contact.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Telefone</label>
                    <p className="text-lg">{contact.phone}</p>
                  </div>
                )}
                {contact.position && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Cargo</label>
                    <p className="text-lg">{contact.position}</p>
                  </div>
                )}
                {contact.company && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Empresa</label>
                    <p className="text-lg flex items-center">
                      <Building className="h-4 w-4 mr-2" />
                      {contact.company.name}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Tab */}
        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.street || contact.city || contact.state ? (
                <div className="space-y-2">
                  {contact.street && <p>{contact.street}</p>}
                  <p>
                    {[contact.city, contact.state, contact.zipCode].filter(Boolean).join(', ')}
                  </p>
                  {contact.country && <p>{contact.country}</p>}
                </div>
              ) : (
                <p className="text-gray-500">Nenhum endereço cadastrado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Tag className="h-5 w-5 mr-2" />
                Tags
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contact.tags && contact.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {contact.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500">Nenhuma tag atribuída</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipelines Tab */}
        <TabsContent value="pipelines">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <GitMerge className="h-5 w-5 mr-2" />
                Pipelines Relacionados
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getRelatedPipelines().length > 0 ? (
                <div className="space-y-4">
                  {getRelatedPipelines().map((pipeline: any) => {
                    const pipelineDeals = contactDeals?.filter(
                      (deal: DealWithRelations) => deal.pipelineId === pipeline.id
                    ) || [];
                    
                    return (
                      <div key={pipeline.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg">{pipeline.name}</h3>
                        {pipeline.description && (
                          <p className="text-gray-600 mt-1">{pipeline.description}</p>
                        )}
                        <div className="mt-3">
                          <p className="text-sm font-medium text-gray-500 mb-2">
                            Oportunidades ({pipelineDeals.length})
                          </p>
                          {pipelineDeals.map((deal: DealWithRelations) => (
                            <div key={deal.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                              <div>
                                <p className="font-medium">{deal.title}</p>
                                <p className="text-sm text-gray-600">Estágio: {deal.stage}</p>
                              </div>
                              {deal.value && (
                                <Badge variant="outline">
                                  R$ {parseFloat(deal.value).toLocaleString('pt-BR')}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500">Nenhum pipeline relacionado</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
