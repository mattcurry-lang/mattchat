// src/data/dekutEmailSetup.js
//
// Steps paraphrased from DeKUT's official email login process page:
// https://www.dkut.ac.ke/index.php/email-login-process
// (student email is Google Workspace-based). Checked August 2026 —
// re-verify against the live page before shipping, and note the actual
// login URL isn't given on that page in a form safe to hardcode here, so
// step 2 points the student to the portal rather than a guessed URL.
export const EMAIL_SETUP_STEPS = [
  {
    id: 'what-you-need',
    title: 'What you need',
    content: 'Your student registration number and your DeKUT student email address (assigned on admission — check your Student Portal profile if you don\u2019t have it yet, or ask ICT).',
  },
  {
    id: 'open-login',
    title: 'Open the student email login',
    content: 'Go to your DeKUT student email sign-in page (linked from the Student Portal).',
  },
  {
    id: 'enter-email',
    title: 'Enter your student email address',
    content: 'Type your full DeKUT student email address, then continue.',
  },
  {
    id: 'first-time-password',
    title: 'Enter your first-time password',
    content: 'On first login, your password is your registration number.',
  },
  {
    id: 'set-new-password',
    title: 'Set a new password',
    content: 'You\u2019ll be required to change your password the first time you log in.',
  },
  {
    id: 'accept-terms',
    title: 'Accept Google\u2019s Terms of Service',
    content: 'If prompted, accept Google\u2019s Terms of Service to continue \u2014 your student email runs on Google Workspace.',
  },
  {
    id: 'test-account',
    title: 'Check your inbox',
    content: 'You should now land in your inbox. If anything fails along the way, contact ICT rather than retrying repeatedly.',
  },
]
export const EMAIL_SETUP_HELP = {
  contactId: 'ict-student-systems', // see dekutContacts.js
  note: 'For Student Portal or student email issues, contact ICT directly or use the IT Help Desk ticket link on the Student Portal.',
}
