import React from 'react';
import { ProcessedShift } from '../types';
import { formatDateFull } from '../services/timesheetService';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ProcessedTableProps {
  data: ProcessedShift[];
}

const ProcessedTable: React.FC<ProcessedTableProps> = ({ data }) => {
  if (data.length === 0) return null;

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Pessoa</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Primeira Hora</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Início Almoço</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Fim Almoço</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Saída</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">Horas Trab.</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((shift) => (
              <tr key={shift.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{shift.person}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{shift.date}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateFull(shift.startTime).split(' ')[1]}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {shift.lunchStart ? (
                        <span className={shift.lunchType === 'ARTIFICIAL' ? 'text-orange-600 font-medium' : ''}>
                           {formatDateFull(shift.lunchStart).split(' ')[1]}
                        </span>
                    ) : ''}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                     {shift.lunchEnd ? (
                        <span className={shift.lunchType === 'ARTIFICIAL' ? 'text-orange-600 font-medium' : ''}>
                           {formatDateFull(shift.lunchEnd).split(' ')[1]}
                        </span>
                    ) : ''}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDateFull(shift.endTime).split(' ')[1]}</td>
                <td className="px-4 py-3 text-right font-bold text-blue-600 whitespace-nowrap font-mono">{shift.workedTimeStr}</td>
                <td className="px-4 py-3 flex justify-center">
                    {shift.lunchType === 'ARTIFICIAL' ? (
                         <div className="group relative flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-orange-500 cursor-help" />
                            <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 w-32 text-center z-10">
                                Almoço inserido automaticamente (60m)
                            </span>
                         </div>
                    ) : shift.lunchType === 'EXTENDED_CAPPED' ? (
                         <div className="group relative flex items-center justify-center">
                            <Clock className="w-5 h-5 text-purple-500 cursor-help" />
                            <span className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 w-32 text-center z-10">
                                Almoço longo limitado a 75m
                            </span>
                         </div>
                    ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 text-center border-t">
        Mostrando {data.length} registros. Role para ver mais.
      </div>
    </div>
  );
};

export default ProcessedTable;