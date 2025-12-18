import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { CheckCircle2, XCircle, Info } from "lucide-react";

export interface LogEntry {
  id: string;
  type: "success" | "error" | "info";
  message: string;
  timestamp: string;
}

interface LogPanelProps {
  logs: LogEntry[];
}

export function LogPanel({ logs }: LogPanelProps) {
  const getIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />;
      case "error":
        return <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
      case "info":
        return <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log de Processamento</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px] w-full rounded-md border p-4 bg-gray-50">
          {logs.length === 0 ? (
            <div className="text-center text-gray-500 text-sm py-8">
              Nenhum log disponível. Inicie a automação para ver o progresso.
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2">
                  {getIcon(log.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{log.message}</p>
                    <p className="text-xs text-gray-500">{log.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
