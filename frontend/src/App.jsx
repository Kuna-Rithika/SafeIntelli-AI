import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlarmClock, ArrowRight, BellRing, BrainCircuit, CheckCircle2,
  ChevronRight, CircleAlert, Download, Factory, FileCheck2, Flame, Gauge,
  MapPin, Moon, Pause, Play, Radio, RefreshCcw, ShieldAlert, ShieldCheck,
  Sun, UsersRound, Wrench, Zap
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const API_URL = "http://localhost:8000";

const fallbackZones = [
  { zone_id: "A", zone_name: "Boiler Deck", safety_score: 88, risk_level: "Safe", factor_risks: { gas: 18, permit: 4, activity: 28, equipment: 8, workers: 16 }, weights: { gas: .3, permit: .2, activity: .15, equipment: .25, workers: .1 }, compound_factors: [], explanation: "Demo mode: this zone is operating within normal limits.", recommendation: "Continue routine checks.", risk_reduction: 18, incident_report: "" },
  { zone_id: "B", zone_name: "Coke Oven Bay", safety_score: 63, risk_level: "Watch", factor_risks: { gas: 55, permit: 82, activity: 48, equipment: 46, workers: 25 }, weights: { gas: .3, permit: .2, activity: .15, equipment: .25, workers: .1 }, compound_factors: ["active hot-work permit", "gas concentration rising near threshold"], explanation: "Demo mode: two safety signals need attention.", recommendation: "Review the hot-work permit and gas readings.", risk_reduction: 35, incident_report: "" }
];

const signalCards = [
  { key: "gas", label: "Gas", detail: "Detects unsafe concentration", icon: Flame },
  { key: "permit", label: "Permit", detail: "Checks high-risk work approval", icon: FileCheck2 },
  { key: "activity", label: "Activity", detail: "Tracks task and crowd level", icon: Activity },
  { key: "equipment", label: "Equipment", detail: "Monitors asset health", icon: Wrench },
  { key: "workers", label: "Worker exposure", detail: "Counts people near danger", icon: UsersRound }
];

const scenarioStages = [
  { title: "Normal operations", text: "All monitored signals are within their normal operating range.", tone: "safe" },
  { title: "Early warning", text: "One signal begins to move outside its normal range.", tone: "watch" },
  { title: "Risk building", text: "A second signal adds context and the zone needs attention.", tone: "watch" },
  { title: "Compound risk detected", text: "Several signals now overlap in the same work area.", tone: "critical" },
  { title: "Critical condition", text: "The selected zone requires immediate action.", tone: "critical" },
  { title: "Critical condition maintained", text: "Keep controls in place while the incident is being managed.", tone: "critical" },
  { title: "Response in progress", text: "Continue monitoring the active zone and its safety controls.", tone: "critical" },
  { title: "Response verification", text: "Verify that workers, equipment, and readings are safe before closing the event.", tone: "critical" },
  { title: "Final safety check", text: "The report captures the current status and recommended action.", tone: "critical" },
  { title: "Demo complete", text: "Run the automatic demo again to load the next zone example.", tone: "safe" }
];

function createSiren() {
  let context, gain, timer, running = false, high = false;
  const oscillators = new Set();
  const setup = () => {
    if (context) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    gain = context.createGain();
    gain.gain.value = .0001;
    gain.connect(context.destination);
    return true;
  };
  const pulse = () => {
    if (!running || !context || !gain) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(high ? 920 : 620, now);
    high = !high;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(.14, now + .025);
    gain.gain.exponentialRampToValueAtTime(.0001, now + .29);
    oscillator.connect(gain);
    oscillators.add(oscillator);
    oscillator.onended = () => { oscillators.delete(oscillator); oscillator.disconnect(); };
    oscillator.start(now);
    oscillator.stop(now + .32);
    timer = window.setTimeout(pulse, 430);
  };
  return {
    async prime() { if (!setup()) return false; if (context.state === "suspended") await context.resume().catch(() => {}); return context.state === "running"; },
    start() { if (running || !setup() || context.state !== "running") return; running = true; high = false; pulse(); },
    stop() { running = false; window.clearTimeout(timer); oscillators.forEach((oscillator) => { try { oscillator.stop(); } catch {} }); oscillators.clear(); if (gain && context) gain.gain.setValueAtTime(.0001, context.currentTime); }
  };
}

