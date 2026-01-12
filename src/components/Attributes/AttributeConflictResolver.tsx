import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, Lock, Unlock } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AttributeWithConflict {
  master_attribute_id: string;
  attribute_name: string;
  attribute_type: string;
  unit: string | null;
  is_required: boolean;
  current_value: string | null;
  source_type: string;
  source_supplier_id: string | null;
  source_supplier_name: string | null;
  has_conflict: boolean;
  manual_override: boolean;
  conflict_details: Array<{
    supplier_id: string;
    supplier_name: string;
    value: string;
  }> | null;
}

interface Props {
  internalSkuId: string;
}

export const AttributeConflictResolver: React.FC<Props> = ({ internalSkuId }) => {
  const [attributes, setAttributes] = useState<AttributeWithConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadAttributes();
  }, [internalSkuId]);

  const loadAttributes = async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc(
      'get_sku_attributes_with_conflicts',
      { p_internal_sku_id: internalSkuId }
    );

    if (!error && data) {
      setAttributes(data);
    }

    setLoading(false);
  };

  const handleManualOverride = async (
    attributeId: string,
    newValue: string,
    supplierId: string | null = null
  ) => {
    setSaving(attributeId);

    const { error } = await supabase
      .from('master_attribute_values')
      .upsert({
        internal_sku_id: internalSkuId,
        master_attribute_id: attributeId,
        value: newValue,
        source_type: 'manual',
        source_supplier_id: supplierId,
        manual_override: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'internal_sku_id,master_attribute_id'
      });

    if (!error) {
      await loadAttributes();
    }

    setSaving(null);
  };

  const handleUnlock = async (attributeId: string) => {
    setSaving(attributeId);

    const { error } = await supabase
      .from('master_attribute_values')
      .update({ manual_override: false })
      .eq('internal_sku_id', internalSkuId)
      .eq('master_attribute_id', attributeId);

    if (!error) {
      await supabase.rpc('update_master_attribute_values_for_sku', {
        p_internal_sku_id: internalSkuId
      });
      await loadAttributes();
    }

    setSaving(null);
  };

  const conflictCount = attributes.filter(a => a.has_conflict).length;
  const missingRequired = attributes.filter(a => a.is_required && !a.current_value).length;

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Loading attributes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Product Attributes</h3>
        <div className="flex items-center gap-4">
          {conflictCount > 0 && (
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-lg text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {conflictCount} conflict{conflictCount !== 1 ? 's' : ''}
            </span>
          )}
          {missingRequired > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm">
              {missingRequired} required missing
            </span>
          )}
        </div>
      </div>

      {attributes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No attributes defined for this category
        </div>
      ) : (
        <div className="space-y-3">
          {attributes.map(attr => (
            <div
              key={attr.master_attribute_id}
              className={`border rounded-lg p-4 ${
                attr.has_conflict ? 'border-yellow-300 bg-yellow-50' :
                attr.is_required && !attr.current_value ? 'border-red-300 bg-red-50' :
                'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold">
                      {attr.attribute_name}
                      {attr.is_required && <span className="text-red-500 ml-1">*</span>}
                    </h4>
                    {attr.unit && (
                      <span className="text-sm text-gray-500">({attr.unit})</span>
                    )}
                    {attr.manual_override && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Locked
                      </span>
                    )}
                  </div>

                  {attr.current_value ? (
                    <div className="mt-1">
                      <span className="text-lg">{attr.current_value}</span>
                      {attr.source_supplier_name && !attr.manual_override && (
                        <span className="ml-2 text-sm text-gray-500">
                          from {attr.source_supplier_name}
                        </span>
                      )}
                      {attr.manual_override && (
                        <span className="ml-2 text-sm text-blue-600">
                          (manual override)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="text-gray-400 italic mt-1">No value set</div>
                  )}
                </div>

                {attr.manual_override && (
                  <button
                    onClick={() => handleUnlock(attr.master_attribute_id)}
                    disabled={saving === attr.master_attribute_id}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2 text-sm"
                  >
                    <Unlock className="w-4 h-4" />
                    Unlock
                  </button>
                )}
              </div>

              {attr.has_conflict && attr.conflict_details && (
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                    <span className="font-medium text-yellow-800">Conflict Detected</span>
                  </div>
                  <div className="space-y-2">
                    {attr.conflict_details.map(detail => (
                      <div
                        key={detail.supplier_id}
                        className="flex items-center justify-between bg-white p-2 rounded border"
                      >
                        <div>
                          <span className="font-medium">{detail.supplier_name}:</span>{' '}
                          <span className="text-gray-700">{detail.value}</span>
                        </div>
                        <button
                          onClick={() => handleManualOverride(
                            attr.master_attribute_id,
                            detail.value,
                            detail.supplier_id
                          )}
                          disabled={saving === attr.master_attribute_id || attr.manual_override}
                          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                        >
                          <Check className="w-4 h-4" />
                          Use This
                        </button>
                      </div>
                    ))}
                  </div>
                  {!attr.manual_override && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Or enter custom value..."
                        className="w-full px-3 py-2 border rounded"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            handleManualOverride(
                              attr.master_attribute_id,
                              e.currentTarget.value.trim()
                            );
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">Press Enter to save custom value</p>
                    </div>
                  )}
                </div>
              )}

              {!attr.has_conflict && !attr.current_value && !attr.manual_override && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Enter value..."
                    className="w-full px-3 py-2 border rounded"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                        handleManualOverride(
                          attr.master_attribute_id,
                          e.currentTarget.value.trim()
                        );
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
