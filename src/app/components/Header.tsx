import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-gray-900">
              Automação de Cancelamento – Porto Seguro
            </h1>
            <p className="text-sm text-gray-500">
              Uso interno – Endosso de Cancelamento
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
