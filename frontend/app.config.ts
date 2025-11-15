import { ArrowPathIcon, CloudArrowUpIcon, FingerPrintIcon, LockClosedIcon } from '@heroicons/vue/24/outline'

export default defineAppConfig({
  title: 'Airfolio',
  description: 'Search, analyze, and compare airfoil performance with AI-powered NeuralFoil analysis. Access a comprehensive database of airfoils with advanced filtering and visualization.',
  features: [
    {
      name: 'Search & Filter',
      description:
        'Browse airfoils by name, thickness, and camber. Find the perfect airfoil for your design requirements.',
      icon: CloudArrowUpIcon,
    },
    {
      name: 'AI-Powered Analysis',
      description:
        'Run aerodynamic analysis powered by NeuralFoil. Get detailed performance insights with configurable flow conditions.',
      icon: LockClosedIcon,
    },
    {
      name: 'Multi-Airfoil Comparison',
      description:
        'Compare multiple airfoils side-by-side with interactive polar plots and performance summary tables.',
      icon: ArrowPathIcon,
    },
    {
      name: 'Custom Upload',
      description:
        'Upload your own airfoil coordinates and share designs with the community.',
      icon: FingerPrintIcon,
    },
  ],
  feature: {
    title: 'Discover Airfoils',
    subtitle: 'Your comprehensive airfoil analysis tool',
    description: 'Search, analyze, and compare airfoil performance data powered by NeuralFoil. Perfect for aircraft design, wind turbines, and aerodynamic research.',
    image: 'https://tailwindui.com/img/component-images/dark-project-app-screenshot.png',
  },
  announcement: {
    enabled: false,
    message: '',
    url: '',
  },
  cta: {
    title: 'Start analyzing airfoils',
    description: 'Search our database or upload your own airfoil to get started.',
    links: [
      {
        title: 'Browse Airfoils',
        url: '/search',
        type: 'primary',
      },
      {
        title: 'Learn More',
        url: '/about',
        type: 'alt',
        arrow: true,
      },
    ],
    image: 'https://tailwindui.com/img/component-images/dark-project-app-screenshot.png',
  },
})