const levelClass = (level) => level.toLowerCase();
const riskText = (score) => score >= 72 ? "Operating normally" : score >= 45 ? "Needs attention" : "Immediate action needed";

function buildSafetyReport(zone) {
  const factors = Object.entries(zone.factor_risks).map(([name, value]) => `- ${name}: ${value}/100`).join("\n");
  return `SAFEINTELLI AI — SAFETY REPORT\nGenerated: ${new Date().toLocaleString()}\n\nZone: ${zone.zone_name} (Zone ${zone.zone_id})\nStatus: ${zone.risk_level}\nSafety score: ${zone.safety_score}/100 (higher is safer)\n\nRISK INPUTS (0 = low risk, 100 = high risk)\n${factors}\n\nASSESSMENT\n${zone.explanation}\n\nRECOMMENDED ACTION\n${zone.recommendation}\n`;
}

function App() {
  const [page, setPage] = useState("home");
  const [theme, setTheme] = useState("dark");
  const [zones, setZones] = useState(fallbackZones);
  const [selectedId, setSelectedId] = useState(fallbackZones[0]?.zone_id || "A");
  const [timeline, setTimeline] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [simulationStep, setSimulationStep] = useState(0);
  const [demoIndex, setDemoIndex] = useState(0);
  const [alarmArmed, setAlarmArmed] = useState(true);
  const [phoneAlert, setPhoneAlert] = useState(null);
  const sirenRef = useRef(null);
  const lastCriticalIdRef = useRef(null);

  const selected = zones.find((zone) => zone.zone_id === selectedId) || zones[0];
  const criticalZone = zones.find((zone) => zone.risk_level === "Critical");
  const averageScore = Math.round(zones.reduce((sum, zone) => sum + zone.safety_score, 0) / zones.length);
  const reportText = selected ? (selected.incident_report || buildSafetyReport(selected)) : "";
  const factors = useMemo(() => selected ? Object.entries(selected.factor_risks).map(([key, value]) => ({ key, value, weight: Math.round((selected.weights?.[key] || 0) * 100) })) : [], [selected]);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { sirenRef.current = createSiren(); return () => sirenRef.current?.stop(); }, []);
  useEffect(() => { fetchZones(); }, []);
  useEffect(() => { if (selectedId) fetchTimeline(selectedId); }, [selectedId]);
  useEffect(() => {
    if (criticalZone) {
      if (alarmArmed) sirenRef.current?.start();
      else sirenRef.current?.stop();
      if (lastCriticalIdRef.current !== criticalZone.zone_id) {
        setPhoneAlert(criticalZone);
        if (alarmArmed) announceCritical(criticalZone);
      }
      lastCriticalIdRef.current = criticalZone.zone_id;
    } else {
      sirenRef.current?.stop();
      lastCriticalIdRef.current = null;
    }
  }, [criticalZone, alarmArmed]);
  useEffect(() => {
    if (!playing) return;
    if (simulationStep >= scenarioStages.length - 1) { setPlaying(false); return; }
    const timer = window.setTimeout(advance, 1600);
    return () => window.clearInterval(timer);
  }, [playing, simulationStep]);

  async function fetchZones() {
    try {
      const response = await fetch(`${API_URL}/zones`);
      if (!response.ok) throw new Error("API unavailable");
      const data = await response.json();
      setZones(data);
      if (!data.some((zone) => zone.zone_id === selectedId)) setSelectedId(data[0]?.zone_id);
    } catch { setZones(fallbackZones); }
  }
  async function fetchTimeline(zoneId) {
    try {
      const response = await fetch(`${API_URL}/zones/${zoneId}/timeline`);
      if (!response.ok) throw new Error("Timeline unavailable");
      setTimeline(await response.json());
    } catch { setTimeline([]); }
  }
  async function advance() {
    try {
      const response = await fetch(`${API_URL}/simulate`, { method: "POST" });
      if (!response.ok) throw new Error("Simulation unavailable");
      const data = await response.json();
      setZones(data.zones);
      setSimulationStep(data.step);
    } catch {
      setSimulationStep((step) => Math.min(step + 1, scenarioStages.length - 1));
      setZones((current) => current.map((zone) => zone.zone_id === selectedId ? { ...zone, safety_score: 36, risk_level: "Critical", compound_factors: ["gas concentration rising near threshold", "active hot-work permit", "overdue or faulty equipment", "workers close to hazard area"], explanation: "Several independent safety signals now overlap in this zone.", recommendation: "Stop high-risk work and move exposed workers to a safe area." } : zone));
    }
  }
  async function reset() {
    setPlaying(false); setPhoneAlert(null); sirenRef.current?.stop();
    await loadNextDemo();
  }
  function announceCritical(zone) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("SafeIntelli: critical safety alert", { body: `${zone.zone_name} is critical. No safe operating area is available—pause work and evacuate exposed workers.` });
    }
  }
  async function prepareEmergencyAlerts() {
    await sirenRef.current?.prime();
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission().catch(() => {});
    setAlarmArmed(true);
    if (criticalZone) announceCritical(criticalZone);
  }
  async function startScenario() {
    await prepareEmergencyAlerts();
    if (simulationStep >= scenarioStages.length - 1) {
      await loadNextDemo();
      return;
    }
    setPlaying((value) => !value);
  }
  async function loadNextDemo() {
    const nextDemo = (demoIndex + 1) % 3;
    try {
      const response = await fetch(`${API_URL}/simulate/demo/${nextDemo}`, { method: "POST" });
      if (!response.ok) throw new Error("Demo unavailable");
      const data = await response.json();
      setZones(data.zones);
      setSimulationStep(data.step);
      setSelectedId(data.zone_id);
      setDemoIndex(nextDemo);
      setPhoneAlert(null);
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }
  function openMonitor(zoneId = criticalZone?.zone_id || selectedId) { setSelectedId(zoneId); setPage("monitor"); }
  function exportReport() {
    const file = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file); const link = document.createElement("a");
    link.href = url; link.download = `SafeIntelli-zone-report.txt`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  }

  return (
    <div className="site-shell">
      <Nav page={page} setPage={setPage} theme={theme} setTheme={setTheme} />
      {page === "home" && <Home zones={zones} criticalZone={criticalZone} averageScore={averageScore} onMonitor={openMonitor} onLearn={() => setPage("how")} />}
      {page === "how" && <HowItWorks onMonitor={openMonitor} />}
      {page === "monitor" && <Monitor zones={zones} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} criticalZone={criticalZone} averageScore={averageScore} factors={factors} timeline={timeline} playing={playing} startScenario={startScenario} simulationStep={simulationStep} advance={advance} reset={reset} alarmArmed={alarmArmed} prepareEmergencyAlerts={prepareEmergencyAlerts} exportReport={exportReport} reportText={reportText} />}
      <PhoneAlert zone={phoneAlert} onClose={() => { setPhoneAlert(null); sirenRef.current?.stop(); }} />
    </div>
  );
}

