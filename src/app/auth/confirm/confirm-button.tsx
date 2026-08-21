'use client';

import { useFormStatus } from 'react-dom';

/**
 * `useFormStatus` funciona dentro de un <form action={serverAction}> sin
 * necesitar convertir toda la página a Client Component. Sin esto, un
 * doble clic/doble tap mandaba dos submits: el primero gastaba el token
 * de un solo uso con éxito, el segundo llegaba después y fallaba —
 * mandando a la persona a /login justo después de haber definido su
 * contraseña. Ver D19 en decisiones-tecnicas.md.
 */
export function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
    >
      {pending ? 'Confirmando…' : 'Continuar'}
    </button>
  );
}
