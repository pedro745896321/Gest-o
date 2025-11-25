import React, { useState, useEffect } from 'react';
import FileUploader from './FileUploader';
import { processTimesheetFile, exportShiftsByCategory, exportSingleSheet, DEFAULT_CONFIG, formatDateFull } from '../services/timesheetService';
import { ProcessedShift } from '../types';
import { Sun, Moon, Sunset, Download, AlertTriangle, Layers } from 'lucide-react';

interface ShiftIdentifierProps {
  preloadedFile: File | null;
}

interface ShiftCardProps {
    title: string;
    range: string;
    icon: React.ElementType;
    colorClass: 'orange' | 'blue' | 'indigo';
    data: ProcessedShift[];
    onDownload: () => void;
}

const ShiftCard: React.FC<ShiftCardProps> = ({ title, range, icon: Icon, colorClass, data, onDownload }) => {
    const bgColors = {
        orange: 'bg-orange-50 border-orange-200',
        blue: 'bg-blue-50 border-blue-200',
        indigo: 'bg-indigo-50 border-indigo-200'
    };
    const textColors = {
        orange: 'text-orange-700',
        blue: 'text-blue-700',
        indigo: 'text-indigo-700'
    };
    const iconBg = {
        orange: 'bg-orange-200',
        blue: 'bg-blue-200',
        indigo: 'bg-indigo-200'
    };

    // Helper to display interval time only
    const formatInterval = (start: Date | null, end: Date | null) => {
        if (!start || !end) return '-';
        const timeStr = (d: Date) => d.toTimeString().slice(0, 5);
        return `${timeStr(start)} - ${timeStr(end)}`;
    };

    return (
        <div className={`rounded-xl border ${bgColors[colorClass]} overflow-hidden flex flex-col shadow-sm`}>
            {/* Header */}
            <div className="p-5 border-b border-black/5 flex justify-between items-start bg-white/50">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${iconBg[colorClass]} ${textColors[colorClass]}`}>
                        <Icon className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className={`font-bold text-lg ${textColors[colorClass]}`}>{title}</h3>
                        <p className="text-xs text-gray-500 font-medium">{range}</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className={`block text-2xl font-bold ${textColors[colorClass]}`}>{data.length}</span>
                    <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Registros</span>
                </div>
            </div>
            
            {/* Preview Table */}
            <div className="flex-1 bg-white p-0 overflow-x-auto min-h-[150px] border-b border-gray-100">
                {data.length > 0 ? (
                    <table className="w-full text-xs text-left">
                        <thead className="bg-gray-50 text-gray-500 font-semibold">
                            <tr>
                                <th className="px-4 py-2.5 w-1/3">Pessoa</th>
                                <th className="px-4 py-2.5 w-auto">Data</th>
                                <th className="px-4 py-2.5 w-auto">Almoço/Janta</th>
                                <th className="px-4 py-2.5 text-right">Horas</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.slice(0, 5).map((row) => (
                                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-2 truncate max-w-[120px] font-medium text-gray-700" title={row.person}>
                                        {row.person}
                                    </td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">{row.date}</td>
                                    <td className={`px-4 py-2 whitespace-nowrap ${row.lunchType === 'ARTIFICIAL' ? 'text-orange-600 font-semibold' : 'text-gray-500'}`}>
                                        {formatInterval(row.lunchStart, row.lunchEnd)}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-gray-600 text-right">{row.workedTimeStr}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-6 text-center text-gray-400 text-sm">
                        <p>Nenhum registro encontrado neste horário.</p>
                    </div>
                )}
                {data.length > 5 && (
                    <div className="px-4 py-2 bg-gray-50 text-center text-xs text-gray-400 border-t border-gray-100">
                        + {data.length - 5} outros registros
                    </div>
                )}
            </div>

            {/* Footer Action */}
            <div className="p-4 bg-white">
                <button 
                    onClick={onDownload}
                    disabled={data.length === 0}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                        data.length === 0 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : `hover:opacity-90 shadow-sm hover:shadow ${iconBg[colorClass]} ${textColors[colorClass]}`
                    }`}
                >
                    <Download className="w-4 h-4" />
                    Baixar {title}
                </button>
            </div>
        </div>
    );
};

