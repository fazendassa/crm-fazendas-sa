
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, TestTube, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ActiveCampaignConfig {
  id: number;
  activeCampaignApiUrl: string;
  activeCampaignApiKey: string;
  webhookSecret: string;
  defaultPipelineId: number;
  defaultTags: string[];
  fieldMapping: Record<string, string>;
  webhookType: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Pipeline {
  id: number;
  name: string;
}

interface WebhookLog {
  id: number;
  configId: number;
  webhookData: any;
  contactId: number | null;
  dealId: number | null;
  status: string;
  errorMessage: string | null;
  processedAt: string;
}

export default function ActiveCampaignConfig() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<ActiveCampaignConfig[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<number | null>(null);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    activeCampaignApiUrl: '',
    activeCampaignApiKey: '',
    pipelineId: '',
    defaultTags: '',
    webhookType: 'contact'
  });

  useEffect(() => {
    loadConfigs();
    loadPipelines();
  }, []);

  const loadConfigs = async () => {
    try {
      const response = await fetch('/api/integrations/activecampaign/configs', {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConfigs(data);
      }
    } catch (err) {
      setError('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const loadPipelines = async () => {
    try {
      const response = await fetch('/api/pipelines', {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setPipelines(data);
      }
    } catch (err) {
      console.error('Erro ao carregar pipelines:', err);
    }
  };

  const loadWebhookLogs = async (configId?: number) => {
    try {
      const url = configId 
        ? `/api/integrations/activecampaign/logs/${configId}`
        : '/api/integrations/activecampaign/logs';
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setWebhookLogs(data);
      }
    } catch (err) {
      console.error('Erro ao carregar logs:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch('/api/integrations/activecampaign/configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({
          activeCampaignApiUrl: formData.activeCampaignApiUrl,
          activeCampaignApiKey: formData.activeCampaignApiKey,
          pipelineId: parseInt(formData.pipelineId),
          defaultTags: formData.defaultTags.split(',').map(tag => tag.trim()).filter(tag => tag),
          webhookType: formData.webhookType
        })
      });

      if (response.ok) {
        setShowForm(false);
        setFormData({
          activeCampaignApiUrl: '',
          activeCampaignApiKey: '',
          pipelineId: '',
          defaultTags: '',
          webhookType: 'contact'
        });
        loadConfigs();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erro ao salvar configuração');
      }
    } catch (err) {
      setError('Erro ao salvar configuração');
    }
  };

  const handleDelete = async (configId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta configuração?')) {
      return;
    }

    try {
      const response = await fetch(`/api/integrations/activecampaign/configs/${configId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user?.token}`
        }
      });

      if (response.ok) {
        loadConfigs();
      } else {
        setError('Erro ao excluir configuração');
      }
    } catch (err) {
      setError('Erro ao excluir configuração');
    }
  };

  const testWebhook = async (configId: number) => {
    try {
      const response = await fetch(`/api/integrations/activecampaign/webhook/${configId}/test`);
      if (response.ok) {
        alert('Webhook testado com sucesso!');
      } else {
        alert('Erro ao testar webhook');
      }
    } catch (err) {
      alert('Erro ao testar webhook');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">ActiveCampaign</h1>
            <p className="text-gray-500 mt-1">Configurações de integração</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => setShowLogs(!showLogs)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showLogs ? 'Ocultar Logs' : 'Ver Logs'}
            </Button>
            <Button 
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nova Configuração
            </Button>
          </div>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {showForm && (
          <Card className="mb-8 border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Nova Configuração ActiveCampaign
              </CardTitle>
              <CardDescription className="text-gray-500">
                Configure a integração com o ActiveCampaign
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      URL da API ActiveCampaign
                    </label>
                    <Input
                      type="url"
                      value={formData.activeCampaignApiUrl}
                      onChange={(e) => setFormData({...formData, activeCampaignApiUrl: e.target.value})}
                      placeholder="https://suaempresa.api-us1.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chave da API
                    </label>
                    <Input
                      type="password"
                      value={formData.activeCampaignApiKey}
                      onChange={(e) => setFormData({...formData, activeCampaignApiKey: e.target.value})}
                      placeholder="sua-chave-api"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Pipeline
                    </label>
                    <select
                      value={formData.pipelineId}
                      onChange={(e) => setFormData({...formData, pipelineId: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    >
                      <option value="">Selecione um pipeline</option>
                      {pipelines.map(pipeline => (
                        <option key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tipo de Webhook
                    </label>
                    <select
                      value={formData.webhookType}
                      onChange={(e) => setFormData({...formData, webhookType: e.target.value})}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="contact">Contato</option>
                      <option value="deal">Negócio</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags Padrão (separadas por vírgula)
                  </label>
                  <Input
                    type="text"
                    value={formData.defaultTags}
                    onChange={(e) => setFormData({...formData, defaultTags: e.target.value})}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    Salvar Configuração
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {showLogs && (
          <Card className="mb-8 border-gray-200 shadow-sm">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-lg font-semibold text-gray-900">
                Logs de Webhook
              </CardTitle>
              <CardDescription className="text-gray-500">
                Histórico de eventos recebidos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {webhookLogs.map((log) => (
                  <div key={log.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(log.processedAt).toLocaleString()}
                      </span>
                    </div>
                    {log.errorMessage && (
                      <p className="text-sm text-red-600 mb-2">{log.errorMessage}</p>
                    )}
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
                        Ver dados do webhook
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.webhookData, null, 2)}
                      </pre>
                    </details>
                  </div>
                ))}
                {webhookLogs.length === 0 && (
                  <p className="text-gray-500 text-center py-8">
                    Nenhum log encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {configs.map((config) => (
            <Card key={config.id} className="border-gray-200 shadow-sm">
              <CardHeader className="border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Configuração #{config.id}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => testWebhook(config.id)}
                      className="flex items-center gap-1"
                    >
                      <TestTube className="h-3 w-3" />
                      Testar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedConfig(config.id);
                        loadWebhookLogs(config.id);
                        setShowLogs(true);
                      }}
                      className="flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      Logs
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(config.id)}
                      className="flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <CardDescription className="text-gray-500">
                  {config.isActive ? 'Ativo' : 'Inativo'}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">URL da API:</label>
                    <p className="text-sm text-gray-900 mt-1">{config.activeCampaignApiUrl}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Pipeline ID:</label>
                    <p className="text-sm text-gray-900 mt-1">{config.defaultPipelineId}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tipo de Webhook:</label>
                    <p className="text-sm text-gray-900 mt-1">{config.webhookType}</p>
                  </div>
                  {config.defaultTags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tags Padrão:</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {config.defaultTags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">URL do Webhook:</label>
                    <p className="text-xs text-gray-600 mt-1 break-all bg-gray-50 p-2 rounded">
                      {window.location.origin}/api/integrations/activecampaign/webhook/{config.id}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {configs.length === 0 && (
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-12 text-center">
              <p className="text-gray-500 text-lg">
                Nenhuma configuração encontrada
              </p>
              <p className="text-gray-400 text-sm mt-2">
                Clique em "Nova Configuração" para começar
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
