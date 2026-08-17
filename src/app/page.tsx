import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { STATUS_LABELS, TYPE_LABELS, type InitiativeStatus } from '@/lib/initiatives/types';
import { AppShell } from '@/components/app-shell';

const RISK_BADGE: Record<string, 'verde' | 'amarillo' | 'rojo'> = {
  GREEN: 'verde',
  AMBER: 'amarillo',
  RED: 'rojo',
};

export default async function Home() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: initiatives } = await supabase
    .from('initiatives')
    .select('code, title, type, status, risk_level, created_at')
    .order('created_at', { ascending: false });

  const rows = initiatives ?? [];
  const active = rows.filter((r) => r.status !== 'CLOSED' && r.status !== 'CANCELLED');
  const atRisk = active.filter((r) => r.risk_level === 'AMBER' || r.risk_level === 'RED');
  const pendingProposal = rows.filter((r) => r.status === 'PROPOSAL');

  return (
    <AppShell user={user} active="/">
      <div className="kpi-row">
        <div className="kpi">
          <div className="k-label">Iniciativas activas</div>
          <div className="k-value">{active.length}</div>
        </div>
        <div className={`kpi ${atRisk.length > 0 ? 'warn' : 'ok'}`}>
          <div className="k-label">En riesgo</div>
          <div className="k-value">{atRisk.length}</div>
        </div>
        <div className={`kpi ${pendingProposal.length > 0 ? 'warn' : ''}`}>
          <div className="k-label">En propuesta</div>
          <div className="k-value">{pendingProposal.length}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Iniciativas recientes</h2>
          <Link href="/iniciativas" className="link">
            Ver todas →
          </Link>
        </div>

        {rows.length === 0 ? (
          <p className="empty">Sin iniciativas todavía.</p>
        ) : (
          <div className="event-list">
            {rows.slice(0, 6).map((r) => (
              <Link
                key={r.code}
                href={`/iniciativas/${r.code}`}
                className="event-card"
                style={{ textDecoration: 'none' }}
              >
                <span className={`rail ${r.risk_level === 'RED' ? 'crit' : r.risk_level === 'AMBER' ? 'warn' : ''}`} />
                <span>
                  <span className="code">{r.code}</span>
                  <span className="title">{r.title}</span>
                  <span className="sub">
                    {TYPE_LABELS[r.type as keyof typeof TYPE_LABELS]} · {STATUS_LABELS[r.status as InitiativeStatus]}
                  </span>
                </span>
                <span className={`badge b-${RISK_BADGE[r.risk_level] ?? 'neutral'}`}>
                  {r.risk_level === 'GREEN' ? 'Verde' : r.risk_level === 'AMBER' ? 'Naranja' : 'Rojo'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <p className="empty" style={{ fontStyle: 'normal' }}>
          Sesión verificada de extremo a extremo: Supabase Auth → RLS → perfil de{' '}
          <code
            style={{
              fontFamily: 'var(--font-mono)',
              background: 'var(--surface-inset)',
              padding: '1px 5px',
              borderRadius: 3,
            }}
          >
            public.users
          </code>
          .
        </p>
      </div>
    </AppShell>
  );
}
