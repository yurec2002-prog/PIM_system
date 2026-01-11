import { supabase } from '../lib/supabase';

export interface VariantSnapshot {
  external_id: string;
  sku: string;
  price: number;
  stock_quantity: number;
  name: string;
  description: string;
  images: string[];
  prices: Record<string, number>;
  warehouse_balances: Record<string, number>;
}

export interface ImportDiff {
  external_id: string;
  field_name: string;
  old_value: string;
  new_value: string;
  change_type: 'added' | 'modified' | 'removed';
}

export async function createVariantSnapshot(
  importId: string,
  variantId: string,
  externalId: string,
  snapshotData: VariantSnapshot
): Promise<void> {
  await supabase
    .from('import_snapshots')
    .insert({
      import_id: importId,
      variant_id: variantId,
      external_id: externalId,
      snapshot_data: snapshotData,
    });
}

export async function getLastSnapshot(
  externalId: string,
  supplierId: string
): Promise<VariantSnapshot | null> {
  const { data: lastImport } = await supabase
    .from('imports')
    .select('id')
    .eq('supplier_id', supplierId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastImport) return null;

  const { data: snapshot } = await supabase
    .from('import_snapshots')
    .select('snapshot_data')
    .eq('import_id', lastImport.id)
    .eq('external_id', externalId)
    .maybeSingle();

  return snapshot?.snapshot_data as VariantSnapshot | null;
}

export function detectDiffs(
  oldSnapshot: VariantSnapshot | null,
  newSnapshot: VariantSnapshot
): ImportDiff[] {
  const diffs: ImportDiff[] = [];

  if (!oldSnapshot) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'variant',
      old_value: '',
      new_value: 'New variant',
      change_type: 'added',
    });
    return diffs;
  }

  if (oldSnapshot.price !== newSnapshot.price) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'price',
      old_value: String(oldSnapshot.price),
      new_value: String(newSnapshot.price),
      change_type: 'modified',
    });
  }

  if (oldSnapshot.stock_quantity !== newSnapshot.stock_quantity) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'stock_quantity',
      old_value: String(oldSnapshot.stock_quantity),
      new_value: String(newSnapshot.stock_quantity),
      change_type: 'modified',
    });
  }

  if (oldSnapshot.name !== newSnapshot.name) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'name',
      old_value: oldSnapshot.name,
      new_value: newSnapshot.name,
      change_type: 'modified',
    });
  }

  if (oldSnapshot.description !== newSnapshot.description) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'description',
      old_value: oldSnapshot.description.substring(0, 100),
      new_value: newSnapshot.description.substring(0, 100),
      change_type: 'modified',
    });
  }

  const oldImagesSet = new Set(oldSnapshot.images);
  const newImagesSet = new Set(newSnapshot.images);

  const addedImages = newSnapshot.images.filter(img => !oldImagesSet.has(img));
  const removedImages = oldSnapshot.images.filter(img => !newImagesSet.has(img));

  if (addedImages.length > 0) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'images',
      old_value: String(oldSnapshot.images.length),
      new_value: String(newSnapshot.images.length),
      change_type: 'added',
    });
  }

  if (removedImages.length > 0) {
    diffs.push({
      external_id: newSnapshot.external_id,
      field_name: 'images',
      old_value: String(oldSnapshot.images.length),
      new_value: String(newSnapshot.images.length),
      change_type: 'removed',
    });
  }

  for (const [priceType, newValue] of Object.entries(newSnapshot.prices)) {
    const oldValue = oldSnapshot.prices[priceType];
    if (oldValue !== newValue) {
      diffs.push({
        external_id: newSnapshot.external_id,
        field_name: `price.${priceType}`,
        old_value: String(oldValue || 0),
        new_value: String(newValue),
        change_type: oldValue ? 'modified' : 'added',
      });
    }
  }

  for (const [warehouse, newQty] of Object.entries(newSnapshot.warehouse_balances)) {
    const oldQty = oldSnapshot.warehouse_balances[warehouse];
    if (oldQty !== newQty) {
      diffs.push({
        external_id: newSnapshot.external_id,
        field_name: `stock.${warehouse}`,
        old_value: String(oldQty || 0),
        new_value: String(newQty),
        change_type: oldQty !== undefined ? 'modified' : 'added',
      });
    }
  }

  return diffs;
}

export async function saveDiffs(
  importId: string,
  variantId: string | null,
  diffs: ImportDiff[]
): Promise<void> {
  if (diffs.length === 0) return;

  const records = diffs.map(diff => ({
    import_id: importId,
    variant_id: variantId,
    external_id: diff.external_id,
    field_name: diff.field_name,
    old_value: diff.old_value,
    new_value: diff.new_value,
    change_type: diff.change_type,
  }));

  await supabase.from('import_diffs').insert(records);
}

export async function getImportDiffs(importId: string): Promise<ImportDiff[]> {
  const { data } = await supabase
    .from('import_diffs')
    .select('*')
    .eq('import_id', importId)
    .order('created_at', { ascending: true });

  return data || [];
}
