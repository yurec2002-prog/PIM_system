import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X,
  Copy,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Package,
  ImageIcon,
  Search,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle
} from 'lucide-react';

interface Product {
  id: string;
  supplier: string;
  supplier_sku: string;
  internal_sku: string | null;
  barcode: string | null;
  vendor_code: string | null;
  brand_ref: string | null;
  name_ru: string | null;
  name_uk: string | null;
  description_ru: string | null;
  description_uk: string | null;
  attributes_ru: any;
  attributes_uk: any;
  images: string[];
  main_image: string | null;
  total_stock: number;
  is_ready: boolean;
  completeness_score: number;
  supplier_category_id: string | null;
  internal_category_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Price {
  id: string;
  price_type: string;
  value: number;
  old_value?: number;
  currency: string;
  source: string;
}

interface WarehouseStock {
  id: string;
  warehouse_code: string;
  warehouse_name: string | null;
  quantity: number;
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
  parent_id: string | null;
}

interface ProductDetailsProps {
  productId: string;
  onClose: () => void;
}

export function ProductDetails({ productId, onClose }: ProductDetailsProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [stocks, setStocks] = useState<WarehouseStock[]>([]);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [supplierCategory, setSupplierCategory] = useState<Category | null>(null);
  const [supplierCategoryPath, setSupplierCategoryPath] = useState<string>('');
  const [internalCategory, setInternalCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'ru' | 'uk'>('ru');
  const [stockExpanded, setStockExpanded] = useState(false);
  const [attributeSearch, setAttributeSearch] = useState('');
  const [showAllAttributes, setShowAllAttributes] = useState(false);

  const pricesRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<HTMLDivElement>(null);
  const attributesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const parsePrice = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const buildCategoryPath = async (categoryId: string, tableName: string): Promise<string> => {
    const path: string[] = [];
    let currentId: string | null = categoryId;
    const visited = new Set<string>();

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);

      const { data } = await supabase
        .from(tableName)
        .select('name, name_ru, name_uk, parent_id')
        .eq('id', currentId)
        .maybeSingle();

      if (!data) break;

      const categoryName = data.name_ru || data.name_uk || data.name || '';
      path.unshift(categoryName);
      currentId = data.parent_id;
    }

    return path.join(' / ');
  };

  const getReadinessReasons = (): Array<{ label: string; passed: boolean; critical: boolean }> => {
    const retailPrice = findPrice('retail');
    const purchasePrice = findPrice('purchase');

    return [
      {
        label: 'Название товара',
        passed: !!(product?.name_uk || product?.name_ru),
        critical: true,
      },
      {
        label: 'Внутренняя категория',
        passed: !!internalCategory,
        critical: true,
      },
      {
        label: 'Розничная цена',
        passed: retailPrice > 0,
        critical: true,
      },
      {
        label: 'Закупочная цена',
        passed: purchasePrice > 0,
        critical: false,
      },
      {
        label: 'Изображения',
        passed: !!(product?.images && product.images.length > 0),
        critical: false,
      },
      {
        label: 'Штрихкод',
        passed: !!product?.barcode,
        critical: false,
      },
      {
        label: 'Наличие на складе',
        passed: (product?.total_stock || 0) > 0,
        critical: false,
      },
    ];
  };

  const findPrice = (priceTypePattern: string): number => {
    const price = prices.find(p => p.price_type.toLowerCase().includes(priceTypePattern.toLowerCase()));
    return price ? parsePrice(price.value) : 0;
  };

  const formatPriceType = (priceType: string): string => {
    const parts = priceType.split('.');
    return parts
      .map(part => {
        const mapping: Record<string, string> = {
          'retail': 'Розница',
          'purchase': 'Закупка',
          'cash': 'Нал',
          'current': 'Текущая',
          'old': 'Старая',
          'rrp': 'РРЦ',
          'promo': 'Акция',
          'discount': 'Скидка',
          'contract': 'Договор',
        };
        return mapping[part.toLowerCase()] || part;
      })
      .join(' / ');
  };

  const loadProduct = async () => {
    setLoading(true);

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (productError || !productData) {
      setLoading(false);
      return;
    }

    const { data: pricesData } = await supabase
      .from('product_prices')
      .select('*')
      .eq('product_id', productId)
      .order('price_type');

    const { data: stocksData } = await supabase
      .from('warehouse_stocks')
      .select('*')
      .eq('product_id', productId)
      .order('warehouse_name');

    let brandData = null;
    if (productData.brand_ref) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name, logo_url')
        .eq('external_ref', productData.brand_ref)
        .maybeSingle();
      brandData = brand;
    }

    let supplierCategoryData = null;
    let supplierPath = '';
    if (productData.supplier_category_id) {
      const { data: suppCat } = await supabase
        .from('supplier_categories')
        .select('*')
        .eq('id', productData.supplier_category_id)
        .maybeSingle();

      supplierCategoryData = suppCat;
      if (suppCat) {
        supplierPath = await buildCategoryPath(suppCat.id, 'supplier_categories');
      }
    }

