/** Sign-in screen shown before the app: create a local account, sign in, or try the demo (sample data, kept apart). */
import { bus } from '../bus';
import { MIN_PASSWORD } from '../core/account';
import * as S from '../state/store';
import { $, confirmDialog, esc, icon } from '../ui/kit';
import { mascot } from '../ui/mascot';
import type { View } from './common';

let busy = false;

function enter() {
  busy = false;
  S.goHome();
  bus.refresh({ animate: true });
}

export const signin: View = {
  render(sub) {
    const joining = sub === 'join';
    const existing = S.hasAccount(), name = S.account()?.name;
    return `<div class="signin page-enter">
      <section class="card signin-card" aria-labelledby="si-title">
        ${mascot('hi', { size: 84 })}
        <h1 id="si-title">${existing ? `Welcome back${name ? `, ${esc(name.split(' ')[0])}` : ''}` : 'Welcome to QSwipe'}</h1>
        <p class="muted">${joining ? (existing ? 'Sign in to join the team.' : 'Create your account to join the team.') : existing ? 'Sign in to continue.' : 'Create your account to start.'}</p>
        <form class="stack" data-submit="signin-submit" autocomplete="on" novalidate>
          ${existing ? '' : `<div class="field"><label for="si-name">Name</label><input class="input" id="si-name" maxlength="60" autocomplete="name" required></div>`}
          <div class="field"><label for="si-pass">Password</label><input class="input" id="si-pass" type="password" minlength="${MIN_PASSWORD}" autocomplete="${existing ? 'current-password' : 'new-password'}" required></div>
          <div class="signin-remember"><span>Keep me signed in</span><label class="switch"><input type="checkbox" id="si-remember" aria-label="Keep me signed in"><span></span></label></div>
          <p class="form-error" id="si-error" role="alert"></p>
          <button class="btn primary lg block" type="submit">${existing ? 'Sign in' : 'Create account'}</button>
        </form>
        <p class="signin-or" aria-hidden="true">or</p>
        <button class="btn lg block" type="button" data-action="signin-demo">${icon('play')}Try the demo</button>
        ${existing ? '<button class="btn sm ghost" type="button" data-action="signin-forgot">Forgot password?</button>' : ''}
        <p class="hint">Your account and data stay on this device. The demo uses sample data and never touches your own.</p>
      </section>
    </div>`;
  },
  mount(root) {
    root.querySelector<HTMLInputElement>('#si-name, #si-pass')?.focus({ preventScroll: true });
  },
  actions: {
    'signin-submit': async form => {
      if (busy) return;
      const v = (id: string) => form.querySelector<HTMLInputElement>(id)?.value ?? '';
      const err = $('#si-error'), remember = form.querySelector<HTMLInputElement>('#si-remember')?.checked ?? false;
      busy = true;
      try {
        if (S.hasAccount()) {
          if (await S.signIn(v('#si-pass'), remember)) return enter();
          if (err) err.textContent = 'That password is not right.';
          form.querySelector<HTMLInputElement>('#si-pass')?.select();
        } else {
          await S.signUp(v('#si-name'), v('#si-pass'), remember);
          return enter();
        }
      } catch (e) {
        if (err) err.textContent = e instanceof Error ? e.message : 'Something went wrong.';
      }
      busy = false;
    },
    'signin-demo': () => { S.startDemo(); enter(); },
    'signin-forgot': async () => {
      const ok = await confirmDialog({
        title: 'Reset this device?', confirmLabel: 'Erase and start over', danger: true,
        body: 'Your account lives only on this device, so a forgotten password cannot be recovered. Erasing removes the account and all QSwipe data stored here.',
      });
      if (!ok) return;
      S.eraseDevice();
      bus.refresh({ animate: true });
    },
  },
};
