export interface ChatHistoryItem {
  message: string;
  timestamp: string | Date;
  fromAdmin: boolean;
  messageType?: string;
  metadataJson?: string;
  priceChallengeId?: string;
}

export interface PriceChallengeChatAction {
  type: string;
  challengeId?: string;
  label?: string;
  productId?: string;
  productSlug?: string;
}

export interface PriceChallengeResultMetadata {
  schemaVersion?: number;
  challengeId?: string;
  decision?: string;
  challengeStatus?: string;
  offerPrice?: number;
  expiresAt?: string;
  actions?: PriceChallengeChatAction[];
}

export interface PriceChallengeProcessingMetadata {
  schemaVersion?: number;
  challengeId?: string;
}

export interface PriceChallengeNeedsManualPriceMetadata {
  schemaVersion?: number;
  challengeId?: string;
  actions?: PriceChallengeChatAction[];
}

export const CHAT_IMAGE_PREFIX = '[[img]]';

export const CHAT_HISTORY_CHANNELS = {
  support: 'support',
  priceChallenge: 'priceChallenge',
} as const;

export type ChatHistoryChannel = typeof CHAT_HISTORY_CHANNELS[keyof typeof CHAT_HISTORY_CHANNELS];

export const CHAT_MESSAGE_TYPES = {
  text: 'Text',
  image: 'Image',
  system: 'System',
  priceChallengeResult: 'PriceChallengeResult',
  priceChallengeProcessing: 'PriceChallengeProcessing',
  priceChallengeEvidence: 'PriceChallengeEvidence',
} as const;

export const PRICE_CHALLENGE_ACTION_TYPES = {
  buyNow: 'PriceChallengeBuyNow',
  enterCompetitorPrice: 'EnterCompetitorPrice',
  sendAnotherScreenshot: 'SendAnotherScreenshot',
} as const;

export const PRICE_CHALLENGE_DECISIONS = {
  challengeAccepted: 'ChallengeAccepted',
  cannotBeat: 'CannotBeat',
} as const;

export const PRICE_CHALLENGE_STATUSES = {
  rejected: 'Rejected',
  manualReview: 'ManualReview',
  completed: 'Completed',
  needsMoreInformation: 'NeedsMoreInformation',
} as const;

export function encodeChatImage(url: string): string {
  return `${CHAT_IMAGE_PREFIX}${url}`;
}

export function isChatImageMessage(message?: string | null): boolean {
  return !!message && message.startsWith(CHAT_IMAGE_PREFIX);
}

export function chatImageUrl(message?: string | null): string {
  if (!isChatImageMessage(message)) {
    return '';
  }
  return String(message).slice(CHAT_IMAGE_PREFIX.length).trim();
}

export function chatPreviewText(message?: string | null): string {
  return isChatImageMessage(message) ? 'Photo' : (message || '');
}

export function isStructuredPriceChallengeMessage(messageType?: string | null): boolean {
  return messageType === CHAT_MESSAGE_TYPES.priceChallengeResult
    || messageType === CHAT_MESSAGE_TYPES.priceChallengeProcessing
    || messageType === CHAT_MESSAGE_TYPES.priceChallengeEvidence;
}

export function isPriceChallengeChatMessage(item?: Pick<ChatHistoryItem, 'messageType' | 'priceChallengeId' | 'message'> | null): boolean {
  if (!item) {
    return false;
  }
  if (isStructuredPriceChallengeMessage(item.messageType)) {
    return true;
  }
  if (item.priceChallengeId) {
    return true;
  }
  if (isAcceptedPriceChallengeOfferMessage(item.message)) {
    return true;
  }
  if (item.messageType === CHAT_MESSAGE_TYPES.system
    && /competitor price|price challenge|checking this offer/i.test(item.message || '')) {
    return true;
  }
  return false;
}

const ACCEPTED_OFFER_MESSAGE_PATTERN =
  /price challenge was accepted|private offer price|tap buy now/i;

export function isAcceptedPriceChallengeOfferMessage(message?: string | null): boolean {
  return ACCEPTED_OFFER_MESSAGE_PATTERN.test(message || '');
}

export function normalizeChatPrivateMessage(payload: unknown): ChatPrivateMessage {
  const row = (payload || {}) as Record<string, unknown>;
  const priceChallengeId = readString(row, 'priceChallengeId', 'PriceChallengeId');
  return {
    message: readString(row, 'message', 'Message') || '',
    fromAdmin: !!(row['fromAdmin'] ?? row['FromAdmin']),
    userId: readString(row, 'userId', 'UserId'),
    messageType: readString(row, 'messageType', 'MessageType'),
    metadataJson: readString(row, 'metadataJson', 'MetadataJson'),
    priceChallengeId,
    timestamp: (row['timestamp'] ?? row['Timestamp']) as string | Date | undefined,
  };
}

