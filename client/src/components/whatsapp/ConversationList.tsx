import React, { useState } from 'react';
import { Search, Filter, Check, Archive, Clock, CircleDot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read' | 'pending';
  isFromMe: boolean;
}

interface Conversation {
  id: string;
  contactName: string;
  contactPhone: string;
  avatar?: string;
  lastMessage: Message;
  unreadCount: number;
  isPinned: boolean;
  tags: string[];
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedConversation: string | null;
  onSelectConversation: (conversationId: string) => void;
  isLoading?: boolean;
}

export function ConversationList({ 
  conversations, 
  selectedConversation, 
  onSelectConversation,
  isLoading = false 
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedFilters, setAppliedFilters] = useState(0);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <Check className="w-3 h-3 text-gray-500" />;
      case 'read':
        return <div className="flex"><Check className="w-3 h-3 text-blue-500" /><Check className="w-3 h-3 text-blue-500 -ml-1" /></div>;
      case 'pending':
        return <Clock className="w-3 h-3 text-gray-400" />;
      default:
        return <CircleDot className="w-3 h-3 text-red-500" />;
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Pesquisar"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4" />
                {appliedFilters > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {appliedFilters}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Por data</DropdownMenuItem>
              <DropdownMenuItem>Por status</DropdownMenuItem>
              <DropdownMenuItem>Por tags</DropdownMenuItem>
              <DropdownMenuItem>Por dispositivo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {appliedFilters > 0 && (
          <Badge variant="outline" className="text-xs">
            {appliedFilters} filtros aplicados
          </Badge>
        )}
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {conversations.map((conversation) => (
            <Card 
              key={conversation.id}
              className={`mb-2 cursor-pointer transition-all duration-200 hover:bg-gray-50 group ${
                selectedConversation === conversation.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={conversation.avatar} />
                      <AvatarFallback className="bg-gray-100 text-gray-600 text-sm">
                        {getInitials(conversation.contactName)}
                      </AvatarFallback>
                    </Avatar>
                    {conversation.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-gray-900 truncate">
                        {conversation.contactName}
                      </h3>
                      <span className="text-xs text-gray-500 shrink-0">
                        {formatTime(conversation.lastMessage.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mb-2">
                      {conversation.lastMessage.isFromMe && getStatusIcon(conversation.lastMessage.status)}
                      <p className="text-sm text-gray-600 truncate flex-1">
                        {conversation.lastMessage.content}
                      </p>
                    </div>

                    {/* Tags */}
                    {conversation.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {conversation.tags.slice(0, 2).map((tag, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {conversation.tags.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{conversation.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hover Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Mark as read logic
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Archive logic
                      }}
                    >
                      <Archive className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}