// Products (legacy JSON used numeric id; POS / API shop uses string Guid for inventory line id)
export interface Product {
    id?: number | string;
    title?: string;
    description?: string;
    type?: string;
    brand?: string;
    collection?: any[];
    category?: string;
    price?: number;
    sale?: boolean;
    discount?: number;
    stock?: number;
    new?: boolean;
    quantity?: number;
    tags?: any[];
    variants?: Variants[];
    images?: Images[];
    /** POS catalog product id when available (separate from inventory row id). */
    productId?: string;
    /** POS product color (flat field from API; use with or without `variants`). */
    color?: string | null;
    /** POS product size from API (decimal); shown in size filter. */
    productSize?: number | string | null;
}

export interface Variants {
    variant_id?: number;
    id?: number;
    sku?: string;
    size?: string;
    color?: string;
    image_id?: number;
}

export interface Images {
    image_id?: number;
    id?: number;
    alt?: string;
    src?: string;
    variant_id?: any[];
}