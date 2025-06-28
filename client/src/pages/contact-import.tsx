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
import { Upload, Download, FileText, X, Plus } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ContactImport() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [importResult, setImportResult] = useState<{
    success: number;
    errors: string[];
  } | null>(null);

  // Fetch pipelines
  const { data: pipelines } = useQuery({
    queryKey: ["/api/pipelines"],
  });

  // Fetch available tags
  const { data: availableTags } = useQuery({
    queryKey: ["/api/contacts/tags"],
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
    }
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

  const handleImport = () => {
    if (!file) {
      toast({
        title: "Erro",
        description: "Selecione um arquivo para importar",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    
    if (selectedPipeline) {
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

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="pipeline">Pipeline (Opcional)</Label>
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum pipeline</SelectItem>
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
              disabled={!file || importMutation.isPending}
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
                <p><strong>Formatos aceitos:</strong> Excel (.xlsx, .xls) e CSV (.csv)</p>
                <p><strong>Campos obrigatórios:</strong> Nome</p>
                <p><strong>Campos opcionais:</strong> Email, Telefone, Cargo, Empresa, Status</p>
              </div>
              
              <Separator />
              
              <div className="text-sm space-y-1">
                <p><strong>Nomes de colunas aceitos:</strong></p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-2">
                  <li>Nome / Name</li>
                  <li>Email / E-mail</li>
                  <li>Telefone / Phone</li>
                  <li>Cargo / Position</li>
                  <li>Empresa / Company</li>
                  <li>Status</li>
                  <li>Tags</li>
                </ul>
              </div>

              <Alert>
                <AlertDescription>
                  Se a empresa não existir, ela será criada automaticamente.
                  Tags podem ser separadas por vírgula na planilha.
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