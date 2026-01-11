import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Eye, CheckCircle, AlertCircle, Package } from 'lucide-react';
import type { ProductWithRelations } from '../../types/pim';

interface ProductsListProps {
  onSelectProduct: (productId: number) => void;
}

export function ProductsList({ onSelectProduct }: ProductsListProps) {
  const [products, setProducts] = useState<ProductWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select(`
        *,
        supplier_category:supplier_categories(
          id,
          name_ru,
          name_uk,
          name
        ),
        prices:product_prices(
          price_type,
          value,
          currency
        ),
        stocks:warehouse_stocks(
          warehouse_code,
          warehouse_name,
          quantity
        ),
        quality:product_quality_scores(
          completeness_score
        )
      `)
      .order('created_at', { ascending: false });

    const { data, error } = await query;

    if (!error && data) {
      setProducts(data as any);
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name_ru.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name_uk.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.supplier_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.barcode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'ready' && product.is_ready) ||
      (statusFilter === 'not_ready' && !product.is_ready);

    return matchesSearch && matchesStatus;
  });

  const getRetailPrice = (product: ProductWithRelations): string => {
    const retailPrice = product.prices?.find(p => p.price_type === 'retail.current');
    if (retailPrice) {
      return `${retailPrice.value.toFixed(2)} ${retailPrice.currency}`;
    }
    return '—';
  };

  const getPurchasePrice = (product: ProductWithRelations): string => {
    const purchasePrice = product.prices?.find(p => p.price_type === 'purchase.cash.current');
    if (purchasePrice) {
      return `${purchasePrice.value.toFixed(2)} ${purchasePrice.currency}`;
    }
    return '—';
  };

  const getTotalStock = (product: ProductWithRelations): number => {
    return product.total_stock || 0;
  };

  const getQualityScore = (product: ProductWithRelations): number => {
    // @ts-ignore - quality is from product_quality_scores join
    return product.quality?.[0]?.completeness_score || product.completeness_score || 0;
  };

  return (
    <div className="w-full px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
          <Package className="w-7 h-7" />
          Products
        </h1>
        <p className="text-gray-600">Manage your product catalog</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-6">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, SKU, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="ready">Ready</option>
              <option value="not_ready">Not Ready</option>
            </select>
          </div>

          <div className="text-sm text-gray-600">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-500">Loading products...</div>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <div className="text-gray-500">No products found</div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SKU / Barcode
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retail
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Purchase
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {product.main_image ? (
                        <img
                          src={product.main_image}
                          alt={product.name_ru || product.name_uk}
                          className="w-12 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                          <Package className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">
                          {product.name_ru || product.name_uk}
                        </div>
                        {product.brand_ref && (
                          <div className="text-sm text-gray-500">{product.brand_ref}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      SKU: {product.supplier_sku}
                    </div>
                    {product.barcode && (
                      <div className="text-sm text-gray-500">
                        EAN: {product.barcode}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {product.supplier_category ? (
                      <div className="text-sm text-gray-900">
                        {product.supplier_category.name_ru || product.supplier_category.name_uk || product.supplier_category.name}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not assigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm text-gray-900">{getRetailPrice(product)}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="text-sm text-gray-900">{getPurchasePrice(product)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {getTotalStock(product)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            getQualityScore(product) === 100
                              ? 'bg-green-500'
                              : getQualityScore(product) >= 75
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${getQualityScore(product)}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600">
                        {getQualityScore(product)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {product.is_ready ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        <CheckCircle className="w-3 h-3" />
                        Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                        <AlertCircle className="w-3 h-3" />
                        Not Ready
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onSelectProduct(product.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
