import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Edit2, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

interface SKUAttribute {
  master_attr_id: string;
  attr_name_ru: string;
  attr_type: string;
  attr_unit: string | null;
  is_required: boolean;
  active_value: string | null;
  active_source_supplier_id: string | null;
  active_source_supplier_name: string | null;
  is_manual_override: boolean;
  has_conflict: boolean;
  conflict_count: number;
  all_values: Array<{
    id: string;
    value: string;
    supplier_id: string;
    supplier_name: string;
    is_active: boolean;
    priority_score: number;
  }> | null;
}

interface SKUAttributesTableProps {
  skuId: string;
  attributes: SKUAttribute[];
  onUpdate?: () => void;
}

export function SKUAttributesTable({ skuId, attributes, onUpdate }: SKUAttributesTableProps) {
  const [editingAttribute, setEditingAttribute] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const handleEditStart = (attr: SKUAttribute) => {
    setEditingAttribute(attr.master_attr_id);
    setEditValue(attr.active_value || '');
  };

  const handleSaveEdit = async (attrId: string) => {
    setSaving(true);

    const { error } = await supabase.rpc('set_manual_override', {
      p_internal_sku_id: skuId,
      p_master_attr_id: attrId,
      p_value: editValue,
    });

    setSaving(false);
    setEditingAttribute(null);

    if (!error && onUpdate) {
      onUpdate();
    }
  };

  const handleCancelEdit = () => {
    setEditingAttribute(null);
    setEditValue('');
  };

  const handleSwitchValue = async (attrId: string, targetValueId: string) => {
    setSaving(true);

    const { error } = await supabase.rpc('set_active_attribute_value', {
      p_internal_sku_id: skuId,
      p_master_attr_id: attrId,
      p_target_value_id: targetValueId,
    });

    setSaving(false);

    if (!error && onUpdate) {
      onUpdate();
    }
  };

  const toggleConflictExpand = (attrId: string) => {
    setExpandedConflicts(prev => {
      const next = new Set(prev);
      if (next.has(attrId)) {
        next.delete(attrId);
      } else {
        next.add(attrId);
      }
      return next;
    });
  };

  const getSupplierBadgeColor = (supplierName: string) => {
    if (supplierName.toLowerCase().includes('sandi')) {
      return 'bg-green-100 text-green-800 border-green-300';
    }
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (!attributes || attributes.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-8">
        No attributes available for this SKU
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {attributes.map((attr) => (
        <div
          key={attr.master_attr_id}
          className={`border rounded-lg p-4 ${
            attr.has_conflict ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Attribute Name */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-gray-900">
                  {attr.attr_name_ru}
                  {attr.is_required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </h4>
                {attr.attr_unit && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {attr.attr_unit}
                  </span>
                )}
                {attr.attr_type && (
                  <span className="text-xs text-gray-500">
                    ({attr.attr_type})
                  </span>
                )}
              </div>
            </div>

            {/* Value and Source */}
            <div className="flex items-center gap-3">
              {editingAttribute === attr.master_attr_id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="px-3 py-1 border rounded text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(attr.master_attr_id)}
                    disabled={saving}
                    className="p-1 text-green-600 hover:bg-green-50 rounded"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">
                      {attr.active_value || (
                        <span className="text-gray-400 italic">No value</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded border ${getSupplierBadgeColor(
                          attr.active_source_supplier_name || ''
                        )}`}
                      >
                        {attr.active_source_supplier_name || 'Unknown'}
                      </span>
                      {attr.is_manual_override && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                          Manual
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleEditStart(attr)}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit value"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Conflict Indicator */}
          {attr.has_conflict && attr.conflict_count > 0 && (
            <div className="mt-3">
              <button
                onClick={() => toggleConflictExpand(attr.master_attr_id)}
                className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-900"
              >
                <AlertCircle className="w-4 h-4" />
                <span>
                  {attr.conflict_count} conflicting value{attr.conflict_count > 1 ? 's' : ''} from other
                  sources
                </span>
                {expandedConflicts.has(attr.master_attr_id) ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {expandedConflicts.has(attr.master_attr_id) && attr.all_values && (
                <div className="mt-2 pl-6 space-y-2">
                  {attr.all_values
                    .filter((v) => !v.is_active)
                    .map((value, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded text-sm"
                      >
                        <div>
                          <span className="text-gray-900 font-medium">{value.value}</span>
                          <span
                            className={`ml-2 text-xs px-2 py-0.5 rounded border ${getSupplierBadgeColor(
                              value.supplier_name
                            )}`}
                          >
                            {value.supplier_name}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">
                            Priority: {value.priority_score}
                          </span>
                        </div>
                        <button
                          onClick={() => handleSwitchValue(attr.master_attr_id, value.id)}
                          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Use This
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
