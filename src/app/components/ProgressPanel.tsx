import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Progress } from "./ui/progress";

interface ProgressPanelProps {
  total: number;
  cancelados: number;
  erros: number;
  progress: number;
}

export function ProgressPanel({
  total,
  cancelados,
  erros,
  progress,
}: ProgressPanelProps) {
  const pendentes = total - cancelados - erros;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progresso da Automação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Processamento</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-3" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-semibold text-gray-900">{total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-semibold text-green-700">
              {cancelados}
            </div>
            <div className="text-sm text-green-600">Cancelados</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-semibold text-red-700">{erros}</div>
            <div className="text-sm text-red-600">Erros</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-semibold text-blue-700">
              {pendentes}
            </div>
            <div className="text-sm text-blue-600">Pendentes</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
