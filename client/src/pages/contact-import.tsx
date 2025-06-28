
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, Download, FileText, X, Plus, ArrowRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FieldMapping {
  [key: string]: string; // column name -> field name
}

export default function ContactImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);
  const [fileColumns, setFileColumns] = useState<string[]>([]);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [showMapping, setShowMapping] = useState(false);

  // Available system fields
  const systemFields = [
    { value: "name", label: "Nome" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Telefone" },
    { value: "position", label: "Cargo" },
    { value: "company", label: "Empresa" },
    { value: "status", label: "Status" },
    { value: "tags", label: "Tags" },
    { value: "", label: "Ignorar campo" }
  ];

  // Fetch pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["/api/pipelines"],
  });

  // Fetch available tags
  const { data: availableTags } = useQuery({
    queryKey: ["/api/contacts/tags"],
  });

  // Preview file mutation to get columns
  const previewMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/contacts/preview-import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro ao analisar arquivo");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setFileColumns(data.columns);
      
      // Auto-map common fields
      const autoMapping: FieldMapping = {};
      data.columns.forEach((column: string) => {
        const lowerColumn = column.toLowerCase();
        if (lowerColumn.includes('nome') || lowerColumn.includes('name')) {
          autoMapping[column] = 'name';
        } else if (lowerColumn.includes('email') || lowerColumn.includes('e-mail')) {
          autoMapping[column] = 'email';
        } else if (lowerColumn.includes('telefone') || lowerColumn.includes('phone')) {
          autoMapping[column] = 'phone';
        } else if (lowerColumn.includes('cargo') || lowerColumn.includes('position')) {
          autoMapping[column] = 'position';
        } else if (lowerColumn.includes('empresa') || lowerColumn.includes('company')) {
          autoMapping[column] = 'company';
        } else if (lowerColumn.includes('status')) {
          autoMapping[column] = 'status';
        } else if (lowerColumn.includes('tags')) {
          autoMapping[column] = 'tags';
        }
      });
      
      setFieldMapping(autoMapping);
      setShowMapping(true);
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao Analisar Arquivo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/contacts/import", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Erro na importação");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "Importação Concluída",
        description: `${data.success} contatos importados com sucesso`,
      });
      setShowMapping(false);
      setFile(null);
      setFileColumns([]);
      setFieldMapping({});
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na Importação",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      setShowMapping(false);
      setFileColumns([]);
      setFieldMapping({});
    }
  };

  const analyzeFile = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    previewMutation.mutate(formData);
  };

  const addTag = () => {
    if (newTag.trim() && !selectedTags.includes(newTag.trim())) {
      setSelectedTags([...selectedTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setSelectedTags(selectedTags.filter(tag => tag !== tagToRemove));
  };

  const addExistingTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const updateFieldMapping = (column: string, field: string) => {
    setFieldMapping(prev => ({
      ...prev,
      [column]: field
    }));
  };

  const handleImport = () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para importar",
        variant: "destructive",
      });
      return;
    }

    // Check if at least name field is mapped
    const nameMapping = Object.values(fieldMapping).includes('name');
    if (!nameMapping) {
      toast({
        title: "Erro",
        description: "É obrigatório mapear pelo menos o campo Nome",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fieldMapping", JSON.stringify(fieldMapping));
    
    if (selectedPipeline && selectedPipeline !== "none") {
      formData.append("pipelineId", selectedPipeline);
    }
    
    if (selectedTags.length > 0) {
      formData.append("tags", JSON.stringify(selectedTags));
    }

    importMutation.mutate(formData);
  };

  const downloadTemplate = () => {
    window.open("/api/contacts/import-template", "_blank");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Importar Contatos</h1>
          <p className="text-muted-foreground">
            Importe contatos em massa via arquivos Excel (.xlsx) ou CSV
          </p>
        </div>
        <Button onClick={downloadTemplate} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Baixar Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload do Arquivo
            </CardTitle>
            <CardDescription>
              Selecione um arquivo Excel (.xlsx, .xls) ou CSV (.csv) com os dados dos contatos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Arquivo</Label>
              <Input
                id="file"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm">{file.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setFile(null)}
                    className="ml-auto h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>

            {file && !showMapping && (
              <Button 
                onClick={analyzeFile} 
                disabled={previewMutation.isPending}
                className="w-full"
              >
                {previewMutation.isPending ? "Analisando..." : "Analisar Arquivo"}
              </Button>
            )}

            {showMapping && (
              <>
                <Separator />
                
                <div className="space-y-3">
                  <Label>Mapeamento de Campos</Label>
                  <p className="text-sm text-muted-foreground">
                    Selecione qual campo do sistema cada coluna da planilha representa:
                  </p>
                  
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {fileColumns.map((column) => (
                      <div key={column} className="flex items-center gap-2 p-2 border rounded">
                        <span className="text-sm font-medium min-w-0 flex-1 truncate">
                          {column}
                        </span>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <Select
                          value={fieldMapping[column] || ""}
                          onValueChange={(value) => updateFieldMapping(column, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Campo" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemFields.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="pipeline">Pipeline (Opcional)</Label>
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum pipeline</SelectItem>
                  {(pipelines as any[])?.map((pipeline: any) => (
                    <SelectItem key={pipeline.id} value={pipeline.id.toString()}>
                      {pipeline.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tags (Opcional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nova tag"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && addTag()}
                />
                <Button onClick={addTag} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTag(tag)}
                        className="h-4 w-4 p-0 hover:bg-transparent"
                      >
                        <X className="h-2 w-2" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}

              {availableTags && Array.isArray(availableTags) && availableTags.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tags existentes:</Label>
                  <div className="flex flex-wrap gap-1">
                    {(availableTags as string[]).map((tag: string) => (
                      <Button
                        key={tag}
                        size="sm"
                        variant="ghost"
                        onClick={() => addExistingTag(tag)}
                        className="h-6 text-xs"
                        disabled={selectedTags.includes(tag)}
                      >
                        {tag}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleImport} 
              disabled={!showMapping || importMutation.isPending}
              className="w-full"
            >
              {importMutation.isPending ? "Importando..." : "Importar Contatos"}
            </Button>
          </CardContent>
        </Card>

        {/* Instructions and Results */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Instruções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p><strong>Novo processo de importação:</strong></p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Selecione seu arquivo Excel ou CSV</li>
                  <li>Clique em "Analisar Arquivo"</li>
                  <li>Mapeie os campos da planilha</li>
                  <li>Configure pipeline e tags (opcional)</li>
                  <li>Finalize a importação</li>
                </ol>
              </div>
              
              <Separator />
              
              <div className="text-sm space-y-1">
                <p><strong>Campos disponíveis:</strong></p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li><strong>Nome:</strong> Obrigatório</li>
                  <li>Email, Telefone, Cargo</li>
                  <li>Empresa, Status, Tags</li>
                </ul>
              </div>

              <Alert>
                <AlertDescription>
                  O mapeamento permite usar qualquer nome de coluna na sua planilha.
                  Se a empresa não existir, ela será criada automaticamente.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Import Results */}
          {importResult && (
            <Card>
              <CardHeader>
                <CardTitle className="text-green-600">Resultado da Importação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Contatos importados:</span>
                  <Badge variant="default">{importResult.success}</Badge>
                </div>
                
                {importResult.errors.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-destructive">Erros encontrados:</Label>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
