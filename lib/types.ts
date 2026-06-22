// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  vendor_id: number | null;
  business_name?: string;
  gstin?: string;
  kyc_status?: string | null;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

// ─── Vendor ──────────────────────────────────────────────────────────────────

export interface Vendor {
  id: number;
  business_name: string;
  business_category: string;
  description: string | null;
  logo_url: string | null;
  city: string;
  state: string;
  latitude: number | null;
  longitude: number | null;
  average_rating: number;
  total_ratings_count: number;
  distance?: number;
  products_count?: number;
}

// ─── Product ─────────────────────────────────────────────────────────────────

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
  parent_id: number | null;
  products_count?: number;
  children?: Category[];
}

export interface ProductPack {
  id: number;
  product_id: number;
  name: string;
  base_price: string;
  discounted_price: string | null;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
}

export interface Product {
  id: number;
  vendor_id: number | null;
  name: string;
  description: string | null;
  category_id: number | null;
  category: Category | null;
  category_label: string | null;
  base_price: string;
  discounted_price: string | null;
  wholesale_price: string | null;
  min_order_quantity: number;
  primary_image_url: string | null;
  secondary_images: string[];
  unit: string;
  stock_quantity: number;
  weight_grams: number | null;
  is_featured: boolean;
  is_active: boolean;
  packs?: ProductPack[];
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'city' | 'average_rating'>;
}

// ─── Cart ────────────────────────────────────────────────────────────────────

export interface CartItem {
  id: number;
  cart_id: number;
  product_id: number;
  product_pack_id?: number | null;
  quantity: number;
  unit_price: string;
  total_price: string;
  product?: Pick<Product, 'id' | 'name' | 'primary_image_url' | 'base_price' | 'discounted_price' | 'wholesale_price' | 'min_order_quantity'>;
  productPack?: ProductPack | null;
}

export interface Cart {
  id: number;
  user_id: number;
  vendor_id: number;
  status: string;
  total_amount: string;
  total_items: number;
  items: CartItem[];
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'logo_url' | 'city'>;
}

// ─── Order ───────────────────────────────────────────────────────────────────

export interface OrderItem {
  id: number;
  product_id: number;
  product_pack_id?: number | null;
  product_name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  product?: Pick<Product, 'id' | 'name' | 'primary_image_url'>;
  productPack?: ProductPack | null;
}

export interface Order {
  id: number;
  order_number: string;
  vendor_id: number;
  order_status: string;
  payment_status: string;
  subtotal?: string;
  delivery_charge?: string;
  tax_amount?: string;
  discount_amount?: string;
  total_amount: string;
  created_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
  items?: OrderItem[];
  items_count?: number;
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'logo_url' | 'city'>;
}

// ─── Subscription ────────────────────────────────────────────────────────────

export interface Subscription {
  id: number;
  user_id: number;
  vendor_id: number;
  plan_name: string;
  frequency: string;
  status: string;
  plan_price: string;
  start_date: string;
  next_delivery_date: string | null;
  total_deliveries: number;
  deliveries_completed: number;
  vendor?: Pick<Vendor, 'id' | 'business_name' | 'logo_url'>;
}

// ─── Address ─────────────────────────────────────────────────────────────────

export interface Address {
  id: number;
  name: string;
  address_line1: string;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  mobile: string | null;
  is_default: boolean;
  is_billing: boolean;
}

// ─── Payment Methods ─────────────────────────────────────────────────────────

export type PaymentMethodType = 'upi' | 'card' | 'netbanking' | 'wallet' | 'cod';

export interface PaymentMethod {
  id: number;
  type: PaymentMethodType;
  provider: string | null;
  identifier: string | null;
  is_default: boolean;
}

// ─── Tax / GST Profile ───────────────────────────────────────────────────────

export interface UserTaxProfile {
  id: number;
  user_id: number;
  is_gst_registered: boolean;
  gstin: string | null;
  legal_business_name: string | null;
}

// ─── Rewards ─────────────────────────────────────────────────────────────────

export interface RewardTransaction {
  id: number;
  transaction_type: 'credit' | 'debit' | 'earn' | 'redeem';
  points: number;
  points_balance_after: number;
  source: string;
  description: string;
  created_at: string;
}

export interface RewardCatalogItem {
  id: number;
  name: string;
  description: string;
  reward_type: string;
  points_required: number;
  cashback_amount: string | null;
  discount_percent: number | null;
  image_url: string | null;
}

// ─── Notification ────────────────────────────────────────────────────────────

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

// ─── API Envelope ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
  };
}
