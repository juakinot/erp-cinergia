import { confirmInvite } from './actions';
import { ConfirmButton } from './confirm-button';

/**
 * Punto de entrada único para todo enlace de correo/invitación de Supabase
 * Auth (invitación, recuperación de contraseña, confirmación de correo).
 * A propósito NO verifica el token en el GET de esta página — solo lo
 * hace el Server Action `confirmInvite`, que requiere un clic real. Ver
 * D14 en decisiones-tecnicas.md.
 */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : '';
  const type = typeof params.type === 'string' ? params.type : '';
  const code = typeof params.code === 'string' ? params.code : '';
  const next = typeof params.next === 'string' ? params.next : '/completar-registro';

  const hasToken = (tokenHash && type) || code;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-4">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-[var(--surface-panel)] p-8 text-center shadow-sm">
        <p className="font-mono text-xs tracking-[0.14em] text-[var(--text-2)] uppercase">CINERGIA · ERP</p>

        {hasToken ? (
          <>
            <h1 className="mt-2 text-lg font-bold text-[var(--text-1)]">Confirmar invitación</h1>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Haz clic para continuar y elegir tu contraseña.
            </p>
            <form action={confirmInvite} className="mt-6">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="code" value={code} />
              <input type="hidden" name="next" value={next} />
              <ConfirmButton />
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-lg font-bold text-[var(--text-1)]">Enlace inválido</h1>
            <p className="mt-2 text-sm text-[var(--text-2)]">
              Pide a Presidencia que te comparta la invitación de nuevo.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