function Nav({ page, setPage, theme, setTheme }) {
  return <header className="nav"><button className="logo" onClick={() => setPage("home")}><span><ShieldCheck size={20} /></span><b>Safe</b><span className="logo-light">Intelli</span></button><nav>{[["home", "Overview"], ["how", "How it works"], ["monitor", "Live monitor"]].map(([id, label]) => <button key={id} className={page === id ? "active" : ""} onClick={() => setPage(id)}>{label}</button>)}</nav><button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Toggle colour theme">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}</button></header>;
}

function Home({ zones, criticalZone, averageScore, onMonitor, onLearn }) {
  return <main>
    <section className="hero"><div className="hero-copy"><span className="live-pill"><i /> AI-powered industrial safety</span><h1>See danger <em>before</em> it becomes an incident.</h1><p>SafeIntelli connects five safety signals to reveal dangerous overlaps that one alarm alone could miss.</p><div className="hero-actions"><button className="button primary" onClick={() => onMonitor()}><Radio size={18} /> Open live monitor</button><button className="button secondary" onClick={onLearn}>See how it works <ArrowRight size={17} /></button></div><div className="hero-trust"><CheckCircle2 size={16} /> Built for early warning, clear decisions, and fast action.</div></div><HeroVisual zones={zones} criticalZone={criticalZone} averageScore={averageScore} onMonitor={onMonitor} /></section>
    <section className="story-strip"><div><strong>5</strong><span>signals connected</span></div><div><strong>{zones.length}</strong><span>areas monitored</span></div><div><strong>{criticalZone ? "1" : "0"}</strong><span>critical alerts now</span></div><div><strong>1</strong><span>clear next action</span></div></section>
    <section className="section intro"><div><span className="section-kicker">The problem</span><h2>Safety risks rarely arrive one at a time.</h2></div><p>A gas reading, a hot-work permit, weak equipment, and people nearby may each look manageable alone. SafeIntelli notices when they occur together—and tells the team what to do next.</p></section>
    <section className="section"><span className="section-kicker">The five signals</span><h2>One clear picture from the data that matters.</h2><div className="signal-grid">{signalCards.map(({ key, label, detail, icon: Icon }, index) => <article className="signal-card" key={key}><span className="signal-number">0{index + 1}</span><div className="signal-icon"><Icon size={22} /></div><h3>{label}</h3><p>{detail}</p></article>)}</div></section>
    <section className="cta-band"><div><span className="section-kicker">Ready to explore?</span><h2>Watch a safety event unfold.</h2><p>Run the guided simulation and see exactly why a zone turns critical.</p></div><button className="button light" onClick={() => onMonitor(criticalZone?.zone_id || zones[0]?.zone_id)}>{criticalZone ? "View live scenario" : "View current scenario"} <ArrowRight size={18} /></button></section>
  </main>;
}

