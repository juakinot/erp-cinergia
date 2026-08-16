-- AlterTable + trigger: `updated_at` real, no solo de Prisma Client
--
-- Mismo problema que D10 con el id, pero para @updatedAt: Prisma lo calcula
-- en el cliente en cada UPDATE que pasa por Prisma Client. Un insert/update
-- vía supabase-js no tiene ese comportamiento — necesita tanto un DEFAULT
-- (para el valor inicial) como un TRIGGER (para que seguir actualizándose
-- en cada UPDATE, que es la promesa real de @updatedAt).

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'actas', 'app_settings', 'calendar_items', 'ideas', 'improvement_proposals',
      'initiative_inputs', 'initiative_risks', 'initiatives', 'logistics_items',
      'observations', 'surveys', 'tasks', 'users'
    ])
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN "updated_at" SET DEFAULT now()', t);
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I; ' ||
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I ' ||
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;
