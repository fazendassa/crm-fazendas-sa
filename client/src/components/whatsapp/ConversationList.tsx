import React, { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, Plus, Filter, MoreVertical, MessageSquare, Users, RefreshCw } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  isLoading: boolean;
  sessionId?: number;
}

export function ConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  isLoading,
  sessionId
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const { toast } = useToast();

  const filteredConversations = conversations.filter(conversation =>
    conversation.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conversation.contactPhone.includes(searchQuery) ||
    conversation.lastMessage.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatLastMessageTime = (timestamp: Date) => {
    if (isToday(timestamp)) {
      return format(timestamp, 'HH:mm', { locale: ptBR });
    } else if (isYesterday(timestamp)) {
      return 'Ontem';
    } else {
      return format(timestamp, 'dd/MM', { locale: ptBR });
    }
  };

  const getStatusIcon = (status: string, isFromMe: boolean) => {
    if (!isFromMe) return '';

    switch (status) {
      case 'sent':
        return '✓';
      case 'delivered':
        return '✓✓';
      case 'read':
        return '✓✓';
      default:
        return '⏳';
    }
  };

  const handleSyncContacts = async () => {
    if (!sessionId) {
      toast({
        title: "Erro",
        description: "Sessão não encontrada",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingContacts(true);
    try {
      const contacts = await apiRequest(`/api/whatsapp/sessions/${sessionId}/contacts`, 'GET');
      console.log('Contatos sincronizados:', contacts);

      toast({
        title: "Contatos sincronizados",
        description: `${contacts.length} contatos encontrados`
      });
    } catch (error) {
      console.error('Erro ao sincronizar contatos:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os contatos",
        variant: "destructive"
      });
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleSyncChats = async () => {
    if (!sessionId) {
      toast({
        title: "Erro",
        description: "Sessão não encontrada",
        variant: "destructive"
      });
      return;
    }

    setIsLoadingContacts(true);
    try {
      const chats = await apiRequest(`/api/whatsapp/sessions/${sessionId}/chats`, 'GET');
      console.log('Chats sincronizados:', chats);

      toast({
        title: "Chats sincronizados",
        description: `${chats.length} chats encontrados`
      });
    } catch (error) {
      console.error('Erro ao sincronizar chats:', error);
      toast({
        title: "Erro ao sincronizar",
        description: "Não foi possível sincronizar os chats",
        variant: "destructive"
      });
    } finally {
      setIsLoadingContacts(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Carregando conversas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Conversas</h2>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSyncContacts}
              disabled={isLoadingContacts}
              title="Sincronizar contatos"
            >
              {isLoadingContacts ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Users className="w-4 h-4" />
              )}
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSyncChats}
              disabled={isLoadingContacts}
              title="Sincronizar chats"
            >
              <MessageSquare className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowFilters(!showFilters)}>
              <Filter className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <Plus className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Pesquisar conversas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="text-xs">
              Não lidas
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              Grupos
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              Fixadas
            </Button>
          </div>
        )}
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 p-4">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 text-center">
              {searchQuery ? 'Nenhuma conversa encontrada' : 'Nenhuma conversa ainda'}
            </p>
            {!searchQuery && (
              <div className="text-center mt-3">
                <p className="text-sm text-gray-400 mb-3">
                  As conversas aparecerão aqui quando você receber mensagens
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncContacts}
                    disabled={isLoadingContacts}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    Sincronizar Contatos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncChats}
                    disabled={isLoadingContacts}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Sincronizar Chats
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedConversation === conversation.id ? 'bg-green-50 border-r-2 border-green-600' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage 
                        src={conversation.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${conversation.contactName}`} 
                      />
                      <AvatarFallback>
                        {conversation.contactName.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs bg-green-600 hover:bg-green-600">
                        {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.contactName}
                      </h3>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatLastMessageTime(conversation.lastMessage.timestamp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-500">
                        {getStatusIcon(conversation.lastMessage.status, conversation.lastMessage.isFromMe)}
                      </span>
                      <p className="text-sm text-gray-600 truncate flex-1">
                        {conversation.lastMessage.isFromMe && 'Você: '}
                        {conversation.lastMessage.content}
                      </p>
                    </div>

                    {/* Tags */}
                    {conversation.tags.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {conversation.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {conversation.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{conversation.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}