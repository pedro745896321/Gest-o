import React, { useState, useEffect } from 'react';
import FileUploader from './FileUploader';
import { processDailyWorkers, exportDailyWorkersExcel, formatDateFull } from '../services/timesheetService';
import { DailyWorkerRecord } from '../types';
import { Calculator, Download, AlertTriangle, UserSquare2 } from 'lucide-react';

interface DailyWorkerAnalyzerProps {
    preloadedFile: File | null;
}

const DailyWorkerAnalyzer: React.FC<DailyWorkerAnalyzerProps> = ({ preloadedFile }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<DailyWorkerRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setData([]);

    try {
        // Small delay for UI
        setTimeout(async () => {
            try {
                const result = await processDailyWorkers(file);
                setData(result);
            } catch (err) {
                console.error(err);
                setError('Erro ao processar arquivo. Verifique se colunas como "Nome/Pessoa" e "Data/Hora" existem.');
            } finally {
                setIsProcessing(false);
            }
        }, 100);
    } catch (e) {
        setIsProcessing(false);
        setError('Erro inesperado.');
    }
  };

  // Handle manual upload
  const handleFileSelected = (file: File) => {
      processFile(file);
  };

  // Handle preloaded file from Merger
  useEffect(() => {
      if (preloadedFile) {
          processFile(preloadedFile);
      }
  }, [preloadedFile]);

  const handleDownload = () => {
    if (data.length > 0) {
      exportDailyWorkersExcel(data);
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 border border-gray-200">
        <div className="text-center mb-6">
           <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
              <UserSquare2 className="w-8 h-8 text-orange-500" />
              Análise de Diaristas
           </h2>
           <p className="text-gray-500 mt-1">Extrai apenas o primeiro e último registro do dia para cada pessoa.</p>
        </div>

        <div className="max-w-xl mx-auto">
          <FileUploader onFileSelected={handleFileSelected} isProcessing={isProcessing} />
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {data.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <span className="text-gray-700 font-semibold">Foram encontrados {data.length} registros consolidados.</span>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold shadow transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar Excel
            </button>
          </div>

          <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">CPF</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Data</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Chegada</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Saída</th>
                    <th className="px-3 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Grupo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.slice(0, 50).map((row) => (
                    <tr key={row.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{row.nome}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.cpf}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.data}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateFull(row.chegada)}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatDateFull(row.saida)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-blue-600">{row.horaTotal}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.categoria}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.grupo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.length > 50 && (
                <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center border-t">
                    Mostrando os primeiros 50 de {data.length} registros. Baixe o Excel para ver tudo.
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyWorkerAnalyzer;