import { useState } from 'react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { supabase } from '@/integrations/supabase/client';

export function useWebAuthn() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if WebAuthn is supported
  const isSupported = typeof window !== 'undefined' && 
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function';

  // Check if platform authenticator (Face ID/Touch ID) is available
  const checkPlatformAuthenticator = async (): Promise<boolean> => {
    if (!isSupported) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  };

  // Register a new passkey (requires authenticated user)
  const registerPasskey = async (deviceName?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('You must be signed in to register a passkey');
      }

      // Get registration options from server
      const { data: optionsData, error: optionsError } = await supabase.functions.invoke('webauthn-register', {
        body: { action: 'generate-options' },
      });

      if (optionsError || !optionsData?.options) {
        throw new Error(optionsError?.message || 'Failed to get registration options');
      }

      const { options, challenge } = optionsData;

      // Start the WebAuthn registration ceremony (triggers Face ID/Touch ID)
      const credential = await startRegistration(options);

      // Verify and store the credential
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn-register', {
        body: {
          action: 'verify-registration',
          credential,
          challenge,
          deviceName,
        },
      });

      if (verifyError || !verifyData?.success) {
        throw new Error(verifyError?.message || 'Failed to register passkey');
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Authentication was cancelled'
        : err.message || 'Failed to register passkey';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Authenticate with passkey
  const authenticateWithPasskey = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get authentication options from server
      const { data: optionsData, error: optionsError } = await supabase.functions.invoke('webauthn-authenticate', {
        body: { action: 'generate-options', email },
      });

      if (optionsError) {
        throw new Error(optionsError.message || 'Failed to get authentication options');
      }

      if (!optionsData?.hasPasskeys) {
        setIsLoading(false);
        return { success: false, error: 'No passkeys registered for this account' };
      }

      const { options, challenge, userId } = optionsData;

      // Start the WebAuthn authentication ceremony (triggers Face ID/Touch ID)
      const credential = await startAuthentication(options);

      // Verify the credential
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('webauthn-authenticate', {
        body: {
          action: 'verify-authentication',
          credential,
          challenge,
          userId,
        },
      });

      if (verifyError || !verifyData?.success) {
        throw new Error(verifyError?.message || 'Authentication failed');
      }

      // If we have an action link, use it to sign in
      if (verifyData.action_link) {
        // Extract token from the action link and use it
        const url = new URL(verifyData.action_link);
        const token_hash = url.searchParams.get('token_hash') || url.hash.substring(1);
        
        if (token_hash) {
          const { error: signInError } = await supabase.auth.verifyOtp({
            token_hash,
            type: 'magiclink',
          });

          if (signInError) {
            throw new Error('Failed to complete sign in');
          }
        }
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Authentication was cancelled'
        : err.message || 'Authentication failed';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  };

  // Check if user has passkeys registered
  const checkPasskeysForEmail = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('webauthn-authenticate', {
        body: { action: 'generate-options', email },
      });
      return !error && data?.hasPasskeys === true;
    } catch {
      return false;
    }
  };

  return {
    isSupported,
    isLoading,
    error,
    checkPlatformAuthenticator,
    registerPasskey,
    authenticateWithPasskey,
    checkPasskeysForEmail,
  };
}
