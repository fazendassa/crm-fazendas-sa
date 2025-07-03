import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatWindow } from '@/components/whatsapp/ChatWindow';
import { OpportunityPanel } from '@/components/whatsapp/OpportunityPanel';
import { TagsPanel } from '@/components/whatsapp/TagsPanel';
import { QrCode, MessageSquare, Plus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Mock data para demonstração da interface
const mockConversations = [
  {
    id: '1',
    contactName: 'Maurício Antônio',
    contactPhone: '+55 11 99999-9999',
    avatar: undefined,
    lastMessage: {
      id: '1',
      content: 'Sim, sei entenda com essa situação meu...',
      timestamp: new Date(2025, 2, 23, 10, 43),
      status: 'read' as const,
      isFromMe: false
    },
    unreadCount: 2,
    isPinned: false,
    tags: ['Qualificação', 'VIP']
  },
  {
    id: '2',
    contactName: 'Michael K.',
    contactPhone: '+55 11 88888-8888',
    avatar: undefined,
    lastMessage: {
      id: '2',
      content: 'Pode me dar uma ajuda aí...',
      timestamp: new Date(2025, 2, 23, 10, 35),
      status: 'delivered' as const,
      isFromMe: true
    },
    unreadCount: 0,
    isPinned: false,
    tags: ['Site Client']
  },
  {
    id: '3',
    contactName: 'Rio Madeiras',
    contactPhone: '+55 11 77777-7777',
    avatar: undefined,
    lastMessage: {
      id: '3',
      content: 'Em uma passta Agora...',
      timestamp: new Date(2025, 2, 23, 10, 30),
      status: 'sent' as const,
      isFromMe: true
    },
    unreadCount: 0,
    isPinned: false,
    tags: ['Evento Concl']
  }
];

const mockMessages = [
  {
    id: '1',
    content: 'Olá! Como posso ajudá-lo hoje?',
    timestamp: new Date(2025, 2, 23, 10, 30),
    status: 'read' as const,
    isFromMe: true,
    type: 'text' as const
  },
  {
    id: '2',
    content: 'Gostaria de saber mais sobre os seus serviços.',
    timestamp: new Date(2025, 2, 23, 10, 32),
    status: 'read' as const,
    isFromMe: false,
    type: 'text' as const
  },
  {
    id: '3',
    content: 'Cartão recusado – Mentoria XYZ – 23/03/23 – 10:43',
    timestamp: new Date(2025, 2, 23, 10, 43),
    status: 'read' as const,
    isFromMe: false,
    type: 'system' as const
  },
  {
    id: '4',
    content: 'Sim, sei entenda com essa situação meu...',
    timestamp: new Date(2025, 2, 23, 10, 43),
    status: 'read' as const,
    isFromMe: false,
    type: 'text' as const
  }
];

const mockDeal = {
  id: '1',
  title: 'Mentoria XYZ',
  value: 2500,
  currency: 'BRL',
  stage: 'Qualificação',
  pipeline: 'Comercial',
  probability: 75,
  expectedCloseDate: new Date(2025, 3, 15),
  createdAt: new Date(2025, 2, 1),
  description: 'Programa de mentoria personalizada para desenvolvimento profissional',
  client: {
    name: 'Maurício Antônio',
    company: 'Tech Solutions Ltd'
  }
};

const mockPipelines = [
  {
    id: '1',
    name: 'Comercial',
    stages: [
      { id: '1', name: 'Prospecção', position: 1 },
      { id: '2', name: 'Qualificação', position: 2 },
      { id: '3', name: 'Proposta', position: 3 },
      { id: '4', name: 'Negociação', position: 4 },
      { id: '5', name: 'Fechamento', position: 5 }
    ]
  },
  {
    id: '2',
    name: 'Eventos',
    stages: [
      { id: '6', name: 'Planejamento', position: 1 },
      { id: '7', name: 'Execução', position: 2 },
      { id: '8', name: 'Finalização', position: 3 }
    ]
  }
];

const mockTags = [
  { id: '1', name: 'Qualificação', color: 'blue', count: 5 },
  { id: '2', name: 'Site Client', color: 'green', count: 3 },
  { id: '3', name: 'Evento Concl', color: 'purple', count: 2 },
  { id: '4', name: 'VIP', color: 'yellow', count: 1 },
  { id: '5', name: 'Proposta', color: 'red', count: 4 },
  { id: '6', name: 'Negociação', color: 'indigo', count: 2 }
];

const mockNotes = [
  {
    id: '1',
    content: 'Cliente interessado em mentoria personalizada. Tem experiência prévia em gestão.',
    createdAt: new Date(2025, 2, 20),
    userId: '1',
    userName: 'Samuel Sousa'
  },
  {
    id: '2',
    content: 'Reagendou reunião para próxima semana. Disponibilidade nas tardes.',
    createdAt: new Date(2025, 2, 22),
    userId: '1',
    userName: 'Samuel Sousa'
  }
];

const mockHistory = [
  {
    id: '1',
    action: 'Oportunidade criada',
    date: new Date(2025, 2, 1),
    user: 'Samuel Sousa',
    details: 'Valor inicial: R$ 2.500,00'
  },
  {
    id: '2',
    action: 'Mudança de estágio',
    date: new Date(2025, 2, 10),
    user: 'Samuel Sousa',
    details: 'De "Prospecção" para "Qualificação"'
  },
  {
    id: '3',
    action: 'Nota adicionada',
    date: new Date(2025, 2, 20),
    user: 'Samuel Sousa'
  }
];

interface WhatsAppSession {
  id: number;
  sessionName: string;
  status: string;
  phoneNumber?: string;
  qrCode?: string;
  isActive: boolean;
}

export default function WhatsAppNew() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>('1');
  const [selectedContact, setSelectedContact] = useState(mockConversations[0]);
  const [selectedTags, setSelectedTags] = useState<string[]>(['1', '2']);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Carregar sessões WhatsApp existentes
  const { data: sessions = [] } = useQuery({
    queryKey: ['/api/whatsapp/sessions'],
    queryFn: () => apiRequest('/api/whatsapp/sessions')
  });

  // WebSocket para tempo real
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('📡 WebSocket connected');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Unknown WebSocket message:', data);
      } catch (e) {
        console.log('WebSocket message (raw):', event.data);
      }
    };

    socket.onclose = () => {
      console.log('📡 WebSocket disconnected');
    };

    return () => {
      socket.close();
    };
  }, []);

  // Mutações
  const createSessionMutation = useMutation({
    mutationFn: (sessionName: string) => 
      apiRequest('/api/whatsapp/sessions', {
        method: 'POST',
        body: JSON.stringify({ sessionName })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      setSessionName('');
      setShowSessionDialog(false);
      toast({
        title: 'Sucesso!',
        description: 'Sessão criada com sucesso'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar sessão',
        variant: 'destructive'
      });
    }
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: number) => 
      apiRequest(`/api/whatsapp/sessions/${sessionId}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      toast({
        title: 'Sucesso!',
        description: 'Sessão excluída com sucesso'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao excluir sessão',
        variant: 'destructive'
      });
    }
  });

  // Handlers
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    const conversation = mockConversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedContact({
        id: conversation.id,
        name: conversation.contactName,
        phone: conversation.contactPhone,
        avatar: conversation.avatar,
        isOnline: true
      });
    }
  };

  const handleSendMessage = (content: string, type: string) => {
    console.log('Sending message:', { content, type });
    // Aqui você implementaria o envio real da mensagem
  };

  const handleSearchConversations = (query: string) => {
    console.log('Searching conversations:', query);
    // Implementar busca de conversas
  };

  const handleFilterConversations = (filters: any) => {
    console.log('Filtering conversations:', filters);
    // Implementar filtros de conversas
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleCreateTag = (name: string) => {
    console.log('Creating tag:', name);
    // Implementar criação de tag
  };

  const handleDeleteTag = (tagId: string) => {
    console.log('Deleting tag:', tagId);
    // Implementar exclusão de tag
  };

  const handleSearchTags = (query: string) => {
    console.log('Searching tags:', query);
    // Implementar busca de tags
  };

  const createSession = () => {
    if (sessionName.trim()) {
      setIsLoading(true);
      createSessionMutation.mutate(sessionName.trim());
    }
  };

  const deleteSession = (sessionId: number) => {
    deleteSessionMutation.mutate(sessionId);
  };

  return (
    <div className="h-screen bg-gray-100 flex flex-col">
      {/* Header com Tags */}
      <TagsPanel
        availableTags={mockTags}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onCreateTag={handleCreateTag}
        onDeleteTag={handleDeleteTag}
        onSearchTags={handleSearchTags}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Lista de Conversas */}
        <div className="w-80 flex-shrink-0">
          <ConversationList
            conversations={mockConversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            onSearchChange={handleSearchConversations}
            onFilterChange={handleFilterConversations}
          />
        </div>

        {/* Janela de Chat */}
        <div className="flex-1">
          <ChatWindow
            contact={selectedContact}
            messages={mockMessages}
            onSendMessage={handleSendMessage}
            onStartNewChat={() => console.log('Start new chat')}
            onCloseChat={() => setSelectedConversation(null)}
            isTyping={isTyping}
            deviceInfo="WhatsApp Web – Dispositivo: Chrome Desktop"
          />
        </div>

        {/* Painel de Oportunidades */}
        <div className="w-80 flex-shrink-0">
          <OpportunityPanel
            deal={mockDeal}
            pipelines={mockPipelines}
            notes={mockNotes}
            history={mockHistory}
            onUpdateDeal={(dealId, updates) => console.log('Update deal:', dealId, updates)}
            onUpdateStatus={(dealId, status) => console.log('Update status:', dealId, status)}
            onAddNote={(dealId, content) => console.log('Add note:', dealId, content)}
            onUpdateNote={(noteId, content) => console.log('Update note:', noteId, content)}
            onDeleteNote={(noteId) => console.log('Delete note:', noteId)}
          />
        </div>
      </div>

      {/* Session Management Dialog */}
      <Dialog open={showSessionDialog} onOpenChange={setShowSessionDialog}>
        <DialogTrigger asChild>
          <Button 
            className="fixed bottom-4 right-4 rounded-full shadow-lg"
            size="lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Sessão
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Sessões WhatsApp</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Create New Session */}
            <div className="space-y-2">
              <h4 className="font-medium">Criar Nova Sessão</h4>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome da sessão"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createSession()}
                />
                <Button 
                  onClick={createSession} 
                  disabled={isLoading || !sessionName.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Criar'
                  )}
                </Button>
              </div>
            </div>

            {/* Existing Sessions */}
            {sessions.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Sessões Existentes</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sessions.map((session: WhatsAppSession) => (
                    <Card key={session.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{session.sessionName}</p>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant={session.status === 'connected' ? 'default' : 'secondary'}
                            >
                              {session.status}
                            </Badge>
                            {session.phoneNumber && (
                              <span className="text-sm text-gray-600">
                                {session.phoneNumber}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSession(session.id)}
                        >
                          Excluir
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}