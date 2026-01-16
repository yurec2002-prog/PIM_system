import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  CheckCircle,
  AlertCircle,
  Link2,
  Plus,
  Trash2,
  Package,
  Filter,
  Info,
  ImageIcon,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Loader,
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface AttributePresence {
  id: string;
  attribute_name: string;
  frequency_count: number;
  example_values: string[];
  mapped_master_attribute_id: string | null;
  mapped_master_attribute?: {
    id: string;
    name: string;
    type: string;
    unit: string | null;
  };
}

interface SupplierCategory {
  id: string;
  external_id: string;
  name: string;
  name_ru: string;
  name_uk: string;
  parent_id: string | null;
  supplier_id: string;
  image: string | null;
  mapping: {
    internal_category: { id: string; name: string };
  } | null;
  attributeStats: {
    total_count: number;
    mapped_count: number;
    unmapped_count: number;
    product_count: number;
  };
  children?: SupplierCategory[];
}

interface InternalCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  image: string | null;
  attributes: Array<{
    id: string;
    name: string;
    type: string;
    unit: string | null;
    is_required: boolean;
    synonyms: string[];
    display_order: number;
  }>;
  attributeStats: {
    total_count: number;
    required_count: number;
    missing_required_count: number;
  };
  children?: InternalCategory[];
}

interface Supplier {
  id: string;
  name: string;
}

