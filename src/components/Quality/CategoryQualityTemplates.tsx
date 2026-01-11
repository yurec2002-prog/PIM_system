import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Save, Plus, X } from 'lucide-react';

interface QualityTemplate {
  id: string;
  internal_category_id: string;
  required_attributes: string[];
  minimum_image_count: number;
  selling_price_required: boolean;
}

interface Category {
  id: string;
  name: string;
}

export function CategoryQualityTemplates() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [templates, setTemplates] = useState<Record<string, QualityTemplate>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<QualityTemplate | null>(null);
  const [newAttribute, setNewAttribute] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const { data: categoriesData } = await supabase
      .from('internal_categories')
      .select('id, name')
      .order('name');

    const { data: templatesData } = await supabase
      .from('category_quality_templates')
      .select('*');

    if (categoriesData) {
      setCategories(categoriesData);
    }

    if (templatesData) {
      const templatesMap: Record<string, QualityTemplate> = {};
      templatesData.forEach(t => {
        templatesMap[t.internal_category_id] = t as any;
      });
      setTemplates(templatesMap);
    }

    setLoading(false);
  };

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const existing = templates[categoryId];
    if (existing) {
      setEditingTemplate({ ...existing });
    } else {
      setEditingTemplate({
        id: '',
        internal_category_id: categoryId,
        required_attributes: [],
        minimum_image_count: 1,
        selling_price_required: true,
      });
    }
  };

  const handleAddAttribute = () => {
    if (!editingTemplate || !newAttribute.trim()) return;

    setEditingTemplate({
      ...editingTemplate,
      required_attributes: [...editingTemplate.required_attributes, newAttribute.trim()],
    });
    setNewAttribute('');
  };

  const handleRemoveAttribute = (index: number) => {
    if (!editingTemplate) return;

    setEditingTemplate({
      ...editingTemplate,
      required_attributes: editingTemplate.required_attributes.filter((_, i) => i !== index),
    });
  };

  const handleSave = async () => {
    if (!editingTemplate) return;

    setSaving(true);

    const dataToSave = {
      internal_category_id: editingTemplate.internal_category_id,
      required_attributes: editingTemplate.required_attributes,
      minimum_image_count: editingTemplate.minimum_image_count,
      selling_price_required: editingTemplate.selling_price_required,
    };

    if (editingTemplate.id) {
      await supabase
        .from('category_quality_templates')
        .update(dataToSave)
        .eq('id', editingTemplate.id);
    } else {
      await supabase
        .from('category_quality_templates')
        .insert(dataToSave);
    }

    setSaving(false);
    await loadData();
    setEditingTemplate(null);
    setSelectedCategory('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <Settings className="w-6 h-6 text-blue-600 mr-3" />
          <div>
            <h2 className="text-xl font-bold text-gray-900">Category Quality Templates</h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure quality requirements for each category
            </p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Select Category</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => handleSelectCategory(category.id)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  {category.name}
                  {templates[category.id] && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Configured
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2">
            {editingTemplate ? (
              <div className="border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Template Configuration
                </h3>

                <div className="space-y-6">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editingTemplate.selling_price_required}
                        onChange={e =>
                          setEditingTemplate({
                            ...editingTemplate,
                            selling_price_required: e.target.checked,
                          })
                        }
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        Selling price required
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum image count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editingTemplate.minimum_image_count}
                      onChange={e =>
                        setEditingTemplate({
                          ...editingTemplate,
                          minimum_image_count: parseInt(e.target.value) || 0,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Required attributes
                    </label>
                    <div className="space-y-2">
                      {editingTemplate.required_attributes.map((attr, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded"
                        >
                          <span className="text-sm text-gray-900">{attr}</span>
                          <button
                            onClick={() => handleRemoveAttribute(index)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newAttribute}
                          onChange={e => setNewAttribute(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAttribute();
                            }
                          }}
                          placeholder="Add attribute name..."
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleAddAttribute}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save Template'}
                    </button>
                    <button
                      onClick={() => {
                        setEditingTemplate(null);
                        setSelectedCategory('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-12 text-center">
                <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">
                  Select a category to configure quality requirements
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
