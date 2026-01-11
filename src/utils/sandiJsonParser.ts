import { supabase } from '../lib/supabase';

interface SandiProduct {
  main: {
    sku: string;
    barcode?: string;
    name: {
      ru: string;
      uk: string;
    };
    vendorCode?: string;
    description: {
      ru: string;
      uk: string;
    };
    brand: string;
    category: string;
    prices: {
      retail?: {
        current: string;
        old?: string | null;
      };
      purchase?: {
        cash?: {
          current: string;
          old?: string | null;
        };
      };
    };
    balance: number;
    balances?: Record<string, number>;
    warehouse_balances?: Record<string, number> | [];
  };
  attributes?: Record<string, { ru: string; uk: string }>;
  images?: {
    main?: string;
    additional?: Record<string, string>;
  };
}

interface SandiCategory {
  name: {
    ru: string;
    uk: string;
  };
  parent_ref?: string;
}

interface SandiBrand {
  name: string;
  image?: string;
}

interface SandiData {
  date?: string;
  balances?: Record<string, { ru: string; uk: string }>;
  warehouses?: Record<string, string>;
  brands?: Record<string, SandiBrand>;
  categories?: Record<string, SandiCategory>;
  products: Record<string, SandiProduct>;
  attributes?: Record<string, { ru: string; uk: string }>;
}

interface ParseResult {
  success: boolean;
  productsCount: number;
  error?: string;
  stats?: ImportStats;
}

interface ImportStats {
  productsCreated: number;
  productsUpdated: number;
  productsSkipped: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  brandsCreated: number;
  brandsUpdated: number;
  pricesUpdated: number;
  imagesDownloaded: number;
  stockUpdated: number;
  errorsCount: number;
}

type ImportStage =
  | 'parsing'
  | 'brands'
  | 'categories'
  | 'products'
  | 'prices'
  | 'stocks'
  | 'images'
  | 'quality'
  | 'completed';

type ProgressCallback = (stage: ImportStage, current: number, total: number) => void;

const SUPPLIER_CODE = 'sandi';
const SANDI_SUPPLIER_ID = '00000000-0000-0000-0000-000000000001';

export type ImportMode = 'categories_only' | 'categories_and_products';

