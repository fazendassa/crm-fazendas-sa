import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatWindow } from '@/components/whatsapp/ChatWindow';
import { OpportunityPanel } from '@/components/whatsapp/OpportunityPanel';
import { TagsPanel } from '@/components/whatsapp/TagsPanel';
import { QrCode, MessageSquare, Plus, Loader2, Smartphone, Power, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface WhatsAppSession {
  id: number;
  userId: string;
  sessionName: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  phoneNumber: string | null;
  qrCode: string | null;
  isActive: boolean;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppMessage {
  id: string;
  sessionId: number;
  contactNumber: string;
  contactName: string;
  messageContent: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file';
  isFromMe: boolean;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  mediaUrl: string | null;
  createdAt: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  isOnline: boolean;
  lastSeen?: Date;
}

interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  avatar?: string;
  lastMessage: {
    id: string;
    content: string;
    timestamp: Date;
    status: 'sent' | 'delivered' | 'read' | 'pending';
    isFromMe: boolean;
  };
  unreadCount: number;
  isPinned: boolean;
  tags: string[];
}

export default function WhatsAppNew() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estados locais
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  // Buscar sessões WhatsApp
  const { data: sessions, isLoading: loadingSessions, error: sessionsError } = useQuery<WhatsAppSession[]>({
    queryKey: ['/api/whatsapp/sessions'],
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  // Buscar mensagens da sessão ativa
  const { data: messages, isLoading: loadingMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: ['/api/whatsapp/messages', selectedSession?.id],
    enabled: !!selectedSession?.id,
    refetchInterval: 2000, // Atualiza a cada 2 segundos
  });

  // WebSocket para atualizações em tempo real
  useEffect(() => {
    if (!selectedSession) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('📡 WebSocket connected');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'new_message' && data.sessionId === selectedSession.id) {
          // Atualizar cache de mensagens
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedSession.id] });
        } else if (data.type === 'session_status_update') {
          // Atualizar cache de sessões
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
        }
      } catch (error) {
        console.log('Unknown WebSocket message:', data);
      }
    };
    
    socket.onclose = () => {
      console.log('📡 WebSocket disconnected');
    };

    return () => {
      socket.close();
    };
  }, [selectedSession, queryClient]);

  // Mutation para criar nova sessão
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      return apiRequest(`/api/whatsapp/sessions`, {
        method: 'POST',
        body: JSON.stringify({ sessionName }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({ title: "Sessão criada", description: "Nova sessão WhatsApp criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      setNewSessionName('');
      setIsCreatingSession(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao criar sessão",
        variant: "destructive" 
      });
    }
  });

  // Mutation para deletar sessão
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      return apiRequest(`/api/whatsapp/sessions/${sessionId}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      toast({ title: "Sessão removida", description: "Sessão WhatsApp removida com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      if (selectedSession?.id === arguments[0]) {
        setSelectedSession(null);
      }
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro", 
        description: error.message || "Erro ao remover sessão",
        variant: "destructive" 
      });
    }
  });

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, type, contactPhone }: { content: string; type: string; contactPhone: string }) => {
      return apiRequest(`/api/whatsapp/sessions/${selectedSession!.id}/send-message`, {
        method: 'POST',
        body: JSON.stringify({ content, type, contactPhone }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      // Atualizar mensagens após envio
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedSession?.id] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao enviar", 
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive" 
      });
    }
  });

  // Converter mensagens para conversas
  const conversations: Conversation[] = React.useMemo(() => {
    if (!messages) return [];

    const conversationMap = new Map<string, Conversation>();

    messages.forEach(message => {
      const key = message.contactNumber;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          contactName: message.contactName || message.contactNumber,
          contactPhone: message.contactNumber,
          lastMessage: {
            id: message.id,
            content: message.messageContent,
            timestamp: new Date(message.timestamp),
            status: message.status,
            isFromMe: message.isFromMe
          },
          unreadCount: 0,
          isPinned: false,
          tags: []
        });
      } else {
        const conversation = conversationMap.get(key)!;
        const messageTime = new Date(message.timestamp);
        
        if (messageTime > conversation.lastMessage.timestamp) {
          conversation.lastMessage = {
            id: message.id,
            content: message.messageContent,
            timestamp: messageTime,
            status: message.status,
            isFromMe: message.isFromMe
          };
        }
        
        if (!message.isFromMe && message.status !== 'read') {
          conversation.unreadCount++;
        }
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime());
  }, [messages]);

  // Handlers
  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversation(conversationId);
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setSelectedContact({
        id: conversation.id,
        name: conversation.contactName,
        phone: conversation.contactPhone,
        isOnline: true
      });
    }
  };

  const handleSendMessage = (content: string, type: string) => {
    if (!selectedContact || !selectedSession) return;
    
    sendMessageMutation.mutate({
      content,
      type,
      contactPhone: selectedContact.phone
    });
  };

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    createSessionMutation.mutate(newSessionName.trim());
  };

  const handleDeleteSession = (sessionId: number) => {
    deleteSessionMutation.mutate(sessionId);
  };

  // Verificar se há sessões conectadas
  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];
  const hasConnectedSession = connectedSessions.length > 0;

  // Selecionar automaticamente a primeira sessão conectada
  useEffect(() => {
    if (connectedSessions.length > 0 && !selectedSession) {
      setSelectedSession(connectedSessions[0]);
    }
  }, [connectedSessions, selectedSession]);

  // Converter mensagens para conversas
  const conversations: Conversation[] = React.useMemo(() => {
    if (!messages) return [];

    const conversationMap = new Map<string, Conversation>();

    messages.forEach(message => {
      const key = message.contactNumber;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          contactName: message.contactName || message.contactNumber,
          contactPhone: message.contactNumber,
          lastMessage: {
            id: message.id,
            content: message.messageContent,
            timestamp: new Date(message.timestamp),
            status: message.status,
            isFromMe: message.isFromMe
          },
          unreadCount: 0,
          isPinned: false,
          tags: []
        });
      } else {
        const conversation = conversationMap.get(key)!;
        const messageTime = new Date(message.timestamp);
        
        if (messageTime > conversation.lastMessage.timestamp) {
          conversation.lastMessage = {
            id: message.id,
            content: message.messageContent,
            timestamp: messageTime,
            status: message.status,
            isFromMe: message.isFromMe
          };
        }
        
        // Contar mensagens não lidas
        if (!message.isFromMe && message.status !== 'read') {
          conversation.unreadCount++;
        }
      }
    });

    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime());
  }, [messages]);

  // Se não há sessões conectadas, mostrar tela de conexão
  if (!hasConnectedSession && !loadingSessions) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <Card className="border-gray-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Conectar WhatsApp</CardTitle>
                <CardDescription className="text-gray-600">
                  Para usar o chat do WhatsApp, você precisa ter pelo menos uma sessão conectada.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sessions && sessions.length > 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você tem sessões criadas mas nenhuma está conectada. Verifique a página de integração do WhatsApp.
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da sessão"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
                    />
                    <Button 
                      onClick={handleCreateSession}
                      disabled={!newSessionName.trim() || createSessionMutation.isPending}
                      className="shrink-0"
                    >
                      {createSessionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => window.location.href = '/integrations/whatsapp'}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Ir para Configurações do WhatsApp
                  </Button>
                </div>

                {sessions && sessions.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Sessões Existentes</h4>
                    <div className="space-y-2">
                      {sessions.map(session => (
                        <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              session.status === 'connected' ? 'bg-green-500' : 
                              session.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{session.sessionName}</p>
                              <p className="text-xs text-gray-500">{session.status}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSession(session.id)}
                            disabled={deleteSessionMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // Carregamento
  if (loadingSessions) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Interface principal do chat (3 painéis)
  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50">
      {/* Header com seletor de sessão */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-900">WhatsApp Chat</h1>
            {connectedSessions.length > 1 && (
              <select
                value={selectedSession?.id || ''}
                onChange={(e) => {
                  const session = connectedSessions.find(s => s.id === Number(e.target.value));
                  setSelectedSession(session || null);
                }}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md"
              >
                {connectedSessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.sessionName} ({session.phoneNumber || 'Conectando...'})
                  </option>
                ))}
              </select>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2" />
              Conectado
            </Badge>
          </div>
        </div>
      </div>

      {/* Área principal com 3 painéis */}
      <div className="flex-1 flex overflow-hidden">
        {/* Painel Esquerdo - Lista de Conversas */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <ConversationList
            conversations={conversations}
            selectedConversation={selectedConversation}
            onSelectConversation={handleSelectConversation}
            isLoading={loadingMessages}
          />
        </div>

        {/* Painel Central - Janela de Chat */}
        <div className="flex-1 flex flex-col">
          <ChatWindow
            contact={selectedContact}
            messages={messages?.filter(m => m.contactNumber === selectedContact?.phone)
              .map(m => ({
                id: m.id,
                content: m.messageContent,
                timestamp: new Date(m.timestamp),
                status: m.status,
                isFromMe: m.isFromMe,
                type: m.messageType,
                mediaUrl: m.mediaUrl
              })) || []}
            onSendMessage={handleSendMessage}
            onStartNewChat={() => console.log('Start new chat')}
            onCloseChat={() => setSelectedConversation(null)}
            isTyping={isTyping}
            deviceInfo={`WhatsApp Web – ${selectedSession?.sessionName} (${selectedSession?.phoneNumber})`}
          />
        </div>

        {/* Painel Direito - Oportunidades e Tags */}
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
          <div className="flex-1 overflow-auto">
            <OpportunityPanel
              contact={selectedContact}
              onCreateDeal={(deal) => console.log('Create deal:', deal)}
              onUpdateDeal={(id, deal) => console.log('Update deal:', id, deal)}
            />
          </div>
          <div className="border-t border-gray-200">
            <TagsPanel
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
              availableTags={['Qualificação', 'VIP', 'Site Client', 'Oportunidade', 'Follow-up']}
            />
          </div>
        </div>
      </div>
    </div>
  );
}