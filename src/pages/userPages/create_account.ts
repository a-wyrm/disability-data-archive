import { escapeHtml } from '../../utilities/escape_html.js';

export function CreateAccountPage(message = '') {
	return `<section class="user-page"><h1>Create an account</h1><p>Register to review submitted artifacts.</p>${message}
		<form method="post" action="/signup">
			<label for="username">Username<input id="username" name="username" maxlength="100" required autocomplete="username"></label>
			<label for="email">Email<input id="email" name="email" type="email" maxlength="100" required autocomplete="email"></label>
			<label for="password">Password<input id="password" name="password" type="password" minlength="12" required autocomplete="new-password"></label>
			<button type="submit">Create account</button>
		</form><p>Already registered? <a href="/login">Log in</a></p></section>`;
}

export function accountError(message: string) {
	return `<p class="form-message error" role="alert">${escapeHtml(message)}</p>`;
}