export function AttributeSchemaManager() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
  const [internalCategories, setInternalCategories] = useState<InternalCategory[]>([]);
  const [selectedSupplierCategory, setSelectedSupplierCategory] = useState<string | null>(null);
  const [selectedInternalCategory, setSelectedInternalCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [attributePresenceList, setAttributePresenceList] = useState<AttributePresence[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'unmapped' | 'mapped'>('all');
  const [syncStats, setSyncStats] = useState<any>({
    total_products: 0,
    total_attributes: 0,
    total_categories: 0,
    mapped_attributes: 0,
    unmapped_attributes: 0,
  });
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<string>>(new Set());
  const [expandedInternalIds, setExpandedInternalIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadSuppliers();
    loadInternalCategories();
  }, []);

  useEffect(() => {
    loadSyncStats();
  }, [selectedSupplier]);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierCategories();
    } else {
      setSupplierCategories([]);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    if (selectedSupplierCategory) {
      loadCategoryAttributePresence();
    }
  }, [selectedSupplierCategory]);

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    if (data) {
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplier) {
        setSelectedSupplier(data[0].id);
      }
    }
  };

  const loadSyncStats = async () => {
    if (!selectedSupplier) {
      setSyncStats({
        total_products: 0,
        total_attributes: 0,
        total_categories: 0,
        mapped_attributes: 0,
        unmapped_attributes: 0,
      });
      return;
    }

    const { count: productsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('supplier', 'sandi');

    const { count: categoriesCount } = await supabase
      .from('supplier_categories')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    const { count: presenceCount } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    const { count: mappedCount } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier)
      .not('mapped_master_attribute_id', 'is', null);

    const stats = {
      total_products: productsCount || 0,
      total_attributes: presenceCount || 0,
      total_categories: categoriesCount || 0,
      mapped_attributes: mappedCount || 0,
      unmapped_attributes: (presenceCount || 0) - (mappedCount || 0),
    };

    setSyncStats(stats);
  };

  const loadSupplierCategories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('supplier_categories')
      .select(`
        *,
        mapping:supplier_category_mappings(
          internal_category:internal_categories(id, name)
        )
      `)
      .eq('supplier_id', selectedSupplier)
      .order('name');

    if (!error && data) {
      const { data: attrStats } = await supabase
        .from('supplier_category_attribute_presence')
        .select('supplier_category_id, attribute_name, mapped_master_attribute_id')
        .eq('supplier_id', selectedSupplier);

      const { data: productCounts } = await supabase
        .from('products')
        .select('supplier_category_id')
        .eq('supplier', 'sandi');

      const categoriesWithStats = data.map(cat => {
        const attrs = attrStats?.filter(a => a.supplier_category_id === cat.id) || [];
        const productCount = productCounts?.filter(p => p.supplier_category_id === cat.id).length || 0;
        const total_count = attrs.length;
        const mapped_count = attrs.filter(a => a.mapped_master_attribute_id).length;

        return {
          ...cat,
          mapping: cat.mapping?.[0] || null,
          attributeStats: {
            total_count,
            mapped_count,
            unmapped_count: total_count - mapped_count,
            product_count: productCount
          }
        };
      });

      const tree = buildTree(categoriesWithStats);
      setSupplierCategories(tree);
    }
    setLoading(false);
  };

  const loadInternalCategories = async () => {
    const { data, error } = await supabase
      .from('internal_categories')
      .select('*')
      .order('name');

    if (!error && data) {
      const { data: attrData } = await supabase
        .from('master_attributes')
        .select('internal_category_id, id, name, is_required');

      const categoriesWithStats = data.map(cat => {
        const attrs = attrData?.filter(a => a.internal_category_id === cat.id) || [];
        const total_count = attrs.length;
        const required_count = attrs.filter(a => a.is_required).length;

        return {
          ...cat,
          attributes: attrs.map(a => ({
            id: a.id,
            name: a.name,
            type: 'text',
            unit: null,
            is_required: a.is_required,
            synonyms: [],
            display_order: 0
          })),
          attributeStats: {
            total_count,
            required_count,
            missing_required_count: 0
          }
        };
      });

      const tree = buildTree(categoriesWithStats);
      setInternalCategories(tree);
    }
  };

  const loadCategoryAttributePresence = async () => {
    if (!selectedSupplierCategory) return;

    const { data, error } = await supabase
      .from('supplier_category_attribute_presence')
      .select(`
        *,
        mapped_master_attribute:master_attribute_dictionary(id, name_ru, type, unit)
      `)
      .eq('supplier_category_id', selectedSupplierCategory)
      .order('frequency_count', { ascending: false });

    if (!error && data) {
      setAttributePresenceList(data.map(item => ({
        id: item.id,
        attribute_name: item.attribute_name,
        frequency_count: item.frequency_count || 0,
        example_values: Array.isArray(item.example_values) ? item.example_values : [],
        mapped_master_attribute_id: item.mapped_master_attribute_id,
        mapped_master_attribute: item.mapped_master_attribute ? {
          id: item.mapped_master_attribute.id,
          name: item.mapped_master_attribute.name_ru,
          type: item.mapped_master_attribute.type,
          unit: item.mapped_master_attribute.unit
        } : undefined
      })));
    }
  };

  const buildTree = <T extends { id: string; parent_id: string | null }>(
    items: T[]
  ): (T & { children?: T[] })[] => {
    const map = new Map<string, T & { children?: T[] }>();
    items.forEach(item => map.set(item.id, { ...item, children: [] }));

    const tree: (T & { children?: T[] })[] = [];
    map.forEach(item => {
      if (item.parent_id && map.has(item.parent_id)) {
        const parent = map.get(item.parent_id)!;
        if (!parent.children) parent.children = [];
        parent.children.push(item);
      } else {
        tree.push(item);
      }
    });

    return tree;
  };

  const toggleExpandSupplier = (id: string) => {
    const newSet = new Set(expandedSupplierIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedSupplierIds(newSet);
  };

  const toggleExpandInternal = (id: string) => {
    const newSet = new Set(expandedInternalIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedInternalIds(newSet);
  };

  const renderSupplierCategoryTree = (categories: SupplierCategory[], depth = 0) => {
    return categories.map(category => {
      const isExpanded = expandedSupplierIds.has(category.id);
      const hasChildren = category.children && category.children.length > 0;
      const isSelected = selectedSupplierCategory === category.id;

      return (
        <div key={category.id}>
          <div
            className={`flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-blue-50 rounded ${
              isSelected ? 'bg-blue-100 border-l-4 border-blue-500' : ''
            }`}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
            onClick={() => setSelectedSupplierCategory(category.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpandSupplier(category.id);
                }}
                className="p-0.5 hover:bg-blue-200 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}

            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                {category.name_ru || category.name}
              </div>
              {category.attributeStats.total_count > 0 && (
                <div className="flex gap-3 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Package size={12} />
                    {category.attributeStats.product_count}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <Link2 size={12} />
                    {category.attributeStats.total_count} attrs
                  </span>
                  {category.attributeStats.mapped_count > 0 && (
                    <span className="text-green-600">
                      {category.attributeStats.mapped_count} mapped
                    </span>
                  )}
                </div>
              )}
            </div>

            {category.mapping && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle size={14} />
              </div>
            )}
          </div>

          {hasChildren && isExpanded && renderSupplierCategoryTree(category.children!, depth + 1)}
        </div>
      );
    });
  };

  const renderInternalCategoryTree = (categories: InternalCategory[], depth = 0) => {
    return categories.map(category => {
      const isExpanded = expandedInternalIds.has(category.id);
      const hasChildren = category.children && category.children.length > 0;
      const isSelected = selectedInternalCategory === category.id;

      return (
        <div key={category.id}>
          <div
            className={`flex items-center gap-2 py-2 px-3 cursor-pointer hover:bg-green-50 rounded ${
              isSelected ? 'bg-green-100 border-l-4 border-green-500' : ''
            }`}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
            onClick={() => setSelectedInternalCategory(category.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpandInternal(category.id);
                }}
                className="p-0.5 hover:bg-green-200 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}

            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{category.name}</div>
              <div className="flex gap-3 text-xs text-gray-500 mt-1">
                {category.attributeStats.total_count > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Link2 size={12} />
                    {category.attributeStats.total_count} attrs
                  </span>
                )}
                {category.attributeStats.required_count > 0 && (
                  <span className="text-orange-600">
                    {category.attributeStats.required_count} required
                  </span>
                )}
              </div>
            </div>
          </div>

          {hasChildren && isExpanded && renderInternalCategoryTree(category.children!, depth + 1)}
        </div>
      );
    });
  };

  const getSupplierCategoryById = (id: string): SupplierCategory | null => {
    const findInTree = (categories: SupplierCategory[]): SupplierCategory | null => {
      for (const cat of categories) {
        if (cat.id === id) return cat;
        if (cat.children) {
          const found = findInTree(cat.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findInTree(supplierCategories);
  };

  const getCategoryPath = (categoryId: string, categories: SupplierCategory[]): string => {
    const findPath = (cats: SupplierCategory[], path: string[] = []): string[] | null => {
      for (const cat of cats) {
        const currentPath = [...path, cat.name_ru || cat.name];
        if (cat.id === categoryId) return currentPath;
        if (cat.children) {
          const found = findPath(cat.children, currentPath);
          if (found) return found;
        }
      }
      return null;
    };
    const path = findPath(categories);
    return path ? path.join(' > ') : '';
  };

  const filteredAttributes = attributePresenceList.filter(attr => {
    if (filterMode === 'mapped' && !attr.mapped_master_attribute_id) return false;
    if (filterMode === 'unmapped' && attr.mapped_master_attribute_id) return false;
    if (searchQuery && !attr.attribute_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedSupplierCategoryData = selectedSupplierCategory
    ? getSupplierCategoryById(selectedSupplierCategory)
    : null;

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Attribute Schema Manager</h1>
        <p className="text-gray-600">
          Manage attribute mappings between supplier categories and internal master categories
        </p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Supplier
          </label>
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          {syncStats && (
            <div className="grid grid-cols-5 gap-3">
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500 mb-1">Products</div>
                <div className="text-lg font-bold text-gray-900">{syncStats.total_products}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500 mb-1">Categories</div>
                <div className="text-lg font-bold text-gray-900">{syncStats.total_categories}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="text-xs text-gray-500 mb-1">Attributes</div>
                <div className="text-lg font-bold text-gray-900">{syncStats.total_attributes}</div>
              </div>
              <div className="bg-white rounded-lg border border-green-200 p-3">
                <div className="text-xs text-green-600 mb-1">Mapped</div>
                <div className="text-lg font-bold text-green-700">{syncStats.mapped_attributes}</div>
              </div>
              <div className="bg-white rounded-lg border border-orange-200 p-3">
                <div className="text-xs text-orange-600 mb-1">Unmapped</div>
                <div className="text-lg font-bold text-orange-700">{syncStats.unmapped_attributes}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!selectedSupplier ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <Info className="w-12 h-12 text-blue-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Select a Supplier</h3>
          <p className="text-gray-600">Choose a supplier from the dropdown to view and manage attribute mappings</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Package size={20} className="text-blue-600" />
                Supplier Categories
              </h2>
              {selectedSupplierCategoryData && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="space-y-2">
                    <div>
                      <div className="text-xs text-gray-500">Selected Category</div>
                      <div className="font-semibold text-gray-900">
                        {selectedSupplierCategoryData.name_ru || selectedSupplierCategoryData.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {getCategoryPath(selectedSupplierCategory!, supplierCategories)}
                      </div>
                      {selectedSupplierCategoryData.attributeStats.product_count > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          {selectedSupplierCategoryData.attributeStats.product_count} products
                        </div>
                      )}
                      {selectedSupplierCategoryData.attributeStats.total_count > 0 && (
                        <div className="text-xs text-gray-600">
                          {selectedSupplierCategoryData.attributeStats.total_count} attributes
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedSupplierCategoryData.mapping && (
                    <div className="mt-2 pt-2 border-t border-blue-300">
                      <div className="flex items-center gap-2 text-xs text-green-700">
                        <CheckCircle size={14} />
                        <span className="font-medium">
                          Mapped to: {selectedSupplierCategoryData.mapping.internal_category.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8">
                  <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading categories...</p>
                </div>
              ) : supplierCategories.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No categories found</p>
                </div>
              ) : (
                renderSupplierCategoryTree(supplierCategories)
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles size={20} className="text-green-600" />
                Internal (Master) Categories
              </h2>
            </div>
            <div className="p-4 max-h-[600px] overflow-y-auto">
              {internalCategories.length === 0 ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No internal categories found</p>
                </div>
              ) : (
                renderInternalCategoryTree(internalCategories)
              )}
            </div>
          </div>
        </div>
      )}

      {selectedSupplierCategory && attributePresenceList.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Attributes ({filteredAttributes.length})
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    filterMode === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterMode('unmapped')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    filterMode === 'unmapped'
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Unmapped
                </button>
                <button
                  onClick={() => setFilterMode('mapped')}
                  className={`px-3 py-1.5 rounded text-sm ${
                    filterMode === 'mapped'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Mapped
                </button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search attributes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
            {filteredAttributes.map((attr) => (
              <div
                key={attr.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{attr.attribute_name}</div>
                  <div className="text-sm text-gray-500">
                    {attr.frequency_count} products
                    {attr.example_values.length > 0 && (
                      <span className="ml-2">
                        Examples: {attr.example_values.slice(0, 3).join(', ')}
                      </span>
                    )}
                  </div>
                  {attr.mapped_master_attribute && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-green-700">
                      <CheckCircle size={14} />
                      <span>Mapped to: {attr.mapped_master_attribute.name}</span>
                      {attr.mapped_master_attribute.unit && (
                        <span className="text-gray-500">({attr.mapped_master_attribute.unit})</span>
                      )}
                    </div>
                  )}
                </div>
                <div>
                  {attr.mapped_master_attribute_id ? (
                    <button className="px-3 py-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm">
                      <CheckCircle size={16} className="inline mr-1" />
                      Mapped
                    </button>
                  ) : (
                    <button className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                      Map
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
