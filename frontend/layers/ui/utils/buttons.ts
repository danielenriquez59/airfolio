import { tv } from 'tailwind-variants'

const filledDisabled = 'disabled:bg-gray-200 disabled:text-gray-500 disabled:border-gray-200'
const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2'

export const buttonVariants = tv({
  base: `inline-flex items-center gap-2 justify-center border border-transparent text-center font-medium whitespace-nowrap
    ${focusRing}
    transition-colors duration-150 ease-in-out
    disabled:cursor-not-allowed
    `,
  variants: {
    color: {
      light: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:text-gray-900 disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200',
      dark: `bg-gray-800 border-gray-800 text-white hover:bg-gray-900 ${filledDisabled}`,
      primary: `bg-primary-600 border-primary-600 text-white hover:bg-primary-700 hover:border-primary-700 ${filledDisabled}`,
      secondary: `bg-gray-600 border-gray-600 text-white hover:bg-gray-700 ${filledDisabled}`,
      warning: `bg-warning-500 border-warning-500 text-white hover:bg-warning-600 ${filledDisabled}`,
      error: `bg-error-600 border-error-600 text-white hover:bg-error-700 ${filledDisabled}`,
      success: `bg-success-600 border-success-600 text-white hover:bg-success-700 ${filledDisabled}`,
      neutral: `bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200 ${filledDisabled}`,
    },
    // Heights match VInput / VSelect: sm 32px, md 36px, lg 44px
    size: {
      xs: 'px-0 py-0 text-xs h-auto min-h-0 font-normal',
      sm: 'h-8 px-3 text-sm',
      md: 'h-9 px-4 text-sm',
      lg: 'h-11 px-6 text-base',
    },
    rounded: {
      true: 'rounded-full',
      false: 'rounded-lg',
    },
    variant: {
      primary: '',
      tertiary: 'bg-transparent',
      ghost: 'bg-transparent border-transparent',
    },
    // Flat surfaces: every shadow option renders at most shadow-sm
    shadow: {
      true: 'shadow-sm',
      false: '',
      sm: 'shadow-sm',
      md: 'shadow-sm',
      lg: 'shadow-sm',
      xl: 'shadow-sm',
    },
    block: {
      true: 'w-full',
      false: '',
    },
  },
  defaultVariants: {
    size: 'md',
    color: 'light',
    rounded: false,
  },
  compoundVariants: [
    {
      variant: 'tertiary',
      color: 'primary',
      class: 'text-primary-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'primary',
      class: 'text-primary-600 hover:bg-primary-100',
    },
    {
      variant: 'ghost',
      color: 'primary',
      size: 'xs',
      class: 'hover:bg-transparent hover:text-primary-800',
    },
    {
      variant: 'ghost',
      color: 'error',
      size: 'xs',
      class: 'text-red-600 hover:bg-transparent hover:text-red-800',
    },
    {
      variant: 'tertiary',
      color: 'secondary',
      class: 'text-gray-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'secondary',
      class: 'text-gray-600 hover:bg-gray-100',
    },
    {
      variant: 'tertiary',
      color: 'warning',
      class: 'text-warning-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'warning',
      class: 'text-warning-600 hover:bg-warning-100',
    },
    {
      variant: 'tertiary',
      color: 'error',
      class: 'text-error-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'error',
      class: 'text-error-600 hover:bg-error-100',
    },
    {
      variant: 'tertiary',
      color: 'success',
      class: 'text-success-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'success',
      class: 'text-success-600 hover:bg-success-100',
    },
    {
      variant: 'tertiary',
      color: 'light',
      class: 'text-gray-700 hover:bg-gray-800 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'light',
      class: 'text-gray-700 hover:bg-gray-100',
    },
    {
      variant: 'tertiary',
      color: 'dark',
      class: 'text-gray-700 hover:bg-gray-800 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'dark',
      class: 'text-gray-700 hover:bg-gray-100',
    },
    {
      variant: 'ghost',
      color: 'neutral',
      class: 'text-gray-700 hover:bg-gray-200',
    },
  ],
})

/** Underline nav tab buttons (compact variant for nested forms) */
export function compactNavTabButtonClasses(active: boolean): string {
  const base = 'px-3 py-2 -mb-px font-medium text-sm border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
  return active
    ? `${base} border-primary-600 text-primary-700`
    : `${base} border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300`
}

/** Segmented control buttons; put them inside `inline-flex gap-1 rounded-lg bg-gray-100 p-1` */
export function tabButtonClasses(active: boolean): string {
  const base = 'rounded-md px-3 h-7 inline-flex items-center gap-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
  return active
    ? `${base} bg-white text-gray-900 shadow-sm ring-1 ring-gray-200`
    : `${base} text-gray-600 hover:text-gray-900`
}

/** Underline nav tab buttons; put them inside `flex gap-2 border-b border-gray-200` */
export function navTabButtonClasses(active: boolean): string {
  const base = 'px-4 py-2.5 -mb-px text-sm font-medium border-b-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-t'
  return active
    ? `${base} border-primary-600 text-primary-700`
    : `${base} border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300`
}

/** Inline chart tab buttons (Schrenk-style) */
export function inlineTabButtonClasses(active: boolean): string {
  const base = 'rounded-md px-3 h-8 inline-flex items-center text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
  return active
    ? `${base} bg-primary-50 text-primary-700`
    : `${base} text-gray-500 hover:text-gray-900 hover:bg-gray-100`
}

/** Stateful toggle / toolbar buttons with active/inactive border styles */
export function toggleButtonClasses(active: boolean): string {
  const base = 'inline-flex items-center gap-2 h-9 px-4 text-sm font-medium rounded-lg border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500'
  return active
    ? `${base} text-primary-700 bg-primary-50 border-primary-300 hover:bg-primary-100`
    : `${base} text-gray-700 bg-white border-gray-300 hover:bg-gray-50`
}

/** Momentary success state (e.g. copy-to-clipboard feedback) */
export function copiedButtonClasses(isCopied: boolean): string {
  const base = 'inline-flex items-center gap-1.5 rounded-lg h-8 px-3 text-sm font-medium transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500'
  return isCopied
    ? `${base} bg-success-50 text-success-700 border-success-300`
    : `${base} bg-white text-gray-700 hover:bg-gray-50 border-gray-300`
}

/** Micro filter chip buttons inside dropdowns */
export function microButtonClasses(): string {
  return 'flex-1 text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
}
