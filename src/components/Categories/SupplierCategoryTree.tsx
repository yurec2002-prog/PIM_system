import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { ChevronRight, ChevronDown, FolderTree, Package, Edit, Save, X } from 'lucide-react';
import { ProductDetails } from '../Products/ProductDetails';

interface Product {
  id: string;
  name: string;
  vendor: string;
  model: string;
  is_ready: boolean;
}

interface SupplierCategory {
  id: string;
  supplier_id: string;
  external_id: string;
  name: string;
  name_ru: string;
  name_uk: string;
  parent_id: string | null;
  isMapped?: boolean;
  children?: SupplierCategory[];
  products?: Product[];
}

interface InternalCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  parent_id: string | null;
  children?: InternalCategory[];
  products?: Product[];
}

interface Supplier {
  id: string;
  name: string;
}

type TreeMode = 'supplier' | 'internal';

export function SupplierCategoryTree() {
  const [treeMode, setTreeMode] = useState<TreeMode>('supplier');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [categories, setCategories] = useState<SupplierCategory[]>([]);
  const [internalCategories, setInternalCategories] = useState<InternalCategory[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  useEffect(() => {
    setExpandedIds(new Set());
    if (treeMode === 'supplier' && selectedSupplier) {
      loadCategories();
    } else if (treeMode === 'internal') {
      loadInternalCategories();
    }
  }, [selectedSupplier, treeMode]);

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    if (data) setSuppliers(data);
  };

  const loadCategories = async () => {
    setLoading(true);

    const { data: supplierData } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', selectedSupplier)
      .single();

    if (!supplierData) {
      setLoading(false);
      return;
    }

    const { data: categoriesData } = await supabase
      .from('supplier_categories')
      .select('id, supplier_id, external_id, name, name_ru, name_uk, parent_id')
      .eq('supplier_id', selectedSupplier)
      .order('name');

    if (categoriesData) {
      const { data: mappings } = await supabase
        .from('category_mappings')
        .select('supplier_category_id')
        .in('supplier_category_id', categoriesData.map(c => c.id));

      const { data: productsData } = await supabase
        .from('products')
        .select('id, name_ru, name_uk, vendor_code, is_ready, supplier_category_id, brand_ref')
        .ilike('supplier', supplierData.name)
        .not('supplier_category_id', 'is', null);

      const mappedIds = new Set(mappings?.map(m => m.supplier_category_id) || []);

      const productsByCategory = new Map<string, Product[]>();

      productsData?.forEach((product: any) => {
        const categoryId = product.supplier_category_id;

        if (categoryId) {
          if (!productsByCategory.has(categoryId)) {
            productsByCategory.set(categoryId, []);
          }
          productsByCategory.get(categoryId)!.push({
            id: product.id.toString(),
            name: product.name_uk || product.name_ru || product.vendor_code || 'Unknown',
            vendor: product.brand_ref || '',
            model: product.vendor_code || '',
            is_ready: product.is_ready || false,
          });
        }
      });

      const enrichedCategories = categoriesData.map(cat => {
        const products = productsByCategory.get(cat.id) || [];
        products.sort((a, b) => a.name.localeCompare(b.name));
        return {
          ...cat,
          isMapped: mappedIds.has(cat.id),
          products,
        };
      });

      const tree = buildTree(enrichedCategories);
      setCategories(tree);
    }
    setLoading(false);
  };

  const loadInternalCategories = async () => {
    setLoading(true);

    const { data: categoriesData } = await supabase
      .from('internal_categories')
      .select('id, name, slug, description, parent_id')
      .order('name');

    if (categoriesData) {
      const { data: mappingsData } = await supabase
        .from('category_mappings')
        .select('supplier_category_id, internal_category_id');

      const supplierToInternalMap = new Map<string, string>();
      mappingsData?.forEach(mapping => {
        supplierToInternalMap.set(mapping.supplier_category_id, mapping.internal_category_id);
      });

      const { data: productsData } = await supabase
        .from('products')
        .select('id, name_ru, name_uk, vendor_code, is_ready, supplier_category_id, brand_ref')
        .not('supplier_category_id', 'is', null);

      const productsByCategory = new Map<string, Product[]>();

      productsData?.forEach((product: any) => {
        const supplierCategoryId = product.supplier_category_id;
        const internalCategoryId = supplierToInternalMap.get(supplierCategoryId);

        if (internalCategoryId) {
          if (!productsByCategory.has(internalCategoryId)) {
            productsByCategory.set(internalCategoryId, []);
          }
          productsByCategory.get(internalCategoryId)!.push({
            id: product.id.toString(),
            name: product.name_uk || product.name_ru || product.vendor_code || 'Unknown',
            vendor: product.brand_ref || '',
            model: product.vendor_code || '',
            is_ready: product.is_ready || false,
          });
        }
      });

      const enrichedCategories = categoriesData.map(cat => {
        const products = productsByCategory.get(cat.id) || [];
        products.sort((a, b) => a.name.localeCompare(b.name));
        return {
          ...cat,
          products,
        };
      });

      const tree = buildInternalTree(enrichedCategories);
      setInternalCategories(tree);
    }
    setLoading(false);
  };

  const buildTree = (flatCategories: SupplierCategory[]): SupplierCategory[] => {
    const map = new Map<string, SupplierCategory>();
    const roots: SupplierCategory[] = [];

    flatCategories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [], products: cat.products || [] });
    });

    flatCategories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const buildInternalTree = (flatCategories: InternalCategory[]): InternalCategory[] => {
    const map = new Map<string, InternalCategory>();
    const roots: InternalCategory[] = [];

    flatCategories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [], products: cat.products || [] });
    });

    flatCategories.forEach(cat => {
      const node = map.get(cat.id)!;
      if (cat.parent_id) {
        const parent = map.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  const handleEditCategory = (category: InternalCategory) => {
    setEditingCategoryId(category.id);
    setEditForm({ name: category.name, description: category.description });
  };

  const handleSaveCategory = async () => {
    if (!editingCategoryId) return;

    const { error } = await supabase
      .from('internal_categories')
      .update({
        name: editForm.name,
        description: editForm.description,
      })
      .eq('id', editingCategoryId);

    if (!error) {
      setEditingCategoryId(null);
      setEditForm({ name: '', description: '' });
      await loadInternalCategories();
    }
  };

  const handleCancelEdit = () => {
    setEditingCategoryId(null);
    setEditForm({ name: '', description: '' });
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedIds(newExpanded);
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    if (treeMode === 'supplier') {
      const collectIds = (cats: SupplierCategory[]) => {
        cats.forEach(cat => {
          allIds.add(cat.id);
          if (cat.children) collectIds(cat.children);
        });
      };
      collectIds(categories);
    } else {
      const collectIds = (cats: InternalCategory[]) => {
        cats.forEach(cat => {
          allIds.add(cat.id);
          if (cat.children) collectIds(cat.children);
        });
      };
      collectIds(internalCategories);
    }
    setExpandedIds(allIds);
  };

  const collapseAll = () => {
    setExpandedIds(new Set());
  };

  const getTotalProductCount = (category: SupplierCategory): number => {
    let count = category.products?.length || 0;
    if (category.children) {
      category.children.forEach(child => {
        count += getTotalProductCount(child);
      });
    }
    return count;
  };

  const getTotalInternalProductCount = (category: InternalCategory): number => {
    let count = category.products?.length || 0;
    if (category.children) {
      category.children.forEach(child => {
        count += getTotalInternalProductCount(child);
      });
    }
    return count;
  };

  const renderCategory = (category: SupplierCategory, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const hasProducts = category.products && category.products.length > 0;
    const hasContent = hasChildren || hasProducts;
    const isExpanded = expandedIds.has(category.id);
    const totalProductCount = getTotalProductCount(category);

    return (
      <div key={category.id}>
        <div
          className="flex items-center py-2 px-3 hover:bg-gray-50 transition-colors border-l-2 border-transparent hover:border-blue-200"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <button
            onClick={() => hasContent && toggleExpanded(category.id)}
            className={`mr-2 flex-shrink-0 ${hasContent ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {hasContent ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          <div className="flex items-center flex-1 min-w-0 gap-3">
            <div className="flex flex-col min-w-0 flex-1">
              {category.name_ru && (
                <span className="text-sm text-gray-900 font-medium truncate">
                  🇷🇺 {category.name_ru}
                </span>
              )}
              {category.name_uk && (
                <span className="text-sm text-gray-600 truncate">
                  🇺🇦 {category.name_uk}
                </span>
              )}
            </div>
            {totalProductCount > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                <Package className="w-3 h-3" />
                {totalProductCount}
              </span>
            )}
            {category.isMapped && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">
                Mapped
              </span>
            )}
          </div>
        </div>
        {isExpanded && hasContent && (
          <div className="border-l-2 border-gray-200" style={{ marginLeft: `${level * 24 + 24}px` }}>
            {category.children && category.children.map(child => renderCategory(child, level + 1))}
            {category.products && category.products.map(product => renderProduct(product, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderInternalCategory = (category: InternalCategory, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const hasProducts = category.products && category.products.length > 0;
    const hasContent = hasChildren || hasProducts;
    const isExpanded = expandedIds.has(category.id);
    const totalProductCount = getTotalInternalProductCount(category);
    const isEditing = editingCategoryId === category.id;

    return (
      <div key={category.id}>
        <div
          className="flex items-center py-2 px-3 hover:bg-gray-50 transition-colors border-l-2 border-transparent hover:border-blue-200"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
        >
          <button
            onClick={() => hasContent && toggleExpanded(category.id)}
            className={`mr-2 flex-shrink-0 ${hasContent ? 'cursor-pointer' : 'cursor-default'}`}
          >
            {hasContent ? (
              isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-600" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-600" />
              )
            ) : (
              <div className="w-4 h-4" />
            )}
          </button>
          <div className="flex items-center flex-1 min-w-0 gap-3">
            {isEditing ? (
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                  placeholder="Category name"
                />
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="px-2 py-1 text-sm border border-gray-300 rounded"
                  placeholder="Description"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveCategory}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm text-gray-900 font-medium truncate">
                    {category.name}
                  </span>
                  {category.description && (
                    <span className="text-xs text-gray-500 truncate">
                      {category.description}
                    </span>
                  )}
                </div>
                {totalProductCount > 0 && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1">
                    <Package className="w-3 h-3" />
                    {totalProductCount}
                  </span>
                )}
                <button
                  onClick={() => handleEditCategory(category)}
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  <Edit className="w-3 h-3" />
                  Edit
                </button>
              </>
            )}
          </div>
        </div>
        {isExpanded && hasContent && (
          <div className="border-l-2 border-gray-200" style={{ marginLeft: `${level * 24 + 24}px` }}>
            {category.children && category.children.map(child => renderInternalCategory(child, level + 1))}
            {category.products && category.products.map(product => renderProduct(product, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderProduct = (product: Product, level: number) => {
    return (
      <div
        key={product.id}
        onClick={() => setSelectedProductId(product.id)}
        className="flex items-center py-1.5 px-3 hover:bg-blue-50 transition-colors text-sm cursor-pointer"
        style={{ paddingLeft: `${level * 24 + 36}px` }}
      >
        <Package className="w-3.5 h-3.5 text-gray-400 mr-2 flex-shrink-0" />
        <div className="flex items-center flex-1 min-w-0 gap-2">
          <span className="text-gray-700 truncate">{product.name}</span>
          {product.vendor && (
            <span className="text-gray-400 text-xs flex-shrink-0">
              {product.vendor}
            </span>
          )}
          {product.model && (
            <span className="text-gray-400 text-xs flex-shrink-0">
              {product.model}
            </span>
          )}
          {product.is_ready && (
            <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex-shrink-0">
              Ready
            </span>
          )}
        </div>
      </div>
    );
  };

  const countCategories = (cats: SupplierCategory[]): { total: number; mapped: number; products: number } => {
    let total = 0;
    let mapped = 0;
    let products = 0;
    const count = (categories: SupplierCategory[]) => {
      categories.forEach(cat => {
        total++;
        if (cat.isMapped) mapped++;
        if (cat.products) products += cat.products.length;
        if (cat.children) count(cat.children);
      });
    };
    count(cats);
    return { total, mapped, products };
  };

  const countInternalCategories = (cats: InternalCategory[]): { total: number; products: number } => {
    let total = 0;
    let products = 0;
    const count = (categories: InternalCategory[]) => {
      categories.forEach(cat => {
        total++;
        if (cat.products) products += cat.products.length;
        if (cat.children) count(cat.children);
      });
    };
    count(cats);
    return { total, products };
  };

  const stats = treeMode === 'supplier' ? countCategories(categories) : { ...countInternalCategories(internalCategories), mapped: 0 };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <FolderTree className="w-7 h-7" />
          Category Tree
        </h1>
        <p className="text-gray-600">
          View the hierarchical structure of categories and products
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tree Mode
          </label>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTreeMode('supplier')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                treeMode === 'supplier'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Supplier Categories
            </button>
            <button
              onClick={() => setTreeMode('internal')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                treeMode === 'internal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Internal Categories
            </button>
          </div>

          {treeMode === 'supplier' && (
            <>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Supplier
              </label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Choose a supplier...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {((treeMode === 'supplier' && selectedSupplier) || treeMode === 'internal') && (
          <>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div>
                  Total categories: <span className="font-semibold">{stats.total}</span>
                </div>
                {treeMode === 'supplier' && (
                  <>
                    <div>
                      Mapped: <span className="font-semibold text-green-600">{stats.mapped}</span>
                    </div>
                    <div>
                      Unmapped: <span className="font-semibold text-orange-600">{stats.total - stats.mapped}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4" />
                  Products: <span className="font-semibold text-blue-600">{stats.products}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={expandAll}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading categories...</div>
            ) : treeMode === 'supplier' ? (
              categories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No categories found for this supplier
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md">
                  {categories.map(cat => renderCategory(cat))}
                </div>
              )
            ) : (
              internalCategories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No internal categories found
                </div>
              ) : (
                <div className="border border-gray-200 rounded-md">
                  {internalCategories.map(cat => renderInternalCategory(cat))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {selectedProductId && (
        <ProductDetails
          productId={selectedProductId}
          onClose={() => setSelectedProductId(null)}
        />
      )}
    </div>
  );
}
