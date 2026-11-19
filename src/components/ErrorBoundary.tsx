import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message || 'Erro inesperado ao carregar o consultório.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Verbena Nutrição ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMessage =
        'Ocorreu uma falha inesperada de comunicação ou validação.';
      if (this.state.message.includes('Missing or insufficient permissions')) {
        friendlyMessage =
          'Permissão insuficiente para acessar ou salvar este registro. Verifique se sua conta Google está autenticada corretamente.';
      } else if (this.state.message.includes('Quota exceeded')) {
        friendlyMessage =
          'O limite diário gratuito de operações do banco de dados foi atingido. Tente novamente após a renovação da cota.';
      }

      return (
        <div className="min-h-screen bg-[#041210] text-[#F4FBF6] flex items-center justify-center p-6">
          <div className="max-w-lg w-full glass-obsidian rounded-2xl p-8">
            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h1 className="font-editorial text-2xl font-medium text-[#F4FBF6]">
                Não foi possível concluir a operação
              </h1>
            </div>
            <p className="text-sm text-[#CBE3D6] leading-relaxed mb-6">
              {friendlyMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-full cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Recarregar sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
