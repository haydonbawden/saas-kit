create extension if not exists "pgcrypto";

-- Helper: check workspace membership
create or replace function public.is_workspace_member(target uuid)
returns boolean as $$
  select exists(
    select 1 from public.workspace_members wm
    where wm.workspace_id = target and wm.user_id = auth.uid()
  );
$$ language sql security definer;

-- Workspaces
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.workspaces enable row level security;

create table if not exists public.workspace_members (
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  role text not null default 'owner',
  created_at timestamptz default now(),
  primary key (workspace_id, user_id)
);
alter table public.workspace_members enable row level security;

create or replace function public.add_workspace_owner()
returns trigger as $$
begin
  insert into public.workspace_members(workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'add_workspace_owner_trigger'
  ) then
    create trigger add_workspace_owner_trigger
    after insert on public.workspaces
    for each row execute procedure public.add_workspace_owner();
  end if;
end $$;

-- Workspace policies
create policy if not exists "Workspace members can view" on public.workspaces
  for select using (is_workspace_member(id));
create policy if not exists "Workspace members can update" on public.workspaces
  for update using (is_workspace_member(id));
create policy if not exists "Workspace creators can insert" on public.workspaces
  for insert with check (auth.uid() = created_by);

create policy if not exists "Members can view membership" on public.workspace_members
  for select using (auth.uid() = user_id or is_workspace_member(workspace_id));
create policy if not exists "Members can manage membership" on public.workspace_members
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

-- Matters and documents
create table if not exists public.matters (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  title text not null,
  status text not null default 'uploading',
  smf_detected boolean default false,
  smf_confidence numeric,
  jurisdiction text default 'WA',
  created_by uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.matters enable row level security;
create policy if not exists "Members view matters" on public.matters
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert matters" on public.matters
  for insert with check (is_workspace_member(workspace_id));
create policy if not exists "Members update matters" on public.matters
  for update using (is_workspace_member(workspace_id));

create table if not exists public.matter_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  filename text not null,
  storage_path text not null,
  kind text not null default 'unknown',
  uploaded_by uuid references auth.users on delete cascade,
  created_at timestamptz default now()
);
alter table public.matter_documents enable row level security;
create policy if not exists "Members view matter documents" on public.matter_documents
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members modify matter documents" on public.matter_documents
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

create table if not exists public.matter_document_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  matter_document_id uuid references public.matter_documents on delete cascade not null,
  page_number int not null default 1,
  storage_path text not null,
  created_at timestamptz default now()
);
alter table public.matter_document_pages enable row level security;
create policy if not exists "Members view document pages" on public.matter_document_pages
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members modify document pages" on public.matter_document_pages
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

create table if not exists public.extracted_pages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  matter_document_page_id uuid references public.matter_document_pages on delete cascade not null,
  text text,
  confidence numeric,
  is_smf boolean default false,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.extracted_pages enable row level security;
create policy if not exists "Members view extracted pages" on public.extracted_pages
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members modify extracted pages" on public.extracted_pages
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

create table if not exists public.charges (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  title text not null,
  act_section text,
  description text,
  confidence numeric,
  jurisdiction text,
  source_page_id uuid references public.extracted_pages,
  created_at timestamptz default now()
);
alter table public.charges enable row level security;
create policy if not exists "Members view charges" on public.charges
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members modify charges" on public.charges
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

create table if not exists public.analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  job_type text not null default 'initial_information',
  status text not null default 'pending',
  created_by uuid references auth.users on delete cascade,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz default now()
);
alter table public.analysis_jobs enable row level security;
create policy if not exists "Members view analysis jobs" on public.analysis_jobs
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members modify analysis jobs" on public.analysis_jobs
  for insert with check (is_workspace_member(workspace_id))
  using (is_workspace_member(workspace_id));

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  job_id uuid references public.analysis_jobs on delete cascade not null,
  payload jsonb not null,
  summary text,
  created_at timestamptz default now()
);
alter table public.analysis_results enable row level security;
create policy if not exists "Members view analysis results" on public.analysis_results
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert analysis results" on public.analysis_results
  for insert with check (is_workspace_member(workspace_id));

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  title text default 'Matter chat',
  created_by uuid references auth.users on delete cascade,
  created_at timestamptz default now()
);
alter table public.conversations enable row level security;
create policy if not exists "Members view conversations" on public.conversations
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert conversations" on public.conversations
  for insert with check (is_workspace_member(workspace_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  conversation_id uuid references public.conversations on delete cascade not null,
  role text not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.messages enable row level security;
create policy if not exists "Members view messages" on public.messages
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert messages" on public.messages
  for insert with check (is_workspace_member(workspace_id));

create table if not exists public.matter_exports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  matter_id uuid references public.matters on delete cascade not null,
  storage_path text not null,
  created_by uuid references auth.users on delete cascade,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.matter_exports enable row level security;
create policy if not exists "Members view matter exports" on public.matter_exports
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert matter exports" on public.matter_exports
  for insert with check (is_workspace_member(workspace_id));

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces on delete cascade not null,
  user_id uuid references auth.users on delete cascade,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.audit_logs enable row level security;
create policy if not exists "Members view audit logs" on public.audit_logs
  for select using (is_workspace_member(workspace_id));
create policy if not exists "Members insert audit logs" on public.audit_logs
  for insert with check (is_workspace_member(workspace_id));

-- Storage bucket scoped per workspace
insert into storage.buckets (id, name, public)
values ('workspace-files', 'workspace-files', false)
on conflict do nothing;

create policy if not exists "Members read workspace files" on storage.objects
  for select using (
    bucket_id = 'workspace-files'
    and exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id = split_part(object_name, '/', 1)::uuid
        and wm.user_id = auth.uid()
    )
  );
create policy if not exists "Members upload workspace files" on storage.objects
  for insert with check (
    bucket_id = 'workspace-files'
    and exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id = split_part(object_name, '/', 1)::uuid
        and wm.user_id = auth.uid()
    )
  );
create policy if not exists "Members update workspace files" on storage.objects
  for update using (
    bucket_id = 'workspace-files'
    and exists(
      select 1 from public.workspace_members wm
      where wm.workspace_id = split_part(object_name, '/', 1)::uuid
        and wm.user_id = auth.uid()
    )
  );
