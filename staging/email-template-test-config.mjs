// Explicit UAT-only transport settings. Never imported by application templates.
export function emailTemplateTestConfig() {
  const prefix = process.env.TRANSACTIONAL_EMAIL_TEST_SUBJECT_PREFIX;
  const recipient = process.env.TRANSACTIONAL_EMAIL_TEST_RECIPIENT;
  if (!prefix || /[\r\n]/.test(prefix)) throw new Error('Configure a single-line test subject prefix.');
  if (process.env.PUBLIC_APP_URL !== 'https://staging.tashiraev.com' || recipient !== 'admin@tashiraev.com') {
    throw new Error('Template UAT requires the isolated staging origin and approved test inbox.');
  }
  return { prefix, recipient };
}
