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
import { Copy, ExternalLink, Trash2, Settings, Webhook, Database, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ActiveCampaignConfig {
  id: number;
  activeCampaignApiUrl: string;
  defaultPipelineId?: number;
  defaultTags: string[];
  isActive: boolean;
  webhookSecret?: string;
  createdAt: string;
  updatedAt: string;
}

interface Pipeline {
  id: number;
  name: string;
  description?: string;
}

export default function ActiveCampaignConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  // Fetch current configuration
  const { data: config, isLoading: configLoading } = useQuery<ActiveCampaignConfig>({
    queryKey: ["/api/integrations/activecampaign/config"],
    retry: false,
  });

  // Fetch pipelines for selection
  const { data: pipelines } = useQuery<Pipeline[]>({
    queryKey: ["/api/pipelines"],
  });

  // Fetch webhook logs
  const { data: logs = [] } = useQuery<any[]>({
    queryKey: ["/api/integrations/activecampaign/logs"],
    enabled: !!config,
  });

  // Populate form when config is loaded
  useEffect(() => {
    if (config) {
      setApiUrl(config.activeCampaignApiUrl);
      setSelectedPipelineId(config.defaultPipelineId?.toString() || "none");
      setTags(config.defaultTags || []);
    }
  }, [config]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: {
      activeCampaignApiUrl: string;
      activeCampaignApiKey: string;
      defaultPipelineId?: number;
      defaultTags: string[];
    }) => {
      return fetch("/api/integrations/activecampaign/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      }).then(res => {
        if (!res.ok) throw new Error("Failed to save config");
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuração salva",
        description: "Integração com ActiveCampaign configurada com sucesso!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/activecampaign/config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Falha ao salvar configuração",
        variant: "destructive",
      });
    },
  });

  // Delete configuration mutation
  const deleteConfigMutation = useMutation({
    mutationFn: async () => {
      return fetch("/api/integrations/activecampaign/config", {
        method: "DELETE",
        credentials: "include",
      }).then(res => {
        if (!res.ok) throw new Error("Failed to delete config");
        return res.ok;
      });
    },
    onSuccess: () => {
      toast({
        title: "Configuração removida",
        description: "Integração com ActiveCampaign desabilitada",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/activecampaign/config"] });
      // Reset form
      setApiUrl("");
      setApiKey("");
      setSelectedPipelineId("");
      setTags([]);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover",
        description: error.message || "Falha ao remover configuração",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!apiUrl || !apiKey) {
      toast({
        title: "Campos obrigatórios",
        description: "URL da API e Chave da API são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    saveConfigMutation.mutate({
      activeCampaignApiUrl: apiUrl,
      activeCampaignApiKey: apiKey,
      defaultPipelineId: selectedPipelineId && selectedPipelineId !== "none" ? parseInt(selectedPipelineId) : undefined,
      defaultTags: tags,
    });
  };

  const handleAddTag = () => {
    if (tagsInput.trim() && !tags.includes(tagsInput.trim())) {
      setTags([...tags, tagsInput.trim()]);
      setTagsInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const copyWebhookUrl = () => {
    if (config?.webhookSecret) {
      const webhookUrl = `${window.location.origin}/api/integrations/activecampaign/webhook`;
      navigator.clipboard.writeText(webhookUrl);
      toast({
        title: "URL copiada",
        description: "URL do webhook copiada para a área de transferência",
      });
    }
  };

  const copyWebhookSecret = () => {
    if (config?.webhookSecret) {
      navigator.clipboard.writeText(config.webhookSecret);
      toast({
        title: "Secret copiado",
        description: "Secret do webhook copiado para a área de transferência",
      });
    }
  };

  if (configLoading) {
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
          <h1 className="text-3xl font-bold">Integração ActiveCampaign</h1>
          <p className="text-muted-foreground">
            Configure webhooks para receber leads do ActiveCampaign automaticamente
          </p>
        </div>
        {config && (
          <Badge variant={config.isActive ? "default" : "secondary"}>
            {config.isActive ? "Ativo" : "Inativo"}
          </Badge>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configuração da API
            </CardTitle>
            <CardDescription>
              Configure sua conexão com a API do ActiveCampaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="apiUrl">URL da API ActiveCampaign</Label>
              <Input
                id="apiUrl"
                placeholder="https://youraccount.api-us1.com"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Chave da API</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="Sua chave da API do ActiveCampaign"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline">Pipeline Padrão</Label>
              <Select value={selectedPipelineId} onValueChange={setSelectedPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum pipeline</SelectItem>
                  {pipelines?.filter(pipeline => pipeline.id && pipeline.id > 0).map((pipeline) => (
                    <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tags Padrão</Label>
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
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
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
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saveConfigMutation.isPending}
                className="flex-1"
              >
                {saveConfigMutation.isPending ? "Salvando..." : "Salvar Configuração"}
              </Button>
              {config && (
                <Button
                  variant="destructive"
                  onClick={() => deleteConfigMutation.mutate()}
                  disabled={deleteConfigMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Webhook Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Configuração do Webhook
            </CardTitle>
            <CardDescription>
              Use estas informações no ActiveCampaign
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {config?.webhookSecret ? (
              <>
                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={`${window.location.origin}/api/integrations/activecampaign/webhook`}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={copyWebhookUrl}>
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
                    <Button variant="outline" size="icon" onClick={copyWebhookSecret}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Alert>
                  <Database className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Configuração no ActiveCampaign:</strong>
                    <br />
                    1. Acesse Automations → Webhooks
                    <br />
                    2. Adicione a URL do webhook acima
                    <br />
                    3. Configure o header 'x-api-key' com o secret acima
                    <br />
                    4. Selecione os eventos de contato que deseja receber
                  </AlertDescription>
                </Alert>

                <Button variant="outline" className="w-full" asChild>
                  <a
                    href="https://developers.activecampaign.com/reference/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Documentação do ActiveCampaign
                  </a>
                </Button>
              </>
            ) : (
              <Alert>
                <AlertDescription>
                  Configure e salve a integração primeiro para gerar as informações do webhook.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Webhook Logs */}
      {config && logs && (
        <Card>
          <CardHeader>
            <CardTitle>Logs Recentes</CardTitle>
            <CardDescription>
              Últimos eventos recebidos do ActiveCampaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            {logs.length > 0 ? (
              <div className="space-y-2">
                {logs.slice(0, 10).map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                      <span className="text-sm">
                        {log.contactId && `Contato: ${log.contactId}`}
                        {log.dealId && ` • Deal: ${log.dealId}`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.processedAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                Nenhum evento recebido ainda
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}