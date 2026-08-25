// src/data/dekutServices.js
//
// University -> Categories -> Services model. Only DeKUT is populated for
// now, but nothing here assumes DeKUT is the only university — adding a
// second one later is just another object in UNIVERSITIES.

export const UNIVERSITIES = {
  dekut: {
    id: 'dekut',
    name: 'Dedan Kimathi University of Technology',
    shortName: 'DeKUT',
    emoji: '🎓',
  },
}

// status: 'active'  -> real, verified official URL, clickable
// status: 'pending' -> real service, no verified official URL yet.
//                      Never invent one — show as "Link coming soon".
export const DEKUT_CATEGORIES = [
  {
    id: 'academic',
    label: 'Academic',
    icon: 'cap',
    services: [
      {
        id: 'elearning',
        name: 'eLearning',
        description: 'Access your courses, notes, assignments and online classes.',
        url: 'https://elearning.dkut.ac.ke/',
        icon: 'book',
        keywords: ['courses', 'moodle', 'classes', 'assignments', 'notes'],
        status: 'active',
      },
      {
        id: 'student-portal',
        name: 'Student Portal',
        description: 'Academic records, unit registration, fees and student email.',
        url: 'https://portal.dkut.ac.ke/',
        icon: 'cap',
        keywords: ['portal', 'results', 'fees', 'email', 'registration'],
        status: 'active',
      },
      {
        id: 'registration',
        name: 'Online Registration & Clearance',
        description: 'Register for units and complete online student clearance.',
        url: 'https://registration.dkut.ac.ke/',
        icon: 'file',
        keywords: ['registration', 'clearance', 'units', 'joining instructions'],
        status: 'active',
      },
      {
        id: 'academic-calendar',
        name: 'Academic Calendar',
        description: 'Term dates and the official university academic calendar.',
        url: null,
        icon: 'calendar',
        keywords: ['calendar', 'term dates', 'semester'],
        status: 'pending',
      },
      {
        id: 'examinations',
        name: 'Examinations Office',
        description: 'Transcripts, certificates and examination queries.',
        url: null,
        contact: 'examinations@dkut.ac.ke',
        icon: 'file',
        keywords: ['exams', 'transcripts', 'certificates', 'results'],
        status: 'pending',
      },
    ],
  },
  {
    id: 'learning-research',
    label: 'Learning & Research',
    icon: 'book',
    services: [
      {
        id: 'library',
        name: 'Library Catalogue',
        description: 'Search the DeKUT library catalogue and check borrowing.',
        url: 'https://library.dkut.ac.ke/',
        icon: 'book',
        keywords: ['books', 'catalogue', 'borrow', 'library'],
        status: 'active',
      },
      {
        id: 'library-info',
        name: 'Library Services',
        description: 'Opening hours, e-resources and research support.',
        url: 'https://www.dkut.ac.ke/library/',
        icon: 'book',
        keywords: ['library hours', 'e-resources', 'research support'],
        status: 'active',
      },
      {
        id: 'repository',
        name: 'Institutional Repository',
        description: 'Theses, dissertations and research output from DeKUT.',
        url: 'https://repository.dkut.ac.ke:8080/xmlui/',
        icon: 'file',
        keywords: ['thesis', 'dissertation', 'research', 'repository', 'journals'],
        status: 'active',
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Payments',
    icon: 'wallet',
    services: [
      {
        id: 'fees',
        name: 'Fees & Billing',
        description: 'Fee statements and payment info, via the Student Portal.',
        url: 'https://portal.dkut.ac.ke/',
        icon: 'wallet',
        keywords: ['fees', 'statement', 'billing', 'payment'],
        status: 'active',
      },
      {
        id: 'financial-aid',
        name: 'Financial Aid Office (DeFAO)',
        description: 'Bursaries, HELB and student financial aid support.',
        url: null,
        icon: 'wallet',
        keywords: ['bursary', 'helb', 'financial aid', 'scholarship'],
        status: 'pending',
      },
    ],
  },
  {
    id: 'campus-life',
    label: 'Campus Life',
    icon: 'home',
    services: [
      {
        id: 'catering',
        name: 'Catering Services',
        description: 'Access DeKUT catering and meal-related services.',
        url: 'https://catering.dkut.ac.ke/',
        icon: 'utensils',
        keywords: ['food', 'meals', 'mess', 'catering'],
        status: 'active',
      },
      {
        id: 'accommodation',
        name: 'Accommodation',
        description: 'Hostel and accommodation information for students.',
        url: null,
        icon: 'home',
        keywords: ['hostel', 'accommodation', 'housing'],
        status: 'pending',
      },
      {
        id: 'student-welfare',
        name: 'Student Welfare',
        description: 'Directorate of Student Welfare support services.',
        url: null,
        icon: 'home',
        keywords: ['welfare', 'student affairs', 'clubs', 'societies', 'sports'],
        status: 'pending',
      },
    ],
  },
  {
    id: 'health-support',
    label: 'Health & Support',
    icon: 'heart',
    services: [
      {
        id: 'medical',
        name: 'Medical Services',
        description: 'Campus medical and health services for students.',
        url: null,
        icon: 'heart',
        keywords: ['clinic', 'health', 'medical'],
        status: 'pending',
      },
      {
        id: 'disability',
        name: 'Services for Persons with Disabilities',
        description: 'Support services for students with disabilities.',
        url: null,
        icon: 'heart',
        keywords: ['disability', 'accessibility'],
        status: 'pending',
      },
      {
        id: 'chaplaincy',
        name: 'Chaplaincy',
        description: 'Spiritual and chaplaincy services at DeKUT.',
        url: null,
        icon: 'heart',
        keywords: ['chaplaincy', 'spiritual', 'counseling'],
        status: 'pending',
      },
    ],
  },
  {
    id: 'technology',
    label: 'Technology',
    icon: 'cpu',
    services: [
      {
        id: 'ict',
        name: 'Directorate of ICT',
        description: 'ICT support, infrastructure and services information.',
        url: 'https://www.dkut.ac.ke/index.php/about-dekut/administrative-units/directorate-of-ict',
        icon: 'cpu',
        keywords: ['ict', 'it support', 'wifi', 'network'],
        status: 'active',
      },
      {
        id: 'it-helpdesk',
        name: 'IT Help Desk',
        description: 'Get help with student email, portal or Wi-Fi issues.',
        url: null,
        contact: 'studentadmin@dkut.ac.ke',
        icon: 'cpu',
        keywords: ['help desk', 'password', 'email issue', 'wifi'],
        status: 'pending',
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    icon: 'briefcase',
    services: [
      {
        id: 'admissions',
        name: 'Admissions — Apply Online',
        description: 'Submit and track your admission application online.',
        url: 'https://admissions.dkut.ac.ke/',
        icon: 'briefcase',
        keywords: ['admissions', 'apply', 'application', 'kuccps'],
        status: 'active',
      },
      {
        id: 'admissions-info',
        name: 'Admissions & Records Office',
        description: 'Admission procedures, forms and requirements.',
        url: 'https://www.dkut.ac.ke/index.php/admissions-and-records',
        icon: 'briefcase',
        keywords: ['admissions office', 'records', 'forms'],
        status: 'active',
      },
    ],
  },
  {
    id: 'university-info',
    label: 'University Information',
    icon: 'megaphone',
    services: [
      {
        id: 'website',
        name: 'DeKUT Website',
        description: 'News, events, announcements and general info.',
        url: 'https://www.dkut.ac.ke/',
        icon: 'megaphone',
        keywords: ['news', 'events', 'announcements', 'about', 'website'],
        status: 'active',
      },
      {
        id: 'contacts',
        name: 'Location & Contacts',
        description: 'Campus location, office contacts and phone numbers.',
        url: 'https://www.dkut.ac.ke/index.php/about-dekut/s5-accordion-menu/location-and-contacts',
        icon: 'megaphone',
        keywords: ['contact', 'location', 'address', 'phone', 'directions'],
        status: 'active',
      },
    ],
  },
]

// Ids featured in Pulse's compact card and in "Most Used" by default,
// before real usage data exists.
export const DEFAULT_FEATURED_IDS = ['elearning', 'student-portal', 'catering']

export function getAllServices(categories = DEKUT_CATEGORIES) {
  return categories.flatMap((cat) =>
    cat.services.map((s) => ({ ...s, categoryId: cat.id, categoryLabel: cat.label }))
  )
}

export function getServiceById(id, categories = DEKUT_CATEGORIES) {
  return getAllServices(categories).find((s) => s.id === id)
}
