create table deal_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  matter_id uuid references matters(id) on delete set null,

  deal_name text not null,
  client_name text not null,
  client_public_name text,
  description text,

  deal_type text,
  practice_areas text[],
  sector text,
  jurisdictions text[],

  deal_value numeric(15,2),
  deal_currency text default 'USD',
  role_played text,
  lead_partner text,

  has_institutional_involvement boolean default false,
  institutions text[],

  start_date date,
  completion_date date,
  year_completed integer,

  status text not null default 'Active' check (status in ('Active', 'Completed', 'Ongoing')),
  is_auto_generated boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

alter table deal_credentials enable row level security;

create policy "Users can manage own credentials"
  on deal_credentials for all using (auth.uid() = user_id);

create index idx_credentials_user on deal_credentials(user_id);
create index idx_credentials_matter on deal_credentials(matter_id) where matter_id is not null;
create index idx_credentials_deal_type on deal_credentials(deal_type);
create index idx_credentials_year on deal_credentials(year_completed);
create index gin_credentials_jurisdictions on deal_credentials using gin(jurisdictions);
create index gin_credentials_practice_areas on deal_credentials using gin(practice_areas);
create index gin_credentials_institutions on deal_credentials using gin(institutions);
