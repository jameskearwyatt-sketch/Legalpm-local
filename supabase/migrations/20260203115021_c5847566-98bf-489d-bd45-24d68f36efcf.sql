-- Create the passkeys table for storing WebAuthn credentials
CREATE TABLE public.passkeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  authenticator_attachment TEXT,
  device_name TEXT,
  backup_eligible BOOLEAN DEFAULT false,
  backup_state BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_passkeys_user_id ON public.passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON public.passkeys(credential_id);

-- Enable Row Level Security
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

-- Users can view their own passkeys
CREATE POLICY "Users can view their own passkeys" 
ON public.passkeys 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own passkeys
CREATE POLICY "Users can insert their own passkeys" 
ON public.passkeys 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own passkeys
CREATE POLICY "Users can update their own passkeys" 
ON public.passkeys 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own passkeys
CREATE POLICY "Users can delete their own passkeys" 
ON public.passkeys 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for updating updated_at
CREATE TRIGGER update_passkeys_updated_at
BEFORE UPDATE ON public.passkeys
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();