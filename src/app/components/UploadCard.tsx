import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";

interface UploadCardProps {
  fileName: string | null;
  onFileSelect: (file: File) => void;
}

export function UploadCard({ fileName, onFileSelect }: UploadCardProps) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload da Planilha</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-4">
          <label htmlFor="file-upload" className="cursor-pointer">
            <input
              id="file-upload"
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              size="lg"
              className="w-full sm:w-auto"
              onClick={() => document.getElementById("file-upload")?.click()}
            >
              <Upload className="w-5 h-5 mr-2" />
              Selecionar planilha (.xlsx ou .csv)
            </Button>
          </label>

          {fileName && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Arquivo selecionado:</span> {fileName}
            </div>
          )}

          <div className="text-sm text-gray-500 text-center max-w-2xl">
            <p className="font-medium mb-2">
              A planilha deve conter os campos:
            </p>
            <p className="text-xs">
              APÓLICE, PARCELA, PROPOSTA, VALOR, VIGÊNCIA, CNPJ/CPF, NOME,
              STATUS, OBSERVAÇÃO
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
