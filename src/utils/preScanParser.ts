interface SandiCategory {
  name: {
    ru: string;
    uk: string;
  };
  parent_ref?: string;
}

interface SandiProduct {
  main: {
    name: {
      ru: string;
      uk: string;
    };
    category: string | {
      ref: string;
      title?: string;
    };
  };
}

interface SandiData {
  categories?: Record<string, SandiCategory>;
  products: Record<string, SandiProduct>;
}

export interface CategoryNode {
  ref: string;
  name: string;
  nameRu: string;
  nameUk: string;
  parentRef?: string;
  children: CategoryNode[];
  productCount: number;
  totalProductCount: number;
}

export interface PreScanResult {
  categories: CategoryNode[];
  totalProducts: number;
  categoryMap: Map<string, CategoryNode>;
}

export function preScanSandiJSON(jsonContent: string): PreScanResult {
  const data: SandiData = JSON.parse(jsonContent);

  if (!data.products || typeof data.products !== 'object') {
    throw new Error('Invalid JSON structure: missing products object');
  }

  const categoryMap = new Map<string, CategoryNode>();
  const productsByCategoryRef = new Map<string, number>();

  // Count products by category
  let skippedProducts = 0;
  let firstProductCategoryRef: string | null = null;
  let firstProductLogged = false;

  Object.entries(data.products).forEach(([sku, product]) => {
    if (!product?.main?.category) {
      skippedProducts++;
      return;
    }

    const categoryRef = typeof product.main.category === 'string'
      ? product.main.category
      : product.main.category.ref;

    if (!categoryRef) {
      skippedProducts++;
      return;
    }

    if (!firstProductCategoryRef) {
      firstProductCategoryRef = categoryRef;
      console.log('First product category ref:', categoryRef, 'SKU:', sku);
    }

    productsByCategoryRef.set(
      categoryRef,
      (productsByCategoryRef.get(categoryRef) || 0) + 1
    );
  });

  console.log(`Pre-scan: Found ${productsByCategoryRef.size} categories with products`);
  console.log(`Pre-scan: Skipped ${skippedProducts} products without category`);

  // Debug: Show sample product counts
  const sampleCounts = Array.from(productsByCategoryRef.entries()).slice(0, 5);
  console.log('Sample product counts by category:', sampleCounts);

  // Check if data.categories exists and compare keys
  if (data.categories) {
    const firstCategoryKey = Object.keys(data.categories)[0];
    console.log('First category key in data.categories:', firstCategoryKey);

    // Check if product refs match category keys
    if (firstProductCategoryRef && data.categories[firstProductCategoryRef]) {
      console.log('✓ Product category ref MATCHES data.categories key');
    } else if (firstProductCategoryRef) {
      console.log('✗ Product category ref DOES NOT MATCH data.categories keys');
      console.log('Product uses ref:', firstProductCategoryRef);
      console.log('Categories have keys like:', firstCategoryKey);
    }
  }

  if (data.categories && Object.keys(data.categories).length > 0) {
    // Build category tree from categories object
    let categoriesWithProducts = 0;
    Object.entries(data.categories).forEach(([ref, category]) => {
      const productCount = productsByCategoryRef.get(ref) || 0;
      if (productCount > 0) {
        categoriesWithProducts++;
      }
      const node: CategoryNode = {
        ref,
        name: category.name.ru || category.name.uk || ref,
        nameRu: category.name.ru || '',
        nameUk: category.name.uk || '',
        parentRef: category.parent_ref,
        children: [],
        productCount: productCount,
        totalProductCount: 0,
      };
      categoryMap.set(ref, node);

      // Debug: Log first category with products
      if (productCount > 0 && categoriesWithProducts === 1) {
        console.log('First category with products:', {
          ref,
          name: node.name,
          productCount
        });
      }
    });

    console.log(`Categories with direct products: ${categoriesWithProducts} out of ${Object.keys(data.categories).length}`);

    // Build parent-child relationships
    categoryMap.forEach(node => {
      if (node.parentRef && categoryMap.has(node.parentRef)) {
        const parent = categoryMap.get(node.parentRef)!;
        parent.children.push(node);
      }
    });
  } else {
    // No categories in JSON, create flat structure from product references
    productsByCategoryRef.forEach((count, ref) => {
      const node: CategoryNode = {
        ref,
        name: ref,
        nameRu: ref,
        nameUk: ref,
        parentRef: undefined,
        children: [],
        productCount: count,
        totalProductCount: 0,
      };
      categoryMap.set(ref, node);
    });
  }

  // Find root categories
  const rootCategories: CategoryNode[] = [];
  categoryMap.forEach(node => {
    if (!node.parentRef || !categoryMap.has(node.parentRef)) {
      rootCategories.push(node);
    }
  });

  // Recursively calculate total product counts
  function calculateTotalProducts(node: CategoryNode): number {
    let total = node.productCount;
    for (const child of node.children) {
      total += calculateTotalProducts(child);
    }
    node.totalProductCount = total;
    return total;
  }

  rootCategories.forEach(node => calculateTotalProducts(node));

  console.log(`Pre-scan: Built tree with ${rootCategories.length} root categories`);
  console.log(`Pre-scan: Total categories: ${categoryMap.size}`);

  // Debug: Log first few categories with counts
  if (rootCategories.length > 0) {
    console.log('Sample root category after calculation:', {
      ref: rootCategories[0].ref,
      name: rootCategories[0].name,
      productCount: rootCategories[0].productCount,
      totalProductCount: rootCategories[0].totalProductCount,
      childrenCount: rootCategories[0].children.length
    });
    if (rootCategories[0].children.length > 0) {
      console.log('Sample child category:', {
        ref: rootCategories[0].children[0].ref,
        name: rootCategories[0].children[0].name,
        productCount: rootCategories[0].children[0].productCount,
        totalProductCount: rootCategories[0].children[0].totalProductCount
      });
    }
  }

  return {
    categories: rootCategories,
    totalProducts: Object.keys(data.products).length,
    categoryMap,
  };
}

