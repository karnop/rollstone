-- Drop old tables if they exist to start fresh (cascading constraints)
drop table if exists public.bjj_log_techniques cascade;
drop table if exists public.bjj_round_events cascade;
drop table if exists public.bjj_logs cascade;
drop table if exists public.bjj_moves cascade;
drop table if exists public.bjj_positions cascade;
drop table if exists public.bjj_partners cascade;

-- 1. Create Profiles Table (extends Supabase Auth Users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text default 'user' check (role in ('user', 'admin')),
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Users can update their own profile." on public.profiles;

create policy "Public profiles are viewable by everyone." on public.profiles for select using (true);
create policy "Users can update their own profile." on public.profiles for update using (auth.uid() = id);

-- 2. Create BJJ Partners Table
create table public.bjj_partners (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  name text not null,
  belt text check (belt in ('White', 'Blue', 'Purple', 'Brown', 'Black')),
  weight text check (weight in ('Lighter', 'Matched', 'Heavier', 'Ultra Heavier')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, name)
);

alter table public.bjj_partners enable row level security;
create policy "Users can view their own partners" on public.bjj_partners for select using (auth.uid() = user_id);
create policy "Users can insert their own partners" on public.bjj_partners for insert with check (auth.uid() = user_id);
create policy "Users can update their own partners" on public.bjj_partners for update using (auth.uid() = user_id);
create policy "Users can delete their own partners" on public.bjj_partners for delete using (auth.uid() = user_id);

-- 3. Create BJJ Positions Table
create table public.bjj_positions (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  category text not null check (category in ('Neutral', 'Dominant (Top)', 'Submissive (Bottom)', 'Guards (Active Bottom)', 'Leg Entanglements (Ashi)')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bjj_positions enable row level security;
create policy "Positions are viewable by everyone" on public.bjj_positions for select using (true);
create policy "Admins can insert positions" on public.bjj_positions for insert with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- 4. Create BJJ Moves Table
create table public.bjj_moves (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('Submission', 'Sweep', 'Escape', 'Takedown', 'Transition')),
  position_id uuid references public.bjj_positions(id) on delete cascade, -- Optional link to specific guard/setup position
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index bjj_moves_positional_unique_idx on public.bjj_moves (name, position_id, type) where position_id is not null;
create unique index bjj_moves_global_unique_idx on public.bjj_moves (name, type) where position_id is null;

alter table public.bjj_moves enable row level security;
create policy "Moves are viewable by everyone" on public.bjj_moves for select using (true);

-- 5. Create Master Session Logs Table (Aggregates a training session day)
create table public.bjj_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null default auth.uid(),
  date date not null,
  attire text not null check (attire in ('Gi', 'No-Gi')),
  duration integer not null default 5, 
  total_rounds integer not null default 1, 
  intensity text not null check (intensity in ('Flow Roll', 'Technical Sparring', 'Competition Mode')),
  partner_name text,
  partner_rank text check (partner_rank in ('White', 'Blue', 'Purple', 'Brown', 'Black')),
  partner_weight text check (partner_weight in ('Lighter', 'Matched', 'Heavier', 'Ultra Heavier')),
  round_focus text,
  feel integer not null check (feel between 1 and 5),
  locker_room_memo text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bjj_logs enable row level security;
create policy "Users can CRUD their own logs" on public.bjj_logs for all using (auth.uid() = user_id);

-- 6. [FIXED] Create BJJ Technique Drill Logs Table (The Classroom Unit)
create table public.bjj_log_techniques (
  id uuid default gen_random_uuid() primary key,
  log_id uuid references public.bjj_logs(id) on delete cascade not null,
  move_id uuid references public.bjj_moves(id) on delete cascade not null,
  drill_feel integer not null check (drill_feel between 1 and 5),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bjj_log_techniques enable row level security;
create policy "Users can CRUD their own technique logs" on public.bjj_log_techniques for all using (
  exists (select 1 from public.bjj_logs where bjj_logs.id = public.bjj_log_techniques.log_id and bjj_logs.user_id = auth.uid())
);

-- 7. [FIXED] Create BJJ Round Events Table (Relational Timeline Data)
create table public.bjj_round_events (
  id uuid default gen_random_uuid() primary key,
  log_id uuid references public.bjj_logs(id) on delete cascade not null,
  sequence_order integer not null,
  who text not null check (who in ('I', 'Opponent')),
  action_type text not null check (action_type in ('Initial State', 'Takedown', 'Guard Pass', 'Sweep', 'Escape', 'Submission Attempt', 'Submission Finish')),
  
  -- Foreign key hooks directly to taxonomy tables for unified analytics calculations
  move_id uuid references public.bjj_moves(id) on delete set null,
  resulting_position_id uuid references public.bjj_positions(id) on delete cascade, 
  move_name text,
  resulting_position text not null,
  
  micro_notes_tags text[] default '{}'::text[],
  micro_notes_text text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.bjj_round_events enable row level security;
create policy "Users can CRUD their own round events" on public.bjj_round_events for all using (
  exists (select 1 from public.bjj_logs where bjj_logs.id = public.bjj_round_events.log_id and bjj_logs.user_id = auth.uid())
);

-- 8. Trigger Configuration
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'user')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 9. Seed Complete Positions Directory
insert into public.bjj_positions (name, category) values
('Standing / Takedown Phase', 'Neutral'),
('Mount (Top)', 'Dominant (Top)'),
('Back Control (Attacking)', 'Dominant (Top)'),
('Side Control (Top)', 'Dominant (Top)'),
('North-South (Top)', 'Dominant (Top)'),
('Knee on Belly (Top)', 'Dominant (Top)'),
('Mount (Bottom)', 'Submissive (Bottom)'),
('Back Taken (Defending)', 'Submissive (Bottom)'),
('Side Control (Bottom)', 'Submissive (Bottom)'),
('North-South (Bottom)', 'Submissive (Bottom)'),
('Knee on Belly (Bottom)', 'Submissive (Bottom)'),
('Turtle (Defending)', 'Submissive (Bottom)'),

-- Guard Configurations (Bottom Perspective)
('Closed Guard (Bottom)', 'Guards (Active Bottom)'),
('Half Guard (Standard)', 'Guards (Active Bottom)'),
('Half Guard (Knee Shield/Z-Guard)', 'Guards (Active Bottom)'),
('Deep Half Guard', 'Guards (Active Bottom)'),
('Butterfly Guard', 'Guards (Active Bottom)'),
('De La Riva Guard', 'Guards (Active Bottom)'),
('Reverse De La Riva Guard', 'Guards (Active Bottom)'),
('Spider Guard', 'Guards (Active Bottom)'),
('X-Guard', 'Guards (Active Bottom)'),
('Single Leg X (SLX)', 'Guards (Active Bottom)'),
('Rubber Guard', 'Guards (Active Bottom)'),

-- Guard Passing Configurations (Top Perspective)
('Closed Guard (Top Passing)', 'Neutral'),
('Half Guard (Top Passing)', 'Neutral'),
('Open Guard (Top Passing)', 'Neutral'),

-- Leg Entanglements (Ashi)
('Standard Ashi Garami', 'Leg Entanglements (Ashi)'),
('Outside Ashi', 'Leg Entanglements (Ashi)'),
('411 / Honey Hole / Saddle', 'Leg Entanglements (Ashi)'),
('50/50 Guard', 'Leg Entanglements (Ashi)')
on conflict (name) do nothing;

-- 10. Seed Core Submission Moves Taxonomy
insert into public.bjj_moves (name, type, position_id)
select name, type, null::uuid from (
  values
  ('Bow and Arrow Choke', 'Submission'),
  ('Cross Collar Choke', 'Submission'),
  ('Ezekiel Choke', 'Submission'),
  ('Baseball Bat Choke', 'Submission'),
  ('Rear Naked Choke (RNC)', 'Submission'),
  ('Guillotine Choke', 'Submission'),
  ('Triangle Choke', 'Submission'),
  ('Arm Triangle', 'Submission'),
  ('D''Arce Choke', 'Submission'),
  ('Anaconda Choke', 'Submission'),
  ('North-South Choke', 'Submission'),
  ('Straight Armbar', 'Submission'),
  ('Kimura (Keylock)', 'Submission'),
  ('Americana (Paintbrush)', 'Submission'),
  ('Omoplata', 'Submission'),
  ('Straight Ankle Lock', 'Submission'),
  ('Heel Hook (Inverted / Outside)', 'Submission'),
  ('Kneebar', 'Submission'),
  ('Toe Hold', 'Submission'),
  ('Calf Slicer', 'Submission')
) as val(name, type)
on conflict do nothing;