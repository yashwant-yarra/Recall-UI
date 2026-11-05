"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { BUSINESS, inr, PLAN_LIMITS, PRICES, TRIAL_DAYS } from "@/lib/legal";
import { LegalLinks } from "./LegalLinks";
import { StatusMark } from "./Library";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

// Each answer language written in its own script, keyed by the API's names.
const NATIVE: Record<(typeof LANGUAGES)[number], [string, string]> = {
  English: ["English", "en"], Hindi: ["हिन्दी", "hi"], Telugu: ["తెలుగు", "te"], Tamil: ["தமிழ்", "ta"],
  Kannada: ["ಕನ್ನಡ", "kn"], Malayalam: ["മലയാളം", "ml"], Marathi: ["मराठी", "mr"], Bengali: ["বাংলা", "bn"],
  Gujarati: ["ગુજરાતી", "gu"], Punjabi: ["ਪੰਜਾਬੀ", "pa"], Urdu: ["اردو", "ur"], Odia: ["ଓଡ଼ିଆ", "or"],
};

// The limits a student weighs first; /pricing lists them all.
const KEY_LIMITS = ["Questions", "Uploads", "Live voice tutor", "Agent runs"];

/** A citation number: lights its source while pointed at, focused or tapped. */
function Cite({ n, lit, setLit }: { n: number; lit: number | null; setLit: (n: number | null) => void }) {
  return (
    <sup>
      <button type="button" aria-label={`Source ${n}`} aria-pressed={lit === n}
              onMouseEnter={() => setLit(n)} onMouseLeave={() => setLit(null)} onFocus={() => setLit(n)} onBlur={() => setLit(null)}
              onClick={() => setLit(n)}
              className={`hl hl-solid hl-n${n} home-cite`}>{n}</button>
    </sup>
  );
}

