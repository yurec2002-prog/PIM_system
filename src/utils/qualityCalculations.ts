import { supabase } from '../lib/supabase';

export type NotReadyReason =
  | 'no_selling_price'
  | 'no_images'
  | 'no_category_mapping'
  | 'missing_required_attributes';

export interface QualityScore {
  completeness_score: number;
  not_ready_reasons: NotReadyReason[];
  has_selling_price: boolean;
  has_images: boolean;
  has_category_mapping: boolean;
  has_required_attributes: boolean;
}

export interface QualityTemplate {
  required_attributes: string[];
  minimum_image_count: number;
  selling_price_required: boolean;
}

export interface VariantQualityData {
  id: string;
  product_id: string;
  internal_category_id: string | null;
  prices: Array<{ price_type: string; value: number }>;
  images: Array<{ url: string }>;
  attributes: Array<{ attribute: { name: string } }>;
}

export const REASON_LABELS: Record<NotReadyReason, string> = {
  no_selling_price: 'Missing selling price',
  no_images: 'No images available',
  no_category_mapping: 'Category not mapped',
  missing_required_attributes: 'Missing required attributes',
};

export const REASON_DESCRIPTIONS: Record<NotReadyReason, string> = {
  no_selling_price: 'This product needs a retail price to be ready for sale',
  no_images: 'At least one product image is required',
  no_category_mapping: 'Product must be assigned to an internal category',
  missing_required_attributes: 'Some required attributes for this category are missing',
};

export async function getQualityTemplate(internalCategoryId: string | null): Promise<QualityTemplate> {
  const defaultTemplate: QualityTemplate = {
    required_attributes: [],
    minimum_image_count: 1,
    selling_price_required: true,
  };

  if (!internalCategoryId) {
    return defaultTemplate;
  }

  const { data } = await supabase
    .from('category_quality_templates')
    .select('*')
    .eq('internal_category_id', internalCategoryId)
    .maybeSingle();

  if (!data) {
    return defaultTemplate;
  }

  return {
    required_attributes: Array.isArray(data.required_attributes) ? data.required_attributes : [],
    minimum_image_count: data.minimum_image_count || 1,
    selling_price_required: data.selling_price_required !== false,
  };
}

export function calculateQualityScore(
  variant: VariantQualityData,
  template: QualityTemplate
): QualityScore {
  const reasons: NotReadyReason[] = [];

  const hasSellingPrice = variant.prices.some(
    p => p.price_type === 'retail.current' && p.value > 0
  );

  const hasImages = variant.images.length >= template.minimum_image_count;

  const hasCategoryMapping = variant.internal_category_id !== null;

  let hasRequiredAttributes = true;
  if (template.required_attributes.length > 0) {
    const variantAttributeNames = variant.attributes.map(a => a.attribute.name);
    const missingAttributes = template.required_attributes.filter(
      reqAttr => !variantAttributeNames.includes(reqAttr)
    );
    hasRequiredAttributes = missingAttributes.length === 0;
  }

  if (template.selling_price_required && !hasSellingPrice) {
    reasons.push('no_selling_price');
  }

  if (!hasImages) {
    reasons.push('no_images');
  }

  if (!hasCategoryMapping) {
    reasons.push('no_category_mapping');
  }

  if (!hasRequiredAttributes) {
    reasons.push('missing_required_attributes');
  }

  const totalChecks = 4;
  const passedChecks = [
    hasSellingPrice || !template.selling_price_required,
    hasImages,
    hasCategoryMapping,
    hasRequiredAttributes,
  ].filter(Boolean).length;

  const completeness_score = Math.round((passedChecks / totalChecks) * 100);

  return {
    completeness_score,
    not_ready_reasons: reasons,
    has_selling_price: hasSellingPrice,
    has_images: hasImages,
    has_category_mapping: hasCategoryMapping,
    has_required_attributes: hasRequiredAttributes,
  };
}

export async function calculateAndSaveQualityScore(
  variantId: string,
  triggeredBy: string = 'manual'
): Promise<QualityScore | null> {
  // Variants not supported in current architecture
  return null;

  const variantData: VariantQualityData = {
    id: variant.id,
    product_id: variant.product_id,
    internal_category_id: (variant.products as any)?.internal_category_id || null,
    prices: variant.prices || [],
    images: variant.images || [],
    attributes: variant.attributes || [],
  };

  const template = await getQualityTemplate(variantData.internal_category_id);
  const score = calculateQualityScore(variantData, template);

  await supabase
    .from('variant_quality_scores')
    .upsert({
      variant_id: variantId,
      completeness_score: score.completeness_score,
      not_ready_reasons: score.not_ready_reasons,
      has_selling_price: score.has_selling_price,
      has_images: score.has_images,
      has_category_mapping: score.has_category_mapping,
      has_required_attributes: score.has_required_attributes,
      calculated_at: new Date().toISOString(),
    }, {
      onConflict: 'variant_id',
    });

  return score;
}

export async function updateProductReadiness(
  productId: string,
  triggeredBy: string = 'auto_quality_check'
): Promise<void> {
  // Variants not supported in current architecture
  return;

  const { data: scores } = await supabase
    .from('variant_quality_scores')
    .select('completeness_score, not_ready_reasons')
    .in('variant_id', variants.map(v => v.id));

  const allReady = scores && scores.length === variants.length &&
    scores.every(s => s.completeness_score === 100 && s.not_ready_reasons.length === 0);

  const { data: currentProduct } = await supabase
    .from('products')
    .select('is_ready')
    .eq('id', productId)
    .single();

  if (currentProduct && currentProduct.is_ready !== allReady) {
    await supabase
      .from('products')
      .update({ is_ready: allReady })
      .eq('id', productId);

    await supabase
      .from('quality_change_logs')
      .insert({
        product_id: productId,
        change_type: 'readiness_status',
        old_value: String(currentProduct.is_ready),
        new_value: String(allReady),
        reason: allReady
          ? 'All variants passed quality checks'
          : 'One or more variants failed quality checks',
        triggered_by: triggeredBy,
      });
  }
}

export async function recalculateProductQuality(
  productId: string,
  triggeredBy: string = 'manual'
): Promise<void> {
  // Variants not supported in current architecture
  return;
}

export async function getCategoryAverageQuality(categoryId: string): Promise<number> {
  const { data: products } = await supabase
    .from('products')
    .select(`
      id,
      variants!inner(
        id,
        quality:variant_quality_scores(completeness_score)
      )
    `)
    .eq('internal_category_id', categoryId);

  if (!products || products.length === 0) return 0;

  let totalScore = 0;
  let variantCount = 0;

  for (const product of products) {
    const variants = (product.variants as any) || [];
    for (const variant of variants) {
      const quality = variant.quality?.[0];
      if (quality) {
        totalScore += quality.completeness_score;
        variantCount++;
      }
    }
  }

  return variantCount > 0 ? Math.round(totalScore / variantCount) : 0;
}
