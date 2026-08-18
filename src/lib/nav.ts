/** The single source of truth for global navigation and the command palette. */
export interface NavItem {
  label: string;
  href: string;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', description: 'Overview, featured work and current research' },
  { label: 'About', href: '/about', description: 'Biography, education and research philosophy' },
  { label: 'Research', href: '/research', description: 'Research themes, questions and status' },
  { label: 'Publications', href: '/publications', description: 'Papers, preprints and BibTeX' },
  { label: 'Projects', href: '/projects', description: 'Systems and studies, written up in depth' },
  { label: 'Hackathons', href: '/hackathons', description: 'Builds, demos and what they taught' },
  { label: 'Experience', href: '/experience', description: 'Research, industry and teaching roles' },
  { label: 'Resume', href: '/resume', description: 'Readable resume and PDF download' },
  { label: 'Repositories', href: '/repositories', description: 'Live GitHub repository index' },
  { label: 'Contact', href: '/contact', description: 'Email and verified profile links' },
];