/** The hero: a sample answer from Explain mode, with its sources in the ruled margin. */
function AnswerSample() {
  const [lit, setLit] = useState<number | null>(null);
  const sources = [
    [1, "biology-ch6.pdf, p. 112"],
    [2, "Voice note: plants revision"],
  ] as const;
  return (
    <figure className="sheet home-answer" data-slot="hero-answer">
      <div className="home-answer-body">
        <p className="home-answer-mode"><span className="current">Explain</span><span className="text-muted">Quick answer</span></p>
        <p className="home-question">Why do leaves look green?</p>
        <p className="home-reading">
          <span className="hl-quiet hl-n1" data-on={lit === 1}>Chlorophyll absorbs red and blue light and reflects green, so green is the colour that reaches your eye.</span>
          <Cite n={1} lit={lit} setLit={setLit} />{" "}
          <span className="hl-quiet hl-n2" data-on={lit === 2}>In autumn it breaks down and the yellow pigments show through.</span>
          <Cite n={2} lit={lit} setLit={setLit} />
        </p>
        <p className="home-beyond"><span className="label">Beyond your document</span> Pond algae look green for the same reason.</p>
      </div>
      <figcaption className="home-answer-margin">
        <span className="label">Sources</span>
        {sources.map(([n, name]) => (
          <span key={n} className="home-source" data-dim={lit !== null && lit !== n}>
            <span className={`hl hl-n${n}`} data-on={lit === n}><b>{n}</b> {name}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function LibraryVisual() {
  const rows = [
    ["ready", "physics-notes.pdf", "PDF", "ready"],
    ["ready", "Lecture 12", "Voice note", "ready"],
    ["processing", "chemistry-ch4.pdf", "PDF", "processing"],
    ["pending", "history-scan.pdf", "PDF, scanned", "pending"],
  ] as const;
  return (
    <ul className="home-files">
      {rows.map(([status, name, kind, word]) => (
        <li key={name}>
          <StatusMark status={status} />
          <span className="font-semibold">{name}</span>
          <span className="text-muted">{kind}</span>
          <span className={`label ${status === "ready" ? "!text-ok" : status === "processing" ? "!text-warn" : ""}`}>{word}</span>
        </li>
      ))}
    </ul>
  );
}

function TalkVisual() {
  return (
    <div className="home-talk">
      <span className="home-mic" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5Z M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3" /></svg>
      </span>
      <div className="home-captions">
        <p><span className="label">You</span> <span className="text-accent">What is a redox reaction?</span></p>
        <p><span className="label">Tutor</span> One substance loses electrons and another gains them, at the same time.<sup className="hl hl-solid hl-n3 home-cite">1</sup></p>
      </div>
    </div>
  );
}

function QuizVisual() {
  return (
    <div className="home-quiz">
      <div className="home-quiz-head">
        <p className="label">Question 2 of 5</p>
        <p className="chapter text-danger" aria-label="Score: 4 out of 5">4/5</p>
      </div>
      <p className="home-question !text-fg">Which gas do plants release in photosynthesis?</p>
      <ul className="home-options">
        <li className="text-accent"><span className="struck">Carbon dioxide</span> <span className="label !text-danger">your answer</span></li>
        <li><span className="hl hl-solid hl-n2">Oxygen</span> <span className="label !text-ok">correct</span></li>
        <li className="text-muted">Nitrogen</li>
      </ul>
    </div>
  );
}

function AgentVisual() {
  return (
    <div className="home-agent">
      <p className="home-question">Make a task for every action item in my latest voice note</p>
      <ol className="home-steps">
        <li><span>Read the voice note Lecture 12</span><span className="label !text-ok">done</span></li>
        <li><span>Found 3 action items</span><span className="label !text-ok">done</span></li>
        <li><span><span className="hl hl-solid hl-n4">Create 3 tasks?</span></span><span className="label !text-warn">waiting for you</span></li>
      </ol>
      <p className="home-approve" aria-hidden="true"><span className="btn-primary">Approve</span><span className="btn">Reject</span></p>
    </div>
  );
}

const TOUR = [
  { title: "Bring your material", text: "Upload PDF, DOCX, TXT or audio, or record a voice note in the app. Scanned PDFs are read too.", Visual: LibraryVisual },
  { title: "Talk it through", text: "A voice tutor answers out loud from your documents, with captions and sources on screen. Part of Pro.", Visual: TalkVisual },
  { title: "Test yourself", text: "A quiz written from one document. Answers stay hidden until it is graded, then each wrong one is struck in red.", Visual: QuizVisual },
  { title: "Hand it a goal", text: "The agent searches your material and plans the steps, then asks before it saves a task or a draft.", Visual: AgentVisual },
];

/** Pinned run: the visual holds still on wide screens while the four panels scroll past it. */
function Tour() {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);
  useEffect(() => {
    const seen = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    panels.current.forEach((p) => p && seen.observe(p));
    return () => seen.disconnect();
  }, []);
  return (
    <section id="tour" className="home-tour" aria-labelledby="tour-head">
      <div className="home-container">
        <h2 id="tour-head" className="home-h2">Upload once, study four ways</h2>
        <div className="home-tour-grid">
          <div className="home-stage" aria-hidden="true">
            {TOUR.map(({ title, Visual }, i) => (
              <div key={title} className="sheet home-stage-item" data-active={active === i}><Visual /></div>
            ))}
          </div>
          <ol className="home-panels">
            {TOUR.map(({ title, text, Visual }, i) => (
              <li key={title} className="home-panel" data-active={active === i}>
                {/* Observed for the pinned visual: the copy, not the tall panel, decides which one is current. */}
                <div data-i={i} ref={(el) => { panels.current[i] = el; }}>
                  <h3 className="home-h3">{title}</h3>
                  <p className="home-panel-text">{text}</p>
                </div>
                <div className="sheet home-panel-fig"><Visual /></div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function Home() {
  return (
    <>
      {/* Masthead: the wordmark centred over a 2px ink rule, like a book's running head. */}
      <header className="home-nav">
        <div className="home-container home-nav-row">
          <nav aria-label="Home" className="home-nav-links">
            <a href="#tour">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <Link href="/" className="home-mast" aria-label="Recall home"><Logo /></Link>
          <div className="home-nav-actions">
            <ThemeToggle compact />
            <Link href="/login" className="btn home-hide-sm">Sign in</Link>
            <Link href="/signup" className="btn-primary">Start free</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-container home-hero-grid">
            <div className="home-hero-text">
              <h1 className="home-display">Study from <span className="hl hl-solid hl-n1">your own pages.</span></h1>
              <p className="home-lead">Ask a doubt and open the exact page each answer came from.</p>
              <div className="home-actions">
                <Link href="/signup" className="btn-primary home-cta">Start free</Link>
                <Link href="/login" className="btn home-cta">Sign in</Link>
              </div>
              <p className="home-terms">Free plan, no card needed. Try Pro free for {TRIAL_DAYS} days, once.</p>
            </div>
            <AnswerSample />
          </div>
        </section>

        <Tour />

        <section className="home-langs" aria-labelledby="langs-head">
          <div className="home-container">
            <h2 id="langs-head" className="home-h2">Answers in your language</h2>
            <p className="home-lead">English and eleven Indian languages.</p>
            <ul className="home-lang-run">
              {LANGUAGES.map((l) => {
                const [native, code] = NATIVE[l];
                return <li key={l} lang={code} dir={code === "ur" ? "rtl" : undefined} title={l}>{native}</li>;
              })}
            </ul>
          </div>
        </section>

        <section id="pricing" className="home-pricing" aria-labelledby="pricing-head">
          <div className="home-container home-pricing-grid">
            <div>
              <h2 id="pricing-head" className="home-h2">Pricing</h2>
              <p className="home-lead">Buy a 30-day pass when you need more. Nothing renews or charges you automatically.</p>
              <Link href="/pricing" className="home-more">Every limit, and how billing works</Link>
            </div>
            <div className="sheet home-table-wrap">
              <table className="home-table">
                <caption className="sr-only">Plans and their weekly limits</caption>
                <thead>
                  <tr>
                    <td className="label">Per week</td>
                    <th scope="col">Free<span>₹0</span></th>
                    <th scope="col">Pro<span>{inr(PRICES.pro)}</span></th>
                    <th scope="col">Ultra<span>{inr(PRICES.ultra)}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {PLAN_LIMITS.filter((r) => KEY_LIMITS.includes(r.name)).map((r) => (
                    <tr key={r.name}>
                      <th scope="row">{r.name}</th>
                      <td className="text-muted">{r.free}</td>
                      <td>{r.pro}</td>
                      <td>{r.ultra}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="home-close">
          <div className="home-container home-close-row">
            <h2 className="home-h2">Start with one chapter</h2>
            <div className="home-actions">
              <Link href="/signup" className="btn-primary home-cta">Start free</Link>
              <Link href="/login" className="btn home-cta">Sign in</Link>
            </div>
          </div>
        </section>
      </main>

      {/* Mast footer: the wordmark large over the real links. */}
      <footer className="home-foot">
        <div className="home-container">
          <p className="home-foot-mark" aria-hidden="true">Recall</p>
          <LegalLinks className="mt-6" />
          <p className="mt-4 text-sm text-muted">
            {BUSINESS.product} is one of the things {BUSINESS.operator} makes.{" "}
            <a href="https://novatomica.studio/" target="_blank" rel="noopener noreferrer"
               className="font-semibold text-fg underline underline-offset-4 hover:text-accent">See the rest of the studio&apos;s projects</a>
          </p>
        </div>
      </footer>
    </>
  );
}
