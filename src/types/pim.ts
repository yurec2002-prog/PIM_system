// PIM System Types based on new architecture

export interface Category {
  id: number;
  supplier: string;
  supplier_category_ref: string;
  parent_id: number | null;
  name_ru: string;
  name_uk: string;
  image: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  supplier: string;
  supplier_sku: string;
  barcode: string;
  vendor_code: string;
  brand_ref: string;
  category_id: number | null;
  name_ru: string;
  name_uk: string;
  description_ru: string;
  description_uk: string;
  attributes_ru: Record<string, string>;
  attributes_uk: Record<string, string>;
  images: string[];
  main_image: string;
  total_stock: number;
  is_ready: boolean;
  completeness_score: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  id: string;
  product_id: number;
  price_type: 'retail_rrp' | 'purchase_cash' | 'selling' | 'promo' | 'discount' | 'contract';
  value: number;
  currency: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface WarehouseStock {
  id: string;
  product_id: number;
  warehouse_code: string;
  warehouse_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  supplier_id: string;
  external_ref: string;
  name: string;
  logo_url: string;
  created_at: string;
  updated_at: string;
}

export interface Import {
  id: string;
  supplier_id: string;
  filename: string;
  selected_categories: string[];
  status: string;
  categories_created: number;
  categories_updated: number;
  products_created: number;
  products_updated: number;
  prices_updated: number;
  images_downloaded: number;
  stock_updated: number;
  errors_count: number;
  error_details: Array<{ sku: string; message: string }>;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface ImportLog {
  id: string;
  import_id: string;
  supplier_sku: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  message: string;
  created_at: string;
}

export interface ProductQualityScore {
  id: string;
  product_id: number;
  completeness_score: number;
  not_ready_reasons: Array<{ code: string; message: string }>;
  has_selling_price: boolean;
  has_images: boolean;
  has_category: boolean;
  has_required_attributes: boolean;
  calculated_at: string;
}

export interface CategoryQualityTemplate {
  id: string;
  category_id: number;
  required_attributes: string[];
  minimum_image_count: number;
  selling_price_required: boolean;
  created_at: string;
  updated_at: string;
}

// Extended types with relations
export interface ProductWithRelations extends Product {
  category?: Category;
  prices?: ProductPrice[];
  stocks?: WarehouseStock[];
  quality_score?: ProductQualityScore;
}

export interface CategoryWithRelations extends Category {
  parent?: Category;
  children?: Category[];
  products?: Product[];
  product_count?: number;
}
