import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router";

export function SectionHead({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="section-head"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{children}</div>;
}

export function Metric({ label, value, detail, accent = false }: { label: string; value: string; detail: string; accent?: boolean }) {
  return <div className={accent ? "metric-card accent" : "metric-card"}><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>;
}

export function ActionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="action-link" to={to}>{children}<ArrowUpRight size={16} /></Link>;
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "green" | "orange" | "blue" | "alert" }) {
  return <span className={`tag tag-${tone}`}>{children}</span>;
}

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><span className="eyebrow">Module unavailable</span><strong>{title}</strong><p>{detail}</p></div>;
}

export function LoadingSkeleton({ rows = 3 }: { rows?: number }) {
  return <div className="skeleton-stack" aria-label="Loading"><span className="skeleton-line wide" /><span className="skeleton-line" />{Array.from({ length: rows }, (_, index) => <span className="skeleton-line" key={index} />)}</div>;
}
