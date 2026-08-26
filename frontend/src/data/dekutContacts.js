// src/data/dekutContacts.js
//
// Verified DeKUT contacts, sourced from official dkut.ac.ke pages:
//  - https://www.dkut.ac.ke/index.php/student-services
//  - https://www.dkut.ac.ke/index.php/about-dekut/administrative-units/directorate-of-ict
//  - https://portal.dkut.ac.ke/
// Checked August 2026. An older (2020) official PDF listed different phone
// numbers for some of these same offices, so numbers do change — re-verify
// before this ships, and ideally this whole file becomes admin-editable
// (spec section 16) rather than hand-maintained.
//
// Only real, sourced contacts belong here — never invent an email or
// number to fill a gap.
export const CONTACT_CATEGORIES = {
  ict: 'ICT & Student Systems',
  academic: 'Academic',
  administration: 'Administration',
  'university-info': 'University Information',
}
export const DEKUT_CONTACTS = [
  {
    id: 'ict-student-systems',
    name: 'ICT — Portal, Passwords & Student Email',
    category: 'ict',
    email: 'studentadmin@dkut.ac.ke',
    phone: null,
    description: 'Student Portal login issues, password resets, and DeKUT student email problems.',
  },
  {
    id: 'elearning',
    name: 'eLearning (CoDEL)',
    category: 'academic',
    email: 'elearning@dkut.ac.ke',
    phone: null,
    description: 'Issues accessing or using the eLearning portal.',
  },
  {
    id: 'admissions-records',
    name: 'Admissions & Records',
    category: 'administration',
    email: 'admissionsoffice@dkut.ac.ke',
    phone: '0709 202 963',
    description: 'Admissions, student IDs, clearance, fee structures.',
  },
  {
    id: 'registrar-aar',
    name: 'Registrar, Academic Affairs & Records',
    category: 'administration',
    email: null,
    phone: '0709 202 914',
    description: null,
  },
  {
    id: 'data-protection',
    name: 'Data Protection Office',
    category: 'administration',
    email: 'dataprotection@dkut.ac.ke',
    phone: '0715 086 810',
    description: null,
  },
  {
    id: 'public-relations',
    name: 'Public Relations',
    category: 'university-info',
    email: 'pro@dkut.ac.ke',
    phone: '0727 088 807',
    description: null,
  },
  {
    id: 'marketing',
    name: 'Marketing Office',
    category: 'university-info',
    email: 'marketing@dkut.ac.ke',
    phone: '0713 123 021',
    description: null,
  },
  {
    id: 'vc-office',
    name: "Vice-Chancellor's Office",
    category: 'administration',
    email: 'vc@dkut.ac.ke',
    phone: null,
    description: null,
  },
]
export function getContactsByCategory(contacts = DEKUT_CONTACTS) {
  return Object.entries(CONTACT_CATEGORIES).map(([id, label]) => ({
    id,
    label,
    contacts: contacts.filter((c) => c.category === id),
  })).filter((group) => group.contacts.length > 0)
}

export function getContactById(id, contacts = DEKUT_CONTACTS) {
  return contacts.find((c) => c.id === id)
}
