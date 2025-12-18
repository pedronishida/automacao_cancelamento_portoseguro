import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { ScrollArea } from "./ui/scroll-area";

export interface PolicyRecord {
  apolice: string;
  nome: string;
  cnpjCpf: string;
  vigencia: string;
  status: "pendente" | "processando" | "cancelado" | "erro";
  observacao: string;
}

interface DataTableProps {
  records: PolicyRecord[];
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-gray-100 text-gray-700" },
  processando: { label: "Processando", className: "bg-blue-100 text-blue-700" },
  cancelado: { label: "Cancelado", className: "bg-green-100 text-green-700" },
  erro: { label: "Erro", className: "bg-red-100 text-red-700" },
};

/**
 * Normaliza o status para garantir que seja um dos valores válidos
 */
function normalizeStatus(status: string | undefined | null): keyof typeof statusConfig {
  if (!status) return "pendente";
  
  const normalized = status.toLowerCase().trim();
  
  // Mapear variações comuns
  if (normalized === "cancelado" || normalized === "cancelada") return "cancelado";
  if (normalized === "processando" || normalized === "em processamento") return "processando";
  if (normalized === "erro" || normalized === "error" || normalized === "falha") return "erro";
  if (normalized === "pendente" || normalized === "aguardando") return "pendente";
  
  // Se não reconhecer, retornar pendente como padrão
  return "pendente";
}

export function DataTable({ records }: DataTableProps) {
  if (records.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização dos Dados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            Nenhuma planilha carregada. Faça o upload para visualizar os dados.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pré-visualização dos Dados</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Apólice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CNPJ/CPF</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.apolice}>
                  <TableCell className="font-medium">
                    {record.apolice}
                  </TableCell>
                  <TableCell>{record.nome}</TableCell>
                  <TableCell>{record.cnpjCpf}</TableCell>
                  <TableCell>{record.vigencia}</TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={statusConfig[normalizeStatus(record.status)].className}
                    >
                      {statusConfig[normalizeStatus(record.status)].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {record.observacao}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
