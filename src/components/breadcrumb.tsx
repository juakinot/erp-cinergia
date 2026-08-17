import Link from 'next/link';

export function Breadcrumb({
  backHref,
  backLabel,
  code,
  status,
  statusVariant = 'neutral',
}: {
  backHref: string;
  backLabel: string;
  code?: string;
  status?: string;
  statusVariant?: 'verde' | 'amarillo' | 'rojo' | 'info' | 'neutral';
}) {
  return (
    <div className="breadcrumb">
      <Link href={backHref}>← {backLabel}</Link>
      {code && <span className="code">{code}</span>}
      {status && <span className={`status badge b-${statusVariant}`}>{status}</span>}
    </div>
  );
}
