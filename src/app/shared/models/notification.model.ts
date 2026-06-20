export interface ShopNotificationItem {
  id: number;
  icon: string;
  title: string;
  badge: string;
  text: string;
  time: Date;
  status: string;
  link: string;
  isRead: boolean;
  sourceType?: string;
  sourceId?: string;
  taskGroupId?: number;
}

export interface NotificationApiDto {
  id: number;
  title: string;
  description: string;
  isRead: boolean;
  creationTime: string;
  link?: string;
  status?: string;
  statusText?: string;
  sourceId?: string;
  sourceType?: string;
  taskGroupId?: number;
}
