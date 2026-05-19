export interface AbpResponse<T> {
  result: T;
  success: boolean;
}

export interface HeaderMenuStorefrontItem {
  slot: number;
  productGroupId?: string;
  categoryName?: string;
}

export interface HeaderMenuStorefront {
  tenantId: number;
  dropdowns: HeaderMenuStorefrontItem[];
}

export interface CategoryTreeNode {
  id: string;
  title: string;
  parentGroupId?: string | null;
  count?: number;
  children?: CategoryTreeNode[];
}
