/** Google Identity Services (GIS) — https://accounts.google.com/gsi/client */
declare namespace google.accounts.id {
  interface CredentialResponse {
    credential: string;
    select_by?: string;
    clientId?: string;
  }

  interface PromptMomentNotification {
    isDisplayMoment(): boolean;
    isDisplayed(): boolean;
    isNotDisplayed(): boolean;
    getNotDisplayedReason(): string;
    isSkippedMoment(): boolean;
    getSkippedReason(): string;
    isDismissedMoment(): boolean;
    getDismissedReason(): string;
  }

  interface IdConfiguration {
    client_id: string;
    callback?: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
    ux_mode?: 'popup' | 'redirect';
    login_uri?: string;
    native_callback?: (response: CredentialResponse) => void;
    intermediate_iframe_close_callback?: () => void;
    itp_support?: boolean;
    use_fedcm_for_prompt?: boolean;
  }

  interface GsiButtonConfiguration {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: number | string;
    locale?: string;
  }

  function initialize(config: IdConfiguration): void;
  function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
  function renderButton(parent: HTMLElement, options?: GsiButtonConfiguration): void;
  function disableAutoSelect(): void;
  function cancel(): void;
  function revoke(hint: string, callback?: (response: { successful: boolean; error?: string }) => void): void;
}

declare namespace google.accounts {
  const id: typeof google.accounts.id;
}

interface Window {
  google?: {
    accounts?: {
      id: typeof google.accounts.id;
    };
  };
}
