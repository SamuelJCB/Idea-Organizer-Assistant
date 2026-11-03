-- Starting projects for Samuel's account.
-- Run once in the Supabase SQL editor AFTER signing in to the app the first time
-- (signing in creates the auth user these rows belong to).
-- It refuses to run unless exactly one user exists, so it can't attach the
-- projects to the wrong account.

do $$
declare
  owner uuid;
  user_count int;
begin
  select count(*) into user_count from auth.users;
  if user_count <> 1 then
    raise exception 'Expected exactly 1 user in auth.users, found %. Edit this script to pick the owner by email.', user_count;
  end if;

  select id into owner from auth.users limit 1;

  insert into public.projects (user_id, title, domain, status, notes) values
    (owner, 'SoleWalk', 'hardware product', 'active',
     'Under-desk walking pad with acupressure track.'),
    (owner, 'Questrom Honors Program A-board program-year planning', 'community', 'active', null),
    (owner, 'Presidents Club', 'community', 'active',
     'BU community for high-achieving students.'),
    (owner, 'Project Hub', 'software', 'active',
     'This app.'),
    (owner, 'Waterless dish cleaning system for camping', 'hardware product', 'raw', null),
    (owner, 'Wall-mounted retractable resistance band system', 'hardware product', 'raw', null),
    (owner, 'Pet grooming tool that captures hair at the source', 'hardware product', 'raw', null);
end;
$$;