function HeroVisual({ zones, criticalZone, averageScore, onMonitor }) {
  const focus = criticalZone || zones[0];
  return <div className="hero-visual"><div className="orb orb-one" /><div className="orb orb-two" /><div className="live-card"><div className="card-heading"><div><span className="mini-label">Facility pulse</span><strong>Live safety picture</strong></div><span className="online"><i /> LIVE</span></div><div className={`facility-status ${criticalZone ? "critical" : "safe"}`}><div className="status-icon">{criticalZone ? <CircleAlert size={25} /> : <ShieldCheck size={25} />}</div><div><span>{criticalZone ? "Needs immediate attention" : "Operating normally"}</span><strong>{criticalZone ? `${focus.zone_name} is critical` : `${averageScore}/100 average safety`}</strong></div></div><div className="signal-flow"><span><Flame size={15} /> Gas</span><ChevronRight size={15} /><span><FileCheck2 size={15} /> Permit</span><ChevronRight size={15} /><span><BrainCircuit size={16} /> AI</span></div><button className="card-link" onClick={() => onMonitor(focus.zone_id)}>Understand this alert <ArrowRight size={16} /></button></div></div>;
}

function HowItWorks({ onMonitor }) {
  const steps = [{ icon: Radio, title: "Collect", text: "Five signals arrive from each work zone." }, { icon: BrainCircuit, title: "Connect", text: "The fusion agent creates one safety picture." }, { icon: Gauge, title: "Explain", text: "AI scores the overlap and identifies the cause." }, { icon: BellRing, title: "Act", text: "Teams receive a clear, practical response." }];
  return <main className="page-main"><section className="page-hero centered"><span className="section-kicker">How SafeIntelli works</span><h1>From scattered signals to one confident safety decision.</h1><p>Not another dashboard full of numbers. A simple path from what is happening to what the team should do.</p></section><section className="process">{steps.map(({ icon: Icon, title, text }, index) => <article key={title}><span>0{index + 1}</span><div><Icon size={28} /></div><h3>{title}</h3><p>{text}</p>{index < steps.length - 1 && <ChevronRight className="process-arrow" />}</article>)}</section><section className="explain-panel"><div><span className="section-kicker">What makes a zone critical?</span><h2>It is the overlap, not just one number.</h2><p>If gas rises near a hot-work permit while equipment is overdue and workers are close by, SafeIntelli raises the alert. A high safety score is good; a low score needs attention.</p><button className="button primary" onClick={() => onMonitor()}>See a real example <ArrowRight size={17} /></button></div><div className="overlap-visual"><div className="overlap gas">Gas</div><div className="overlap permit">Hot work</div><div className="overlap equipment">Equipment</div><div className="overlap workers">Workers</div><div className="overlap-center"><ShieldAlert size={22} /> Compound<br />risk</div></div></section><section className="score-guide"><div><Gauge size={30} /><h3>Safety score</h3><p>A simple 0–100 guide. Higher means safer.</p></div><div className="score-scale"><span className="safe-scale">72–100<br /><b>Safe</b></span><span className="watch-scale">45–71<br /><b>Watch</b></span><span className="critical-scale">0–44<br /><b>Critical</b></span></div></section></main>;
}