export async function parseSandiJSON(
  jsonContent: string,
  supplierId: string,
  userId: string,
  selectedCategoryRefs?: string[],
  onProgress?: ProgressCallback,
  cancelRef?: React.MutableRefObject<boolean>,
  importMode: ImportMode = 'categories_and_products'
): Promise<ParseResult> {
  let importRecordId: string | null = null;
  const stats: ImportStats = {
    productsCreated: 0,
    productsUpdated: 0,
    productsSkipped: 0,
    categoriesCreated: 0,
    categoriesUpdated: 0,
    brandsCreated: 0,
    brandsUpdated: 0,
    pricesUpdated: 0,
    imagesDownloaded: 0,
    stockUpdated: 0,
    errorsCount: 0
  };

  try {
    onProgress?.('parsing', 0, 1);
    const data: SandiData = JSON.parse(jsonContent);

    if (!data.products || typeof data.products !== 'object') {
      throw new Error('Invalid JSON structure: missing products object');
    }

    onProgress?.('parsing', 1, 1);

    // Create import record
    importRecordId = await createImportRecord(
      supplierId,
      userId,
      'sandi.json',
      selectedCategoryRefs || []
    );
    if (!importRecordId) {
      throw new Error('Failed to create import record');
    }

    // Process categories (ONE-TO-ONE from SANDI)
    if (data.categories) {
      const categoryCount = Object.keys(data.categories).length;
      onProgress?.('categories', 0, categoryCount);
      const catStats = await processCategories(data.categories, supplierId, onProgress, cancelRef);
      stats.categoriesCreated = catStats.created;
      stats.categoriesUpdated = catStats.updated;
      if (cancelRef?.current) {
        await updateImportRecord(importRecordId, 'cancelled', stats);
        return { success: false, productsCount: 0, error: 'Cancelled', stats };
      }
      onProgress?.('categories', categoryCount, categoryCount);
    }

    // Process brands
    if (data.brands) {
      const brandCount = Object.keys(data.brands).length;
      onProgress?.('brands', 0, brandCount);

      let processedBrands = 0;
      for (const [brandRef, brandData] of Object.entries(data.brands)) {
        if (cancelRef?.current) break;

        const brandStats = await createOrUpdateBrand(
          SANDI_SUPPLIER_ID,
          brandRef,
          brandData.name,
          brandData.image
        );

        if (brandStats.created) stats.brandsCreated++;
        if (brandStats.updated) stats.brandsUpdated++;

        processedBrands++;
        onProgress?.('brands', processedBrands, brandCount);
      }

      if (cancelRef?.current) {
        await updateImportRecord(importRecordId, 'cancelled', stats);
        return { success: false, productsCount: 0, error: 'Cancelled', stats };
      }
    }

    // Only import products if mode is 'categories_and_products'
    if (importMode === 'categories_and_products') {
      // Filter products by selected categories if specified
      let productsToProcess = Object.entries(data.products);
      if (selectedCategoryRefs && selectedCategoryRefs.length > 0) {
        productsToProcess = productsToProcess.filter(
          ([_, product]) => selectedCategoryRefs.includes(product.main.category)
        );
      }

      const totalProducts = productsToProcess.length;

      // Process products in batches to avoid stack overflow
      const BATCH_SIZE = 50;
      const batches = [];
      for (let i = 0; i < productsToProcess.length; i += BATCH_SIZE) {
        batches.push(productsToProcess.slice(i, i + BATCH_SIZE));
      }

      let processedCount = 0;

      for (const batch of batches) {
        if (cancelRef?.current) break;

        const batchResults = await processBatch(
          batch,
          importRecordId,
          supplierId,
          data.attributes,
          onProgress,
          processedCount,
          totalProducts
        );

        stats.productsCreated += batchResults.created;
        stats.productsUpdated += batchResults.updated;
        stats.productsSkipped += batchResults.skipped;
        stats.pricesUpdated += batchResults.pricesUpdated;
        stats.imagesDownloaded += batchResults.imagesAdded;
        stats.stockUpdated += batchResults.stockUpdated;
        stats.errorsCount += batchResults.errors;

        processedCount += batch.length;

        // Small delay between batches to avoid overwhelming the database
        if (processedCount < totalProducts) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (cancelRef?.current) {
        await updateImportRecord(importRecordId, 'cancelled', stats);
        return { success: false, productsCount: stats.productsCreated + stats.productsUpdated, error: 'Cancelled', stats };
      }
    }

    onProgress?.('completed', 1, 1);
    await updateImportRecord(importRecordId, 'completed', stats);

    return {
      success: true,
      productsCount: stats.productsCreated + stats.productsUpdated,
      stats
    };
  } catch (error) {
    console.error('Parse error:', error);
    if (importRecordId) {
      await updateImportRecord(importRecordId, 'failed', stats);
    }
    return {
      success: false,
      productsCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      stats
    };
  }
}

async function processBatch(
  batch: Array<[string, SandiProduct]>,
  importId: string,
  supplierId: string,
  attributeNames?: Record<string, { ru: string; uk: string }>,
  onProgress?: ProgressCallback,
  offset: number = 0,
  total: number = 0
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  pricesUpdated: number;
  imagesAdded: number;
  stockUpdated: number;
  errors: number;
}> {
  const result = {
    created: 0,
    updated: 0,
    skipped: 0,
    pricesUpdated: 0,
    imagesAdded: 0,
    stockUpdated: 0,
    errors: 0
  };

  // Get all SKUs in batch
  const skus = batch.map(([sku]) => sku);

  // Load existing products for this batch
  const { data: existingProducts } = await supabase
    .from('products')
    .select('id, supplier_sku')
    .eq('supplier', SUPPLIER_CODE)
    .in('supplier_sku', skus);

  const existingMap = new Map<string, number>();
  if (existingProducts) {
    existingProducts.forEach(p => existingMap.set(p.supplier_sku, p.id));
  }

  // Load categories for this batch
  const categoryRefs = [...new Set(batch.map(([_, p]) => p.main.category))];
  const { data: categories } = await supabase
    .from('supplier_categories')
    .select('id, external_id')
    .eq('supplier_id', supplierId)
    .in('external_id', categoryRefs);

  const categoryMap = new Map<string, string>();
  if (categories) {
    categories.forEach(c => categoryMap.set(c.external_id, c.id));
  }

  const productsToInsert: any[] = [];
  const productsToUpdate: any[] = [];
  const priceRecords: any[] = [];
  const stockRecords: any[] = [];
  const productIdMap = new Map<string, number>();

  // Prepare products for insert/update
  for (let i = 0; i < batch.length; i++) {
    const [sku, product] = batch[i];

    if (onProgress) {
      onProgress('products', offset + i, total);
    }

    const categoryId = categoryMap.get(product.main.category) || null;

    // Prepare attributes
    const attributesRu: Record<string, string> = {};
    const attributesUk: Record<string, string> = {};

    if (product.attributes && attributeNames) {
      for (const [attrRef, attrValue] of Object.entries(product.attributes)) {
        const attrName = attributeNames[attrRef];
        if (attrName) {
          const key = attrName.ru || attrName.uk || attrRef;
          attributesRu[key] = attrValue.ru || '';
          attributesUk[key] = attrValue.uk || '';
        }
      }
    }

    // Prepare images array
    const images: string[] = [];
    if (product.images?.main) {
      images.push(product.images.main);
    }
    if (product.images?.additional) {
      images.push(...Object.values(product.images.additional));
    }

    const mainImage = images[0] || '';

    const productData = {
      supplier: SUPPLIER_CODE,
      supplier_sku: sku,
      barcode: product.main.barcode || '',
      vendor_code: product.main.vendorCode || '',
      brand_ref: product.main.brand,
      supplier_category_id: categoryId,
      name_ru: product.main.name.ru || '',
      name_uk: product.main.name.uk || '',
      description_ru: product.main.description?.ru || '',
      description_uk: product.main.description?.uk || '',
      attributes_ru: attributesRu,
      attributes_uk: attributesUk,
      images: images,
      main_image: mainImage,
      total_stock: product.main.balance || 0,
      updated_at: new Date().toISOString()
    };

    const existingId = existingMap.get(sku);
    if (existingId) {
      productsToUpdate.push({ ...productData, id: existingId });
      productIdMap.set(sku, existingId);
      result.updated++;
    } else {
      productsToInsert.push({ ...productData, is_ready: false, completeness_score: 0 });
      result.created++;
    }

    result.imagesAdded += images.length;
  }

  // Batch insert new products
  if (productsToInsert.length > 0) {
    const { data: newProducts, error: insertError } = await supabase
      .from('products')
      .insert(productsToInsert)
      .select('id, supplier_sku');

    if (insertError) {
      console.error('Batch insert error:', insertError);
      result.errors += productsToInsert.length;
    } else if (newProducts) {
      newProducts.forEach(p => productIdMap.set(p.supplier_sku, p.id));
    }
  }

  // Batch update existing products
  for (const productUpdate of productsToUpdate) {
    const { error: updateError } = await supabase
      .from('products')
      .update(productUpdate)
      .eq('id', productUpdate.id);

    if (updateError) {
      console.error('Product update error:', updateError);
      result.errors++;
    }
  }

  // Prepare prices and stocks
  for (const [sku, product] of batch) {
    const productId = productIdMap.get(sku);
    if (!productId) continue;

    // Delete old prices
    await supabase
      .from('product_prices')
      .delete()
      .eq('product_id', productId)
      .eq('source', 'sandi_json');

    // Prepare price records with full path structure
    if (product.main.prices.retail?.current) {
      const value = parseFloat(product.main.prices.retail.current);
      if (!isNaN(value)) {
        priceRecords.push({
          product_id: productId,
          price_type: 'retail.current',
          value,
          currency: 'UAH',
          source: 'sandi_json'
        });
        result.pricesUpdated++;
      }
    }

    if (product.main.prices.retail?.old) {
      const value = parseFloat(product.main.prices.retail.old);
      if (!isNaN(value)) {
        priceRecords.push({
          product_id: productId,
          price_type: 'retail.old',
          value,
          currency: 'UAH',
          source: 'sandi_json'
        });
      }
    }

    if (product.main.prices.purchase?.cash?.current) {
      const value = parseFloat(product.main.prices.purchase.cash.current);
      if (!isNaN(value)) {
        priceRecords.push({
          product_id: productId,
          price_type: 'purchase.cash.current',
          value,
          currency: 'UAH',
          source: 'sandi_json'
        });
      }
    }

    if (product.main.prices.purchase?.cash?.old) {
      const value = parseFloat(product.main.prices.purchase.cash.old);
      if (!isNaN(value)) {
        priceRecords.push({
          product_id: productId,
          price_type: 'purchase.cash.old',
          value,
          currency: 'UAH',
          source: 'sandi_json'
        });
      }
    }

    // Delete old stocks
    await supabase
      .from('warehouse_stocks')
      .delete()
      .eq('product_id', productId);

    // Prepare stock records
    if (product.main.warehouse_balances && !Array.isArray(product.main.warehouse_balances)) {
      for (const [code, quantity] of Object.entries(product.main.warehouse_balances)) {
        stockRecords.push({
          product_id: productId,
          warehouse_code: code,
          warehouse_name: '',
          quantity: quantity || 0
        });
        result.stockUpdated++;
      }
    }
  }

  // Batch insert prices
  if (priceRecords.length > 0) {
    await supabase.from('product_prices').insert(priceRecords);
  }

  // Batch insert stocks
  if (stockRecords.length > 0) {
    await supabase.from('warehouse_stocks').insert(stockRecords);
  }

  return result;
}

async function processProduct(
  sku: string,
  product: SandiProduct,
  importId: string,
  attributeNames?: Record<string, { ru: string; uk: string }>
): Promise<{
  created: boolean;
  updated: boolean;
  skipped: boolean;
  pricesUpdated: boolean;
  imagesAdded: number;
  stockUpdated: boolean;
}> {
  // Check if product exists (match by supplier + supplier_sku)
  const { data: existingProduct } = await supabase
    .from('products')
    .select('id')
    .eq('supplier', SUPPLIER_CODE)
    .eq('supplier_sku', sku)
    .maybeSingle();

  let productId: number;
  let isNew = false;

  // Get supplier_category_id
  const categoryId = await getCategoryId(product.main.category, SANDI_SUPPLIER_ID);

  // Prepare attributes
  const attributesRu: Record<string, string> = {};
  const attributesUk: Record<string, string> = {};

  if (product.attributes && attributeNames) {
    for (const [attrRef, attrValue] of Object.entries(product.attributes)) {
      const attrName = attributeNames[attrRef];
      if (attrName) {
        const key = attrName.ru || attrName.uk || attrRef;
        attributesRu[key] = attrValue.ru || '';
        attributesUk[key] = attrValue.uk || '';
      }
    }
  }

  // Prepare images array
  const images: string[] = [];
  if (product.images?.main) {
    images.push(product.images.main);
  }
  if (product.images?.additional) {
    images.push(...Object.values(product.images.additional));
  }

  const mainImage = images[0] || '';

  if (existingProduct) {
    // UPDATE existing product
    productId = existingProduct.id;

    await supabase
      .from('products')
      .update({
        barcode: product.main.barcode || '',
        vendor_code: product.main.vendorCode || '',
        brand_ref: product.main.brand,
        supplier_category_id: categoryId,
        name_ru: product.main.name.ru || '',
        name_uk: product.main.name.uk || '',
        description_ru: product.main.description?.ru || '',
        description_uk: product.main.description?.uk || '',
        attributes_ru: attributesRu,
        attributes_uk: attributesUk,
        images: images,
        main_image: mainImage,
        total_stock: product.main.balance || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', productId);

    await logImportAction(importId, sku, 'updated', 'Product updated');
  } else {
    // CREATE new product
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        supplier: SUPPLIER_CODE,
        supplier_sku: sku,
        barcode: product.main.barcode || '',
        vendor_code: product.main.vendorCode || '',
        brand_ref: product.main.brand,
        supplier_category_id: categoryId,
        name_ru: product.main.name.ru || '',
        name_uk: product.main.name.uk || '',
        description_ru: product.main.description?.ru || '',
        description_uk: product.main.description?.uk || '',
        attributes_ru: attributesRu,
        attributes_uk: attributesUk,
        images: images,
        main_image: mainImage,
        total_stock: product.main.balance || 0,
        is_ready: false,
        completeness_score: 0
      })
      .select('id')
      .single();

    if (error) throw error;
    productId = newProduct.id;
    isNew = true;
    await logImportAction(importId, sku, 'created', 'New product created');
  }

  // Update prices (multiple price types)
  await updateProductPrices(productId, product.main.prices);

  // Update warehouse stocks
  const stockUpdated = await updateWarehouseStocks(
    productId,
    product.main.balance,
    product.main.warehouse_balances
  );

  return {
    created: isNew,
    updated: !isNew,
    skipped: false,
    pricesUpdated: true,
    imagesAdded: images.length,
    stockUpdated
  };
}

async function updateProductPrices(
  productId: number,
  prices: SandiProduct['main']['prices']
): Promise<void> {
  const priceUpdates: Array<{ price_type: string; value: number }> = [];

  // Flatten nested price structure with full paths
  if (prices.retail?.current) {
    const value = parseFloat(prices.retail.current);
    if (!isNaN(value)) {
      priceUpdates.push({ price_type: 'retail.current', value });
    }
  }

  if (prices.retail?.old) {
    const value = parseFloat(prices.retail.old);
    if (!isNaN(value)) {
      priceUpdates.push({ price_type: 'retail.old', value });
    }
  }

  if (prices.purchase?.cash?.current) {
    const value = parseFloat(prices.purchase.cash.current);
    if (!isNaN(value)) {
      priceUpdates.push({ price_type: 'purchase.cash.current', value });
    }
  }

  if (prices.purchase?.cash?.old) {
    const value = parseFloat(prices.purchase.cash.old);
    if (!isNaN(value)) {
      priceUpdates.push({ price_type: 'purchase.cash.old', value });
    }
  }

  // Delete old sandi_json prices and insert new ones
  await supabase
    .from('product_prices')
    .delete()
    .eq('product_id', productId)
    .eq('source', 'sandi_json');

  if (priceUpdates.length > 0) {
    const priceRecords = priceUpdates.map(({ price_type, value }) => ({
      product_id: productId,
      price_type,
      value,
      currency: 'UAH',
      source: 'sandi_json'
    }));

    await supabase.from('product_prices').insert(priceRecords);
  }
}

async function updateWarehouseStocks(
  productId: number,
  totalBalance: number,
  warehouseBalances?: Record<string, number> | []
): Promise<boolean> {
  // Delete old stocks
  await supabase
    .from('warehouse_stocks')
    .delete()
    .eq('product_id', productId);

  if (!warehouseBalances || Array.isArray(warehouseBalances)) {
    return false;
  }

  const stockRecords = Object.entries(warehouseBalances).map(([code, quantity]) => ({
    product_id: productId,
    warehouse_code: code,
    warehouse_name: '',
    quantity: quantity || 0
  }));

  if (stockRecords.length > 0) {
    await supabase.from('warehouse_stocks').insert(stockRecords);
    return true;
  }

  return false;
}

async function getCategoryId(supplierCategoryRef: string, supplierId: string): Promise<string | null> {
  const { data } = await supabase
    .from('supplier_categories')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('external_id', supplierCategoryRef)
    .maybeSingle();

  return data?.id || null;
}

async function processCategories(
  categories: Record<string, SandiCategory>,
  supplierId: string,
  onProgress?: ProgressCallback,
  cancelRef?: React.MutableRefObject<boolean>
): Promise<{ created: number; updated: number }> {
  const categoryMap = new Map<string, string>();
  const categoryEntries = Object.entries(categories);
  const totalCategories = categoryEntries.length;
  let created = 0;
  let updated = 0;

  // First pass: create/update categories without parent relationships
  for (let i = 0; i < categoryEntries.length; i++) {
    if (cancelRef?.current) break;

    const [ref, category] = categoryEntries[i];
    onProgress?.('categories', i, totalCategories);

    const { data: existing } = await supabase
      .from('supplier_categories')
      .select('id')
      .eq('supplier_id', supplierId)
      .eq('external_id', ref)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('supplier_categories')
        .update({
          name: category.name.uk || category.name.ru || '',
          name_ru: category.name.ru || '',
          name_uk: category.name.uk || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      categoryMap.set(ref, existing.id);
      updated++;
    } else {
      const { data: newCategory } = await supabase
        .from('supplier_categories')
        .insert({
          supplier_id: supplierId,
          external_id: ref,
          name: category.name.uk || category.name.ru || '',
          name_ru: category.name.ru || '',
          name_uk: category.name.uk || ''
        })
        .select('id')
        .single();

      if (newCategory) {
        categoryMap.set(ref, newCategory.id);
        created++;
      }
    }
  }

  // Second pass: update parent relationships
  for (const [ref, category] of categoryEntries) {
    if (cancelRef?.current) break;

    if (category.parent_ref) {
      const categoryId = categoryMap.get(ref);
      const parentId = categoryMap.get(category.parent_ref);

      if (categoryId && parentId) {
        await supabase
          .from('supplier_categories')
          .update({ parent_id: parentId })
          .eq('id', categoryId);
      }
    }
  }

  return { created, updated };
}

async function createOrUpdateBrand(
  supplierId: string,
  externalRef: string,
  name: string,
  logoUrl?: string
): Promise<{ created: boolean; updated: boolean }> {
  const { data: existing } = await supabase
    .from('brands')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('external_ref', externalRef)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('brands')
      .update({
        name,
        logo_url: logoUrl || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
    return { created: false, updated: true };
  }

  await supabase
    .from('brands')
    .insert({
      supplier_id: supplierId,
      external_ref: externalRef,
      name,
      logo_url: logoUrl || ''
    });

  return { created: true, updated: false };
}

async function createImportRecord(
  supplierId: string,
  userId: string,
  filename: string,
  selectedCategories: string[]
): Promise<string | null> {
  const { data, error } = await supabase
    .from('imports')
    .insert({
      supplier_id: supplierId,
      filename,
      selected_categories: selectedCategories,
      status: 'processing',
      created_by: userId
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating import record:', error);
    return null;
  }

  return data.id;
}

async function updateImportRecord(
  importId: string,
  status: string,
  stats: ImportStats
): Promise<void> {
  await supabase
    .from('imports')
    .update({
      status,
      categories_created: stats.categoriesCreated,
      categories_updated: stats.categoriesUpdated,
      products_created: stats.productsCreated,
      products_updated: stats.productsUpdated,
      prices_updated: stats.pricesUpdated,
      images_downloaded: stats.imagesDownloaded,
      stock_updated: stats.stockUpdated,
      errors_count: stats.errorsCount,
      completed_at: new Date().toISOString()
    })
    .eq('id', importId);
}

async function logImportAction(
  importId: string,
  supplierSku: string,
  action: 'created' | 'updated' | 'skipped' | 'failed',
  message: string
): Promise<void> {
  await supabase
    .from('import_logs')
    .insert({
      import_id: importId,
      supplier_sku: supplierSku,
      action,
      message
    });
}
