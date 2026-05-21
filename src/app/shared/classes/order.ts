import { Product } from './product';

// Order
export interface Order {
    shippingDetails?: any;
    /** Line items (cart snapshot); template uses *ngFor over this array. */
    product?: Product[];
    orderId?: any;
    totalAmount?: any;
}