const ShiftIdentifier: React.FC<ShiftIdentifierProps> = ({ preloadedFile }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [data, setData] = useState<ProcessedShift[]>([]);
  const [error, setError] = useState<string | null>(null);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setData([]);

    try {
        setTimeout(async () => {
            try {
                // Override default config: Use 12h threshold to capture overnight shifts (e.g. 22:00 - 06:00) as a single shift
                const result = await processTimesheetFile(file, {
                    ...DEFAULT_CONFIG,
                    shiftThresholdHours: 12
                });
                setData(result);
            } catch (err) {
                console.error(err);
                setError('Erro ao processar arquivo. Verifique a estrutura da planilha.');
            } finally {
                setIsProcessing(false);
            }
        }, 100);
    } catch (e) {
        setIsProcessing(false);
        setError('Erro inesperado.');
    }
  };

  const handleFileSelected = (file: File) => {
      processFile(file);
  };

  useEffect(() => {
      if (preloadedFile) {
          processFile(preloadedFile);
      }
  }, [preloadedFile]);

  const handleDownloadAll = () => {
    if (data.length > 0) {
      exportShiftsByCategory(data);
    }
  };

  const handleSingleDownload = (categoryData: ProcessedShift[], name: string) => {
      if (categoryData.length === 0) return;
      exportSingleSheet(categoryData, name, `Turno_${name}_${new Date().getTime()}.xlsx`);
  };

  // Helper to categorize shifts
  const getCategorizedData = () => {
      const morning: ProcessedShift[] = [];
      const afternoon: ProcessedShift[] = [];
      const night: ProcessedShift[] = [];

      data.forEach(shift => {
          const hour = shift.startTime.getHours();
          if (hour >= 5 && hour < 13) morning.push(shift);
          else if (hour >= 13 && hour < 18) afternoon.push(shift);
          else night.push(shift);
      });
      return { morning, afternoon, night };
  };

  const categorized = getCategorizedData();

  return (
    <div className="animate-fade-in space-y-8">
      <div className="bg-white rounded-xl shadow-sm p-6 md:p-8 border border-gray-200">
        <div className="text-center mb-6">
           <h2 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2">
              <Layers className="w-8 h-8 text-indigo-500" />
              Separação de Turnos
           </h2>
           <p className="text-gray-500 mt-1">Identifica e separa os registros em abas: Manhã, Tarde e Noite.</p>
           <p className="text-xs text-gray-400 mt-2">
              *Considera como mesmo turno registros com intervalo de até 12h (ex: Plantões Noturnos).
              <br/>
              *Identifica intervalos de refeição entre 45 e 75 minutos.
           </p>
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
        <div className="space-y-8 pb-12">
           {/* Main Download Button */}
           <div className="flex justify-center">
                <button
                onClick={handleDownloadAll}
                className="w-full md:w-auto flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 text-lg"
                >
                <Download className="w-6 h-6" />
                <span>Baixar Planilha Completa (3 Abas)</span>
                </button>
           </div>
           
           <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-700 mb-6 flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Visualização por Turno
                </h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <ShiftCard 
                            title="Manhã" 
                            range="05:00 - 12:59"
                            icon={Sun} 
                            colorClass="orange" 
                            data={categorized.morning} 
                            onDownload={() => handleSingleDownload(categorized.morning, 'Manhã')}
                        />
                        <ShiftCard 
                            title="Tarde" 
                            range="13:00 - 17:59"
                            icon={Sunset} 
                            colorClass="blue" 
                            data={categorized.afternoon} 
                            onDownload={() => handleSingleDownload(categorized.afternoon, 'Tarde')}
                        />
                        <ShiftCard 
                            title="Noite" 
                            range="18:00 - 04:59"
                            icon={Moon} 
                            colorClass="indigo" 
                            data={categorized.night} 
                            onDownload={() => handleSingleDownload(categorized.night, 'Noite')}
                        />
                </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ShiftIdentifier;