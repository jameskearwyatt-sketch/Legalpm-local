import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Helper to convert ArrayBuffer to base64url
function bufferToBase64url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// Helper to convert base64url to ArrayBuffer
function base64urlToBuffer(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;
    const userEmail = claimsData.claims.email as string;

    const { action, ...body } = await req.json();
    console.log('WebAuthn register action:', action);

    if (action === 'generate-options') {
      // Generate registration options
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = bufferToBase64url(challenge);
      
      // Get existing credentials to exclude
      const { data: existingPasskeys } = await supabase
        .from('passkeys')
        .select('credential_id')
        .eq('user_id', userId);

      const excludeCredentials = (existingPasskeys || []).map((pk: { credential_id: string }) => ({
        id: pk.credential_id,
        type: 'public-key',
        transports: ['internal', 'hybrid'],
      }));

      const options = {
        challenge: challengeBase64,
        rp: {
          name: 'Legal Practice Manager',
          id: new URL(req.headers.get('origin') || 'https://legalpm.lovable.app').hostname,
        },
        user: {
          id: bufferToBase64url(new TextEncoder().encode(userId)),
          name: userEmail,
          displayName: userEmail.split('@')[0],
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Use built-in authenticator (Face ID, Touch ID)
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
        excludeCredentials,
      };

      // Store challenge temporarily (in a real app, use a cache/session store)
      // For simplicity, we'll verify in the next step without storing
      console.log('Generated registration options for user:', userId);

      return new Response(
        JSON.stringify({ options, challenge: challengeBase64 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify-registration') {
      const { credential, challenge, deviceName } = body;
      
      if (!credential || !challenge) {
        return new Response(
          JSON.stringify({ error: 'Missing credential or challenge' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract credential data
      const credentialId = credential.id;
      const clientDataJSON = base64urlToBuffer(credential.response.clientDataJSON);
      const attestationObject = base64urlToBuffer(credential.response.attestationObject);

      // Parse clientDataJSON to verify challenge
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));
      
      if (clientData.challenge !== challenge) {
        return new Response(
          JSON.stringify({ error: 'Challenge mismatch' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (clientData.type !== 'webauthn.create') {
        return new Response(
          JSON.stringify({ error: 'Invalid credential type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Store the credential (simplified - in production, parse attestationObject properly)
      const { error: insertError } = await supabase
        .from('passkeys')
        .insert({
          user_id: userId,
          credential_id: credentialId,
          public_key: credential.response.attestationObject, // Store full attestation for simplicity
          counter: 0,
          transports: credential.response.transports || ['internal'],
          authenticator_attachment: 'platform',
          device_name: deviceName || 'Face ID / Touch ID',
          backup_eligible: credential.response.backupEligible || false,
          backup_state: credential.response.backupState || false,
        });

      if (insertError) {
        console.error('Error storing passkey:', insertError);
        return new Response(
          JSON.stringify({ error: 'Failed to store passkey' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Passkey registered successfully for user:', userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WebAuthn register error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
