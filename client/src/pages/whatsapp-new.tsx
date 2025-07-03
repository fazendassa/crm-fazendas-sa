import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, Trash2 } from 'lucide-react';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatWindow } from '@/components/whatsapp/ChatWindow';
import { OpportunityPanel } from '@/components/whatsapp/OpportunityPanel';
import { TagsPanel } from '@/components/whatsapp/TagsPanel';
import { useToast } from '@/hooks/use-toast';

// Interfaces
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

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  isFromMe: boolean;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
}

export default function WhatsAppNew() {
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar sessões WhatsApp
  const { data: sessions, isLoading: loadingSessions } = useQuery<WhatsAppSession[]>({
    queryKey: ['/api/whatsapp/sessions'],
    refetchInterval: 5000,
  });

  // Buscar mensagens da sessão selecionada
  const { data: messages, isLoading: loadingMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: ['/api/whatsapp/messages', selectedSession?.id],
    enabled: !!selectedSession?.id,
    refetchInterval: 2000,
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
          queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedSession.id] });
        } else if (data.type === 'session_status_update') {
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

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async ({ content, type, contactPhone }: { content: string; type: string; contactPhone: string }) => {
      if (!selectedSession) throw new Error('Nenhuma sessão selecionada');
      
      return apiRequest(`/api/whatsapp/sessions/${selectedSession.id}/send-message`, 'POST', { content, type, contactPhone });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/messages', selectedSession?.id] });
      toast({
        title: "Mensagem enviada",
        description: "Mensagem enviada com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Erro ao enviar mensagem",
        variant: "destructive" 
      });
    }
  });

  // Mutation para criar nova sessão
  const createSessionMutation = useMutation({
    mutationFn: async (sessionName: string) => {
      return apiRequest('/api/whatsapp/sessions', 'POST', { sessionName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      toast({
        title: "Sessão criada",
        description: "Nova sessão WhatsApp criada com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar sessão",
        description: error.message || "Erro ao criar sessão",
        variant: "destructive"
      });
    }
  });

  // Mutation para deletar sessão
  const deleteSessionMutation = useMutation({
    mutationFn: async (sessionId: number) => {
      return apiRequest(`/api/whatsapp/sessions/${sessionId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      toast({
        title: "Sessão removida",
        description: "Sessão WhatsApp removida com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover sessão",
        description: error.message || "Erro ao remover sessão",
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

  // Verificar se há sessões conectadas
  const connectedSessions = sessions?.filter(s => s.status === 'connected') || [];
  const hasConnectedSession = connectedSessions.length > 0;

  // Selecionar automaticamente a primeira sessão conectada
  useEffect(() => {
    if (connectedSessions.length > 0 && !selectedSession) {
      setSelectedSession(connectedSessions[0]);
    }
  }, [connectedSessions, selectedSession]);

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
    const sessionName = `WhatsApp-${Date.now()}`;
    createSessionMutation.mutate(sessionName);
  };

  const handleDeleteSession = (sessionId: number) => {
    deleteSessionMutation.mutate(sessionId);
  };

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
                <Button 
                  onClick={handleCreateSession}
                  disabled={createSessionMutation.isPending}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {createSessionMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Criando sessão...
                    </>
                  ) : (
                    'Criar Nova Sessão'
                  )}
                </Button>

                {sessions && sessions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Sessões Existentes:</h4>
                    <div className="space-y-2">
                      {sessions.map(session => (
                        <div key={session.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{session.sessionName}</p>
                            <p className="text-sm text-gray-500">Status: {session.status}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteSession(session.id)}
                            className="text-red-600 hover:text-red-700"
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
          <div className="flex items-center">
            <Badge variant="secondary" className="text-green-700 bg-green-100">
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
                mediaUrl: m.mediaUrl || undefined
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
            <OpportunityPanel />
          </div>
          <div className="border-t border-gray-200">
            <TagsPanel
              selectedTags={selectedTags}
              availableTags={[
                { id: '1', name: 'Qualificação', color: '#3B82F6', count: 5 },
                { id: '2', name: 'VIP', color: '#F59E0B', count: 2 },
                { id: '3', name: 'Site Client', color: '#10B981', count: 8 },
                { id: '4', name: 'Oportunidade', color: '#EF4444', count: 3 },
                { id: '5', name: 'Follow-up', color: '#8B5CF6', count: 12 }
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}