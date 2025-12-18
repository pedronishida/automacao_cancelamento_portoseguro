import { Play, Pause, RotateCcw, Download } from "lucide-react";
import { Button } from "./ui/button";

interface ActionButtonsProps {
  isProcessing: boolean;
  hasRecords: boolean;
  onStart: () => void;
  onPause: () => void;
  onReprocess: () => void;
  onDownload: () => void;
}

export function ActionButtons({
  isProcessing,
  hasRecords,
  onStart,
  onPause,
  onReprocess,
  onDownload,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap gap-3 justify-end">
      {!isProcessing ? (
        <Button
          onClick={onStart}
          disabled={!hasRecords}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Play className="w-4 h-4 mr-2" />
          Iniciar Automação
        </Button>
      ) : (
        <Button
          onClick={onPause}
          variant="outline"
          size="lg"
          className="border-orange-500 text-orange-600 hover:bg-orange-50"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pausar
        </Button>
      )}

      <Button
        onClick={onReprocess}
        variant="outline"
        size="lg"
        disabled={!hasRecords || isProcessing}
      >
        <RotateCcw className="w-4 h-4 mr-2" />
        Reprocessar Erros
      </Button>

      <Button
        onClick={onDownload}
        variant="outline"
        size="lg"
        disabled={!hasRecords}
      >
        <Download className="w-4 h-4 mr-2" />
        Baixar Planilha Atualizada
      </Button>
    </div>
  );
}
