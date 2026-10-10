import { escapeHtml } from '../../utilities/escape_html.js';

export function LoginPage(message = '') {
  return `<section class="user-page"><h1>Log in</h1><p>Sign in to review submitted artifacts.</p>${message}
    <form method="post" action="/login">
      <label for="login">Username or email<input id="login" name="login" required autocomplete="username"></label>
      <label for="password">Password<input id="password" name="password" type="password" required autocomplete="current-password"></label>
      <button type="submit">Log in</button>
    </form><p>Need an account? <a href="/signup">Create one</a></p></section>`;
}

export function loginError(message: string) {
  return `<p class="form-message error" role="alert">${escapeHtml(message)}</p>`;
}