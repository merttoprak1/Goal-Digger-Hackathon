import { useEffect, useState, type FormEvent } from 'react';
import { createChallenge, listChallenges } from './api';
import { WAKE_UP_PROOF, type Challenge } from '../shared/contracts';

function localDate(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function initialTimes() {
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setHours(7, 0, 0, 0);
  return {
    startsAt: localDate(start),
    bettingClosesAt: localDate(new Date(start.getTime() - 60 * 60_000)),
    proofDeadline: localDate(new Date(start.getTime() + 5 * 60_000)),
  };
}

export function App() {
  const [times, setTimes] = useState(initialTimes);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let active = true;
    listChallenges().then(({ challenges }) => { if (active) setChallenges(challenges); })
      .catch(() => { if (active) setError('Could not load challenges. Check that the API is running.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError('');
    try {
      const { challenge } = await createChallenge({
        template: 'wake_up', creatorName: String(form.get('creatorName')).trim(),
        title: String(form.get('title')).trim(), requestedStakeUsdt: String(form.get('stake')).trim(), timezone,
        startsAt: new Date(times.startsAt).toISOString(),
        bettingClosesAt: new Date(times.bettingClosesAt).toISOString(),
        proofDeadline: new Date(times.proofDeadline).toISOString(),
      });
      setChallenges((previous) => [challenge, ...previous]);
      setSelected(challenge);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save the challenge.'); }
    finally { setSaving(false); }
  }

  return <main>
    <header><a className="brand" href="/">GOAL DIGGER<span>Challenge yourself.</span></a><span className="badge">Mutinynet · test assets only</span></header>
    <section className="intro"><p className="eyebrow">MAKE IT HAPPEN</p><h1>Your goal.<br />Your word.</h1><p>Create a challenge with clear proof. Give everyone the same rules before they bet.</p></section>
    <p className="notice">Drafts only. No funds move. RGB payments and QVAC verification are not connected yet.</p>
    <div className="columns">
      <section className="panel" aria-labelledby="create-title">
        <p className="eyebrow">01 / SET THE TERMS</p><h2 id="create-title">Wake up on time</h2>
        <form onSubmit={submit}>
          <label>Your name<input name="creatorName" autoComplete="name" required maxLength={80} placeholder="Mert" /></label>
          <label>Challenge title<input name="title" required minLength={3} maxLength={120} defaultValue="I will wake up at 07:00" /></label>
          <label>Planned stake (test USDT)<input name="stake" type="number" required min="0.000001" max="999999.999999" step="0.000001" defaultValue="5" /></label>
          <p className="hint">This amount is a plan. No stake is funded.</p>
          {(['bettingClosesAt', 'startsAt', 'proofDeadline'] as const).map((key) => <label key={key}>
            {{ bettingClosesAt: 'Betting closes', startsAt: 'Proof window starts', proofDeadline: 'Proof deadline' }[key]}
            <input type="datetime-local" required value={times[key]} onChange={(event) => setTimes({ ...times, [key]: event.target.value })} />
          </label>)}
          <p className="hint">All times use {timezone}.</p>
          <div className="terms"><strong>Proof terms</strong><p>{WAKE_UP_PROOF.successRule}</p><p>{WAKE_UP_PROOF.source}</p><p>{WAKE_UP_PROOF.retryRule}</p><p>{WAKE_UP_PROOF.failureRule}</p></div>
          <label className="check"><input type="checkbox" required />I accept these proof terms. Saved drafts cannot be edited in this version.</label>
          <button disabled={saving} type="submit">{saving ? 'Saving…' : 'Save challenge draft'}<span aria-hidden="true">↗</span></button>
        </form>
      </section>
      <section className="panel" aria-labelledby="details-title">
        <p className="eyebrow">02 / KNOW THE RULES</p><h2 id="details-title">{selected ? selected.title : 'Challenge details'}</h2>
        {error && <p role="alert" className="error">{error}</p>}
        {selected ? <>
          <p className="badge">Saved draft · unfunded</p>
          <dl><dt>Creator</dt><dd>{selected.creatorName}</dd><dt>Planned stake</dt><dd>{selected.requestedStakeUsdt} test USDT</dd>
            {(['bettingClosesAt', 'startsAt', 'proofDeadline'] as const).map((key) => <div key={key}><dt>{{ bettingClosesAt: 'Betting closes', startsAt: 'Proof window starts', proofDeadline: 'Proof deadline' }[key]}</dt><dd>{new Date(selected[key]).toLocaleString(undefined, { timeZone: selected.timezone })} ({selected.timezone})</dd></div>)}
          </dl>
          <div className="terms"><strong>Fixed proof terms</strong><p>{selected.proof.successRule}</p><p>{selected.proof.source}</p><p>{selected.proof.retryRule}</p><p>{selected.proof.failureRule}</p></div>
          <p>If you succeed, you win the entire pool. If you fail, opponents split it in proportion to their stakes.</p>
          <p className="hint">Betting and evidence submission are not available yet.</p>
        </> : <p className="empty">Save your first draft to see the proof terms and deadlines here.</p>}
        <div className="saved"><h3>Saved challenges</h3>
          {loading ? <p>Loading challenges…</p> : challenges.length === 0 ? <p className="hint">No saved drafts yet.</p> :
            <ul>{challenges.map((challenge) => <li key={challenge.id}><button type="button" className="draft-link" aria-pressed={selected?.id === challenge.id} onClick={() => setSelected(challenge)}>{challenge.title}<small>{challenge.creatorName} · {challenge.requestedStakeUsdt} test USDT planned</small></button></li>)}</ul>}
        </div>
      </section>
    </div>
  </main>;
}