function LegacyMonitor({ zones, selected, selectedId, setSelectedId, criticalZone, averageScore, factors, timeline, playing, setPlaying, simulationStep, advance, reset, alarmArmed, toggleAlarm, exportReport, reportText }) {
  // Show only readings that have occurred in the current demo, not future data.
  timeline = timeline.filter((point) => point.step <= simulationStep);
  return <main className="page-main monitor"><section className="monitor-heading"><div><span className="section-kicker">Live safety monitor</span><h1>What needs attention right now?</h1><p>Choose a zone below. We will show its safety picture, why it has that status, and the next best action.</p></div><div className="monitor-actions"><button className={`alarm-button ${alarmArmed ? "armed" : ""}`} onClick={toggleAlarm}><AlarmClock size={17} /> {alarmArmed ? "Emergency alerts on" : "Enable emergency alerts"}</button><button className="button secondary compact" onClick={reset}><RefreshCcw size={16} /> Restart demo</button></div></section><section className={`alert-banner ${criticalZone ? "critical" : "safe"}`}><div>{criticalZone ? <CircleAlert size={25} /> : <ShieldCheck size={25} />}</div><div><span>{criticalZone ? "Critical situation detected" : "Facility operating normally"}</span><strong>{criticalZone ? `${criticalZone.zone_name} needs immediate action. Open it to understand why.` : "No zones require immediate action."}</strong></div>{criticalZone && <button onClick={() => setSelectedId(criticalZone.zone_id)}>View critical zone <ArrowRight size={16} /></button>}</section><section className="scenario-guide"><div className="scenario-intro"><span className="section-kicker">Guided safety story · Stage {simulationStep + 1}</span><h2>{playing ? "The scenario is running" : "Watch the safety risk build"}</h2><p>{playing ? `Every 1.6 seconds the demo moves to the next moment. Watch ${selected.zone_name}: safe conditions may shift into a warning and then a compound critical risk.` : "Start the guided scenario to automatically move through the demo stages. Or use “Move one stage” to explain it at your own pace."}</p></div><div className="scenario-actions"><button className="button primary" onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? "Pause story" : "Start guided scenario"}</button><button className="button secondary compact" onClick={advance}><ChevronRight size={16} /> Move one stage</button></div></section><section className="zone-section"><div className="section-title-row"><div><span className="section-kicker">Choose an area</span><h2>{zones.length} zones being monitored</h2></div><span className="average-chip"><Gauge size={16} /> Facility score {averageScore}</span></div><div className="zone-grid">{zones.map((zone) => <button key={zone.zone_id} className={`zone-tile ${levelClass(zone.risk_level)} ${zone.zone_id === selectedId ? "selected" : ""}`} onClick={() => setSelectedId(zone.zone_id)}><span className="zone-id">Zone {zone.zone_id}</span><strong>{zone.zone_name}</strong><div><span className="zone-state">{zone.risk_level}</span><b>{zone.safety_score}</b></div></button>)}</div></section><section className="focus-grid"><article className="focus-card"><div className="focus-title"><div><span className="section-kicker">Selected area</span><h2><MapPin size={20} /> {selected.zone_name}</h2></div><span className={`status-tag ${levelClass(selected.risk_level)}`}>{selected.risk_level}</span></div><div className="score-hero"><div><span>Safety score</span><strong>{selected.safety_score}<small>/100</small></strong></div><p>{riskText(selected.safety_score)}<br /><small>Higher safety score = safer zone</small></p></div><p className="plain-explanation">{selected.explanation}</p><h3>What is influencing this score?</h3><div className="factor-stack">{factors.map(({ key, value, weight }) => <div className="factor" key={key}><div><span>{signalCards.find((item) => item.key === key)?.label || key}</span><small>{weight}% influence</small></div><div className="risk-meter"><i style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}</div></article><article className="action-card"><div className="focus-title"><div><span className="section-kicker">Recommended next step</span><h2><ShieldAlert size={20} /> Make the safe choice</h2></div></div><p>{selected.recommendation}</p><div className="action-check"><CheckCircle2 size={18} /> {selected.risk_level === "Critical" ? "Escalate to the shift safety officer now." : "Keep monitoring; act if the status changes."}</div><button className="button primary full" onClick={exportReport}><Download size={17} /> Download safety report</button><small className="report-note">Downloads a report for {selected.zone_name}, including its current readings and recommended action.</small></article></section><section className="timeline-card"><div><span className="section-kicker">What happened over time?</span><h2>Safety trend for {selected.zone_name}</h2><p>The orange line is safety score: when it falls, the zone is becoming less safe. The other lines show the risk signals that caused it.</p></div><ResponsiveContainer width="100%" height={310}><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" /><XAxis dataKey="step" stroke="var(--muted)" /><YAxis domain={[0, 100]} stroke="var(--muted)" /><Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }} /><Legend /><Line type="monotone" name="Safety score" dataKey="safety_score" stroke="var(--accent)" strokeWidth={3} dot={false} /><Line type="monotone" name="Gas risk" dataKey="gas" stroke="#ff7760" strokeWidth={2} dot={false} /><Line type="monotone" name="Equipment risk" dataKey="equipment" stroke="#b79aff" strokeWidth={2} dot={false} /><Line type="monotone" name="Worker exposure" dataKey="workers" stroke="#41c9c3" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></section></main>;
}

