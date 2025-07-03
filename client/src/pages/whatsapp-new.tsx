import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageSquare, Loader2, Trash2, Plus, QrCode, Wifi, WifiOff } from 'lucide-react';
import { ConversationList } from '@/components/whatsapp/ConversationList';
import { ChatWindow } from '@/components/whatsapp/ChatWindow';
import { OpportunityPanel } from '@/components/whatsapp/OpportunityPanel';
import { TagsPanel } from '@/components/whatsapp/TagsPanel';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  const { user } = useAuth();
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [showQrDialog, setShowQrDialog] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // WebSocket connection
  const { isConnected: wsConnected } = useWebSocket({
    userId: user?.id,
    onMessage: (data) => {
      console.log('📡 WebSocket message in WhatsApp page:', data);

      if (data.type === 'wa:qr') {
        console.log('📱 QR Code received via WebSocket');
        setCurrentQrCode(data.qrCode);
        setShowQrDialog(true);
      }

      if (data.type === 'wa:status') {
        console.log('📱 Status update received:', data.status);
        // Invalidate sessions query to refresh the list
        queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });

        if (data.status === 'connected') {
          setShowQrDialog(false);
          setCurrentQrCode(null);
          toast({
            title: "WhatsApp Conectado",
            description: "Sua sessão WhatsApp foi conectada com sucesso!"
          });
        }
      }
    }
  });

  // Check auth loading first
  const { isLoading: authLoading } = useAuth();

  // Buscar sessões WhatsApp
  const { data: sessionsData, isLoading: loadingSessions, error: sessionsError } = useQuery<WhatsAppSession[]>({
    queryKey: ['/api/whatsapp/sessions'],
    refetchInterval: 10000,
    onError: (error) => {
      console.error('Error loading sessions:', error);
    },
  });

  // Garantir que sessions seja sempre um array
  const sessions = Array.isArray(sessionsData) ? sessionsData : [];
  console.log('sessionsData:', sessionsData);
  console.log('sessions:', sessions);

  // Buscar contatos únicos para criar conversas (sem carregar mensagens ainda)
  const { data: contactsData, error: contactsError } = useQuery<any[]>({
    queryKey: [`/api/whatsapp/sessions/${selectedSession?.id}/contacts`],
    enabled: !!selectedSession?.id && selectedSession.status === 'connected',
    refetchInterval: 60000, // Atualizar contatos a cada 60 segundos
    onError: (error) => {
      console.error('Error loading contacts:', error);
    },
  });

  // Buscar todas as mensagens sem filtrar por conversa específica
  const { data: allMessagesData, isLoading: loadingAllMessages } = useQuery<WhatsAppMessage[]>({
    queryKey: [`/api/whatsapp/messages/${selectedSession?.id}`],
    enabled: !!selectedSession?.id,
    refetchInterval: 5000,
    onError: (error) => {
      console.error('Error loading all messages:', error);
    },
  });

  const allMessages = Array.isArray(allMessagesData) ? allMessagesData : [];

  // Filtrar mensagens para o contato selecionado
  const filteredMessages = React.useMemo(() => {
    if (!selectedContact || !allMessages) return [];
    
    return allMessages.filter(message => {
      const messagePhone = (message.contactNumber || '').replace(/\D/g, '');
      const contactPhone = (selectedContact.phone || '').replace(/\D/g, '');
      return messagePhone === contactPhone;
    });
  }, [selectedContact, allMessages]);

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
      console.log('🚀 Creating WhatsApp session:', sessionName);
      const result = await apiRequest('/api/whatsapp/create-session', 'POST', { sessionName });
      console.log('✅ Session creation result:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('✅ Session created successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      setNewSessionName('');
      toast({
        title: "Sessão criada",
        description: "Nova sessão WhatsApp criada com sucesso!"
      });
    },
    onError: (error: any) => {
      console.error('Error creating session:', error);
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

  // Mutation para desconectar sessão
  const disconnectSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/whatsapp/session', 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/sessions'] });
      setSelectedSession(null);
      toast({
        title: "Sessão desconectada",
        description: "Sessão WhatsApp desconectada com sucesso!"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Erro ao desconectar sessão",
        variant: "destructive"
      });
    }
  });

  // Log para debug
  if (sessionsError) {
    console.error('Sessions query error:', sessionsError);
  }

  if (contactsError) {
    console.error('Contacts query error:', contactsError);
  }

  // Converter contatos em conversas
  const conversations: Conversation[] = React.useMemo(() => {
    console.log('🔄 Processing conversations with contactsData:', contactsData?.length || 0, 'allMessages:', allMessages?.length || 0);
    
    // Garantir que temos arrays válidos
    const safeContactsData = Array.isArray(contactsData) ? contactsData : [];
    const safeMessages = Array.isArray(allMessages) ? allMessages : [];
    
    // Criar um mapa de conversas a partir das mensagens
    const conversationMap = new Map<string, Conversation>();

    // Primeiro, processar todas as mensagens para criar conversas
    safeMessages.forEach(message => {
      if (!message || !message.contactNumber) return;
      
      const key = message.contactNumber;
      
      // Extrair nome do contato de forma mais inteligente
      let contactName = message.contactName || '';
      if (!contactName || contactName === message.contactNumber) {
        // Se não tem nome, usar o número formatado
        const cleanNumber = (message.contactNumber || '').replace(/\D/g, '');
        if (cleanNumber.length >= 10) {
          contactName = `+${cleanNumber.slice(0, 2)} ${cleanNumber.slice(2, 4)} ${cleanNumber.slice(4)}`;
        } else {
          contactName = message.contactNumber || 'Contato';
        }
      }

      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: key,
          contactName: contactName,
          contactPhone: message.contactNumber,
          avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contactName)}&backgroundColor=random`,
          lastMessage: {
            id: message.id || 'unknown',
            content: message.messageContent || 'Mensagem',
            timestamp: new Date(message.timestamp || Date.now()),
            status: message.status || 'sent',
            isFromMe: message.isFromMe || false
          },
          unreadCount: 0,
          isPinned: false,
          tags: []
        });
      } else {
        const conversation = conversationMap.get(key)!;
        const messageTime = new Date(message.timestamp || Date.now());

        // Atualizar nome se este for melhor
        if (contactName && contactName !== message.contactNumber && conversation.contactName === message.contactNumber) {
          conversation.contactName = contactName;
          conversation.avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contactName)}&backgroundColor=random`;
        }

        if (messageTime > conversation.lastMessage.timestamp) {
          conversation.lastMessage = {
            id: message.id || 'unknown',
            content: message.messageContent || 'Mensagem',
            timestamp: messageTime,
            status: message.status || 'sent',
            isFromMe: message.isFromMe || false
          };
        }

        if (!message.isFromMe && message.status !== 'read') {
          conversation.unreadCount++;
        }
      }
    });

    // Agora, adicionar contatos que não tem mensagens ainda
    safeContactsData.forEach(contact => {
      if (!contact || contact.isGroup || !contact.phone) return;
      
      const key = contact.phone;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          id: contact.phone,
          contactName: contact.name || contact.phone || 'Contato',
          contactPhone: contact.phone,
          avatar: contact.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contact.name || contact.phone || 'Contato')}&backgroundColor=random`,
          lastMessage: {
            id: 'no-message',
            content: 'Clique para iniciar conversa',
            timestamp: new Date(0), // Data muito antiga para ficar no final
            status: 'sent' as const,
            isFromMe: false
          },
          unreadCount: 0,
          isPinned: false,
          tags: []
        });
      } else {
        // Atualizar informações do contato se disponível
        const conversation = conversationMap.get(key)!;
        if (contact.name && contact.name !== contact.phone) {
          conversation.contactName = contact.name;
          conversation.avatar = contact.profilePic || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(contact.name)}&backgroundColor=random`;
        }
      }
    });

    const result = Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessage.timestamp.getTime() - a.lastMessage.timestamp.getTime());
    
    console.log('📋 Created conversations:', result.length);
    return result;
  }, [contactsData, allMessages]);

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
      
      // Forçar reload das mensagens ao selecionar conversa
      if (selectedSession?.id) {
        queryClient.invalidateQueries({ queryKey: [`/api/whatsapp/messages/${selectedSession.id}`] });
      }
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
    if (!newSessionName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a sessão",
        variant: "destructive"
      });
      return;
    }
    createSessionMutation.mutate(newSessionName.trim());
  };

  const handleDeleteSession = (sessionId: number) => {
    deleteSessionMutation.mutate(sessionId);
  };

  const handleDisconnectSession = () => {
    disconnectSessionMutation.mutate();
  };

  // Verificar se há sessões conectadas
  const connectedSessions = sessions.filter(s => s.status === 'connected');
  const hasConnectedSession = connectedSessions.length > 0;

  // Selecionar automaticamente a primeira sessão conectada
  useEffect(() => {
    if (connectedSessions.length > 0 && !selectedSession) {
      setSelectedSession(connectedSessions[0]);
    }
  }, [connectedSessions, selectedSession]);

  // Early return if loading or no user (after all hooks are defined)
  if (authLoading || !user) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // Se não há sessões, mostrar tela de criação
  if (!loadingSessions && (!sessions || sessions.length === 0)) {
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
                  Para usar o chat do WhatsApp, você precisa criar uma sessão e conectar seu dispositivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Nome da sessão"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
                  />
                  <Button 
                    onClick={handleCreateSession}
                    disabled={createSessionMutation.isPending || !newSessionName.trim()}
                    className="shrink-0 bg-green-600 hover:bg-green-700"
                  >
                    {createSessionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Escaneie o QR Code
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Abra o WhatsApp no seu celular e escaneie este código para conectar:
              </p>
              <div className="flex justify-center">
                {currentQrCode ? (
                  <img 
                    src={currentQrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64 border rounded-lg"
                  />
                ) : (
                  <div className="w-64 h-64 border rounded-lg flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Gerando QR Code...</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center">
                O código será atualizado automaticamente se expirar
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQrDialog(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Se há sessões mas não há conectadas, mostrar interface com sessões disponíveis
  if (sessions && sessions.length > 0 && !hasConnectedSession) {
    return (
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md w-full">
            <Card className="border-gray-200">
              <CardHeader className="text-center">
                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="w-8 h-8 text-yellow-600" />
                </div>
                <CardTitle className="text-xl text-gray-900">Sessões Disponíveis</CardTitle>
                <CardDescription className="text-gray-600">
                  Há sessões criadas mas nenhuma conectada. Conecte uma sessão ou crie uma nova.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          session.status === 'connected' ? 'bg-green-500' :
                          session.status === 'connecting' ? 'bg-yellow-500' :
                          session.status === 'error' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                        <div>
                          <p className="font-medium text-gray-900">{session.sessionName}</p>
                          <p className="text-sm text-gray-500">
                            Status: {session.status}
                            {session.phoneNumber && ` • ${session.phoneNumber}`}
                          </p>
                        </div>
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

                <div className="border-t pt-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome da nova sessão"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateSession()}
                    />
                    <Button 
                      onClick={handleCreateSession}
                      disabled={createSessionMutation.isPending || !newSessionName.trim()}
                      className="shrink-0 bg-green-600 hover:bg-green-700"
                    >
                      {createSessionMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Nova Sessão
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* QR Code Dialog */}
        <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                Escaneie o QR Code
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Abra o WhatsApp no seu celular e escaneie este código para conectar:
              </p>
              <div className="flex justify-center">
                {currentQrCode ? (
                  <img 
                    src={currentQrCode} 
                    alt="QR Code WhatsApp" 
                    className="w-64 h-64 border rounded-lg"
                  />
                ) : (
                  <div className="w-64 h-64 border rounded-lg flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-500">Gerando QR Code...</p>
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 text-center">
                O código será atualizado automaticamente se expirar
              </p>
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowQrDialog(false)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
          <div className="flex items-center gap-3">
            {selectedSession && (
                <>
                  <Badge variant="secondary" className={`${
                    selectedSession.status === 'connected' ? 'text-green-700 bg-green-100' :
                    selectedSession.status === 'connecting' ? 'text-yellow-700 bg-yellow-100' :
                    'text-red-700 bg-red-100'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      selectedSession.status === 'connected' ? 'bg-green-500' :
                      selectedSession.status === 'connecting' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    {selectedSession.status === 'connected' ? 'Conectado' :
                     selectedSession.status === 'connecting' ? 'Conectando' : 'Erro'}
                  </Badge>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDisconnectSession}
                    disabled={disconnectSessionMutation.isPending}
                    className="text-red-600 hover:text-red-700"
                    title="Desconectar sessão"
                  >
                    {disconnectSessionMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <WifiOff className="w-4 h-4" />
                    )}
                    <span className="ml-1 text-xs">Desconectar</span>
                  </Button>
                </>
              )}
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
            isLoading={loadingAllMessages}
            sessionId={selectedSession?.id}
          />
        </div>

        {/* Painel Central - Janela de Chat */}
        <div className="flex-1 flex flex-col">
          <ChatWindow
            contact={selectedContact}
            messages={filteredMessages.map(m => ({
              id: m.id,
              content: m.messageContent,
              timestamp: new Date(m.timestamp),
              status: m.status,
              isFromMe: m.isFromMe,
              type: m.messageType,
              mediaUrl: m.mediaUrl || undefined
            }))}
            onSendMessage={handleSendMessage}
            onStartNewChat={() => console.log('Start new chat')}
            onCloseChat={() => setSelectedConversation(null)}
            isTyping={isTyping}
            deviceInfo={selectedSession ? `WhatsApp Web – ${selectedSession.sessionName} (${selectedSession.phoneNumber || 'Conectando...'})` : ''}
            sessionId={selectedSession?.id}
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

      {/* QR Code Dialog */}
      <Dialog open={showQrDialog} onOpenChange={setShowQrDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="w-5 h-5" />
              Escaneie o QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Abra o WhatsApp no seu celular e escaneie este código para conectar:
            </p>
            <div className="flex justify-center">
              {currentQrCode ? (
                <img 
                  src={currentQrCode} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64 border rounded-lg"
                />
              ) : (
                <div className="w-64 h-64 border rounded-lg flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-500">Gerando QR Code...</p>
                  </div>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center">
              O código será atualizado automaticamente se expirar
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQrDialog(false)}
              >
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}