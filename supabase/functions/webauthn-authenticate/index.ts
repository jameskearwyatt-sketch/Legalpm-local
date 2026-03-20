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
    // Use service role for authentication flow (user not yet authenticated)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, ...body } = await req.json();
    console.log('WebAuthn authenticate action:', action);

    if (action === 'generate-options') {
      const { email } = body;
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find user by email
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error('Error listing users:', userError);
        return new Response(
          JSON.stringify({ error: 'Failed to find user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const user = userData.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!user) {
        return new Response(
          JSON.stringify({ hasPasskeys: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get user's passkeys
      const { data: passkeys, error: passkeysError } = await supabase
        .from('passkeys')
        .select('credential_id, transports')
        .eq('user_id', user.id);

      if (passkeysError || !passkeys || passkeys.length === 0) {
        return new Response(
          JSON.stringify({ hasPasskeys: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const challengeBase64 = bufferToBase64url(challenge);

      // Extract the registrable domain for cross-subdomain compatibility
      const origin = req.headers.get('origin') || 'https://legalpm.lovable.app';
      const hostname = new URL(origin).hostname;
      let rpId = hostname;
      if (hostname.endsWith('.lovable.app')) {
        rpId = 'lovable.app';
      } else if (hostname.endsWith('.lovableproject.com')) {
        rpId = 'lovableproject.com';
      }
      
      console.log('Auth Origin:', origin, 'RP ID:', rpId);

      const allowCredentials = passkeys.map((pk: { credential_id: string; transports: string[] }) => ({
        id: pk.credential_id,
        type: 'public-key',
        transports: pk.transports || ['internal', 'hybrid'],
      }));

      const options = {
        challenge: challengeBase64,
        rpId,
        allowCredentials,
        userVerification: 'required',
        timeout: 60000,
      };

      console.log('Generated authentication options for:', email);

      return new Response(
        JSON.stringify({ 
          options, 
          challenge: challengeBase64, 
          userId: user.id,
          hasPasskeys: true 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify-authentication') {
      const { credential, challenge, userId } = body;
      
      if (!credential || !challenge || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify the credential belongs to this user
      const { data: passkey, error: passkeyError } = await supabase
        .from('passkeys')
        .select('*')
        .eq('user_id', userId)
        .eq('credential_id', credential.id)
        .single();

      if (passkeyError || !passkey) {
        return new Response(
          JSON.stringify({ error: 'Invalid credential' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Parse and verify clientDataJSON
      const clientDataJSON = base64urlToBuffer(credential.response.clientDataJSON);
      const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON));

      if (clientData.challenge !== challenge) {
        return new Response(
          JSON.stringify({ error: 'Challenge mismatch' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (clientData.type !== 'webauthn.get') {
        return new Response(
          JSON.stringify({ error: 'Invalid assertion type' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update last used timestamp
      await supabase
        .from('passkeys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', passkey.id);

      // Generate a session for the user
      // Since we can't directly create a session, we'll generate a magic link token
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: (await supabase.auth.admin.getUserById(userId)).data.user?.email || '',
      });

      if (linkError || !linkData) {
        console.error('Error generating session:', linkError);
        return new Response(
          JSON.stringify({ error: 'Failed to create session' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Extract the token from the magic link
      const urlParams = new URL(linkData.properties.hashed_token ? 
        `https://x.com?token=${linkData.properties.hashed_token}` : 
        linkData.properties.action_link
      );
      
      console.log('Passkey authentication successful for user:', userId);

      return new Response(
        JSON.stringify({ 
          success: true,
          access_token: linkData.properties.hashed_token,
          action_link: linkData.properties.action_link,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('WebAuthn authenticate error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
