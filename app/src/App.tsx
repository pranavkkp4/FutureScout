import { HashRouter, Link, Route, Routes } from "react-router";
import { ArtifactGate, ArtifactProvider } from "./context";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Calculator from "./pages/Calculator";
import DecisionMap from "./pages/DecisionMap";
import Teams from "./pages/Teams";
import Quarterbacks from "./pages/Quarterbacks";
import Decisions from "./pages/Decisions";
import Methods from "./pages/Methods";
import "./styles.css";

function NotFound() {
  return <div className="panel"><p className="eyebrow">404 / route not found</p><h1>This workspace route does not exist.</h1><Link className="button button-primary" to="/">Return to overview</Link></div>;
}

export default function App() {
  return <ArtifactProvider><ArtifactGate><HashRouter><Routes><Route element={<Layout />}><Route path="/" element={<Home />} /><Route path="/calculator" element={<Calculator />} /><Route path="/map" element={<DecisionMap />} /><Route path="/teams" element={<Teams />} /><Route path="/quarterbacks" element={<Quarterbacks />} /><Route path="/decisions" element={<Decisions />} /><Route path="/methods" element={<Methods />} /><Route path="*" element={<NotFound />} /></Route></Routes></HashRouter></ArtifactGate></ArtifactProvider>;
}