export interface ChatPrivateMessage {
  message: string;
  fromAdmin: boolean;
  userId?: string;
  messageType?: string;
  metadataJson?: string;
  priceChallengeId?: string;
  timestamp?: string | Date;
}

export function resolvePriceChallengeResultActions(
  message: Pick<ChatHistoryItem, 'message' | 'messageType' | 'metadataJson' | 'priceChallengeId' | 'fromAdmin'>,
): PriceChallengeChatAction[] {
  const metadata = parsePriceChallengeResultMetadata(message.metadataJson);
  if (metadata?.actions?.length) {
    return metadata.actions;
  }

  const manualActions = parsePriceChallengeNeedsManualPriceMetadata(message.metadataJson)?.actions || [];
  if (manualActions.length) {
    return manualActions;
  }

  const challengeId = (
    metadata?.challengeId
    || message.priceChallengeId
    || ''
  ).trim();

  const isAccepted = metadata?.decision === PRICE_CHALLENGE_DECISIONS.challengeAccepted
    || (
      !!challengeId
      && message.fromAdmin
      && isAcceptedPriceChallengeOfferMessage(message.message)
    );

  if (isAccepted && challengeId) {
    return [{
      type: PRICE_CHALLENGE_ACTION_TYPES.buyNow,
      challengeId,
      label: 'Buy Now',
    }];
  }

  return [];
}

export function isPriceChallengeResultMessage(
  message: Pick<ChatHistoryItem, 'message' | 'messageType' | 'metadataJson' | 'priceChallengeId' | 'fromAdmin'>,
): boolean {
  if (message.messageType === CHAT_MESSAGE_TYPES.priceChallengeResult) {
    return true;
  }

  if (parsePriceChallengeResultMetadata(message.metadataJson)?.decision) {
    return true;
  }

  return !!message.fromAdmin && isAcceptedPriceChallengeOfferMessage(message.message);
}

export function parsePriceChallengeResultMetadata(metadataJson?: string | null): PriceChallengeResultMetadata | null {
  const raw = parseMetadata<Record<string, unknown>>(metadataJson);
  if (!raw) {
    return null;
  }

  return {
    schemaVersion: readNumber(raw, 'schemaVersion', 'SchemaVersion'),
    challengeId: readString(raw, 'challengeId', 'ChallengeId'),
    decision: readString(raw, 'decision', 'Decision'),
    challengeStatus: readString(raw, 'challengeStatus', 'ChallengeStatus'),
    offerPrice: readNumber(raw, 'offerPrice', 'OfferPrice'),
    expiresAt: readString(raw, 'expiresAt', 'ExpiresAt'),
    actions: normalizeActions(raw['actions'] ?? raw['Actions']),
  };
}

export function parsePriceChallengeProcessingMetadata(metadataJson?: string | null): PriceChallengeProcessingMetadata | null {
  const raw = parseMetadata<Record<string, unknown>>(metadataJson);
  if (!raw) {
    return null;
  }
  return {
    schemaVersion: readNumber(raw, 'schemaVersion', 'SchemaVersion'),
    challengeId: readString(raw, 'challengeId', 'ChallengeId'),
  };
}

export function parsePriceChallengeNeedsManualPriceMetadata(metadataJson?: string | null): PriceChallengeNeedsManualPriceMetadata | null {
  const raw = parseMetadata<Record<string, unknown>>(metadataJson);
  if (!raw) {
    return null;
  }
  return {
    schemaVersion: readNumber(raw, 'schemaVersion', 'SchemaVersion'),
    challengeId: readString(raw, 'challengeId', 'ChallengeId'),
    actions: normalizeActions(raw['actions'] ?? raw['Actions']),
  };
}

function normalizeActions(value: unknown): PriceChallengeChatAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const row = item as Record<string, unknown>;
      return {
        type: readString(row, 'type', 'Type') || '',
        challengeId: readString(row, 'challengeId', 'ChallengeId'),
        label: readString(row, 'label', 'Label'),
        productId: readString(row, 'productId', 'ProductId'),
        productSlug: readString(row, 'productSlug', 'ProductSlug'),
      };
    })
    .filter((action) => !!action.type);
}

function readString(source: Record<string, unknown>, camel: string, pascal: string): string | undefined {
  const value = source[camel] ?? source[pascal];
  if (value == null || value === '') {
    return undefined;
  }
  return String(value);
}

function readNumber(source: Record<string, unknown>, camel: string, pascal: string): number | undefined {
  const value = source[camel] ?? source[pascal];
  if (value == null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseMetadata<T>(metadataJson?: string | null): T | null {
  if (!metadataJson) {
    return null;
  }
  try {
    return JSON.parse(metadataJson) as T;
  } catch {
    return null;
  }
}

export function newChatGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
