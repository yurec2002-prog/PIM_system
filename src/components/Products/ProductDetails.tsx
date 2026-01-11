import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Package, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

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
  supplier_category?: {
    id: string;
    name: string;
    category_mappings: Array<{
      internal_category: { id: string; name: string };
    }>;
  } | null;
  brand?: {
    name: string;
    logo_url: string;
  } | null;
}

interface Price {
  id: string;
  price_type: string;
  value: number;
  currency: string;
  source: string;
}

interface ProductDetailsProps {
  productId: string;
  onClose: () => void;
}

export function ProductDetails({ productId, onClose }: ProductDetailsProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const parsePrice = (value: any): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value.replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const findPrice = (priceType: string): number => {
    const price = prices.find(p => p.price_type === priceType);
    return price ? parsePrice(price.value) : 0;
  };

  const retailPrice = findPrice('retail.current');
  const purchasePrice = findPrice('purchase.cash.current');
  const margin = retailPrice - purchasePrice;
  const marginPercent = retailPrice > 0 ? (margin / retailPrice) * 100 : 0;

  const getInternalCategory = () => {
    if (!product?.supplier_category) return null;
    const mappings = product.supplier_category.category_mappings;
    if (!mappings || mappings.length === 0) return null;
    return mappings[0]?.internal_category;
  };

  const internalCategory = getInternalCategory();

  const readinessChecklist = [
    {
      label: 'Название товара',
      passed: !!(product?.name_uk || product?.name_ru),
    },
    {
      label: 'Описание',
      passed: !!(product?.description_uk || product?.description_ru),
    },
    {
      label: 'Внутренняя категория',
      passed: !!internalCategory,
    },
    {
      label: 'Изображения',
      passed: !!(product?.images && product.images.length > 0),
    },
    {
      label: 'Розничная цена',
      passed: retailPrice > 0,
    },
    {
      label: 'Закупочная цена',
      passed: purchasePrice > 0,
    },
    {
      label: 'Штрихкод',
      passed: !!product?.barcode,
    },
    {
      label: 'Наличие на складе',
      passed: (product?.total_stock || 0) > 0,
    },
  ];

  const loadProduct = async () => {
    setLoading(true);

    const { data: productData, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        supplier_category:supplier_categories!supplier_category_id(
          id,
          name,
          category_mappings!supplier_category_id(
            internal_category:internal_categories!internal_category_id(id, name)
          )
        )
      `)
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

    const { data: qualityData } = await supabase
      .from('product_quality_scores')
      .select('completeness_score')
      .eq('product_id', productId)
      .maybeSingle();

    let brandData = null;
    if (productData.brand_ref) {
      const { data: brand } = await supabase
        .from('brands')
        .select('name, logo_url')
        .eq('external_ref', productData.brand_ref)
        .maybeSingle();
      brandData = brand;
    }

    const enrichedProduct = {
      ...productData,
      completeness_score: qualityData?.completeness_score ?? productData.completeness_score ?? 0,
      brand: brandData,
    };

    setProduct(enrichedProduct as any);
    setPrices(pricesData || []);
    setLoading(false);
  };

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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-6xl w-full my-8">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Package className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {product.name_uk || product.name_ru || product.supplier_sku}
              </h2>
              <p className="text-sm text-gray-600">
                {product.supplier} • Внутренний SKU: {product.internal_sku || 'Не присвоен'} • SKU поставщика: {product.supplier_sku}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium mb-1">Розничная цена</div>
              <div className="text-2xl font-bold text-blue-900">
                {retailPrice > 0 ? `${retailPrice.toFixed(2)} UAH` : 'Н/Д'}
              </div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-sm text-orange-600 font-medium mb-1">Закупочная цена</div>
              <div className="text-2xl font-bold text-orange-900">
                {purchasePrice > 0 ? `${purchasePrice.toFixed(2)} UAH` : 'Н/Д'}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium mb-1 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1" />
                Маржа
              </div>
              <div className="text-2xl font-bold text-green-900">
                {retailPrice > 0 && purchasePrice > 0 ? `${margin.toFixed(2)} UAH` : 'Н/Д'}
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium mb-1">Маржа %</div>
              <div className="text-2xl font-bold text-green-900">
                {retailPrice > 0 && purchasePrice > 0 ? `${marginPercent.toFixed(1)}%` : 'Н/Д'}
              </div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium mb-1">Остаток</div>
              <div className="text-2xl font-bold text-purple-900">
                {product.total_stock || 0} шт.
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Чек-лист готовности товара</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {readinessChecklist.map((item, index) => (
                <div key={index} className="flex items-center">
                  {item.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 mr-2 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mr-2 flex-shrink-0" />
                  )}
                  <span className={`text-sm ${item.passed ? 'text-gray-900' : 'text-gray-500'}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Общая готовность:</span>
                <span className={`text-lg font-bold ${product.is_ready ? 'text-green-600' : 'text-yellow-600'}`}>
                  {product.completeness_score}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <div className="lg:col-span-2">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Информация о товаре</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Поставщик</dt>
                  <dd className="text-sm text-gray-900">{product.supplier}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Внутренний SKU</dt>
                  <dd className="text-sm font-semibold text-blue-900">{product.internal_sku || 'Не присвоен'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">SKU поставщика</dt>
                  <dd className="text-sm text-gray-900">{product.supplier_sku}</dd>
                </div>
                {product.barcode && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Штрихкод</dt>
                    <dd className="text-sm text-gray-900">{product.barcode}</dd>
                  </div>
                )}
                {product.vendor_code && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Артикул поставщика</dt>
                    <dd className="text-sm text-gray-900">{product.vendor_code}</dd>
                  </div>
                )}
                {product.brand?.name && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Бренд</dt>
                    <dd className="text-sm text-gray-900">{product.brand.name}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-gray-500">Внутренняя категория</dt>
                  <dd className="text-sm text-gray-900">
                    {internalCategory?.name || (
                      <span className="text-yellow-600">Не привязана</span>
                    )}
                  </dd>
                </div>
                {product.description_uk && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Описание (UK)</dt>
                    <dd className="text-sm text-gray-900">{product.description_uk}</dd>
                  </div>
                )}
                {product.description_ru && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Описание (RU)</dt>
                    <dd className="text-sm text-gray-900">{product.description_ru}</dd>
                  </div>
                )}
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Все цены</h3>
              {prices.length > 0 ? (
                <div className="overflow-hidden border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Тип
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Цена
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {prices.map((price) => (
                        <tr key={price.id}>
                          <td className="px-3 py-2 text-xs text-gray-900">
                            {price.price_type}
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-medium text-gray-900">
                            {parsePrice(price.value).toFixed(2)} {price.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Цены отсутствуют</p>
              )}

              <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Изображения</h3>
              <div className="grid grid-cols-2 gap-2">
                {product.images && product.images.length > 0 ? (
                  product.images.slice(0, 4).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Товар ${i + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                  ))
                ) : (
                  <div className="col-span-2 bg-gray-100 rounded-lg flex items-center justify-center h-32">
                    <Package className="w-12 h-12 text-gray-400" />
                  </div>
                )}
              </div>
              {product.images && product.images.length > 4 && (
                <p className="text-sm text-gray-500 mt-2">
                  +{product.images.length - 4} ещё
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Атрибуты
            </h3>
            <div className="space-y-4">
              {product.attributes_uk && Object.keys(product.attributes_uk).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Українська</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {Object.entries(product.attributes_uk).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {product.attributes_ru && Object.keys(product.attributes_ru).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Русский</h4>
                  <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                    {Object.entries(product.attributes_ru).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-gray-600">{key}:</span>
                        <span className="text-gray-900 font-medium">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!product.attributes_uk || Object.keys(product.attributes_uk).length === 0) &&
               (!product.attributes_ru || Object.keys(product.attributes_ru).length === 0) && (
                <p className="text-sm text-gray-500">Атрибуты отсутствуют</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
