export function parsePrice(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/,/g, '.'));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function formatPrice(value: number, currency: string = 'UAH'): string {
  return `${value.toFixed(2)} ${currency}`;
}

export function calculateMargin(retailPrice: number, purchasePrice: number): {
  amount: number;
  percentage: number;
} {
  if (retailPrice === 0) {
    return { amount: 0, percentage: 0 };
  }

  const amount = retailPrice - purchasePrice;
  const percentage = (amount / retailPrice) * 100;

  return {
    amount: Math.round(amount * 100) / 100,
    percentage: Math.round(percentage * 100) / 100,
  };
}

export function getReadinessChecklist(variant: {
  prices: Array<{ price_type: string; value: number }>;
  stock_quantity: number;
  images: Array<any>;
  attributes: Array<any>;
}): {
  hasRetailPrice: boolean;
  hasPurchasePrice: boolean;
  hasStock: boolean;
  hasImages: boolean;
  hasAttributes: boolean;
  isReady: boolean;
} {
  const hasRetailPrice = variant.prices.some(p => p.price_type === 'retail.current' && parsePrice(p.value) > 0);
  const hasPurchasePrice = variant.prices.some(p => p.price_type === 'purchase.cash.current' && parsePrice(p.value) > 0);
  const hasStock = variant.stock_quantity > 0;
  const hasImages = variant.images && variant.images.length > 0;
  const hasAttributes = variant.attributes && variant.attributes.length > 0;

  const isReady = hasRetailPrice && hasPurchasePrice && hasStock && hasImages;

  return {
    hasRetailPrice,
    hasPurchasePrice,
    hasStock,
    hasImages,
    hasAttributes,
    isReady,
  };
}
