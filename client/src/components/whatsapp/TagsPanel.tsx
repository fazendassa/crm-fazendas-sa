import React, { useState } from 'react';
import { Search, Plus, X, Tag, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Tag {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface TagsPanelProps {
  availableTags?: Tag[];
  selectedTags?: string[];
  onTagToggle?: (tagId: string) => void;
  onCreateTag?: (name: string) => void;
  onDeleteTag?: (tagId: string) => void;
  onSearchTags?: (query: string) => void;
}

export function TagsPanel({
  availableTags,
  selectedTags,
  onTagToggle,
  onCreateTag,
  onDeleteTag,
  onSearchTags
}: TagsPanelProps) {
  const [isCreateTagOpen, setIsCreateTagOpen] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag(newTagName.trim());
      setNewTagName('');
      setIsCreateTagOpen(false);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearchTags(query);
  };

  const getTagColor = (color: string) => {
    const colors: { [key: string]: string } = {
      blue: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
      green: 'bg-green-100 text-green-800 hover:bg-green-200',
      yellow: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      red: 'bg-red-100 text-red-800 hover:bg-red-200',
      purple: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
      pink: 'bg-pink-100 text-pink-800 hover:bg-pink-200',
      indigo: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
      gray: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    };
    return colors[color] || colors.gray;
  };

  const predefinedTags = availableTags.filter(tag => 
    ['Qualificação', 'Site Client', 'Evento Concl', 'Proposta', 'Negociação', 'Cliente VIP'].includes(tag.name)
  );

  const filteredTags = availableTags.filter(tag => 
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white border-b border-gray-200 p-4 space-y-4">
      {/* Quick Filter Tags */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-600" />
          <h3 className="font-medium text-gray-900">Filtros Rápidos</h3>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {predefinedTags.map((tag) => (
            <Button
              key={tag.id}
              variant={selectedTags.includes(tag.id) ? "default" : "outline"}
              size="sm"
              onClick={() => onTagToggle(tag.id)}
              className={`h-8 ${
                selectedTags.includes(tag.id) 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : getTagColor(tag.color)
              }`}
            >
              <Tag className="w-3 h-3 mr-2" />
              {tag.name}
              {tag.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tag.count}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Tag Search and Management */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-600" />
          <h3 className="font-medium text-gray-900">Buscar Tags</h3>
        </div>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar ou criar tags..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Popover open={isCreateTagOpen} onOpenChange={setIsCreateTagOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-gray-900">Nova Tag</h4>
                <Input
                  placeholder="Nome da tag"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag();
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim()}
                    className="flex-1"
                  >
                    Criar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={() => setIsCreateTagOpen(false)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Selected Tags */}
        {selectedTags.length > 0 && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-700 mb-2">Tags Aplicadas:</p>
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tagId) => {
                const tag = availableTags.find(t => t.id === tagId);
                if (!tag) return null;
                
                return (
                  <Badge
                    key={tagId}
                    variant="secondary"
                    className={`${getTagColor(tag.color)} flex items-center gap-1`}
                  >
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-transparent"
                      onClick={() => onTagToggle(tagId)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                );
              })}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => selectedTags.forEach(id => onTagToggle(id))}
                className="text-gray-500 hover:text-gray-700"
              >
                Limpar Tudo
              </Button>
            </div>
          </div>
        )}

        {/* Available Tags */}
        {searchQuery && (
          <Card>
            <CardContent className="p-3">
              <div className="max-h-40 overflow-y-auto">
                {filteredTags.length > 0 ? (
                  <div className="space-y-1">
                    {filteredTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 cursor-pointer"
                        onClick={() => onTagToggle(tag.id)}
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-full ${getTagColor(tag.color).split(' ')[0]}`}
                          />
                          <span className="text-sm text-gray-900">{tag.name}</span>
                          {tag.count > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {tag.count}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {selectedTags.includes(tag.id) && (
                            <Badge variant="secondary" className="text-xs">
                              Aplicada
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-gray-400 hover:text-red-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTag(tag.id);
                            }}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500 mb-2">
                      Nenhuma tag encontrada para "{searchQuery}"
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onCreateTag(searchQuery);
                        setSearchQuery('');
                      }}
                    >
                      <Plus className="w-3 h-3 mr-2" />
                      Criar "{searchQuery}"
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary */}
      <div className="pt-2 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {selectedTags.length > 0 
              ? `${selectedTags.length} filtro(s) aplicado(s)`
              : 'Nenhum filtro aplicado'
            }
          </span>
          <span>{availableTags.length} tags disponíveis</span>
        </div>
      </div>
    </div>
  );
}