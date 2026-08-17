import { getCurrentUser } from '@/lib/auth';
import CompleteRegistrationForm from './complete-registration-form';

export default async function CompleteRegistrationPage() {
  const user = await getCurrentUser();

  if (!user) {
    // En la práctica el middleware ya redirige a /login antes de llegar
    // aquí si no hay sesión — esto es una segunda capa por si acaso.
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4">
        <div className="w-full max-w-sm rounded-lg border border-[#E8EEF5] bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-[#003360]">Enlace inválido o vencido</h1>
          <p className="mt-2 text-sm text-[#5A6B82]">
            Pide a Presidencia que te reenvíe la invitación desde &ldquo;Usuarios&rdquo;.
          </p>
        </div>
      </main>
    );
  }

  return <CompleteRegistrationForm fullName={user.fullName} />;
}
