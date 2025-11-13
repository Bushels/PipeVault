/**
 * ManifestDataDisplay Component
 * Displays AI-extracted manifest data from trucking documents
 * Shows pipe joints with heat numbers, dimensions, and calculated totals
 *
 * IMPORTANT: Metric Units First
 * - All measurements display metric units as primary values
 * - Imperial units shown in parentheses for reference
 * - Conversions:
 *   * Length: ft → m (multiply by 0.3048)
 *   * Weight: lbs → kg (multiply by 0.453592)
 *   * OD: inches → mm (multiply by 25.4)
 *   * Weight/Length: lb/ft → kg/m (multiply by 1.48816)
 */

import React from 'react';
import { ManifestItem } from '../../types';

interface ManifestDataDisplayProps {
  data: ManifestItem[] | null | undefined;
  documentFileName: string;
}

export const ManifestDataDisplay: React.FC<ManifestDataDisplayProps> = ({
  data,
  documentFileName
}) => {
  // Handle null/missing data
  if (!data || data.length === 0) {
    return (
      <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="text-sm">No manifest data extracted from this document</span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          This may be a proof of delivery, photos, or other non-manifest document.
          Manifest extraction only applies to pipe tally sheets.
        </p>
      </div>
    );
  }

  // Calculate totals (metric and imperial)
  const totals = data.reduce(
    (acc, item) => {
      const qty = item.quantity || 0;
      const lengthFt = item.tally_length_ft || 0;
      const weightPerFoot = item.weight_lbs_ft || 0;

      return {
        joints: acc.joints + qty,
        lengthFt: acc.lengthFt + (lengthFt * qty),
        weightLbs: acc.weightLbs + (lengthFt * qty * weightPerFoot),
        lengthM: acc.lengthM + (lengthFt * qty * 0.3048), // Convert ft to meters
        weightKg: acc.weightKg + (lengthFt * qty * weightPerFoot * 0.453592) // Convert lbs to kg
      };
    },
    { joints: 0, lengthFt: 0, weightLbs: 0, lengthM: 0, weightKg: 0 }
  );

  // Check data quality - count how many items have all critical fields
  const qualityMetrics = {
    withHeatNumber: data.filter(item => item.heat_number).length,
    withSerialNumber: data.filter(item => item.serial_number).length,
    withLength: data.filter(item => item.tally_length_ft).length,
    withGrade: data.filter(item => item.grade).length,
    total: data.length
  };

  const completeness = Math.round(
    ((qualityMetrics.withHeatNumber +
      qualityMetrics.withSerialNumber +
      qualityMetrics.withLength +
      qualityMetrics.withGrade) /
    (qualityMetrics.total * 4)) * 100
  );

  return (
    <div className="space-y-3">
      {/* Header with quality indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-indigo-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wide">
            AI-Extracted Manifest Data
          </h4>
        </div>

        {/* Data quality badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Data Quality:</span>
          <span
            className={`
              px-2 py-1 rounded text-xs font-semibold
              ${completeness >= 90 ? 'bg-green-900/30 text-green-400 border border-green-800' : ''}
              ${completeness >= 70 && completeness < 90 ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800' : ''}
              ${completeness < 70 ? 'bg-red-900/30 text-red-400 border border-red-800' : ''}
            `}
          >
            {completeness}% Complete
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Joints</p>
          <p className="text-2xl font-bold text-white mt-1">{totals.joints}</p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Length</p>
          <p className="text-2xl font-bold text-white mt-1">
            {totals.lengthM.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            <span className="text-sm text-gray-400 ml-1">m</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ({totals.lengthFt.toLocaleString(undefined, { maximumFractionDigits: 1 })} ft)
          </p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Total Weight</p>
          <p className="text-2xl font-bold text-white mt-1">
            {totals.weightKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-sm text-gray-400 ml-1">kg</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            ({totals.weightLbs.toLocaleString(undefined, { maximumFractionDigits: 0 })} lbs)
          </p>
        </div>
      </div>

      {/* Data table */}
      <div className="bg-gray-900/40 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-900 sticky top-0">
              <tr className="border-b border-gray-800">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  #
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Manufacturer
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Heat #
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Serial #
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Qty
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Length (m)
                </th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Grade
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  OD (mm)
                </th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Weight (kg/m)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr
                  key={index}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-3 py-2 text-gray-500 font-mono">
                    {index + 1}
                  </td>
                  <td className="px-3 py-2">
                    {item.manufacturer ? (
                      <span className="text-white font-medium">{item.manufacturer}</span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {item.heat_number ? (
                      <span className="text-white font-mono">{item.heat_number}</span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {item.serial_number ? (
                      <span className="text-white font-mono">{item.serial_number}</span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-white font-semibold">
                    {item.quantity}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.tally_length_ft ? (
                      <span className="text-white font-mono">
                        {(item.tally_length_ft * 0.3048).toFixed(2)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({item.tally_length_ft.toFixed(1)} ft)
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {item.grade ? (
                      <span className="px-2 py-1 rounded bg-indigo-900/30 text-indigo-300 text-xs font-semibold border border-indigo-800">
                        {item.grade}
                      </span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.outer_diameter ? (
                      <span className="text-white font-mono">
                        {(item.outer_diameter * 25.4).toFixed(1)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({item.outer_diameter.toFixed(3)}")
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {item.weight_lbs_ft ? (
                      <span className="text-white font-mono">
                        {(item.weight_lbs_ft * 1.48816).toFixed(1)}
                        <span className="text-xs text-gray-500 ml-1">
                          ({item.weight_lbs_ft.toFixed(1)} lb/ft)
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-600 italic">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer note */}
      <div className="flex items-start gap-2 text-xs text-gray-500 bg-gray-900/20 border border-gray-800 rounded-lg p-3">
        <svg
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="font-semibold">AI-Extracted Data from: {documentFileName}</p>
          <p className="mt-1">
            This data was automatically extracted using Google Gemini Vision AI.
            Please verify accuracy before using for critical operations.
            Missing fields may indicate unclear document quality or non-standard formatting.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManifestDataDisplay;
