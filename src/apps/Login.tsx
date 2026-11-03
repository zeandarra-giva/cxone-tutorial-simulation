import { useState } from 'react';
import { useSim } from '../store';
import { Logo } from '../components/icons';
import { ROLES, TENANT, USER } from '../data/data';

// Training replica of the sign-in screen. Nothing typed here leaves the browser,
// and no password is ever requested.
export function Login() {
  const { s, set } = useSim();
  const [username, setUsername] = useState(s.username || USER.username);
  const [error, setError] = useState('');

  const enter = () => {
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    const role = ROLES.find((r) => r.id === s.role)!;
    set({ username, screen: 'cxone', app: role.defaultApp, page: role.defaultApp === 'supervisor' ? 'live' : role.defaultApp === 'admin' ? 'employees' : 'profile' });
  };

  return (
    <div className="login">
      <div className="login-left">
        <div className="login-banner">{TENANT.banner}</div>
        <div className="login-pattern" />
        <div className="login-center">
          <Logo size={26} />
          <div className="login-card" data-tour="login-card">
            <div className="login-title">Sign In</div>
            <label className="login-field" data-tour="login-username">
              <span>Username</span>
              <input value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} onKeyDown={(e) => e.key === 'Enter' && enter()} autoComplete="off" />
            </label>
            {error && <div className="login-error">{error}</div>}
            <div className="login-actions">
              <button className="login-back" onClick={() => set({ screen: 'picker' })}>&lt; Back</button>
              <button className="login-next" data-tour="login-next" onClick={enter}>NEXT</button>
            </div>
            <div className="login-or"><span>or</span></div>
            <div data-tour="login-sso">
              <button className="login-sso" onClick={enter}>{TENANT.adButton}</button>
              <button className="login-sso" onClick={enter}>{TENANT.ssoButton}</button>
            </div>
          </div>
        </div>
        <div className="login-copy">Copyright © 2005-2026 NICE LTD. All Rights Reserved. <u>Contact Us</u></div>
      </div>
      <div className="login-right">
        <div className="login-promo">
          <h1>Extend CXone with enterprise AI agents</h1>
          <p>AI agents that automate service journeys and turn customer intent into resolution.</p>
          <div className="login-promo-btns">
            <button className="promo-dark"><span className="promo-play">▶</span> Watch demo</button>
            <button className="promo-blue">Learn more</button>
          </div>
        </div>
      </div>
    </div>
  );
}