function Monitor({ zones, selected, selectedId, setSelectedId, criticalZone, averageScore, factors, timeline, playing, startScenario, simulationStep, advance, reset, alarmArmed, prepareEmergencyAlerts, exportReport, reportText }) {
  const stage = scenarioStages[simulationStep] || scenarioStages[0];
  const isLastStage = false;
  return <div className="monitor-enhanced"><main className="page-main monitor scenario-header"><section className="monitor-heading"><div><span className="section-kicker">Live safety monitor</span><h1>What needs attention right now?</h1><p>Critical alerts are automatic once this device has been activated.</p></div><div className="monitor-actions"><button className={`alarm-button ${alarmArmed ? "armed" : ""}`} onClick={prepareEmergencyAlerts}><AlarmClock size={17} /> Critical alerts active</button><button className="button secondary compact" onClick={reset}><RefreshCcw size={16} /> Restart demo</button></div></section><section className="scenario-guide enhanced"><div className="scenario-intro"><span className="section-kicker">Guided safety scenario · Step {simulationStep + 1} of {scenarioStages.length}</span><h2>{stage.title}</h2><p>{stage.text}</p><div className="scenario-progress">{scenarioStages.map((item, index) => <i key={`${item.title}-${index}`} className={index <= simulationStep ? item.tone : ""} />)}</div></div><div className="scenario-actions"><button className="button primary" onClick={startScenario} disabled={isLastStage}>{playing ? <Pause size={17} /> : <Play size={17} />}{playing ? "Pause automatic demo" : isLastStage ? "Demo complete" : "Run automatic demo"}</button><button className="button secondary compact" onClick={advance} disabled={isLastStage}><ChevronRight size={16} /> {isLastStage ? "Final step reached" : "Show next step"}</button><small>Automatic mode advances every 1.6 seconds. Use the next-step button to inspect each change.</small></div></section></main><LegacyMonitor zones={zones} selected={selected} selectedId={selectedId} setSelectedId={setSelectedId} criticalZone={criticalZone} averageScore={averageScore} factors={factors} timeline={timeline} playing={playing} setPlaying={startScenario} simulationStep={simulationStep} advance={advance} reset={reset} alarmArmed={alarmArmed} toggleAlarm={prepareEmergencyAlerts} exportReport={exportReport} reportText={reportText} /></div>;
}

function LiveSafetyReport({ zone, factors }) {
  return <section className="live-safety-report"><div className="report-heading"><div><span className="section-kicker">Live safety report</span><h2>{zone.zone_name} · Zone {zone.zone_id}</h2><p>This report updates whenever you choose a different zone.</p></div><span className={`status-tag ${levelClass(zone.risk_level)}`}>{zone.risk_level}</span></div><div className="report-summary"><div><span>Current safety score</span><strong>{zone.safety_score}<small>/100</small></strong></div><p>{zone.explanation}</p></div><div className="report-factors"><h3>Key signals right now</h3>{[...factors].sort((a, b) => b.value - a.value).slice(0, 3).map(({ key, value }) => <span key={key}>{signalCards.find((item) => item.key === key)?.label || key}: <b>{value}/100</b></span>)}</div><div className={`immediate-action ${levelClass(zone.risk_level)}`}><ShieldAlert size={23} /><div><span>Immediate action</span><strong>{zone.recommendation}</strong></div></div></section>;
}

function PhoneAlert({ zone, onClose }) { return <aside className={`phone-alert ${zone ? "show" : ""}`}><div className="phone-card"><BellRing size={20} /><div><strong>Safety alert</strong><p>{zone ? `${zone.zone_name} is critical. No safe operating area is available—pause work and evacuate exposed workers.` : ""}</p></div><button onClick={onClose}>Acknowledge</button></div></aside>; }

export default App;