export function getSelectedCategoryRefs(
  categoryMap: Map<string, CategoryNode>,
  selectedRefs: Set<string>
): Set<string> {
  const allSelectedRefs = new Set<string>();

  function addCategoryAndChildren(ref: string) {
    allSelectedRefs.add(ref);
    const node = categoryMap.get(ref);
    if (node) {
      node.children.forEach(child => addCategoryAndChildren(child.ref));
    }
  }

  selectedRefs.forEach(ref => addCategoryAndChildren(ref));

  return allSelectedRefs;
}

export function filterProductsByCategories(
  jsonContent: string,
  selectedCategoryRefs: Set<string>
): string {
  const data: SandiData = JSON.parse(jsonContent);

  // Filter products
  const filteredProducts: Record<string, SandiProduct> = {};
  Object.entries(data.products).forEach(([sku, product]) => {
    if (!product?.main?.category) return;

    const categoryRef = typeof product.main.category === 'string'
      ? product.main.category
      : product.main.category.ref;

    if (categoryRef && selectedCategoryRefs.has(categoryRef)) {
      filteredProducts[sku] = product;
    }
  });

  // Filter categories - only keep selected categories
  const filteredCategories: Record<string, SandiCategory> = {};
  if (data.categories) {
    Object.entries(data.categories).forEach(([ref, category]) => {
      if (selectedCategoryRefs.has(ref)) {
        filteredCategories[ref] = category;
      }
    });
  }

  console.log(`Filtered: ${Object.keys(filteredProducts).length} products, ${Object.keys(filteredCategories).length} categories`);

  return JSON.stringify({
    ...data,
    products: filteredProducts,
    categories: filteredCategories,
  });
}
