-- Preview: show some profiles that currently have NULL email and the auth.email to be copied
SELECT p.id, p.email as profiles_email, u.email as auth_email
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE p.email IS NULL
LIMIT 20;

-- Backfill: copy email from auth.users into profiles.email where missing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Verify how many rows were updated
SELECT count(*) FROM public.profiles WHERE email IS NOT NULL;
