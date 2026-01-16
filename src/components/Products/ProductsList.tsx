import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Package,
  ImageIcon,
  TrendingUp,
  ArrowUpDown,
  Filter,
  ChevronDown,
  Info
} from 'lucide-react';

interface Product {
  id: string;
  supplier_id?: string;
  suppliers?: { name: string };
  supplier?: string;
  supplier_sku: string;
  internal_sku: string | null;
  barcode: string | null;
  vendor_code: string | null;
  brand_ref: string | null;
  name_ru: string | null;
  name_uk: string | null;
  images: string[];
  main_image: string | null;
  total_stock: number;
  is_ready: boolean;
  completeness_score: number;
  supplier_category_id: string | null;
  internal_category_id: string | null;
  blocking_reasons?: string[];
  blocking_reasons_text?: { ru: string[]; uk: string[] };
  warnings?: string[];
  warnings_text?: { ru: string[]; uk: string[] };
  created_at: string;
  updated_at: string;
}

interface Price {
  price_type: string;
  value: number;
  currency: string;
}

interface Brand {
  name: string;
  logo_url: string | null;
}

interface Category {
  id: string;
  name: string;
  name_ru?: string;
  name_uk?: string;
}

interface EnrichedProduct extends Product {
  prices?: Price[];
  brand?: Brand | null;
  supplier_category?: Category | null;
  internal_category?: Category | null;
}

interface ProductsListProps {
  onSelectProduct: (productId: string) => void;
}

type SortField = 'name' | 'retail_price' | 'purchase_price' | 'margin' | 'stock' | 'readiness';
type SortDirection = 'asc' | 'desc';