    let internalCategoryData = null;
    if (productData.internal_category_id) {
      const { data: intCat } = await supabase
        .from('internal_categories')
        .select('*')
        .eq('id', productData.internal_category_id)
        .maybeSingle();

      internalCategoryData = intCat;
    }

    setProduct(productData as Product);
    setPrices(pricesData || []);
    setStocks(stocksData || []);
    setBrand(brandData);
    setSupplierCategory(supplierCategoryData);
    setSupplierCategoryPath(supplierPath);
    setInternalCategory(internalCategoryData);
    setLoading(false);
  };

  const retailPrice = findPrice('retail');
  const purchasePrice = findPrice('purchase');
  const margin = retailPrice - purchasePrice;
  const marginPercent = retailPrice > 0 ? (margin / retailPrice) * 100 : 0;
  const markup = purchasePrice > 0 ? ((retailPrice / purchasePrice - 1) * 100) : 0;

  const readinessReasons = getReadinessReasons();
  const failedCritical = readinessReasons.filter(r => r.critical && !r.passed);
  const isReady = failedCritical.length === 0;

  const productName = language === 'uk' ? (product?.name_uk || product?.name_ru) : (product?.name_ru || product?.name_uk);

  const importantAttributeKeys = [
    'материал', 'material', 'матеріал',
    'страна', 'country', 'країна',
    'серия', 'series', 'серія',
    'размер', 'size', 'розмір',
    'объем', 'volume', "об'єм",
    'гарантия', 'warranty', 'гарантія',
    'тип', 'type', 'вид'
  ];

  const getAttributes = () => {
    const attrs = language === 'uk' ? product?.attributes_uk : product?.attributes_ru;
    if (!attrs || typeof attrs !== 'object') return { important: [], other: [] };

    const entries = Object.entries(attrs);
    const important = entries.filter(([key]) =>
      importantAttributeKeys.some(importantKey => key.toLowerCase().includes(importantKey.toLowerCase()))
    );
    const other = entries.filter(([key]) =>
      !importantAttributeKeys.some(importantKey => key.toLowerCase().includes(importantKey.toLowerCase()))
    );

    if (attributeSearch) {
      const search = attributeSearch.toLowerCase();
      return {
        important: important.filter(([key, value]) =>
          key.toLowerCase().includes(search) || String(value).toLowerCase().includes(search)
        ),
        other: other.filter(([key, value]) =>
          key.toLowerCase().includes(search) || String(value).toLowerCase().includes(search)
        ),
      };
    }

    return { important, other };
  };

  const { important: importantAttrs, other: otherAttrs } = getAttributes();

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Загрузка товара...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full h-full max-w-7xl max-h-[95vh] flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="flex items-start justify-between p-4">
            <div className="flex items-start space-x-4 flex-1">
              {brand?.logo_url && (
                <img
                  src={brand.logo_url}
                  alt={brand.name}
                  className="h-12 w-auto object-contain"
                />
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  {brand?.name && (
                    <span className="text-sm font-medium text-gray-500">{brand.name}</span>
                  )}
                  <button
                    onClick={() => setLanguage(language === 'ru' ? 'uk' : 'ru')}
                    className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                  >
                    {language === 'ru' ? 'RU' : 'UA'}
                  </button>
                </div>

                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {productName || product.supplier_sku}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="text-gray-500">ID:</span>
                    <span className="font-mono font-medium">{product.supplier_sku}</span>
                    <button onClick={() => copyToClipboard(product.supplier_sku)} className="text-blue-600 hover:text-blue-700">
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {product.internal_sku && (
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-500">Внутр. SKU:</span>
                      <span className="font-mono font-medium">{product.internal_sku}</span>
                      <button onClick={() => copyToClipboard(product.internal_sku!)} className="text-blue-600 hover:text-blue-700">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {product.vendor_code && (
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-500">Артикул:</span>
                      <span className="font-mono font-medium">{product.vendor_code}</span>
                      <button onClick={() => copyToClipboard(product.vendor_code!)} className="text-blue-600 hover:text-blue-700">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {product.barcode && (
                    <div className="flex items-center space-x-1">
                      <span className="text-gray-500">Баркод:</span>
                      <span className="font-mono font-medium">{product.barcode}</span>
                      <button onClick={() => copyToClipboard(product.barcode!)} className="text-blue-600 hover:text-blue-700">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-4 mt-2">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    isReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {isReady ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Готов к продаже
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 mr-1" />
                        Не готов
                        {failedCritical.length > 0 && (
                          <span className="ml-1">({failedCritical.map(r => r.label).join(', ')})</span>
                        )}
                      </>
                    )}
                  </div>

                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    product.total_stock > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {product.total_stock > 0 ? (
                      <>
                        <Package className="w-4 h-4 mr-1" />
                        В наличии: {product.total_stock} шт
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4 mr-1" />
                        Нет в наличии
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center space-x-2 px-4 pb-3 overflow-x-auto">
            <button
              onClick={() => scrollToSection(pricesRef)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
            >
              Цены
            </button>
            <button
              onClick={() => scrollToSection(stockRef)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
            >
              Склады
            </button>
            <button
              onClick={() => scrollToSection(categoriesRef)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
            >
              Категории
            </button>
            <button
              onClick={() => scrollToSection(imagesRef)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
            >
              Изображения
            </button>
            <button
              onClick={() => scrollToSection(attributesRef)}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md whitespace-nowrap"
            >
              Атрибуты
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div ref={pricesRef} className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Цены и маржинальность
            </h3>

            {prices.length > 0 ? (
              <>
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Тип цены
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Текущая цена
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Старая цена
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Валюта
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {prices.map((price) => (
                        <tr key={price.id}>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {formatPriceType(price.price_type)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                            {parsePrice(price.value).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {price.old_value ? parsePrice(price.old_value).toFixed(2) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">
                            {price.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {retailPrice > 0 && purchasePrice > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-green-50 rounded-lg">
                    <div>
                      <div className="text-sm text-green-700 font-medium mb-1">Маржа (сумма)</div>
                      <div className="text-2xl font-bold text-green-900">
                        {margin.toFixed(2)} UAH
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700 font-medium mb-1">Маржа (%)</div>
                      <div className="text-2xl font-bold text-green-900">
                        {marginPercent.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-green-700 font-medium mb-1">Наценка (%)</div>
                      <div className="text-2xl font-bold text-green-900">
                        {markup.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Цены отсутствуют</p>
              </div>
            )}
          </div>

          <div ref={stockRef} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Package className="w-5 h-5 mr-2 text-blue-600" />
                Остатки на складах
              </h3>

              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Всего на складах</div>
                  <div className="text-2xl font-bold text-blue-900">{product.total_stock} шт</div>
                </div>
                {stocks.length > 0 && (
                  <button
                    onClick={() => setStockExpanded(!stockExpanded)}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    {stockExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                )}
              </div>
            </div>

            {stockExpanded && stocks.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Склад
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Количество
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stocks.map((stock) => (
                      <tr key={stock.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {stock.warehouse_name || stock.warehouse_code}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {stock.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {stocks.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>Нет данных об остатках</p>
              </div>
            )}
          </div>

          <div ref={categoriesRef} className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Категории
            </h3>

            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Категория поставщика (Sandi)</div>
                <div className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                  {supplierCategoryPath || 'Не указана'}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Внутренняя категория</div>
                {internalCategory ? (
                  <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg">
                    <span className="text-sm text-gray-900 font-medium">{internalCategory.name}</span>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg">
                    <span className="text-sm text-gray-700">Не привязана</span>
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div ref={imagesRef} className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ImageIcon className="w-5 h-5 mr-2 text-gray-600" />
              Изображения
            </h3>

            {product.images && product.images.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {product.images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img
                      src={img}
                      alt={`${productName} ${i + 1}`}
                      className="w-full h-40 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity rounded-lg flex items-center justify-center space-x-2">
                      <a
                        href={img}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-lg transition-opacity"
                      >
                        <ExternalLink className="w-5 h-5 text-gray-700" />
                      </a>
                      <button
                        onClick={() => copyToClipboard(img)}
                        className="opacity-0 group-hover:opacity-100 p-2 bg-white rounded-lg transition-opacity"
                      >
                        <Copy className="w-5 h-5 text-gray-700" />
                      </button>
                    </div>
                    {i === 0 && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        Главное
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon className="w-16 h-16 mx-auto mb-2 text-gray-400" />
                <p>Изображения отсутствуют</p>
              </div>
            )}
          </div>

          <div ref={attributesRef} className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Атрибуты
              </h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  value={attributeSearch}
                  onChange={(e) => setAttributeSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {(importantAttrs.length > 0 || otherAttrs.length > 0) ? (
              <div className="space-y-4">
                {importantAttrs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Основные характеристики</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {importantAttrs.map(([key, value]) => (
                        <div key={key} className="bg-blue-50 rounded-lg p-3">
                          <div className="text-xs text-blue-700 font-medium mb-1">{key}</div>
                          <div className="text-sm text-gray-900 font-semibold">{String(value)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {otherAttrs.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-700">
                        Дополнительные характеристики ({otherAttrs.length})
                      </h4>
                      {otherAttrs.length > 10 && (
                        <button
                          onClick={() => setShowAllAttributes(!showAllAttributes)}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {showAllAttributes ? 'Скрыть' : 'Показать все'}
                        </button>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {(showAllAttributes ? otherAttrs : otherAttrs.slice(0, 10)).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                          <span className="text-gray-600">{key}</span>
                          <span className="text-gray-900 font-medium text-right ml-4">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Атрибуты отсутствуют</p>
              </div>
            )}
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Служебная информация</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Источник данных</dt>
                <dd className="text-gray-900 font-medium">sandi_json</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Поставщик</dt>
                <dd className="text-gray-900 font-medium">{product.supplier}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Последнее обновление</dt>
                <dd className="text-gray-900 font-medium">
                  {new Date(product.updated_at).toLocaleString('ru-RU')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Создано</dt>
                <dd className="text-gray-900 font-medium">
                  {new Date(product.created_at).toLocaleString('ru-RU')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Процент готовности</dt>
                <dd className="text-gray-900 font-medium">{product.completeness_score}%</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
