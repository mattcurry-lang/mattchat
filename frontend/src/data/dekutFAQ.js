// src/data/dekutFAQ.js
//
// Static knowledge base for the "Ask DeKUT" FAQ page (spec §10/§11).
// Every `answer` below is sourced from DeKUT's own public pages (ICT
// login flow, student portal, registration portal, admissions,
// library, contacts) — not invented. Where DeKUT doesn't publish the
// info (Wi-Fi status, timetable), the entry says so honestly and
// escalates to a real contact instead of guessing (spec §24).
//
// `action.type`:
//   'service'  -> serviceId into dekutServices.js; resolved via
//                 getServiceById + openDekutService at render time.
//   'mailto'   -> action.email, opens the user's mail client directly.
//   'none'     -> no action, informational only.
//
// category ids intentionally mirror DEKUT_CATEGORIES ids so filtering
// can reuse the same labels later if needed.

export const FAQ_CATEGORIES = {
  technology: 'Email, Portal & ICT',
  academic: 'Academic',
  finance: 'Finance',
  campus: 'Campus & Facilities',
  admissions: 'Admissions',
}

export const DEKUT_FAQ = [
  {
    id: 'activate-email',
    category: 'technology',
    question: 'How do I activate or log into my DeKUT university email?',
    answer:
      "DeKUT student email runs on Google Workspace. Enter your student email address first, then on the next screen enter your password — your registration number is your default first-time password. You may be asked to accept Google's Terms of Service before your inbox loads.",
    action: { type: 'service', serviceId: 'email-setup', label: 'Open Step-by-Step Guide' },
  },
  {
    id: 'portal-login',
    category: 'technology',
    question: 'How do I log into the Student Portal?',
    answer:
      'Your username is your student email address, and your initial password is your registration number. You are required to change this password after your first login.',
    action: { type: 'service', serviceId: 'student-portal', label: 'Open Student Portal' },
  },
  {
    id: 'email-portal-not-working',
    category: 'technology',
    question: "My student email or portal login isn't working — who do I contact?",
    answer:
      'For student portal or student email issues, contact studentadmin@dkut.ac.ke, or use the IT Help Desk ticketing link on the portal.',
    action: { type: 'mailto', email: 'studentadmin@dkut.ac.ke', label: 'Email Student Admin' },
  },
  {
    id: 'elearning-issue',
    category: 'academic',
    question: "I can't access eLearning — who do I contact?",
    answer: 'eLearning portal issues go to elearning@dkut.ac.ke.',
    action: { type: 'mailto', email: 'elearning@dkut.ac.ke', label: 'Email eLearning Support' },
  },
  {
    id: 'unit-registration',
    category: 'academic',
    question: 'Where do I register for units and complete clearance?',
    answer:
      "Unit registration and student clearance are done online through DeKUT's Online Registration & Clearance portal.",
    action: { type: 'service', serviceId: 'registration', label: 'Open Registration & Clearance' },
  },
  {
    id: 'course-materials',
    category: 'academic',
    question: 'Where do I find my course materials, notes and assignments?',
    answer: 'These are all on the eLearning platform (Moodle-based) once you log in with your student email.',
    action: { type: 'service', serviceId: 'elearning', label: 'Open eLearning' },
  },
  {
    id: 'fees',
    category: 'finance',
    question: 'Where do I check my fee statement or pay fees?',
    answer: 'Fee statements and payment information are accessed through the Student Portal.',
    action: { type: 'service', serviceId: 'fees', label: 'Open Fees & Billing' },
  },
  {
    id: 'library',
    category: 'campus',
    question: 'Where is the library and how do I search the catalogue?',
    answer: 'The DeKUT library has an online catalogue you can search directly, plus a page covering hours and e-resources.',
    action: { type: 'service', serviceId: 'library', label: 'Open Library Catalogue' },
  },
  {
    id: 'admissions',
    category: 'admissions',
    question: 'How do I apply or track my admission?',
    answer: 'Applications are submitted and tracked online through the Admissions portal.',
    action: { type: 'service', serviceId: 'admissions', label: 'Open Admissions' },
  },
  {
    id: 'find-room',
    category: 'campus',
    question: 'How do I find a lecture room, office or facility on campus?',
    answer: 'Use Room Finder to search by name, room code or keyword.',
    action: { type: 'service', serviceId: 'room-finder', label: 'Open Room Finder' },
  },
  {
    id: 'new-student',
    category: 'campus',
    question: "I'm a new student — where do I even start?",
    answer: 'Start with the Fresher Guide — it collects the essentials (email setup, portal, eLearning, catering, contacts) in one place.',
    action: { type: 'service', serviceId: 'fresher-mode', label: 'Open Fresher Guide' },
  },
  {
    id: 'contacts',
    category: 'campus',
    question: 'Where can I find verified DeKUT office contacts and phone numbers?',
    answer: 'Location and Contacts lists official phone numbers and emails for Public Relations, the Registrar, Data Protection and Marketing offices.',
    action: { type: 'service', serviceId: 'contacts', label: 'Open Contacts' },
  },
  {
    id: 'wifi',
    category: 'technology',
    question: 'Where can I find Wi-Fi on campus?',
    answer: "I don't have verified information about campus Wi-Fi locations or signal strength yet. Please contact the Directorate of ICT for this.",
    action: { type: 'service', serviceId: 'ict', label: 'Open Directorate of ICT' },
  },
  {
    id: 'timetable',
    category: 'academic',
    question: "Where do I find my class timetable?",
    answer: "I don't have verified timetable data yet. Check the Student Portal, or contact your department directly.",
    action: { type: 'service', serviceId: 'student-portal', label: 'Open Student Portal' },
  },
]

export function searchFAQ(query, category, faqs = DEKUT_FAQ) {
  let list = faqs
  if (category && category !== 'all') {
    list = list.filter((f) => f.category === category)
  }
  const q = query.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q)
  )
}
