import { Activity, BarChart3, Calculator, CircleHelp, FileText, Gauge, Menu, Table2, X } from "lucide-react";
import { NavLink, Outlet, Link, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { useArtifacts } from "../context";
import { compact } from "../format";

const groups = [
  {
    label: "Workspace",
    links: [
      { to: "/", label: "Overview", detail: "Release summary", icon: Gauge, end: true },
      { to: "/calculator", label: "Decision calculator", detail: "Price a game state", icon: Calculator },
      { to: "/map", label: "Decision map", detail: "Find the boundary", icon: BarChart3 },
    ],
  },
  {
    label: "Evidence",
    links: [
      { to: "/teams", label: "Team behavior", detail: "Observed vs model", icon: Table2 },
      { to: "/quarterbacks", label: "QB value", detail: "Efficiency by spend", icon: CircleHelp },
      { to: "/decisions", label: "Decision explorer", detail: "Audit the rows", icon: Activity },
    ],
  },
];

const pageNames: Record<string, string> = {
  "/": "Overview",
  "/calculator": "Decision calculator",
  "/map": "Decision map",
  "/teams": "Team behavior",
  "/quarterbacks": "QB value",
  "/decisions": "Decision explorer",
  "/methods": "Methods & sources",
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches);
  const { report } = useArtifacts();
  const location = useLocation();
  const currentPage = pageNames[location.pathname] ?? "Workspace";
  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <div className="app-shell">
      <aside className={open ? "sidebar is-open" : "sidebar"} aria-hidden={isMobile && !open} inert={isMobile && !open ? true : undefined}>
        <div className="sidebar-head">
          <Link to="/" className="wordmark" onClick={() => setOpen(false)}>
            <span className="wordmark-mark"><span /></span>
            <span>Future<span>Scout</span></span>
          </Link>
          <span className="release-chip">R01</span>
        </div>
        <div className="sidebar-context">
          <span className="status-light" />
          <div><strong>Verified release</strong><span>{report.dataset.seasons[0]}-{report.dataset.seasons.at(-1)} regular season</span></div>
        </div>
        <nav id="primary-navigation" className="sidebar-nav" aria-label="Primary navigation">
          {groups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-group-label">{group.label}</span>
            {group.links.map(({ to, label, detail, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <Icon size={16} strokeWidth={1.8} /><span><b>{label}</b><small>{detail}</small></span>
            </NavLink>)}
          </div>)}
          <div className="nav-group nav-group-last">
            <span className="nav-group-label">Documentation</span>
            <NavLink to="/methods" end onClick={() => setOpen(false)} className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}>
              <FileText size={16} strokeWidth={1.8} /><span><b>Methods &amp; sources</b><small>Audit the release</small></span>
            </NavLink>
          </div>
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-stat"><span>FOURTH-DOWN ROWS</span><strong>{compact(report.dataset.fourth_downs)}</strong></div>
          <Link to="/calculator" className="sidebar-cta" onClick={() => setOpen(false)}>Open calculator <span>↗</span></Link>
        </div>
      </aside>
      {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left"><button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation" aria-expanded={open} aria-controls="primary-navigation">{open ? <X size={18} /> : <Menu size={18} />}</button><span className="breadcrumb-root">FUTURESCOUT</span><span className="breadcrumb-separator">/</span><span>{currentPage}</span></div>
          <div className="topbar-right"><span className="topbar-note">{compact(report.dataset.clean_plays)} clean plays</span><Link to="/methods" className="topbar-link">Release notes <span>↗</span></Link></div>
        </header>
        <main className="page-frame"><Outlet /></main>
        <footer className="site-footer"><span>FUTURESCOUT / RESEARCH RELEASE 01</span><span>Observed data, modeled counterfactuals, explicit limits.</span></footer>
      </div>
    </div>
  );
}
