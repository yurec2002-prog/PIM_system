import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Link2, Plus, Trash2, ChevronRight, ChevronDown, CheckCircle, AlertCircle, Search, Wand2, X } from 'lucide-react';
import { findBestMatch } from '../../utils/categorySimilarity';

interface SupplierCategory {
  id: string;
  external_id: string;
  name: string;
  name_ru: string;
  name_uk: string;
  parent_id: string | null;
  supplier_id: string;
  mapping: {
    internal_category: { id: string; name: string };
  } | null;
  children?: SupplierCategory[];
}

interface InternalCategory {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  children?: InternalCategory[];
}

interface Supplier {
  id: string;
  name: string;
}

export function CategoryMapping() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([]);
  const [internalCategories, setInternalCategories] = useState<InternalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedSupplierIds, setExpandedSupplierIds] = useState<Set<string>>(new Set());
  const [expandedInternalIds, setExpandedInternalIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCategories, setFilteredCategories] = useState<SupplierCategory[]>([]);
  const [autoSuggestEnabled, setAutoSuggestEnabled] = useState(false);

  useEffect(() => {
    loadSuppliers();
    loadInternalCategories();
  }, []);

  useEffect(() => {
    if (selectedSupplier) {
      loadSupplierCategories();
    } else {
      setSupplierCategories([]);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = filterCategories(supplierCategories, searchQuery.toLowerCase());
      setFilteredCategories(filtered);
      expandSearchResults(filtered);
    } else {
      setFilteredCategories(supplierCategories);
    }
  }, [searchQuery, supplierCategories]);

  const loadSuppliers = async () => {
    const { data } = await supabase
      .from('suppliers')
      .select('id, name')
      .order('name');
    if (data) setSuppliers(data);
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
        mapping:category_mappings(
          internal_category:internal_categories(id, name)
        )
      `)
      .eq('supplier_id', selectedSupplier)
      .order('name');

    if (supplierCats) {
      const categoriesWithMapping = supplierCats.map((cat: any) => ({
        ...cat,
        mapping: cat.mapping?.[0] || null,
      }));
      const tree = buildSupplierTree(categoriesWithMapping);
      setSupplierCategories(tree);
      setFilteredCategories(tree);
    }
    setLoading(false);
  };

  const loadInternalCategories = async () => {
    const { data: internalCats } = await supabase
      .from('internal_categories')
      .select('*')
      .order('name');

    if (internalCats) {
      const tree = buildInternalTree(internalCats);
      setInternalCategories(tree);
    }
  };

  const buildSupplierTree = (flatCategories: SupplierCategory[]): SupplierCategory[] => {
    const map = new Map<string, SupplierCategory>();
    const roots: SupplierCategory[] = [];

    flatCategories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
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
      map.set(cat.id, { ...cat, children: [] });
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

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    const slug = newCategoryName.toLowerCase().replace(/\s+/g, '-');
    const { error } = await supabase
      .from('internal_categories')
      .insert({ name: newCategoryName, slug, parent_id: null });

    if (!error) {
      setNewCategoryName('');
      setShowCreateForm(false);
      await loadInternalCategories();
    }
  };

  const handleMapCategory = async (supplierCategoryId: string, internalCategoryId: string) => {
    if (!internalCategoryId) {
      await supabase
        .from('category_mappings')
        .delete()
        .eq('supplier_category_id', supplierCategoryId);
    } else {
      await supabase
        .from('category_mappings')
        .upsert({
          supplier_category_id: supplierCategoryId,
          internal_category_id: internalCategoryId,
        });
    }

    if (selectedSupplier) {
      await supabase.rpc('update_product_readiness_for_supplier', {
        supplier_uuid: selectedSupplier,
      });
    }

    await loadSupplierCategories();
  };

  const handleDeleteInternalCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    const { error } = await supabase.from('internal_categories').delete().eq('id', id);

    if (!error) {
      await loadInternalCategories();
    }
  };

  const handleCopySupplierTree = async () => {
    if (!selectedSupplier) return;

    const selectedSupplierName = suppliers.find(s => s.id === selectedSupplier)?.name || 'supplier';

    if (!confirm(`Copy all ${stats.total} categories from ${selectedSupplierName} as internal categories and create mappings?\n\nThis will copy the entire category tree structure.`)) {
      return;
    }

    setLoading(true);

    try {
      const idMap = new Map<string, string>();

      const copyCategory = async (supCat: SupplierCategory, parentInternalId: string | null = null) => {
        const name = supCat.name_ru || supCat.name_uk || supCat.name;

        const baseSlug = name
          .toLowerCase()
          .replace(/[^a-zа-яіїєґ0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        let slug = baseSlug;
        let attempt = 1;

        while (true) {
          const { data: existing } = await supabase
            .from('internal_categories')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

          if (!existing) break;
          slug = `${baseSlug}-${attempt}`;
          attempt++;
        }

        const description = [supCat.name_ru, supCat.name_uk].filter(Boolean).join(' / ') || '';

        const { data: newInternal, error: insertError } = await supabase
          .from('internal_categories')
          .insert({
            name,
            slug,
            parent_id: parentInternalId,
            description
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error inserting category:', insertError);
          return;
        }

        if (newInternal) {
          idMap.set(supCat.id, newInternal.id);

          await supabase
            .from('category_mappings')
            .upsert({
              supplier_category_id: supCat.id,
              internal_category_id: newInternal.id,
            });

          if (supCat.children && supCat.children.length > 0) {
            for (const child of supCat.children) {
              await copyCategory(child, newInternal.id);
            }
          }
        }
      };

      for (const rootCategory of supplierCategories) {
        await copyCategory(rootCategory, null);
      }

      if (selectedSupplier) {
        await supabase.rpc('update_product_readiness_for_supplier', {
          supplier_uuid: selectedSupplier,
        });
      }

      await loadInternalCategories();
      await loadSupplierCategories();

      alert(`Successfully copied ${idMap.size} categories!`);
    } catch (error) {
      console.error('Error copying categories:', error);
      alert('Error copying categories. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyBranch = async (category: SupplierCategory, mode: 'with_parent' | 'children_only' | 'parent_only') => {
    const descendantsCount = getAllDescendants(category).length;
    const categoryName = category.name_ru || category.name_uk || category.name;

    let count = 0;
    let modeText = '';

    if (mode === 'with_parent') {
      count = descendantsCount;
      modeText = 'Include parent category and all children';
    } else if (mode === 'children_only') {
      count = descendantsCount - 1;
      modeText = 'Copy only children without parent';
    } else {
      count = 1;
      modeText = 'Copy only this category without children';
    }

    if (!confirm(`Copy ${count} ${count === 1 ? 'category' : 'categories'} from "${categoryName}" as internal categories?\n\nMode: ${modeText}`)) {
      return;
    }

    setLoading(true);

    try {
      const idMap = new Map<string, string>();

      const copyCategory = async (supCat: SupplierCategory, parentInternalId: string | null = null, includeChildren: boolean = true) => {
        const name = supCat.name_ru || supCat.name_uk || supCat.name;

        const baseSlug = name
          .toLowerCase()
          .replace(/[^a-zа-яіїєґ0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        let slug = baseSlug;
        let attempt = 1;

        while (true) {
          const { data: existing } = await supabase
            .from('internal_categories')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

          if (!existing) break;
          slug = `${baseSlug}-${attempt}`;
          attempt++;
        }

        const description = [supCat.name_ru, supCat.name_uk].filter(Boolean).join(' / ') || '';

        const { data: newInternal, error: insertError } = await supabase
          .from('internal_categories')
          .insert({
            name,
            slug,
            parent_id: parentInternalId,
            description
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('Error inserting category:', insertError);
          return;
        }

        if (newInternal) {
          idMap.set(supCat.id, newInternal.id);

          await supabase
            .from('category_mappings')
            .upsert({
              supplier_category_id: supCat.id,
              internal_category_id: newInternal.id,
            });

          if (includeChildren && supCat.children && supCat.children.length > 0) {
            for (const child of supCat.children) {
              await copyCategory(child, newInternal.id, true);
            }
          }
        }
      };

      if (mode === 'with_parent') {
        await copyCategory(category, null, true);
      } else if (mode === 'children_only') {
        if (category.children && category.children.length > 0) {
          for (const child of category.children) {
            await copyCategory(child, null, true);
          }
        }
      } else {
        await copyCategory(category, null, false);
      }

      if (selectedSupplier) {
        await supabase.rpc('update_product_readiness_for_supplier', {
          supplier_uuid: selectedSupplier,
        });
      }

      await loadInternalCategories();
      await loadSupplierCategories();

      alert(`Successfully copied ${idMap.size} categories!`);
    } catch (error) {
      console.error('Error copying categories:', error);
      alert('Error copying categories. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const flattenSupplierCategories = (cats: SupplierCategory[]): SupplierCategory[] => {
    const result: SupplierCategory[] = [];
    const flatten = (categories: SupplierCategory[]) => {
      categories.forEach(cat => {
        result.push(cat);
        if (cat.children) flatten(cat.children);
      });
    };
    flatten(cats);
    return result;
  };

  const toggleSupplierExpanded = (id: string) => {
    const newExpanded = new Set(expandedSupplierIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedSupplierIds(newExpanded);
  };

  const toggleInternalExpanded = (id: string) => {
    const newExpanded = new Set(expandedInternalIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedInternalIds(newExpanded);
  };

  const filterCategories = (categories: SupplierCategory[], query: string): SupplierCategory[] => {
    const results: SupplierCategory[] = [];

    const searchCategory = (cat: SupplierCategory): boolean => {
      const nameMatch = cat.name.toLowerCase().includes(query);
      const nameRuMatch = cat.name_ru?.toLowerCase().includes(query);
      const nameUkMatch = cat.name_uk?.toLowerCase().includes(query);
      const idMatch = cat.external_id.toLowerCase().includes(query);

      const childMatches = cat.children?.filter(child => searchCategory(child)) || [];

      if (nameMatch || nameRuMatch || nameUkMatch || idMatch || childMatches.length > 0) {
        results.push({
          ...cat,
          children: childMatches.length > 0 ? childMatches : cat.children,
        });
        return true;
      }

      return false;
    };

    categories.forEach(cat => searchCategory(cat));
    return results;
  };

  const expandSearchResults = (categories: SupplierCategory[]) => {
    const idsToExpand = new Set<string>();
    const collectIds = (cats: SupplierCategory[]) => {
      cats.forEach(cat => {
        idsToExpand.add(cat.id);
        if (cat.children) collectIds(cat.children);
      });
    };
    collectIds(categories);
    setExpandedSupplierIds(idsToExpand);
  };

  const getAllDescendants = (category: SupplierCategory): SupplierCategory[] => {
    const descendants: SupplierCategory[] = [category];
    const collect = (cat: SupplierCategory) => {
      if (cat.children) {
        cat.children.forEach(child => {
          descendants.push(child);
          collect(child);
        });
      }
    };
    collect(category);
    return descendants;
  };

  const handleBulkMapCategory = async (category: SupplierCategory, internalCategoryId: string) => {
    if (!confirm(`Map "${category.name_ru || category.name}" and all ${getAllDescendants(category).length - 1} descendants to the selected category?`)) {
      return;
    }

    const allCategories = getAllDescendants(category);

    for (const cat of allCategories) {
      if (!internalCategoryId) {
        await supabase
          .from('category_mappings')
          .delete()
          .eq('supplier_category_id', cat.id);
      } else {
        await supabase
          .from('category_mappings')
          .upsert({
            supplier_category_id: cat.id,
            internal_category_id: internalCategoryId,
          });
      }
    }

    if (selectedSupplier) {
      await supabase.rpc('update_product_readiness_for_supplier', {
        supplier_uuid: selectedSupplier,
      });
    }

    await loadSupplierCategories();
  };

  const getSuggestedMapping = (category: SupplierCategory) => {
    if (!autoSuggestEnabled) return null;
    const flatInternal = flattenInternalCategories(internalCategories);
    const match = findBestMatch(category, flatInternal);
    return match;
  };

  const renderSupplierCategory = (category: SupplierCategory, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedSupplierIds.has(category.id);
    const isMapped = !!category.mapping;
    const descendantsCount = hasChildren ? getAllDescendants(category).length - 1 : 0;
    const suggestion = getSuggestedMapping(category);

    return (
      <div key={category.id}>
        <div
          className="border border-gray-200 rounded-lg p-3 mb-2 hover:bg-gray-50 transition-colors"
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-start gap-2">
            <button
              onClick={() => hasChildren && toggleSupplierExpanded(category.id)}
              className={`flex-shrink-0 ${hasChildren ? 'cursor-pointer text-gray-600 hover:text-gray-900' : 'cursor-default'}`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              ) : (
                <div className="w-4 h-4" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex flex-col min-w-0">
                  {category.name_ru && (
                    <p className="font-medium text-gray-900">🇷🇺 {category.name_ru}</p>
                  )}
                  {category.name_uk && (
                    <p className="text-sm text-gray-600">🇺🇦 {category.name_uk}</p>
                  )}
                  {!category.name_ru && !category.name_uk && (
                    <p className="font-medium text-gray-900">{category.name}</p>
                  )}
                </div>
                {isMapped ? (
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2">
                ID: {category.external_id}
                {hasChildren && <span className="ml-2">({descendantsCount} descendants)</span>}
              </p>

              {suggestion && !isMapped && (
                <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                  <div className="flex items-center gap-1 text-blue-700 mb-1">
                    <Wand2 className="w-3 h-3" />
                    <span className="font-medium">Suggested: {suggestion.category.name}</span>
                    <span className="text-blue-600">({suggestion.score}% match)</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={category.mapping?.internal_category?.id || ''}
                  onChange={(e) => handleMapCategory(category.id, e.target.value)}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select internal category...</option>
                  {flattenInternalCategories(internalCategories).map((intCat) => (
                    <option key={intCat.id} value={intCat.id}>
                      {'─'.repeat(intCat.level * 2)}{intCat.level > 0 ? ' ' : ''}{intCat.name}
                    </option>
                  ))}
                </select>
              </div>

              {!hasChildren && (
                <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-2">
                  <button
                    onClick={() => handleCopyBranch(category, 'parent_only')}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="Copy this category to internal categories"
                  >
                    Copy to Internal
                  </button>
                </div>
              )}

              {hasChildren && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const internalCatId = category.mapping?.internal_category?.id || '';
                        if (internalCatId) {
                          handleBulkMapCategory(category, internalCatId);
                        } else {
                          alert('Please select an internal category first');
                        }
                      }}
                      disabled={!category.mapping?.internal_category?.id}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Bulk Map All ({descendantsCount + 1})
                    </button>
                    <span className="text-xs text-gray-500">Map this + all children</span>
                  </div>
                  <div className="flex flex-col gap-1 pt-1 border-t border-gray-100">
                    <span className="text-xs text-gray-600 font-medium">Copy to Internal:</span>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => handleCopyBranch(category, 'with_parent')}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        title="Copy this category and all subcategories"
                      >
                        With Parent ({descendantsCount})
                      </button>
                      <button
                        onClick={() => handleCopyBranch(category, 'children_only')}
                        className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                        title="Copy only subcategories without the parent"
                      >
                        Children Only ({descendantsCount - 1})
                      </button>
                      <button
                        onClick={() => handleCopyBranch(category, 'parent_only')}
                        className="px-3 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700 transition-colors"
                        title="Copy only this category without children"
                      >
                        Parent Only (1)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        {isExpanded && hasChildren && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200" style={{ marginLeft: `${level * 24 + 8}px` }} />
            {category.children!.map(child => renderSupplierCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const renderInternalCategory = (category: InternalCategory, level: number = 0) => {
    const hasChildren = category.children && category.children.length > 0;
    const isExpanded = expandedInternalIds.has(category.id);

    return (
      <div key={category.id}>
        <div
          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 mb-2 transition-colors"
          style={{ marginLeft: `${level * 24}px` }}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => hasChildren && toggleInternalExpanded(category.id)}
              className={`flex-shrink-0 ${hasChildren ? 'cursor-pointer text-gray-600 hover:text-gray-900' : 'cursor-default'}`}
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )
              ) : (
                <div className="w-4 h-4" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900">{category.name}</p>
              <p className="text-sm text-gray-500">{category.slug}</p>
            </div>
          </div>
          <button
            onClick={() => handleDeleteInternalCategory(category.id)}
            className="text-red-600 hover:text-red-900 flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        {isExpanded && hasChildren && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-200" style={{ marginLeft: `${level * 24 + 8}px` }} />
            {category.children!.map(child => renderInternalCategory(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const flattenInternalCategories = (cats: InternalCategory[]): Array<InternalCategory & { level: number }> => {
    const result: Array<InternalCategory & { level: number }> = [];
    const flatten = (categories: InternalCategory[], level: number = 0) => {
      categories.forEach(cat => {
        result.push({ ...cat, level });
        if (cat.children) flatten(cat.children, level + 1);
      });
    };
    flatten(cats, 0);
    return result;
  };

  const countSupplierCategories = (cats: SupplierCategory[]): { total: number; mapped: number } => {
    let total = 0;
    let mapped = 0;
    const count = (categories: SupplierCategory[]) => {
      categories.forEach(cat => {
        total++;
        if (cat.mapping) mapped++;
        if (cat.children) count(cat.children);
      });
    };
    count(cats);
    return { total, mapped };
  };

  const stats = countSupplierCategories(supplierCategories);

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Category Mapping</h1>
            {selectedSupplier && (
              <p className="text-gray-600 mt-1">
                {stats.mapped} mapped, {stats.total - stats.mapped} unmapped
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {selectedSupplier && supplierCategories.length > 0 && (
              <button
                onClick={handleCopySupplierTree}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Copy Supplier Tree
              </button>
            )}
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Internal Category
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="mb-6 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Internal Category</h2>
            <form onSubmit={handleCreateCategory} className="flex gap-4">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </form>
          </div>
        )}

        <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
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
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading categories...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Supplier Categories</h2>
                <button
                  onClick={() => setAutoSuggestEnabled(!autoSuggestEnabled)}
                  className={`flex items-center gap-1 px-3 py-1 text-sm rounded transition-colors ${
                    autoSuggestEnabled
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <Wand2 className="w-4 h-4" />
                  Auto-suggest {autoSuggestEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              {selectedSupplier && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name (RU/UK) or ID..."
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 overflow-y-auto">
              {!selectedSupplier ? (
                <p className="text-gray-500 text-center py-8">
                  Select a supplier to view and map categories
                </p>
              ) : filteredCategories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  {searchQuery ? 'No categories match your search' : 'No categories found for this supplier'}
                </p>
              ) : (
                <div>
                  {filteredCategories.map((category) => renderSupplierCategory(category))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Internal Categories</h2>
            </div>
            <div className="p-4 overflow-y-auto">
              {internalCategories.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No internal categories. Create one to start mapping.
                </p>
              ) : (
                <div>
                  {internalCategories.map((category) => renderInternalCategory(category))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
