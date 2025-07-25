import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MessageSquare, Loader2, Wifi, WifiOff, Send, Phone, Video, MoreVertical, Users, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Interfaces para nossa API W-API
interface WApiStatus {
  status: 'CONNECTED' | 'DISCONNECTED' | 'QRCODE' | 'LOADING';
  qrcode?: string;
  phone?: string;
}

interface WApiMessage {
  id: string;
  sessionId: number;
  messageId: string;
  chatId: string;
  fromNumber: string;
  toNumber: string;
  content: string;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'file';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  isRead: boolean;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
}

interface Conversation {
  contact: Contact;
  lastMessage: WApiMessage;
}

export default function WhatsAppWApi() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  // Verificar status da W-API
  const { data: wapiStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['/api/whatsapp/status'],
    queryFn: () => apiRequest('/api/whatsapp/status'),
    enabled: !authLoading,
    refetchInterval: 30000, // Verificar status a cada 30 segundos
    select: (response: any): WApiStatus => {
      if (!response?.success || !response?.data) {
        return { status: 'DISCONNECTED' };
      }

      // Lógica para determinar o status com base na resposta
      if (response.data.error && response.data.error.includes('QRCODE')) {
        return { status: 'QRCODE' };
      }

      return {
        status: response.data.connected ? 'CONNECTED' : 'DISCONNECTED',
        phone: response.data.phone
      };
    },
  });

  // Buscar QR Code se o status for QRCODE
  const { data: qrCodeResp, isFetching: loadingQrCode } = useQuery<{ success: boolean; data?: { qrcode: string }; error?: string }>({ 
    queryKey: ['/api/whatsapp/qrcode'],
    queryFn: () => apiRequest('/api/whatsapp/qrcode'),
    enabled: !authLoading && wapiStatus?.status === 'QRCODE',
    refetchInterval: 15000, 
  });

  const qrCodeBase64 = qrCodeResp?.data?.qrcode;

  // Buscar conversas ativas
  const { data: conversations, isLoading: loadingConversations } = useQuery<{ success: boolean, data: any[] }>({ 
    queryKey: ['/api/whatsapp/conversations'],
    queryFn: () => apiRequest('/api/whatsapp/conversations'),
    enabled: !authLoading && wapiStatus?.status === 'CONNECTED',
    refetchInterval: 10000, // Atualizar conversas a cada 10 segundos
  });

  // Buscar histórico de mensagens do contato selecionado
  const { data: messages, isLoading: loadingMessages } = useQuery<{ success: boolean, data: { messages: WApiMessage[] } }>({ 
    queryKey: ['/api/whatsapp/history', selectedContact?.phone],
    queryFn: () => apiRequest(`/api/whatsapp/history/${selectedContact?.phone}`),
    enabled: !authLoading && !!selectedContact?.phone,
    refetchInterval: 3000, // Atualizar mensagens a cada 3 segundos
  });

  // Mutation para enviar mensagem
  const sendMessageMutation = useMutation({
    mutationFn: async ({ phone, message }: { phone: string; message: string }) => {
      return apiRequest('/api/whatsapp/send', 'POST', { phone, message });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/history', selectedContact?.phone] });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/conversations'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao Enviar Mensagem',
        description: error.message || 'Não foi possível enviar a mensagem. Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const handleSendMessage = () => {
    if (newMessage.trim() && selectedContact) {
      sendMessageMutation.mutate({ phone: selectedContact.phone, message: newMessage });
    }
  };

  const handleStartNewChat = () => {
    if (newContactPhone.trim()) {
      const existingContact = conversations?.data.find(c => c.contact.phone === newContactPhone);
      if (existingContact) {
        setSelectedContact(existingContact.contact);
      } else {
        const newContact: Contact = { id: newContactPhone, name: newContactPhone, phone: newContactPhone };
        setSelectedContact(newContact);
      }
      setShowNewChat(false);
      setNewContactPhone('');
    }
  };

  useEffect(() => {
    const chatBox = document.getElementById('chat-box');
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [messages]);

  const formatMessageTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm');
  };

  const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp);
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  if (authLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Coluna 1: Lista de Conversas */}
      <div className="w-96 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">WhatsApp W-API</h2>
            {wapiStatus?.status === 'CONNECTED' ? (
              <Badge variant="default" className="bg-green-500 text-white">
                <Wifi className="w-3 h-3 mr-1" />
                Conectado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="w-3 h-3 mr-1" />
                Desconectado
              </Badge>
            )}
          </div>
        </div>
        
        <Button onClick={() => setShowNewChat(true)} className="m-4">Nova Conversa</Button>

        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-4 text-center text-gray-500">Carregando conversas...</div>
          ) : wapiStatus?.status !== 'CONNECTED' ? (
            <div className="p-4 text-center text-gray-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
              Conecte-se ao WhatsApp para ver suas conversas.
            </div>
          ) : conversations?.data.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Nenhuma conversa encontrada.</div>
          ) : (
            conversations?.data.map((conv: Conversation) => (
              <div
                key={conv.contact.phone} // Usando o telefone como chave única
                className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedContact?.phone === conv.contact.phone ? 'bg-blue-50' : ''}`}
                onClick={() => setSelectedContact(conv.contact)}
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${conv.contact.name.replace(' ', '+')}&background=random`} />
                    <AvatarFallback>{conv.contact.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">{conv.contact.name}</h3>
                      <span className="text-xs text-gray-500">{formatMessageTime(conv.lastMessage.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {conv.lastMessage.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Coluna 2: Chat Ativo */}
      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={`https://ui-avatars.com/api/?name=${selectedContact.name.replace(' ', '+')}&background=random`} />
                  <AvatarFallback>{selectedContact.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedContact.name}</h3>
                  <p className="text-sm text-green-600">Online</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-gray-500">
                <Phone className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                <Video className="w-5 h-5 cursor-pointer hover:text-gray-700" />
                <MoreVertical className="w-5 h-5 cursor-pointer hover:text-gray-700" />
              </div>
            </div>
            
            <ScrollArea id="chat-box" className="flex-1 p-4 bg-gray-50">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                messages?.data.messages.map((msg, index) => {
                  const prevMsg = messages.data.messages[index - 1];
                  const showDate = !prevMsg || formatMessageDate(prevMsg.timestamp) !== formatMessageDate(msg.timestamp);
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div className="text-center my-4">
                          <Badge variant="secondary">{formatMessageDate(msg.timestamp)}</Badge>
                        </div>
                      )}
                      <div className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-lg p-3 rounded-lg ${msg.direction === 'outgoing' ? 'bg-blue-500 text-white' : 'bg-white'}`}>
                          <p>{msg.content}</p>
                          <span className="text-xs opacity-75 float-right mt-1">{formatMessageTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </ScrollArea>

            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Digite uma mensagem..."
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button onClick={handleSendMessage} disabled={sendMessageMutation.isPending || !newMessage.trim()}>
                  {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
              <p>Escolha uma conversa da lista ou inicie uma nova para começar.</p>
            </div>
          </div>
        )}
      </div>

      {/* Coluna 3: Painel de Status */}
      <div className="w-80 bg-white border-l border-gray-200 p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Status W-API
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Conexão:</span>
              {loadingStatus ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : wapiStatus?.status === 'CONNECTED' ? (
                <Badge variant="default" className="bg-green-500">Conectado</Badge>
              ) : wapiStatus?.status === 'QRCODE' ? (
                <Badge className="bg-yellow-500 text-white">Escaneie QR</Badge>
              ) : (
                <Badge variant="destructive">Desconectado</Badge>
              )}
            </div>
            
            {wapiStatus?.phone && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Telefone:</span>
                <span className="text-sm text-gray-600">{wapiStatus.phone}</span>
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Status:</span>
              <span className="text-sm text-gray-600">{wapiStatus?.status || 'Verificando...'}</span>
            </div>

            {wapiStatus?.status === 'QRCODE' && (loadingQrCode ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : qrCodeBase64) && (
              <div className="text-center">
                <p className="text-sm mb-2">Escaneie para conectar:</p>
                <img src={`data:image/png;base64,${qrCodeBase64}`} alt="QR Code WhatsApp" className="mx-auto w-48 h-48 border" />
              </div>
            )}

            <Separator />
            
            <div className="text-xs text-gray-500">
              <p>• As mensagens são sincronizadas automaticamente</p>
              <p>• Status atualizado a cada 30 segundos</p>
              <p>• Conversas atualizadas a cada 10 segundos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para Nova Conversa */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardHeader>
              <CardTitle>Nova Conversa</CardTitle>
              <CardDescription>
                Digite o número de telefone com código do país (ex: 5511999998888)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="5511999998888"
                type="tel"
              />
              <div className="flex gap-2">
                <Button onClick={handleStartNewChat} className="flex-1">
                  Iniciar Conversa
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowNewChat(false);
                    setNewContactPhone('');
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
