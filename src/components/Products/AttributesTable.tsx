import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Pin, PinOff, ChevronUp, ChevronDown } from 'lucide-react';

interface AttributeData {
  id: string;
  attribute: {
    id: string;
    name: string;
    name_ru?: string;
    name_uk?: string;
  };
  value: string;
  value_ru?: string;
  value_uk?: string;
  numeric_value?: number;
  is_pinned?: boolean;
}

interface AttributesTableProps {
  attributes: AttributeData[];
  variantId: string;
  onUpdate?: () => void;
}

type SortField = 'name' | 'value' | 'numeric';
type SortDirection = 'asc' | 'desc';

export function AttributesTable({ attributes, variantId, onUpdate }: AttributesTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [updatingPins, setUpdatingPins] = useState<Set<string>>(new Set());

  const handleTogglePin = async (attributeId: string, currentPinned: boolean) => {
    setUpdatingPins(prev => new Set(prev).add(attributeId));

    const { error } = await supabase
      .from('variant_attributes')
      .update({ is_pinned: !currentPinned })
      .eq('id', attributeId);

    setUpdatingPins(prev => {
      const next = new Set(prev);
      next.delete(attributeId);
      return next;
    });

    if (!error && onUpdate) {
      onUpdate();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAttributes = [...attributes].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }

    let compareResult = 0;

    if (sortField === 'name') {
      const aName = a.attribute.name_ru || a.attribute.name_uk || a.attribute.name;
      const bName = b.attribute.name_ru || b.attribute.name_uk || b.attribute.name;
      compareResult = aName.localeCompare(bName);
    } else if (sortField === 'value') {
      const aValue = a.value_ru || a.value_uk || a.value;
      const bValue = b.value_ru || b.value_uk || b.value;
      compareResult = aValue.localeCompare(bValue);
    } else if (sortField === 'numeric') {
      const aNum = a.numeric_value ?? Infinity;
      const bNum = b.numeric_value ?? Infinity;
      compareResult = aNum - bNum;
    }

    return sortDirection === 'asc' ? compareResult : -compareResult;
  });

  if (attributes.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No attributes available
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-3 h-3 inline ml-1" />
    ) : (
      <ChevronDown className="w-3 h-3 inline ml-1" />
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-xs">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-500 w-8"></th>
            <th
              className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('name')}
            >
              Attribute <SortIcon field="name" />
            </th>
            <th
              className="px-3 py-2 text-left font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('value')}
            >
              Value <SortIcon field="value" />
            </th>
            <th
              className="px-3 py-2 text-right font-medium text-gray-500 cursor-pointer hover:bg-gray-100"
              onClick={() => handleSort('numeric')}
            >
              Numeric <SortIcon field="numeric" />
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedAttributes.map((attr) => (
            <tr
              key={attr.id}
              className={`${attr.is_pinned ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors`}
            >
              <td className="px-3 py-2">
                <button
                  onClick={() => handleTogglePin(attr.id, attr.is_pinned || false)}
                  disabled={updatingPins.has(attr.id)}
                  className={`text-gray-400 hover:text-blue-600 transition-colors ${
                    updatingPins.has(attr.id) ? 'opacity-50 cursor-wait' : ''
                  }`}
                  title={attr.is_pinned ? 'Unpin attribute' : 'Pin attribute'}
                >
                  {attr.is_pinned ? (
                    <Pin className="w-4 h-4 text-blue-600 fill-current" />
                  ) : (
                    <PinOff className="w-4 h-4" />
                  )}
                </button>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col">
                  {attr.attribute.name_ru && (
                    <span className="text-gray-900 font-medium">
                      🇷🇺 {attr.attribute.name_ru}
                    </span>
                  )}
                  {attr.attribute.name_uk && (
                    <span className="text-gray-700">
                      🇺🇦 {attr.attribute.name_uk}
                    </span>
                  )}
                  {!attr.attribute.name_ru && !attr.attribute.name_uk && (
                    <span className="text-gray-900 font-medium">
                      {attr.attribute.name}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col">
                  {attr.value_ru && (
                    <span className="text-gray-900">
                      🇷🇺 {attr.value_ru}
                    </span>
                  )}
                  {attr.value_uk && (
                    <span className="text-gray-700">
                      🇺🇦 {attr.value_uk}
                    </span>
                  )}
                  {!attr.value_ru && !attr.value_uk && (
                    <span className="text-gray-900">
                      {attr.value}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-right">
                {attr.numeric_value !== null && attr.numeric_value !== undefined ? (
                  <span className="font-mono text-blue-600 font-medium">
                    {attr.numeric_value}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
