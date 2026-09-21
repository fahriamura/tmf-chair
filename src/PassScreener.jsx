import { useMemo, useState } from 'react';
import { analysePass, RULES } from './engine.js';
import { usePersistedState } from './lib.js';

const CLEAN_SAMPLE =
  'Five funds, and my seat is drawn at random into one of them. Once a week the fund’s book is up to us, and when it gains everyone gets a check. I applied for a TMF Pass and I am waiting on the verdict. @TheMutualFun';

export default function PassScreener() {
  const [wallet, setWallet] = usePersistedState('tmf.pass.wallet', '');
  const [link, setLink] = usePersistedState('tmf.pass.link', '');
  const [post, setPost] = usePersistedState('tmf.pass.post', '');

  const reading = useMemo(() => analysePass(post), [post]);

  const scope = useMemo(() => {
    const out = [];
    const words = post.trim() ? post.trim().split(/\s+/).length : 0;
    out.push({
      strong: 'The post was read.',
      rest: ` ${words} words checked against ${RULES.pass.length} published rules.`,
    });
    if (wallet) {
      const ok = /^0x[0-9a-fA-F]{40}$/.test(wallet.trim());
      out.push({
        strong: ok ? 'Wallet shape looks like a real address.' : 'Wallet is not a 40 character hex address.',
        rest: ' The screener does not read a balance, a holding or a signature. It has no RPC connection, on purpose.',
      });
    } else {
      out.push({
        strong: 'No wallet given.',
        rest: ' The Waiting Room asks for one, so an application without it is incomplete.',
      });
    }
    if (link) {
      const ok = /(?:x|twitter)\.com\/[^/]+\/status\/\d+/.test(link.trim());
      out.push({
        strong: ok ? 'Post link has the shape of a status link.' : 'Post link is not shaped like an x.com status link.',
        rest: ' The screener cannot open the post. Confirm it is public before submitting.',
      });
    } else {
      out.push({ strong: 'No post link given.', rest: ' One public post is required.' });
    }
    out.push({
      strong: 'Not looked at:',
      rest: ' your history, follower count, following, tenure, who follows you, whether you hold anything, or what is in your wallet.',
    });
    out.push({
      strong: 'Not decided here:',
      rest: ' the verdict. This page reports a reading against the posted rules. The Waiting Room decides.',
    });
    return out;
  }, [post, wallet, link]);

  const loadSample = () => {
    setWallet('0x0000000000000000000000000000000000000000');
    setLink('https://x.com/example/status/1900000000000000000');
    setPost(CLEAN_SAMPLE);
  };

  return (
    <>
      <div className="grid-2">
        <div className="card">
          <h2>The application</h2>
          <p className="hint">
            The Waiting Room asks for a wallet, an X account, and one public post. The screener reads the post and
            checks the shape of the link. It will never call an RPC or look at a balance.
          </p>
          <label className="fld">
            <span>Wallet address</span>
            <input
              type="text"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="0x..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="fld">
            <span>X post link</span>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://x.com/you/status/..."
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="fld">
            <span>Your post, verbatim</span>
            <textarea
              rows={8}
              value={post}
              onChange={(e) => setPost(e.target.value)}
              placeholder="Paste the whole post here, exactly as it will be published."
            />
          </label>
          <div className="btnrow">
            <button className="btn btn-ghost" onClick={loadSample}>
              Load an example that passes
            </button>
          </div>
        </div>

        <div className="card card-result">
          <h2>The verdict</h2>
          <div className="verdictbox">
            <div className={`vbig ${reading.verdict.toLowerCase()}`} id="pass-verdict">
              {reading.verdict}
            </div>
            <div className="vsub" id="pass-score">
              {reading.score} out of 100
            </div>
          </div>
          <p className="note small">Admitted is a reading, not a promise. The Waiting Room decides, not this page.</p>
          <div className="findings">
            {reading.findings.length === 0 ? (
              <div className="clear">
                {post.trim() ? (
                  <>
                    <strong>No rule was broken.</strong> The post reads in the house voice as published. The Waiting
                    Room still decides, and a clean reading is not a promise.
                  </>
                ) : (
                  'Nothing to read yet. Paste the post.'
                )}
              </div>
            ) : (
              reading.findings.map((f) => (
                <div key={f.id} className={`finding${f.id === 'asset_terms' ? ' declined' : ''}`}>
                  <span className="tag">{f.id === 'asset_terms' ? 'terms' : 'flagged'}</span>
                  <h4>{f.label}</h4>
                  <p>{f.why}</p>
                  <p>
                    <strong>Evidence:</strong> {f.evidence}
                  </p>
                  <p className="fix">
                    <strong>Fix:</strong> {f.fix}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>What was looked at, and what was not</h2>
        <ul className="plain">
          {scope.map((s, i) => (
            <li key={i}>
              <strong>{s.strong}</strong>
              {s.rest}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
