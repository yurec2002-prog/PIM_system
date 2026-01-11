import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, CheckCircle, AlertCircle, Loader, XCircle, FileSearch } from 'lucide-react';
import { parseYMLFile, YMLData } from '../../utils/ymlParser';
import { parseSandiJSON, ImportMode } from '../../utils/sandiJsonParser';
import { useAuth } from '../../contexts/AuthContext';
import { preScanSandiJSON, PreScanResult, filterProductsByCategories, getSelectedCategoryRefs } from '../../utils/preScanParser';
import { CategorySelector } from './CategorySelector';

interface Supplier {
  id: string;
  name: string;
}

type ImportStage =
  | 'upload'
  | 'parsing'
  | 'brands'
  | 'categories'
  | 'offers'
  | 'products'
  | 'variants'
  | 'prices'
  | 'stocks'
  | 'images'
  | 'attributes'
  | 'completed';

interface ImportProgress {
  stage: ImportStage;
  percentage: number;
  current: number;
  total: number;
}

const STAGE_LABELS: Record<ImportStage, string> = {
  upload: 'Uploading file',
  parsing: 'Parsing data',
  brands: 'Saving brands',
  categories: 'Saving categories tree',
  offers: 'Processing offers',
  products: 'Saving products',
  variants: 'Creating variants',
  prices: 'Saving prices',
  stocks: 'Saving stocks',
  images: 'Saving images',
  attributes: 'Saving attributes',
  completed: 'Completed',
};