export function ProductsList({ onSelectProduct }: ProductsListProps) {
  const [products, setProducts] = useState<EnrichedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const [readinessFilter, setReadinessFilter] = useState<string>('all');
  const [categoryMappingFilter, setCategoryMappingFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    loadProducts();
  }, []);

  const parsePrice = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const loadProducts = async () => {
    setLoading(true);

    const { data: productsData } = await supabase
      .from('supplier_products')
      .select(`
        *,
        suppliers!inner(name)
      `)
      .order('created_at', { ascending: false });

    if (!productsData) {
      setLoading(false);
      return;
    }

    const productIds = productsData.map(p => p.id);

    const { data: pricesData } = await supabase
      .from('product_prices')
      .select('*')
      .in('supplier_product_id', productIds);

    const brandRefs = [...new Set(productsData.filter(p => p.brand_ref).map(p => p.brand_ref))];
    const { data: brandsData } = await supabase
      .from('brands')
      .select('external_ref, name, logo_url')
      .in('external_ref', brandRefs);

    const supplierCategoryIds = [...new Set(productsData.filter(p => p.supplier_category_id).map(p => p.supplier_category_id))];
    const { data: supplierCategoriesData } = await supabase
      .from('supplier_categories')
      .select('id, name, name_ru, name_uk')
      .in('id', supplierCategoryIds);

    const internalCategoryIds = [...new Set(productsData.filter(p => p.internal_category_id).map(p => p.internal_category_id))];
    const { data: internalCategoriesData } = await supabase
      .from('internal_categories')
      .select('id, name')
      .in('id', internalCategoryIds);

    const enrichedProducts: EnrichedProduct[] = productsData.map(product => {
      const productPrices = pricesData?.filter(p => p.product_id === product.id) || [];
      const brand = brandsData?.find(b => b.external_ref === product.brand_ref);
      const supplierCategory = supplierCategoriesData?.find(c => c.id === product.supplier_category_id);
      const internalCategory = internalCategoriesData?.find(c => c.id === product.internal_category_id);

      return {
        ...product,
        prices: productPrices,
        brand: brand ? { name: brand.name, logo_url: brand.logo_url } : null,
        supplier_category: supplierCategory,
        internal_category: internalCategory,
      };
    });

    const uniqueBrands = brandsData || [];
    setBrands(uniqueBrands);
    setProducts(enrichedProducts);
    setLoading(false);
  };

  const getRetailPrice = (product: EnrichedProduct): number => {
    const retailPrice = product.prices?.find(p => p.price_type.toLowerCase().includes('retail'));
    return retailPrice ? parsePrice(retailPrice.value) : 0;
  };

  const getPurchasePrice = (product: EnrichedProduct): number => {
    const purchasePrice = product.prices?.find(p => p.price_type.toLowerCase().includes('purchase'));
    return purchasePrice ? parsePrice(purchasePrice.value) : 0;
  };

  const getMargin = (product: EnrichedProduct): { amount: number; percentage: number; markup: number } => {
    const retail = getRetailPrice(product);
    const purchase = getPurchasePrice(product);

    if (retail === 0 || purchase === 0) {
      return { amount: 0, percentage: 0, markup: 0 };
    }

    const amount = retail - purchase;
    const percentage = (amount / retail) * 100;
    const markup = ((retail / purchase - 1) * 100);

    return { amount, percentage, markup };
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getBlockingReasons = (product: EnrichedProduct): string[] => {
    return product.blocking_reasons_text?.ru || [];
  };

  const getWarnings = (product: EnrichedProduct): string[] => {
    return product.warnings_text?.ru || [];
  };

  const isRecentlyUpdated = (product: EnrichedProduct): boolean => {
    const updatedDate = new Date(product.updated_at);
    const now = new Date();
    const diffHours = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60);
    return diffHours < 24;
  };

  let filteredProducts = products.filter(product => {
    const productName = product.name_ru || product.name_uk || '';
    const matchesSearch =
      productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.supplier_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.vendor_code && product.vendor_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesBrand = brandFilter === 'all' || product.brand_ref === brandFilter;

    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'in_stock' && product.total_stock > 0) ||
      (stockFilter === 'out_of_stock' && product.total_stock === 0);

    const matchesReadiness =
      readinessFilter === 'all' ||
      (readinessFilter === 'ready' && product.is_ready) ||
      (readinessFilter === 'not_ready' && !product.is_ready);

    const matchesCategoryMapping =
      categoryMappingFilter === 'all' ||
      (categoryMappingFilter === 'mapped' && product.internal_category_id) ||
      (categoryMappingFilter === 'not_mapped' && !product.internal_category_id);

    return matchesSearch && matchesBrand && matchesStock && matchesReadiness && matchesCategoryMapping;
  });

  filteredProducts = filteredProducts.sort((a, b) => {
    let comparison = 0;

    switch (sortField) {
      case 'name':
        const nameA = a.name_ru || a.name_uk || '';
        const nameB = b.name_ru || b.name_uk || '';
        comparison = nameA.localeCompare(nameB);
        break;
      case 'retail_price':
        comparison = getRetailPrice(a) - getRetailPrice(b);
        break;
      case 'purchase_price':
        comparison = getPurchasePrice(a) - getPurchasePrice(b);
        break;
      case 'margin':
        comparison = getMargin(a).amount - getMargin(b).amount;
        break;
      case 'stock':
        comparison = a.total_stock - b.total_stock;
        break;
      case 'readiness':
        comparison = (a.is_ready ? 1 : 0) - (b.is_ready ? 1 : 0);
        break;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 hover:text-gray-900 transition-colors"
    >
      <span>{children}</span>
      {sortField === field && (
        <ArrowUpDown className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
      )}
    </button>
  );

  return (
    <div className="w-full px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Package className="w-7 h-7" />
          Каталог товаров
        </h1>
        <p className="text-gray-600">Управление товарами и ценами</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Поиск по названию, SKU, артикулу, баркоду..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center space-x-2 px-4 py-2 border rounded-md transition-colors ${
                showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Фильтры</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Бренд</label>
                <select
                  value={brandFilter}
                  onChange={(e) => setBrandFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все бренды</option>
                  {brands.map((brand) => (
                    <option key={brand.name} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Наличие</label>
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все товары</option>
                  <option value="in_stock">В наличии</option>
                  <option value="out_of_stock">Нет в наличии</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Готовность</label>
                <select
                  value={readinessFilter}
                  onChange={(e) => setReadinessFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все</option>
                  <option value="ready">Готов</option>
                  <option value="not_ready">Не готов</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Категории</label>
                <select
                  value={categoryMappingFilter}
                  onChange={(e) => setCategoryMappingFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Все</option>
                  <option value="mapped">Привязаны</option>
                  <option value="not_mapped">Не привязаны</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              Показано {paginatedProducts.length} из {filteredProducts.length} товаров
              {filteredProducts.length < products.length && ` (всего: ${products.length})`}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Назад
                </button>
                <span>
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  Вперед
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-gray-500">Загрузка товаров...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-gray-500">Товары не найдены</div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 min-w-[300px]">
                    <SortButton field="name">Товар</SortButton>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="retail_price">Розница</SortButton>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="purchase_price">Закупка</SortButton>
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="margin">Маржа</SortButton>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="stock">Остаток</SortButton>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <SortButton field="readiness">Статус</SortButton>
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Инфо
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProducts.map((product) => {
                  const retailPrice = getRetailPrice(product);
                  const purchasePrice = getPurchasePrice(product);
                  const margin = getMargin(product);
                  const blockingReasons = getBlockingReasons(product);
                  const warnings = getWarnings(product);
                  const hasImages = product.images && product.images.length > 0;
                  const recentlyUpdated = isRecentlyUpdated(product);

                  return (
                    <tr
                      key={product.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => onSelectProduct(product.id)}
                    >
                      <td className="px-4 py-3 sticky left-0 bg-white hover:bg-gray-50">
                        <div className="flex items-start space-x-3">
                          {product.brand?.logo_url ? (
                            <img
                              src={product.brand.logo_url}
                              alt={product.brand.name}
                              className="w-8 h-8 object-contain flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center flex-shrink-0">
                              <Package className="w-4 h-4 text-gray-400" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-gray-900 text-sm truncate">
                              {product.name_ru || product.name_uk || product.supplier_sku}
                            </div>
                            <div className="text-xs text-gray-500 space-y-0.5 mt-1">
                              <div className="font-mono">{product.supplier_sku}</div>
                              {product.vendor_code && (
                                <div className="text-gray-400">Арт: {product.vendor_code}</div>
                              )}
                              {product.brand?.name && (
                                <div className="text-gray-600">{product.brand.name}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {retailPrice > 0 ? (
                          <div className="text-sm font-semibold text-gray-900">
                            {retailPrice.toFixed(2)} ₴
                          </div>
                        ) : (
                          <div className="text-sm text-red-500 font-medium">—</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {purchasePrice > 0 ? (
                          <div className="text-sm font-semibold text-gray-900">
                            {purchasePrice.toFixed(2)} ₴
                          </div>
                        ) : (
                          <div className="text-sm text-yellow-500 font-medium">—</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        {margin.amount > 0 ? (
                          <div>
                            <div className="text-sm font-semibold text-green-700">
                              {margin.amount.toFixed(2)} ₴
                            </div>
                            <div className="text-xs text-gray-500">
                              {margin.percentage.toFixed(1)}% / +{margin.markup.toFixed(0)}%
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-400">—</div>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex flex-col items-center">
                          <div className="text-sm font-semibold text-gray-900">
                            {product.total_stock}
                          </div>
                          <div className={`text-xs px-2 py-0.5 rounded-full mt-1 ${
                            product.total_stock > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {product.total_stock > 0 ? 'В наличии' : 'Нет'}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs space-y-1">
                          {product.supplier_category && (
                            <div className="text-gray-600 truncate max-w-[180px]">
                              {product.supplier_category.name_ru || product.supplier_category.name_uk || product.supplier_category.name}
                            </div>
                          )}
                          <div>
                            {product.internal_category_id ? (
                              <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                                <CheckCircle className="w-3 h-3" />
                                <span>Привязана</span>
                              </div>
                            ) : (
                              <div className="inline-flex items-center space-x-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                                <AlertCircle className="w-3 h-3" />
                                <span>Не привязана</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <div className="relative group inline-block">
                          {product.is_ready ? (
                            <>
                              <div className="inline-flex items-center space-x-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                <CheckCircle className="w-3 h-3" />
                                <span>Готов</span>
                              </div>
                              {warnings.length > 0 && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                                    <div className="font-medium mb-1 text-yellow-300">⚠ Предупреждения:</div>
                                    {warnings.map((warning, i) => (
                                      <div key={i} className="text-gray-200">• {warning}</div>
                                    ))}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                      <div className="border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="inline-flex items-center space-x-1 px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">
                                <XCircle className="w-3 h-3" />
                                <span>Не готов</span>
                              </div>
                              {blockingReasons.length > 0 && (
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-20">
                                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                                    <div className="font-medium mb-1 text-red-300">🚫 Блокирующие причины:</div>
                                    {blockingReasons.map((reason, i) => (
                                      <div key={i} className="text-gray-200">• {reason}</div>
                                    ))}
                                    {warnings.length > 0 && (
                                      <>
                                        <div className="font-medium mt-2 mb-1 text-yellow-300">⚠ Предупреждения:</div>
                                        {warnings.map((warning, i) => (
                                          <div key={i} className="text-gray-200">• {warning}</div>
                                        ))}
                                      </>
                                    )}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                      <div className="border-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center space-x-2">
                          <div
                            className={`p-1 rounded ${
                              hasImages ? 'text-green-600' : 'text-gray-300'
                            }`}
                            title={hasImages ? 'Есть изображения' : 'Нет изображений'}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </div>
                          {blockingReasons.length > 0 && (
                            <div className="p-1 rounded text-red-500" title="Есть блокирующие причины">
                              <XCircle className="w-4 h-4" />
                            </div>
                          )}
                          {warnings.length > 0 && (
                            <div className="p-1 rounded text-yellow-500" title="Есть предупреждения">
                              <AlertCircle className="w-4 h-4" />
                            </div>
                          )}
                          {recentlyUpdated && (
                            <div className="p-1 rounded text-blue-500" title="Обновлён за последние 24ч">
                              <TrendingUp className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
