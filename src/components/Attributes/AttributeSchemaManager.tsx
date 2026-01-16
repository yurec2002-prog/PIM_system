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

    console.log('Loading sync stats for supplier:', selectedSupplier);

    // Count products for selected supplier
    const { count: productsCount, error: productsError } = await supabase
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    console.log('Products count:', productsCount, 'Error:', productsError);

    // Count categories for selected supplier
    const { count: categoriesCount, error: categoriesError } = await supabase
      .from('supplier_categories')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    console.log('Categories count:', categoriesCount, 'Error:', categoriesError);

    // Count attributes for selected supplier
    const { count: presenceCount, error: presenceError } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    console.log('Attributes count:', presenceCount, 'Error:', presenceError);

    // Count mapped attributes for selected supplier
    const { count: mappedCount, error: mappedError } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier)
      .not('mapped_master_attribute_id', 'is', null);

    console.log('Mapped count:', mappedCount, 'Error:', mappedError);

    const stats = {
      total_products: productsCount || 0,
      total_attributes: presenceCount || 0,
      total_categories: categoriesCount || 0,
      mapped_attributes: mappedCount || 0,
      unmapped_attributes: (presenceCount || 0) - (mappedCount || 0),
    };

    console.log('Setting sync stats:', stats);
    setSyncStats(stats);
  };

  const loadSupplierCategories = async () => {
    setLoading(true);

    const { data: supplierCats } = await supabase
      .from('supplier_categories')
      .select(`
        id,
        external_id,
        name,
        name_ru,
        name_uk,
        parent_id,
        supplier_id,
        image,
        mapping:category_mappings(
          internal_category:internal_categories(id, name)
        )
      `)
      .eq('supplier_id', selectedSupplier)
      .order('name');

    if (!supplierCats) {
      setLoading(false);
      return;
    }

    const categoriesWithStats = await Promise.all(
      supplierCats.map(async (cat: any) => {
        const { data: statsArray } = await supabase.rpc('get_category_attribute_stats', {
          p_category_id: cat.id
        });

        const stats = statsArray?.[0];

        return {
          ...cat,
          mapping: cat.mapping?.[0] || null,
          directProductCount: stats?.product_count || 0,
          attributeStats: stats || {
            total_count: 0,
            mapped_count: 0,
            unmapped_count: 0,
            product_count: 0,
          },
        };
      })
    );

    const tree = buildTree(categoriesWithStats);
    setSupplierCategories(tree);
    setLoading(false);
  };

  const loadCategoryAttributePresence = async () => {
    if (!selectedSupplierCategory) return;

    const { data } = await supabase
      .from('supplier_category_attribute_presence')
      .select(`
        id,
        attribute_name,
        frequency_count,
        example_values,
        mapped_master_attribute_id,
        mapped_master_attribute:master_attributes(id, name, type, unit)
      `)
      .eq('supplier_category_id', selectedSupplierCategory)
      .order('frequency_count', { ascending: false });

    if (data) {
      setAttributePresenceList(data as any);
    }
  };

  const loadInternalCategories = async () => {
    const { data } = await supabase
      .from('internal_categories')
      .select('id, name, slug, parent_id, description, image')
      .order('name');

    if (!data) return;

    const categoriesWithAttributes = await Promise.all(
      data.map(async (cat: any) => {
        const { data: attrs } = await supabase
          .from('master_attributes')
          .select('id, name, type, unit, is_required, synonyms, display_order')
          .eq('internal_category_id', cat.id)
          .order('display_order');

        const required_count = attrs?.filter(a => a.is_required).length || 0;

        return {
          ...cat,
          attributes: attrs || [],
          attributeStats: {
            total_count: attrs?.length || 0,
            required_count,
            missing_required_count: 0,
          },
        };
      })
    );

    const tree = buildTree(categoriesWithAttributes);
    setInternalCategories(tree);
  };

  const buildTree = <T extends { id: string; parent_id: string | null }>(items: T[]): T[] => {
    const map = new Map<string, T & { children: T[] }>();
    const roots: (T & { children: T[] })[] = [];

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  };


  const handleRebuildAttributePresence = async () => {
    if (!confirm('Rebuild attribute presence from all products? This may take a moment.')) {
      return;
    }

    setRebuilding(true);
    const { data, error } = await supabase.rpc('rebuild_attribute_presence_from_products', {
      p_supplier_id: selectedSupplier || null
    });

    if (error) {
      alert('Error rebuilding: ' + error.message);
    } else {
      alert(`Success! Processed ${data.products_processed} products, discovered ${data.attributes_discovered} attributes in ${data.categories_processed} categories.`);
      await loadSupplierCategories();
      await loadSyncStats();
      if (selectedSupplierCategory) {
        await loadCategoryAttributePresence();
      }
    }
    setRebuilding(false);
  };

  const toggleSupplierExpand = (id: string) => {
    const newExpanded = new Set(expandedSupplierIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSupplierIds(newExpanded);
  };

  const toggleInternalExpand = (id: string) => {
    const newExpanded = new Set(expandedInternalIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInternalIds(newExpanded);
  };

  const handleMapAttribute = async (attributePresenceId: string, masterAttributeId: string) => {
    const { data: masterAttr } = await supabase
      .from('master_attributes')
      .select('id, name, type, unit')
      .eq('id', masterAttributeId)
      .single();

    setAttributePresenceList(prev =>
      prev.map(attr =>
        attr.id === attributePresenceId
          ? {
              ...attr,
              mapped_master_attribute_id: masterAttributeId,
              mapped_master_attribute: masterAttr || undefined
            }
          : attr
      )
    );

    await supabase
      .from('supplier_category_attribute_presence')
      .update({
        mapped_master_attribute_id: masterAttributeId,
        updated_at: new Date().toISOString()
      })
      .eq('id', attributePresenceId);

    await loadSupplierCategories();
    await loadSyncStats();
  };

  const handleUnmapAttribute = async (attributePresenceId: string) => {
    setAttributePresenceList(prev =>
      prev.map(attr =>
        attr.id === attributePresenceId
          ? {
              ...attr,
              mapped_master_attribute_id: null,
              mapped_master_attribute: undefined
            }
          : attr
      )
    );

    await supabase
      .from('supplier_category_attribute_presence')
      .update({
        mapped_master_attribute_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', attributePresenceId);

    await loadSupplierCategories();
    await loadSyncStats();
  };

  const handleCreateMasterAttribute = async (attributeName: string) => {
    const categoryData = getSupplierCategoryById(selectedSupplierCategory!);
    if (!categoryData?.mapping) {
      alert('This supplier category must be mapped to an internal category first.');
      return;
    }

    const newAttrName = prompt(`Create new master attribute for "${attributeName}":`, attributeName);
    if (!newAttrName) return;

    const { data: newAttr, error } = await supabase
      .from('master_attributes')
      .insert({
        internal_category_id: categoryData.mapping.internal_category.id,
        name: newAttrName,
        type: 'text',
        is_required: false,
        synonyms: [attributeName],
        display_order: 999,
      })
      .select()
      .single();

    if (error) {
      alert('Error creating attribute: ' + error.message);
      return;
    }

    await loadInternalCategories();
    await loadCategoryAttributePresence();
  };

  const findInMasterTree = async () => {
    const categoryData = getSupplierCategoryById(selectedSupplierCategory!);
    if (!categoryData?.mapping) {
      alert('This supplier category is not mapped to an internal category yet.');
      return;
    }

    const internalCatId = categoryData.mapping.internal_category.id;
    setSelectedInternalCategory(internalCatId);
  };

  const getSupplierCategoryById = (id: string): SupplierCategory | null => {
    const flatten = (cats: SupplierCategory[]): SupplierCategory[] => {
      return cats.flatMap(c => [c, ...(c.children ? flatten(c.children) : [])]);
    };
    return flatten(supplierCategories).find(c => c.id === id) || null;
  };

  const getInternalCategoryById = (id: string): InternalCategory | null => {
    const flatten = (cats: InternalCategory[]): InternalCategory[] => {
      return cats.flatMap(c => [c, ...(c.children ? flatten(c.children) : [])]);
    };
    return flatten(internalCategories).find(c => c.id === id) || null;
  };

  const getCategoryPath = (categoryId: string, tree: any[]): string => {
    const findPath = (cats: any[], targetId: string, path: string[] = []): string[] | null => {
      for (const cat of cats) {
        const catName = cat.name_ru || cat.name_uk || cat.name;
        if (cat.id === targetId) {
          return [...path, catName];
        }
        if (cat.children) {
          const found = findPath(cat.children, targetId, [...path, catName]);
          if (found) return found;
        }
      }
      return null;
    };

    const path = findPath(tree, categoryId);
    return path ? path.join(' > ') : '';
  };

  const aggregateStats = (category: any): any => {
    // Use directProductCount from category directly (from DB column)
    const directProductCount = category.directProductCount || 0;
    const directTotalCount = category.attributeStats?.total_count || 0;
    const directMappedCount = category.attributeStats?.mapped_count || 0;
    const directUnmappedCount = category.attributeStats?.unmapped_count || 0;
    const directRequiredCount = category.attributeStats?.required_count || 0;

    if (!category.children || category.children.length === 0) {
      return {
        ...category,
        attributeStats: {
          total_count: directTotalCount,
          mapped_count: directMappedCount,
          unmapped_count: directUnmappedCount,
          product_count: directProductCount,
          required_count: directRequiredCount,
        },
        directProductCount,
        directTotalCount,
        directMappedCount,
        directUnmappedCount,
        directRequiredCount
      };
    }

    const aggregatedChildren = category.children.map(aggregateStats);

    const aggregatedStats = {
      total_count: directTotalCount,
      mapped_count: directMappedCount,
      unmapped_count: directUnmappedCount,
      product_count: directProductCount,
      required_count: directRequiredCount,
    };

    aggregatedChildren.forEach((child: any) => {
      aggregatedStats.total_count += child.attributeStats?.total_count || 0;
      aggregatedStats.mapped_count += child.attributeStats?.mapped_count || 0;
      aggregatedStats.unmapped_count += child.attributeStats?.unmapped_count || 0;
      aggregatedStats.product_count += child.directProductCount || 0;
      aggregatedStats.required_count += child.attributeStats?.required_count || 0;
    });

    return {
      ...category,
      attributeStats: aggregatedStats,
      directProductCount,
      directTotalCount,
      directMappedCount,
      directUnmappedCount,
      directRequiredCount,
      children: aggregatedChildren,
    };
  };

  const renderSupplierCategoryTree = (categories: any[], level: number = 0) => {
    return categories.map((category: any) => {
      const isExpanded = expandedSupplierIds.has(category.id);
      const hasChildren = category.children && category.children.length > 0;
      const isSelected = selectedSupplierCategory === category.id;
      const stats = category.attributeStats || { total_count: 0, mapped_count: 0, unmapped_count: 0, product_count: 0 };
      const directProductCount = category.directProductCount || 0;

      return (
        <div key={category.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 border-l-2 transition-colors ${
              isSelected
                ? 'bg-blue-50 border-blue-600'
                : 'border-transparent'
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => setSelectedSupplierCategory(category.id)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSupplierExpand(category.id);
                }}
                className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}

            <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {category.name_ru || category.name}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {category.mapping && (
                <CheckCircle className="w-4 h-4 text-green-600" />
              )}

              <div className="flex items-center gap-1 text-xs">
                {directProductCount > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium" title="Products in this category">
                    {directProductCount}p
                  </span>
                )}
                {(stats?.total_count || 0) > 0 && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium" title="Total attributes (including children)">
                    {stats.total_count}a
                  </span>
                )}
                {(stats?.unmapped_count || 0) > 0 && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium" title="Unmapped attributes">
                    {stats.unmapped_count}u
                  </span>
                )}
              </div>
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div>
              {renderSupplierCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderInternalCategoryTree = (categories: any[], level: number = 0) => {
    return categories.map((category: any) => {
      const isExpanded = expandedInternalIds.has(category.id);
      const hasChildren = category.children && category.children.length > 0;
      const isSelected = selectedInternalCategory === category.id;
      const stats = category.attributeStats || { total_count: 0, required_count: 0 };

      return (
        <div key={category.id}>
          <div
            className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 border-l-2 transition-colors ${
              isSelected
                ? 'bg-blue-50 border-blue-600'
                : 'border-transparent'
            }`}
            style={{ paddingLeft: `${level * 20 + 12}px` }}
            onClick={() => setSelectedInternalCategory(category.id)}
          >
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleInternalExpand(category.id);
                }}
                className="p-0.5 hover:bg-gray-200 rounded flex-shrink-0"
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                )}
              </button>
            ) : (
              <div className="w-5 flex-shrink-0" />
            )}

            <Package className="w-4 h-4 text-blue-500 flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {category.name}
              </div>
            </div>

            <div className="flex items-center gap-1 text-xs flex-shrink-0">
              {(stats?.total_count || 0) > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">
                  {stats.total_count}a
                </span>
              )}
              {(stats?.required_count || 0) > 0 && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">
                  {stats.required_count}req
                </span>
              )}
            </div>
          </div>

          {isExpanded && hasChildren && (
            <div>
              {renderInternalCategoryTree(category.children!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };


  const aggregatedSupplierCategories = supplierCategories.map(aggregateStats);
  const aggregatedInternalCategories = internalCategories.map(aggregateStats);

  const selectedSupplierCategoryData = selectedSupplierCategory
    ? getSupplierCategoryById(selectedSupplierCategory)
    : null;

  const selectedInternalCategoryData = selectedInternalCategory
    ? getInternalCategoryById(selectedInternalCategory)
    : null;

  const filteredAttributes = attributePresenceList.filter(attr => {
    if (filterMode === 'mapped') return attr.mapped_master_attribute_id !== null;
    if (filterMode === 'unmapped') return attr.mapped_master_attribute_id === null;
    return true;
  }).filter(attr =>
    searchQuery === '' || attr.attribute_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attribute Schema Manager</h1>
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
          <div className="text-center py-12 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Select a supplier to begin attribute schema management</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col" style={{ height: '400px' }}>
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Supplier Categories
                    </h2>
                    <button
                      onClick={handleRebuildAttributePresence}
                      disabled={rebuilding}
                      className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                      {rebuilding ? (
                        <>
                          <Loader className="w-4 h-4 animate-spin" />
                          Rebuilding...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          Rebuild
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1">
                  {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                  ) : aggregatedSupplierCategories.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">No categories</div>
                  ) : (
                    renderSupplierCategoryTree(aggregatedSupplierCategories)
                  )}
                </div>
              </div>

              {selectedSupplierCategoryData && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">
                          {selectedSupplierCategoryData.name_ru || selectedSupplierCategoryData.name}
                        </h3>
                        <div className="text-xs text-gray-500 mb-2">
                          {getCategoryPath(selectedSupplierCategory!, supplierCategories)}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedSupplierCategoryData.attributeStats.product_count > 0 && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                              {selectedSupplierCategoryData.attributeStats.product_count} products
                            </span>
                          )}
                          {selectedSupplierCategoryData.attributeStats.total_count > 0 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                              {selectedSupplierCategoryData.attributeStats.total_count} attributes
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedSupplierCategoryData.mapping && (
                        <button
                          onClick={findInMasterTree}
                          className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm ml-3"
                        >
                          <MapPin className="w-4 h-4" />
                          Find
                        </button>
                      )}
                    </div>

                    {selectedSupplierCategoryData.mapping ? (
                      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded mb-3">
                        <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        <span className="flex-1">
                          Mapped to: {selectedSupplierCategoryData.mapping.internal_category.name}
                        </span>
                        <ArrowRight className="w-4 h-4 flex-shrink-0" />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 px-3 py-2 rounded mb-3">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Category not mapped - map it first in Category Mapping</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search attributes..."
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <select
                        value={filterMode}
                        onChange={(e) => setFilterMode(e.target.value as any)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="all">All</option>
                        <option value="mapped">Mapped</option>
                        <option value="unmapped">Unmapped</option>
                      </select>
                    </div>

                  </div>

                  <div className="p-4">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Attributes ({filteredAttributes.length})
                    </div>
                    <div className="space-y-2">
                      {filteredAttributes.map((attr) => (
                        <SupplierAttributeRow
                          key={attr.id}
                          attribute={attr}
                          internalCategory={selectedSupplierCategoryData.mapping?.internal_category}
                          onMap={handleMapAttribute}
                          onUnmap={handleUnmapAttribute}
                          onCreate={handleCreateMasterAttribute}
                        />
                      ))}
                      {filteredAttributes.length === 0 && (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          No attributes found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col" style={{ height: '400px' }}>
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-900">
                  Internal (Master) Categories
                </h2>
              </div>

              <div className="overflow-y-auto flex-1">
                {aggregatedInternalCategories.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">No categories</div>
                ) : (
                  renderInternalCategoryTree(aggregatedInternalCategories)
                )}
              </div>
              </div>

              {selectedInternalCategoryData && (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {selectedInternalCategoryData.name}
                    </h3>
                    <div className="text-xs text-gray-500">
                      {getCategoryPath(selectedInternalCategory!, internalCategories)}
                    </div>
                  </div>

                  <div className="p-4">
                    {selectedInternalCategoryData.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {selectedInternalCategoryData.description}
                      </p>
                    )}

                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Master Attributes ({selectedInternalCategoryData.attributeStats.total_count})
                    </div>
                    <div className="space-y-2">
                      {selectedInternalCategoryData.attributes.map((attr) => (
                        <div
                          key={attr.id}
                          className="px-3 py-2 bg-blue-50 border border-blue-200 rounded"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1">
                              <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900">
                                  {attr.name}
                                  {attr.unit && <span className="text-gray-500 ml-1">({attr.unit})</span>}
                                </div>
                                {attr.synonyms && attr.synonyms.length > 0 && (
                                  <div className="text-xs text-gray-600 mt-0.5">
                                    Synonyms: {attr.synonyms.join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {attr.type}
                              </span>
                              {attr.is_required && (
                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
                                  required
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface SupplierAttributeRowProps {
  attribute: AttributePresence;
  internalCategory?: { id: string; name: string };
  onMap: (attrId: string, masterId: string) => void;
  onUnmap: (attrId: string) => void;
  onCreate: (attrName: string) => void;
}

function SupplierAttributeRow({ attribute, internalCategory, onMap, onUnmap, onCreate }: SupplierAttributeRowProps) {
  const [showMappingOptions, setShowMappingOptions] = useState(false);
  const [masterAttributes, setMasterAttributes] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (showMappingOptions && internalCategory) {
      loadMasterAttributes();
    }
  }, [showMappingOptions, internalCategory]);

  const loadMasterAttributes = async () => {
    if (!internalCategory) return;

    const { data } = await supabase
      .from('master_attributes')
      .select('id, name, type, unit, synonyms')
      .eq('internal_category_id', internalCategory.id)
      .order('name');

    if (data) setMasterAttributes(data);
  };

  const isMapped = attribute.mapped_master_attribute_id !== null;

  const filteredMasterAttributes = masterAttributes.filter(ma =>
    ma.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`px-3 py-2 rounded border ${
        isMapped
          ? 'bg-green-50 border-green-200'
          : 'bg-orange-50 border-orange-200'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {isMapped ? (
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 break-words">
              {attribute.attribute_name}
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              {attribute.frequency_count} products
              {attribute.example_values && attribute.example_values.length > 0 && (
                <span className="ml-2">
                  Examples: {attribute.example_values.slice(0, 2).join(', ')}
                </span>
              )}
            </div>
            {isMapped && attribute.mapped_master_attribute && (
              <div className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded mt-1 inline-block">
                → {attribute.mapped_master_attribute.name}
                {attribute.mapped_master_attribute.unit && ` (${attribute.mapped_master_attribute.unit})`}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isMapped ? (
            <button
              onClick={() => onUnmap(attribute.id)}
              className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-xs"
            >
              Unmap
            </button>
          ) : (
            <>
              {internalCategory ? (
                <button
                  onClick={() => setShowMappingOptions(!showMappingOptions)}
                  className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                >
                  Map
                </button>
              ) : (
                <span className="text-xs text-gray-500">Map category first</span>
              )}
            </>
          )}
        </div>
      </div>

      {showMappingOptions && internalCategory && (
        <div className="mt-2 p-2 bg-white rounded border border-gray-300">
          <div className="mb-2">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search master attributes..."
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
            />
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {filteredMasterAttributes.map(ma => (
              <button
                key={ma.id}
                onClick={() => {
                  onMap(attribute.id, ma.id);
                  setShowMappingOptions(false);
                }}
                className="w-full text-left px-2 py-1 hover:bg-blue-50 rounded text-sm"
              >
                <div className="font-medium">{ma.name}</div>
                <div className="text-xs text-gray-500">
                  {ma.type} {ma.unit && `(${ma.unit})`}
                  {ma.synonyms && ma.synonyms.length > 0 && ` • ${ma.synonyms.join(', ')}`}
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              onCreate(attribute.attribute_name);
              setShowMappingOptions(false);
            }}
            className="w-full mt-2 px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Create New Master Attribute
          </button>
        </div>
      )}
    </div>
  );
}