export function Import() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [newSupplierName, setNewSupplierName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'cancelled'>('idle');
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [progress, setProgress] = useState<ImportProgress>({
    stage: 'upload',
    percentage: 0,
    current: 0,
    total: 0,
  });
  const cancelImportRef = useRef(false);
  const importRecordIdRef = useRef<string | null>(null);
  const [preScanResult, setPreScanResult] = useState<PreScanResult | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('categories_and_products');

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*').order('name');
    if (data) {
      setSuppliers(data);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
      setPreScanResult(null);
      setSelectedCategories(new Set());
      setFileContent('');
      setImportMode('categories_and_products');
    }
  };

  const handleScan = async () => {
    if (!file) return;

    setIsScanning(true);
    setMessage('');

    try {
      const content = await file.text();
      setFileContent(content);

      const isJSON = file.name.toLowerCase().endsWith('.json');

      if (isJSON) {
        const scanResult = preScanSandiJSON(content);
        setPreScanResult(scanResult);

        const allRefs = new Set<string>();
        const collectRefs = (categories: typeof scanResult.categories) => {
          categories.forEach(cat => {
            allRefs.add(cat.ref);
            if (cat.children.length > 0) {
              collectRefs(cat.children);
            }
          });
        };
        collectRefs(scanResult.categories);
        setSelectedCategories(allRefs);

        setMessage(`Scanned ${scanResult.totalProducts} products across ${scanResult.categoryMap.size} categories`);
      } else {
        setMessage('Pre-scan is only available for JSON files');
      }
    } catch (error: any) {
      setMessage(`Scan failed: ${error.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCategoryToggle = (ref: string) => {
    const newSelected = new Set(selectedCategories);
    if (newSelected.has(ref)) {
      newSelected.delete(ref);
    } else {
      newSelected.add(ref);
    }
    setSelectedCategories(newSelected);
  };

  const handleCategoryToggleAll = (refs: string[], selected: boolean) => {
    const newSelected = new Set(selectedCategories);
    refs.forEach(ref => {
      if (selected) {
        newSelected.add(ref);
      } else {
        newSelected.delete(ref);
      }
    });
    setSelectedCategories(newSelected);
  };

  const handleStopImport = () => {
    cancelImportRef.current = true;
    setStatus('cancelled');
    setMessage('Stopping import...');
  };

  const createSupplier = async () => {
    if (!newSupplierName.trim()) return null;

    const { data, error } = await supabase
      .from('suppliers')
      .insert({ name: newSupplierName.trim() })
      .select()
      .single();

    if (!error && data) {
      setSuppliers([...suppliers, data]);
      setSelectedSupplier(data.id);
      setNewSupplierName('');
      return data.id;
    }

    return null;
  };

  const updateProgress = (stage: ImportStage, current: number, total: number) => {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    setProgress({ stage, percentage, current, total });
  };

  const handleImport = async () => {
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    let supplierId = selectedSupplier;
    if (!supplierId && newSupplierName) {
      supplierId = (await createSupplier()) || '';
    }

    if (!supplierId) {
      setMessage('Please select or create a supplier');
      return;
    }

    setStatus('processing');
    cancelImportRef.current = false;
    importRecordIdRef.current = null;

    try {
      updateProgress('upload', 0, 1);
      setMessage('Reading file...');
      let contentToImport = fileContent || await file.text();

      const isJSON = file.name.toLowerCase().endsWith('.json');
      if (isJSON && preScanResult && selectedCategories.size > 0) {
        const allSelectedRefs = getSelectedCategoryRefs(preScanResult.categoryMap, selectedCategories);
        if (allSelectedRefs.size < preScanResult.categoryMap.size) {
          contentToImport = filterProductsByCategories(contentToImport, allSelectedRefs);
          setMessage(`Filtered to ${allSelectedRefs.size} categories...`);
        }
      }

      updateProgress('upload', 1, 1);

      if (cancelImportRef.current) {
        setStatus('cancelled');
        setMessage('Import cancelled by user');
        return;
      }

      if (isJSON) {
        updateProgress('parsing', 0, 1);
        setMessage('Processing JSON data...');

        const progressCallback = (stage: ImportStage, current: number, total: number) => {
          updateProgress(stage, current, total);
          setMessage(STAGE_LABELS[stage]);
        };

        const selectedRefs = Array.from(selectedCategories);

        const result = await parseSandiJSON(
          contentToImport,
          supplierId,
          user?.id || '',
          selectedRefs.length > 0 ? selectedRefs : undefined,
          progressCallback,
          cancelImportRef,
          importMode
        );

        if (cancelImportRef.current) {
          setStatus('cancelled');
          setMessage('Import cancelled by user');
          return;
        }

        if (!result.success) {
          throw new Error(result.error || 'JSON import failed');
        }

        updateProgress('completed', 1, 1);
        setStats(result.stats);
        setStatus('success');
        if (importMode === 'categories_only') {
          setMessage(`Successfully imported category structure!`);
        } else {
          setMessage(`Successfully imported ${result.productsCount} products!`);
        }
        setFile(null);
      } else {
        setStatus('error');
        setMessage('YML format is not yet supported in the current version. Please use JSON format.');
        return;

        if (cancelImportRef.current) {
          setStatus('cancelled');
          setMessage('Import cancelled by user');
          return;
        }

        const importRecord = await supabase
          .from('imports')
          .insert({
            supplier_id: supplierId,
            filename: file.name,
            status: 'processing',
            created_by: user?.id,
          })
          .select()
          .single();

        if (importRecord.error) throw importRecord.error;

        importRecordIdRef.current = importRecord.data.id;

        setMessage('Importing currencies...');
        await importCurrencies(ymlData.currencies);

        if (cancelImportRef.current) {
          setStatus('cancelled');
          setMessage('Import cancelled by user');
          return;
        }

        updateProgress('categories', 0, ymlData.categories.length);
        setMessage('Importing categories...');
        await importCategories(supplierId, ymlData.categories);
        updateProgress('categories', ymlData.categories.length, ymlData.categories.length);

        if (cancelImportRef.current) {
          setStatus('cancelled');
          setMessage('Import cancelled by user');
          return;
        }

        updateProgress('offers', 0, ymlData.offers.length);
        setMessage('Processing offers...');
        const { productsCount, variantsCount } = await importProducts(supplierId, ymlData.offers);

        if (cancelImportRef.current) {
          await supabase
            .from('imports')
            .update({
              status: 'cancelled',
              products_count: productsCount,
              variants_count: variantsCount,
              completed_at: new Date().toISOString(),
            })
            .eq('id', importRecordIdRef.current);

          setStats({ productsCreated: productsCount, productsUpdated: 0 });
          setMessage(`Import cancelled. Imported ${productsCount} products and ${variantsCount} variants before stopping.`);
          return;
        }

        await supabase
          .from('imports')
          .update({
            status: 'completed',
            products_count: productsCount,
            variants_count: variantsCount,
            completed_at: new Date().toISOString(),
          })
          .eq('id', importRecordIdRef.current);

        updateProgress('completed', 1, 1);
        setStats({ productsCreated: productsCount, productsUpdated: 0 });
        setStatus('success');
        setMessage(`Successfully imported ${productsCount} products and ${variantsCount} variants!`);
        setFile(null);
      }
    } catch (error: any) {
      setStatus('error');
      setMessage(`Import failed: ${error.message}`);
    }
  };

  const importCurrencies = async (currencies: YMLData['currencies']) => {
    for (const curr of currencies) {
      await supabase
        .from('currencies')
        .upsert({ code: curr.code, rate: curr.rate }, { onConflict: 'code' });
    }
  };

  const importCategories = async (supplierId: string, categories: YMLData['categories']) => {
    // Build a map to track external_id -> uuid mapping
    const categoryMap = new Map<string, string>();

    // First, load existing categories to populate the map
    const { data: existingCategories } = await supabase
      .from('supplier_categories')
      .select('id, external_id')
      .eq('supplier_id', supplierId);

    if (existingCategories) {
      existingCategories.forEach(cat => {
        categoryMap.set(cat.external_id, cat.id);
      });
    }

    // Sort categories by dependency (parents before children)
    const sortedCategories = [...categories];
    const processedIds = new Set<string>();
    const orderedCategories: typeof categories = [];

    while (orderedCategories.length < sortedCategories.length) {
      const startLength = orderedCategories.length;

      for (const cat of sortedCategories) {
        if (processedIds.has(cat.id)) continue;

        // If no parent or parent already processed, add this category
        if (!cat.parentId || processedIds.has(cat.parentId)) {
          orderedCategories.push(cat);
          processedIds.add(cat.id);
        }
      }

      // Prevent infinite loop if circular dependencies exist
      if (orderedCategories.length === startLength) {
        // Add remaining categories without parents
        for (const cat of sortedCategories) {
          if (!processedIds.has(cat.id)) {
            orderedCategories.push(cat);
            processedIds.add(cat.id);
          }
        }
        break;
      }
    }

    // Insert categories in order
    for (const cat of orderedCategories) {
      if (cancelImportRef.current) break;

      // Find parent uuid if parent exists
      let parentUuid: string | null = null;
      if (cat.parentId) {
        parentUuid = categoryMap.get(cat.parentId) || null;
      }

      const { data } = await supabase
        .from('supplier_categories')
        .upsert(
          {
            supplier_id: supplierId,
            external_id: cat.id,
            name: cat.name,
            parent_id: parentUuid,
          },
          { onConflict: 'supplier_id,external_id' }
        )
        .select('id, external_id')
        .single();

      if (data) {
        categoryMap.set(data.external_id, data.id);
      }
    }
  };

  const importProducts = async (supplierId: string, offers: YMLData['offers']) => {
    const productMap = new Map<string, string>();
    let productsCount = 0;
    let variantsCount = 0;
    const totalOffers = offers.length;

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];

      if (cancelImportRef.current) {
        break;
      }

      const groupKey = `${offer.vendor}-${offer.model || offer.name}`;

      let productId = productMap.get(groupKey);

      if (!productId) {
        updateProgress('products', productsCount, totalOffers);

        const { data: currency } = await supabase
          .from('currencies')
          .select('id')
          .eq('code', offer.currencyId)
          .maybeSingle();

        const { data: supplierCategory } = await supabase
          .from('supplier_categories')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('external_id', offer.categoryId)
          .maybeSingle();

        const { data: product } = await supabase
          .from('products')
          .insert({
            supplier_id: supplierId,
            vendor: offer.vendor,
            model: offer.model || '',
            name: offer.name,
            description: offer.description || '',
            name_ua: offer.name_ua || '',
            description_ua: offer.description_ua || '',
            is_ready: false,
          })
          .select()
          .single();

        if (product) {
          productId = product.id;
          productMap.set(groupKey, productId);
          productsCount++;
        }
      }

      if (productId) {
        if (cancelImportRef.current) {
          break;
        }

        updateProgress('variants', variantsCount, totalOffers);

        const { data: currency } = await supabase
          .from('currencies')
          .select('id')
          .eq('code', offer.currencyId)
          .maybeSingle();

        const { data: supplierCategory } = await supabase
          .from('supplier_categories')
          .select('id')
          .eq('supplier_id', supplierId)
          .eq('external_id', offer.categoryId)
          .maybeSingle();

        const { data: variant } = await supabase
          .from('variants')
          .insert({
            product_id: productId,
            external_id: offer.id,
            sku: offer.id,
            price: offer.price,
            currency_id: currency?.id,
            stock_quantity: offer.stock_quantity || 0,
            available: offer.available,
            supplier_category_id: supplierCategory?.id,
          })
          .select()
          .single();

        if (variant) {
          variantsCount++;

          if (cancelImportRef.current) {
            break;
          }

          await supabase.from('variant_prices').insert({
            variant_id: variant.id,
            price_type: 'RRP',
            value: offer.price,
            currency_id: currency?.id,
            source: 'supplier',
          });

          if (cancelImportRef.current) {
            break;
          }

          for (let i = 0; i < offer.picture.length; i++) {
            if (cancelImportRef.current) {
              break;
            }
            await supabase.from('variant_images').insert({
              variant_id: variant.id,
              url: offer.picture[i],
              position: i,
            });
          }

          if (cancelImportRef.current) {
            break;
          }

          updateProgress('attributes', i + 1, totalOffers);

          for (const param of offer.params) {
            if (cancelImportRef.current) {
              break;
            }
            const { data: attribute } = await supabase
              .from('attributes')
              .upsert({ name: param.name }, { onConflict: 'name' })
              .select()
              .single();

            if (attribute) {
              await supabase.from('variant_attributes').insert({
                variant_id: variant.id,
                attribute_id: attribute.id,
                value: param.value,
              });
            }
          }
        }
      }
    }

    await updateProductReadiness(supplierId);

    return { productsCount, variantsCount };
  };

  const updateProductReadiness = async (supplierId: string) => {
    await supabase.rpc('update_product_readiness_for_supplier', {
      supplier_uuid: supplierId,
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Import Feed</h1>
        <p className="text-gray-600 mt-1">Upload YML or JSON file from supplier</p>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Supplier
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select existing supplier...</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Create New Supplier
            </label>
            <input
              type="text"
              value={newSupplierName}
              onChange={(e) => setNewSupplierName(e.target.value)}
              placeholder="Enter new supplier name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feed File
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <input
                type="file"
                accept=".xml,.yml,.json"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
              >
                Choose file
              </label>
              <p className="text-sm text-gray-500 mt-2">or drag and drop</p>
              {file && (
                <p className="text-sm text-gray-900 mt-4 font-medium">{file.name}</p>
              )}
            </div>
          </div>

          {file && file.name.toLowerCase().endsWith('.json') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Import Mode
              </label>
              <div className="space-y-3 mb-6">
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="categories_only"
                    checked={importMode === 'categories_only'}
                    onChange={(e) => setImportMode(e.target.value as ImportMode)}
                    className="mt-1 mr-3 w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Categories Only</div>
                    <div className="text-sm text-gray-600">Import only the category tree structure</div>
                  </div>
                </label>
                <label className="flex items-start cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="categories_and_products"
                    checked={importMode === 'categories_and_products'}
                    onChange={(e) => setImportMode(e.target.value as ImportMode)}
                    className="mt-1 mr-3 w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Categories and Products</div>
                    <div className="text-sm text-gray-600">Import categories with all products and related data</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {file && file.name.toLowerCase().endsWith('.json') && !preScanResult && (
            <div>
              <button
                onClick={handleScan}
                disabled={isScanning || status === 'processing'}
                className="w-full flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isScanning ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-5 h-5 mr-2" />
                    Scan File
                  </>
                )}
              </button>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Scan the file to preview and select categories before importing
              </p>
            </div>
          )}

          {preScanResult && (
            <CategorySelector
              categories={preScanResult.categories}
              selectedRefs={selectedCategories}
              onToggle={handleCategoryToggle}
              onToggleAll={handleCategoryToggleAll}
            />
          )}

          {status === 'processing' && (
            <div className="bg-blue-50 rounded-lg p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-900">
                    {STAGE_LABELS[progress.stage]}
                  </span>
                  <span className="text-sm font-medium text-blue-900">
                    {progress.percentage}%
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2.5 mb-4">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${progress.percentage}%` }}
                  ></div>
                </div>
                {progress.total > 0 && (
                  <div className="text-sm text-blue-800 font-medium mb-3">
                    Processing: {progress.current.toLocaleString()} / {progress.total.toLocaleString()} SKUs
                  </div>
                )}
              </div>

              {file?.name.toLowerCase().endsWith('.json') && (
                <div className="border-t border-blue-200 pt-4">
                  <div className="text-xs font-medium text-blue-700 mb-2">Import Stages:</div>
                  <div className="space-y-1">
                    {(['parsing', 'brands', 'categories', 'products', 'prices', 'stocks', 'images', 'completed'] as ImportStage[]).map((stage) => {
                      const stageOrder = ['parsing', 'brands', 'categories', 'products', 'prices', 'stocks', 'images', 'completed'];
                      const currentIndex = stageOrder.indexOf(progress.stage);
                      const stageIndex = stageOrder.indexOf(stage);
                      const isCompleted = stageIndex < currentIndex;
                      const isCurrent = stage === progress.stage;

                      return (
                        <div key={stage} className={`flex items-center text-xs ${isCurrent ? 'text-blue-900 font-medium' : isCompleted ? 'text-green-700' : 'text-blue-600'}`}>
                          {isCompleted && <CheckCircle className="w-3 h-3 mr-2 flex-shrink-0" />}
                          {isCurrent && <Loader className="w-3 h-3 mr-2 flex-shrink-0 animate-spin" />}
                          {!isCompleted && !isCurrent && <div className="w-3 h-3 mr-2 flex-shrink-0 rounded-full border border-blue-300" />}
                          <span>{STAGE_LABELS[stage]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {message && status !== 'processing' && (
            <div
              className={`p-4 rounded-lg flex items-start ${
                status === 'error'
                  ? 'bg-red-50 text-red-800'
                  : status === 'success'
                  ? 'bg-green-50 text-green-800'
                  : status === 'cancelled'
                  ? 'bg-yellow-50 text-yellow-800'
                  : 'bg-blue-50 text-blue-800'
              }`}
            >
              {status === 'success' && <CheckCircle className="w-5 h-5 mr-3 mt-0.5" />}
              {status === 'error' && <AlertCircle className="w-5 h-5 mr-3 mt-0.5" />}
              {status === 'cancelled' && <XCircle className="w-5 h-5 mr-3 mt-0.5" />}
              <div className="flex-1">
                <p>{message}</p>
                {(status === 'success' || status === 'cancelled') && stats && (
                  <div className="mt-3 space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {stats.productsCreated > 0 && (
                        <div>
                          <span className="font-semibold">Products Created:</span> {stats.productsCreated}
                        </div>
                      )}
                      {stats.productsUpdated > 0 && (
                        <div>
                          <span className="font-semibold">Products Updated:</span> {stats.productsUpdated}
                        </div>
                      )}
                      {stats.productsSkipped > 0 && (
                        <div>
                          <span className="font-semibold">Products Skipped:</span> {stats.productsSkipped}
                        </div>
                      )}
                      {stats.categoriesCreated > 0 && (
                        <div>
                          <span className="font-semibold">Categories Created:</span> {stats.categoriesCreated}
                        </div>
                      )}
                      {stats.categoriesUpdated > 0 && (
                        <div>
                          <span className="font-semibold">Categories Updated:</span> {stats.categoriesUpdated}
                        </div>
                      )}
                      {stats.brandsCreated > 0 && (
                        <div>
                          <span className="font-semibold">Brands Created:</span> {stats.brandsCreated}
                        </div>
                      )}
                      {stats.brandsUpdated > 0 && (
                        <div>
                          <span className="font-semibold">Brands Updated:</span> {stats.brandsUpdated}
                        </div>
                      )}
                      {stats.pricesUpdated > 0 && (
                        <div>
                          <span className="font-semibold">Prices Updated:</span> {stats.pricesUpdated}
                        </div>
                      )}
                      {stats.stockUpdated > 0 && (
                        <div>
                          <span className="font-semibold">Stock Updated:</span> {stats.stockUpdated}
                        </div>
                      )}
                      {stats.imagesAdded > 0 && (
                        <div>
                          <span className="font-semibold">Images Added:</span> {stats.imagesAdded}
                        </div>
                      )}
                      {stats.errorsCount > 0 && (
                        <div className="col-span-2 text-red-700">
                          <span className="font-semibold">Errors:</span> {stats.errorsCount}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {preScanResult && selectedCategories.size > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-900">
                  Ready to import <span className="font-semibold">{selectedCategories.size}</span> selected categories
                  {importMode === 'categories_only' && (
                    <span> (categories only)</span>
                  )}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleImport}
                disabled={status === 'processing' || !file || (file.name.toLowerCase().endsWith('.json') && !preScanResult)}
                className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'processing' ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    {importMode === 'categories_only' ? 'Import Categories' : 'Import Feed'}
                  </>
                )}
              </button>

              {status === 'processing' && (
                <button
                  onClick={handleStopImport}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                  title="Stop import"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Stop
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
