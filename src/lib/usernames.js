// Firebase sign-in needs an email address, but students only have usernames.
// Each username maps to a made-up address on a reserved domain that can never
// receive mail. scripts/create-accounts.mjs uses the same mapping.
export const USERNAME_EMAIL_DOMAIN = "students.ams-python.example.com";

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}
