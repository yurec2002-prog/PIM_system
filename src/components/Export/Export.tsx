import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Download, FileText, AlertCircle } from 'lucide-react';

interface ExportStats {
  totalProducts: number;
  readyProducts: number;
  totalVariants: number;
}

export function Export() {
  const [stats, setStats] = useState<ExportStats>({
    totalProducts: 0,
    readyProducts: 0,
    totalVariants: 0,
  });
  const [loading, setLoading] = useState(true);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xml'>('csv');
  const [onlyReady, setOnlyReady] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);

    const { data: products } = await supabase.from('products').select('id, is_ready');

    // Variants not used in current architecture
    setStats({
      totalProducts: products?.length || 0,
      readyProducts: products?.filter((p) => p.is_ready).length || 0,
      totalVariants: 0,
    });

    setLoading(false);
  };

  const handleExport = async () => {
    let query = supabase
      .from('products')
      .select(`
        *,
        supplier_category:supplier_categories(name, name_ru, name_uk),
        internal_category:internal_categories(name_ru, name_uk),
        prices:product_prices(price_type, value, currency)
      `);

    if (onlyReady) {
      query = query.eq('is_ready', true);
    }

    const { data: products } = await query;

    if (!products || products.length === 0) {
      alert('No products to export');
      return;
    }

    if (exportFormat === 'csv') {
      exportAsCSV(products);
    } else {
      exportAsXML(products);
    }
  };

  const exportAsCSV = (products: any[]) => {
    const rows: string[][] = [
      [
        'Product ID',
        'Vendor',
        'Model',
        'Name',
        'Category',
        'Variant SKU',
        'External ID',
        'Price',
        'Currency',
        'Stock',
        'Available',
        'Image URLs',
        'Attributes',
      ],
    ];

    products.forEach((product: any) => {
      const price = product.prices?.find((p: any) => p.price_type === 'selling') || product.prices?.[0];
      const imageUrls = (product.images || []).join('|');

      rows.push([
        product.id,
        product.vendor_code || '',
        product.brand_ref || '',
        product.name_ru || product.name_uk || '',
        product.supplier_category?.name_ru || product.supplier_category?.name_uk || '',
        product.supplier_sku,
        product.barcode || '',
        price?.value?.toString() || '',
        price?.currency || '',
        product.total_stock?.toString() || '0',
        product.is_ready ? 'Yes' : 'No',
        imageUrls,
        JSON.stringify(product.attributes_ru || {}),
      ]);
    });

    const csvContent = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    downloadFile(csvContent, 'products-export.csv', 'text/csv');
  };

  const exportAsXML = (products: any[]) => {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<products>\n';

    products.forEach((product: any) => {
      const price = product.prices?.find((p: any) => p.price_type === 'selling') || product.prices?.[0];

      xml += '  <product>\n';
      xml += `    <id>${escapeXml(product.id)}</id>\n`;
      xml += `    <sku>${escapeXml(product.supplier_sku)}</sku>\n`;
      xml += `    <barcode>${escapeXml(product.barcode || '')}</barcode>\n`;
      xml += `    <vendor>${escapeXml(product.vendor_code || '')}</vendor>\n`;
      xml += `    <brand>${escapeXml(product.brand_ref || '')}</brand>\n`;
      xml += `    <name>${escapeXml(product.name_ru || product.name_uk || '')}</name>\n`;
      xml += `    <description>${escapeXml(product.description_ru || '')}</description>\n`;
      xml += `    <category>${escapeXml(product.supplier_category?.name_ru || '')}</category>\n`;
      xml += `    <price>${price?.value || 0}</price>\n`;
      xml += `    <currency>${price?.currency || ''}</currency>\n`;
      xml += `    <stock>${product.total_stock || 0}</stock>\n`;
      xml += `    <ready>${product.is_ready ? 'true' : 'false'}</ready>\n`;

      if (product.images?.length > 0) {
        xml += '    <images>\n';
        product.images.forEach((img: string) => {
          xml += `      <image>${escapeXml(img)}</image>\n`;
        });
        xml += '    </images>\n';
      }

      xml += '  </product>\n';
    });

    xml += '</products>';
    downloadFile(xml, 'products-export.xml', 'application/xml');
  };

  const escapeXml = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Export Products</h1>
        <p className="text-gray-600 mt-1">Export products for Bitrix or other systems</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading statistics...</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-3">Export Statistics</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-blue-600">Total Products</p>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalProducts}</p>
                </div>
                <div>
                  <p className="text-sm text-green-600">Ready Products</p>
                  <p className="text-2xl font-bold text-green-900">{stats.readyProducts}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Variants</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalVariants}</p>
                </div>
              </div>
            </div>

            {stats.readyProducts === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium">No ready products</p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Make sure products have mapped categories, price, and stock before exporting.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Export Format
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setExportFormat('csv')}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center transition-colors ${
                    exportFormat === 'csv'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  <span className="font-medium">CSV</span>
                </button>
                <button
                  onClick={() => setExportFormat('xml')}
                  className={`p-4 border-2 rounded-lg flex items-center justify-center transition-colors ${
                    exportFormat === 'xml'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <FileText className="w-5 h-5 mr-2" />
                  <span className="font-medium">XML</span>
                </button>
              </div>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="onlyReady"
                checked={onlyReady}
                onChange={(e) => setOnlyReady(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="onlyReady" className="ml-2 text-sm text-gray-700">
                Export only ready products
              </label>
            </div>

            <button
              onClick={handleExport}
              disabled={stats.totalProducts === 0}
              className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-5 h-5 mr-2" />
              Export {exportFormat.toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
