import React, { useState, useEffect } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface MasterAttribute {
  id: string;
  internal_category_id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  unit: string | null;
  is_required: boolean;
  select_options: string[] | null;
  synonyms: string[];
  preferred_source_rule: string;
  display_order: number;
  is_pinned: boolean;
}

interface InternalCategory {
  id: string;
  name: string;
  name_ru: string;
}

interface Supplier {
  id: string;
  name: string;
}

export const AttributeSchemaManager: React.FC = () => {
  const [categories, setCategories] = useState<InternalCategory[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [attributes, setAttributes] = useState<MasterAttribute[]>([]);
  const [editingAttribute, setEditingAttribute] = useState<Partial<MasterAttribute> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [expandedAttribute, setExpandedAttribute] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCategories();
    loadSuppliers();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadAttributes();
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    const { data, error } = await supabase
      .from('internal_categories')
      .select('id, name, name_ru')
      .order('name');

    if (!error && data) {
      setCategories(data);
    }
  };

  const loadSuppliers = async () => {
    const { data, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setSuppliers(data);
    }
  };

  const loadAttributes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('master_attributes')
      .select('*')
      .eq('internal_category_id', selectedCategory)
      .order('display_order');

    if (!error && data) {
      setAttributes(data);
    }
    setLoading(false);
  };

  const handleSaveAttribute = async () => {
    if (!editingAttribute || !selectedCategory) return;

    setSaving(true);

    const attributeData = {
      internal_category_id: selectedCategory,
      name: editingAttribute.name,
      type: editingAttribute.type,
      unit: editingAttribute.unit || null,
      is_required: editingAttribute.is_required || false,
      select_options: editingAttribute.select_options || null,
      synonyms: editingAttribute.synonyms || [],
      preferred_source_rule: editingAttribute.preferred_source_rule || 'manual',
      display_order: editingAttribute.display_order || attributes.length,
      is_pinned: editingAttribute.is_pinned || false,
    };

    if (editingAttribute.id) {
      const { error } = await supabase
        .from('master_attributes')
        .update(attributeData)
        .eq('id', editingAttribute.id);

      if (!error) {
        await loadAttributes();
        setEditingAttribute(null);
      }
    } else {
      const { error } = await supabase
        .from('master_attributes')
        .insert(attributeData);

      if (!error) {
        await loadAttributes();
        setEditingAttribute(null);
        setIsAdding(false);
      }
    }

    setSaving(false);
  };

  const handleDeleteAttribute = async (id: string) => {
    if (!confirm('Delete this attribute? This will remove all values for this attribute.')) return;

    const { error } = await supabase
      .from('master_attributes')
      .delete()
      .eq('id', id);

    if (!error) {
      await loadAttributes();
    }
  };

  const handleSyncSupplierAttributes = async () => {
    setLoading(true);
    const { error } = await supabase.rpc('sync_supplier_attributes_to_master');

    if (!error) {
      alert('Supplier attributes synchronized successfully!');
    } else {
      alert('Error syncing: ' + error.message);
    }
    setLoading(false);
  };

  const renderAttributeForm = (attr: Partial<MasterAttribute>) => {
    return (
      <div className="bg-gray-50 p-4 rounded-lg space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attribute Name
            </label>
            <input
              type="text"
              value={attr.name || ''}
              onChange={(e) => setEditingAttribute({ ...attr, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Material, Weight, Color"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={attr.type || 'text'}
              onChange={(e) => setEditingAttribute({ ...attr, type: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select</option>
              <option value="boolean">Boolean</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <input
              type="text"
              value={attr.unit || ''}
              onChange={(e) => setEditingAttribute({ ...attr, unit: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., cm, kg, W"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Source
            </label>
            <select
              value={attr.preferred_source_rule || 'manual'}
              onChange={(e) => setEditingAttribute({ ...attr, preferred_source_rule: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="manual">Manual</option>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              {suppliers.map(s => (
                <option key={s.id} value={`supplier:${s.id}`}>Supplier: {s.name}</option>
              ))}
            </select>
          </div>
        </div>

        {attr.type === 'select' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Options (comma-separated)
            </label>
            <input
              type="text"
              value={attr.select_options?.join(', ') || ''}
              onChange={(e) => setEditingAttribute({
                ...attr,
                select_options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Option 1, Option 2, Option 3"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Synonyms (comma-separated supplier attribute names)
          </label>
          <input
            type="text"
            value={attr.synonyms?.join(', ') || ''}
            onChange={(e) => setEditingAttribute({
              ...attr,
              synonyms: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
            })}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="e.g., материал, material, Материал"
          />
          <p className="text-xs text-gray-500 mt-1">
            Supplier attributes matching these names will be mapped to this master attribute
          </p>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={attr.is_required || false}
              onChange={(e) => setEditingAttribute({ ...attr, is_required: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Required</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={attr.is_pinned || false}
              onChange={(e) => setEditingAttribute({ ...attr, is_pinned: e.target.checked })}
              className="rounded"
            />
            <span className="text-sm">Pinned</span>
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveAttribute}
            disabled={saving || !attr.name || !attr.type}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setEditingAttribute(null);
              setIsAdding(false);
            }}
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Attribute Schema Manager</h2>
          <button
            onClick={handleSyncSupplierAttributes}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Sync Supplier Attributes
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
          >
            <option value="">Choose a category...</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.name_ru})
              </option>
            ))}
          </select>
        </div>

        {selectedCategory && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Attributes</h3>
              {!isAdding && (
                <button
                  onClick={() => {
                    setIsAdding(true);
                    setEditingAttribute({
                      type: 'text',
                      synonyms: [],
                      preferred_source_rule: 'manual',
                      is_required: false,
                      is_pinned: false
                    });
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Attribute
                </button>
              )}
            </div>

            {isAdding && editingAttribute && renderAttributeForm(editingAttribute)}

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading attributes...</div>
            ) : (
              <div className="space-y-3">
                {attributes.length === 0 && !isAdding && (
                  <div className="text-center py-8 text-gray-500">
                    No attributes defined. Click "Add Attribute" to create one.
                  </div>
                )}

                {attributes.map(attr => (
                  <div key={attr.id} className="border rounded-lg p-4">
                    {editingAttribute?.id === attr.id ? (
                      renderAttributeForm(editingAttribute)
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-lg">{attr.name}</h4>
                              <span className="px-2 py-1 bg-gray-100 text-xs rounded">{attr.type}</span>
                              {attr.unit && <span className="text-sm text-gray-500">{attr.unit}</span>}
                              {attr.is_required && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">Required</span>}
                              {attr.is_pinned && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">Pinned</span>}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Source: <span className="font-medium">{attr.preferred_source_rule}</span>
                              {attr.synonyms.length > 0 && (
                                <span className="ml-3">
                                  Synonyms: {attr.synonyms.slice(0, 3).join(', ')}
                                  {attr.synonyms.length > 3 && '...'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setExpandedAttribute(expandedAttribute === attr.id ? null : attr.id)}
                              className="p-2 hover:bg-gray-100 rounded"
                            >
                              {expandedAttribute === attr.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setEditingAttribute(attr)}
                              className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAttribute(attr.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {expandedAttribute === attr.id && (
                          <div className="mt-3 pt-3 border-t text-sm space-y-2">
                            {attr.select_options && (
                              <div>
                                <span className="font-medium">Options:</span> {attr.select_options.join(', ')}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">All Synonyms:</span> {attr.synonyms.join(', ') || 'None'}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
