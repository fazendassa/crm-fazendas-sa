import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Copy, ExternalLink, Trash2, Settings, Webhook, Database, Tag, Plus, ArrowLeft, ArrowRight, X, Building, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ActiveCampaignConfig {
  id: number;
  activeCampaignApiUrl: string;
  pipelineId: number;
  defaultTags: string[];
  isActive: boolean;
  webhookSecret?: string;
  fieldMapping: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

interface Pipeline {
  id: number;
  name: string;
  description?: string;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const wizardSteps: WizardStep[] = [
  { id: 1, title: "Introdução", description: "Informações sobre a integração" },
  { id: 2, title: "Criação", description: "Configurar webhook no ActiveCampaign" },
  { id: 3, title: "Mapeamento", description: "Mapear campos de dados" },
  { id: 4, title: "Configuração", description: "Finalizar configuração" }
];

const defaultFieldMapping = {
  first_name: "Nome",
  last_name: "Sobrenome", 
  email: "Email",
  phone: "Telefone",
  city: "Cidade",
  position: "Cargo"
};

export default function ActiveCampaignConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [wizardData, setWizardData] = useState({
    apiUrl: "",
    apiKey: "",
    pipelineId: "",
    tags: [] as string[],
    fieldMapping: { ...defaultFieldMapping },
    webhookType: "deal", // deal or contact
    defaultStage: "",
    defaultStatus: "active"
  });

  // Form state
  const [tagsInput, setTagsInput] = useState("");

  // Fetch configurations
  const [selectedConfig, setSelectedConfig] = useState<ActiveCampaignConfig | null>(null);
  const { data: configs = [], isLoading: configsLoading } = useQuery<ActiveCampaignConfig[]>({
    queryKey: ["/api/integrations/activecampaign/configs"],
    retry: false,
  });

  // Fetch pipelines
  const { data: pipelines = [] } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  // Fetch available tags
  const { data: availableTags = [] } = useQuery<string[]>({
    queryKey: ["/api/contacts/tags"],
  });

  // Fetch webhook logs for recent activity - moved to top to prevent conditional hook rendering
  const { data: logs = [], isLoading: logsLoading } = useQuery<any[]>({
    queryKey: ["/api/integrations/activecampaign/logs"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Create configuration mutation
  const createConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      return fetch("/api/integrations/activecampaign/configs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to create config");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Integração criada",
        description: "Webhook configurado com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/activecampaign/configs"] });
      setIsWizardOpen(false);
      resetWizard();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar integração",
        description: error.message || "Falha ao criar configuração",
        variant: "destructive",
      });
    },
  });

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      return fetch(`/api/integrations/activecampaign/configs/${id}`, {
        method: "DELETE",
        credentials: "include",
      }).then(res => {
        if (!res.ok) throw new Error("Failed to delete config");
        return res.ok;
      });
    },
    onSuccess: () => {
      toast({
        title: "Integração removida",
        description: "Configuração deletada com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/activecampaign/configs"] });
    },
  });

  const resetWizard = () => {
    setCurrentStep(1);
    setWizardData({
      apiUrl: "",
      apiKey: "",
      pipelineId: "",
      tags: [],
      fieldMapping: { ...defaultFieldMapping },
      webhookType: "deal",
      defaultStage: "",
      defaultStatus: "active"
    });
    setTagsInput("");
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleFinish = () => {
    if (!wizardData.apiUrl || !wizardData.apiKey || !wizardData.pipelineId) {
      toast({
        title: "Campos obrigatórios",
        description: "URL da API, Chave da API e Pipeline são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    createConfigMutation.mutate({
      activeCampaignApiUrl: wizardData.apiUrl,
      activeCampaignApiKey: wizardData.apiKey,
      pipelineId: parseInt(wizardData.pipelineId),
      defaultTags: wizardData.tags,
      fieldMapping: wizardData.fieldMapping,
      webhookType: wizardData.webhookType,
      defaultStage: wizardData.defaultStage,
      defaultStatus: wizardData.defaultStatus
    });
  };

  const handleAddTag = () => {
    if (tagsInput.trim() && !wizardData.tags.includes(tagsInput.trim())) {
      setWizardData(prev => ({
        ...prev,
        tags: [...prev.tags, tagsInput.trim()]
      }));
      setTagsInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setWizardData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }));
  };

  const handleRemoveField = (fieldKey: string) => {
    setWizardData(prev => {
      const newFieldMapping = { ...prev.fieldMapping };
      delete newFieldMapping[fieldKey];
      return {
        ...prev,
        fieldMapping: newFieldMapping
      };
    });
  };

  const handleAddCustomField = () => {
    const newFieldName = prompt("Digite o nome do campo no ActiveCampaign:");
    if (newFieldName && newFieldName.trim() && !wizardData.fieldMapping[newFieldName.trim()]) {
      setWizardData(prev => ({
        ...prev,
        fieldMapping: {
          ...prev.fieldMapping,
          [newFieldName.trim()]: "ignore"
        }
      }));
    }
  };

  const handleFetchIntegrationFields = async () => {
    if (!wizardData.apiUrl || !wizardData.apiKey) {
      toast({
        title: "Erro",
        description: "URL da API e Chave da API são necessárias para buscar campos",
        variant: "destructive",
      });
      return;
    }

    try {
      // Simulate fetching fields from ActiveCampaign API
      // In a real implementation, you would make an API call to ActiveCampaign
      const commonFields = [
        'first_name', 'last_name', 'email', 'phone', 'orgname', 
        'field[%PERSONALIZATION_1%]', 'field[%PERSONALIZATION_2%]',
        'field[%PERSONALIZATION_3%]', 'field[%WEBSITE%]', 'field[%JOB_TITLE%]'
      ];
      
      const newFields: Record<string, string> = {};
      commonFields.forEach(field => {
        if (!wizardData.fieldMapping[field]) {
          newFields[field] = "ignore";
        }
      });

      if (Object.keys(newFields).length > 0) {
        setWizardData(prev => ({
          ...prev,
          fieldMapping: {
            ...prev.fieldMapping,
            ...newFields
          }
        }));

        toast({
          title: "Campos encontrados",
          description: `${Object.keys(newFields).length} novos campos foram adicionados`,
        });
      } else {
        toast({
          title: "Nenhum campo novo",
          description: "Todos os campos comuns já estão mapeados",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao buscar campos",
        description: "Não foi possível conectar com a API do ActiveCampaign",
        variant: "destructive",
      });
    }
  };

  const updateFieldMapping = (acField: string, crmField: string) => {
    setWizardData(prev => ({
      ...prev,
      fieldMapping: {
        ...prev.fieldMapping,
        [acField]: crmField
      }
    }));
  };

  const copyWebhookUrl = (config: ActiveCampaignConfig) => {
    const webhookUrl = `${window.location.origin}/api/integrations/activecampaign/webhook/${config.id}`;
    navigator.clipboard.writeText(webhookUrl);
    toast({
      title: "URL copiada",
      description: "URL do webhook copiada para a área de transferência",
    });
  };

  const copyWebhookSecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast({
      title: "Secret copiado",
      description: "Secret do webhook copiado para a área de transferência",
    });
  };

  const renderWizardStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Webhook className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold">Integração com Active Campaign</h3>
              <div className="space-y-2 text-sm text-muted-foreground max-w-md mx-auto">
                <p>1. Dentro da sua conta no Active Campaign, acesse a opção: Configurações</p>
                <p>2. Em Configurações, selecione a opção: Desenvolvedor</p>
                <p>3. Em acesso à API, copie a URL e a Chave</p>
                <p>4. Adicione essas informações nos campos solicitados e cria sua integração</p>
              </div>
              <Button variant="link" className="text-blue-600">
                Veja o passo a passo detalhado →
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">O que você deseja criar ou atualizar quando receber esse Webhook?</h3>

            <div className="grid grid-cols-2 gap-4">
              <Card className={`cursor-pointer border-2 ${wizardData.webhookType === 'deal' ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                    onClick={() => setWizardData(prev => ({ ...prev, webhookType: 'deal' }))}>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <Building className="h-8 w-8 mb-2" />
                  <span className="font-medium">Negócio</span>
                </CardContent>
              </Card>

              <Card className={`cursor-pointer border-2 ${wizardData.webhookType === 'contact' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    onClick={() => setWizardData(prev => ({ ...prev, webhookType: 'contact' }))}>
                <CardContent className="flex flex-col items-center justify-center p-6">
                  <User className="h-8 w-8 mb-2" />
                  <span className="font-medium">Contato</span>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiUrl">URL</Label>
                <Input
                  id="apiUrl"
                  placeholder="Acesse Configurações > Desenvolvedor > Acesso à API > Copiar URL da API"
                  value={wizardData.apiUrl}
                  onChange={(e) => setWizardData(prev => ({ ...prev, apiUrl: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey">Chave</Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Acesse Configurações > Desenvolvedor > Acesso à API > Copiar chave da API"
                  value={wizardData.apiKey}
                  onChange={(e) => setWizardData(prev => ({ ...prev, apiKey: e.target.value }))}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Mapeamento de campos</h3>
              <Button variant="outline" size="sm" onClick={handleAddCustomField}>
                + Adicionar campo
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 font-medium text-sm">
                <span>NOME DO CAMPO NO SEU FORMULÁRIO</span>
                <span>MAPEAR CAMPO PARA</span>
              </div>

              {Object.entries(wizardData.fieldMapping).map(([acField, crmField]) => (
                <div key={acField} className="grid grid-cols-2 gap-4 items-center">
                  <span className="font-mono text-sm">{acField}</span>
                  <div className="flex items-center gap-2">
                    <Select value={crmField} onValueChange={(value) => updateFieldMapping(acField, value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Nome">Nome</SelectItem>
                        <SelectItem value="Sobrenome">Sobrenome</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Telefone">Telefone</SelectItem>
                        <SelectItem value="Cidade">Cidade</SelectItem>
                        <SelectItem value="Cargo">Cargo</SelectItem>
                        <SelectItem value="ignore">Ignorar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleRemoveField(acField)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button 
                variant="link" 
                className="text-blue-600 p-0 hover:text-blue-800"
                onClick={handleFetchIntegrationFields}
              >
                🔍 Buscar campos da integração
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Configurações adicionais</h3>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pipeline">Pipeline</Label>
                <Select value={wizardData.pipelineId} onValueChange={(value) => setWizardData(prev => ({ ...prev, pipelineId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines?.map((pipeline) => (
                      <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                        {pipeline.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tags para contatos</Label>
                
                {/* Available tags */}
                {availableTags.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Tags existentes (clique para adicionar):</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {availableTags.filter(tag => !wizardData.tags.includes(tag)).map((tag) => (
                        <Badge 
                          key={tag} 
                          variant="outline" 
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                          onClick={() => setWizardData(prev => ({
                            ...prev,
                            tags: [...prev.tags, tag]
                          }))}
                        >
                          + {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add new tag */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova tag"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button onClick={handleAddTag} variant="outline">
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>

                {/* Selected tags */}
                {wizardData.tags.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground">Tags selecionadas:</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {wizardData.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 text-muted-foreground hover:text-foreground"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Etapa inicial (opcional)</Label>
                <Select 
                  value={wizardData.defaultStage || ""} 
                  onValueChange={(value) => setWizardData(prev => ({ ...prev, defaultStage: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma etapa inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Primeira etapa do pipeline</SelectItem>
                    <SelectItem value="prospecção">Prospecção</SelectItem>
                    <SelectItem value="qualificação">Qualificação</SelectItem>
                    <SelectItem value="proposta">Proposta</SelectItem>
                    <SelectItem value="fechamento">Fechamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status inicial dos contatos</Label>
                <Select 
                  value={wizardData.defaultStatus || "active"} 
                  onValueChange={(value) => setWizardData(prev => ({ ...prev, defaultStatus: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (configsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrações ActiveCampaign</h1>
          <p className="text-muted-foreground">
            Configure múltiplos webhooks para diferentes pipelines
          </p>
        </div>
        <Dialog open={isWizardOpen} onOpenChange={setIsWizardOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetWizard}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Integração
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Integração com Active Campaign</span>
                <Button variant="ghost" size="icon" onClick={() => setIsWizardOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator */}
            <div className="flex items-center justify-between mb-6">
              {wizardSteps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {step.id}
                  </div>
                  <div className="ml-2 text-sm">
                    <div className={`font-medium ${currentStep >= step.id ? 'text-blue-600' : 'text-gray-600'}`}>
                      {step.title}
                    </div>
                  </div>
                  {index < wizardSteps.length - 1 && (
                    <div className="w-8 h-0.5 bg-gray-200 mx-4"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="min-h-[400px]">
              {renderWizardStep()}
            </div>

            {/* Navigation buttons */}
            <div className="flex justify-between pt-6 border-t">
              <Button 
                variant="outline" 
                onClick={handlePrevious}
                disabled={currentStep === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>

              {currentStep < 4 ? (
                <Button onClick={handleNext}>
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={handleFinish}
                  disabled={createConfigMutation.isPending}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {createConfigMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Existing configurations */}
      <div className="grid gap-6">
        {configs.length > 0 ? (
          configs.map((config) => (
            <Card key={config.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Integração ActiveCampaign #{config.id}
                      <Badge variant={config.isActive ? "default" : "secondary"}>
                        {config.isActive ? "Ativo" : "Inativo"}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Pipeline: {pipelines?.find(p => p.id === config.pipelineId)?.name || "N/A"}
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteConfigMutation.mutate(config.id);
                      setSelectedConfig(null);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="space-y-2">
                      <Label>URL do Webhook</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/api/integrations/activecampaign/webhook/${config.id}`}
                          className="font-mono text-sm"
                        />
                        <Button variant="outline" size="icon" onClick={() => copyWebhookUrl(config)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Webhook Secret</Label>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          type="password"
                          value={config.webhookSecret}
                          className="font-mono text-sm"
                        />
                        <Button variant="outline" size="icon" onClick={() => copyWebhookSecret(config.webhookSecret!)}>
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const url = `${window.location.origin}/api/integrations/activecampaign/webhook/${config.id}/test`;
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Testar Webhook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            // Test webhook with sample data
                            const response = await fetch(`/api/integrations/activecampaign/webhook/${config.id}`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                "contact[email]": "teste@exemplo.com",
                                "contact[first_name]": "Teste",
                                "contact[last_name]": "Webhook",
                                "contact[phone]": "(11) 99999-9999",
                                "contact[orgname]": "Empresa Teste"
                              })
                            });

                            if (response.ok) {
                              toast({
                                title: "Teste realizado!",
                                description: "O webhook foi testado com sucesso. Verifique os logs abaixo.",
                              });
                              // Refresh logs
                              queryClient.invalidateQueries({ queryKey: ["/api/integrations/activecampaign/logs"] });
                            } else {
                              throw new Error('Teste falhou');
                            }
                          } catch (error) {
                            toast({
                              title: "Erro no teste",
                              description: "Não foi possível testar o webhook.",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <Database className="h-4 w-4 mr-2" />
                        Simular Envio
                      </Button>
                    </div>

                    <Alert>
                      <AlertDescription>
                        <strong>Como configurar no ActiveCampaign:</strong><br />
                        1. Vá em Automations → Webhook<br />
                        2. Cole a URL acima<br />
                        3. Método: POST<br />
                        4. Não é necessário autenticação adicional
                      </AlertDescription>
                    </Alert>

                    {config.defaultTags.length > 0 && (
                      <div className="space-y-2">
                        <Label>Tags Padrão</Label>
                        <div className="flex flex-wrap gap-2">
                          {config.defaultTags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma integração configurada ainda.
                <br />
                Clique em "Nova Integração" para começar.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
       {/* Recent Logs Section */}
       <div className="space-y-4">
            <h2 className="text-2xl font-bold">Logs Recentes</h2>
            {logsLoading ? (
                <p>Carregando logs...</p>
            ) : logs.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Data/Hora
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Tipo
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Descrição
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {logs.map((log, index) => (
                                <tr key={index}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {new Date(log.createdAt).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.type}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {log.description}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p>Nenhum log encontrado.</p>
            )}
        </div>
    </div>
  );
}