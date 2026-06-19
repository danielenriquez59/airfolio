import { tv } from 'tailwind-variants'

export const variants = ['primary', 'tertiary', 'ghost'] as const
export const colors = ['primary', 'secondary', 'success', 'error', 'warning', 'light', 'dark', 'neutral'] as const
export const sizes = ['xs', 'sm', 'md', 'lg'] as const

const filledDisabled = 'disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-300'

export const buttonVariants = tv({
  base: `inline-flex items-center gap-2 justify-center border border-transparent text-center font-medium
    focus:outline-none focus:ring-2 focus:ring-offset-2
    transition duration-200 ease-in-out
    disabled:cursor-not-allowed
    `,
  variants: {
    color: {
      light: `bg-white text-gray-800 border-gray-300 hover:bg-gray-50 focus:ring-indigo-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200`,
      dark: `text-white bg-neutral-800 border-neutral-800 focus:ring-neutral-800 ${filledDisabled}`,
      primary: `bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-600 ${filledDisabled}`,
      secondary: `bg-gray-600 border-gray-600 text-white hover:bg-gray-700 focus:ring-gray-600 ${filledDisabled}`,
      warning: `bg-amber-500 border-amber-500 text-white hover:bg-amber-600 focus:ring-amber-500 ${filledDisabled}`,
      error: `bg-rose-600 border-rose-600 text-white hover:bg-rose-700 focus:ring-rose-600 ${filledDisabled}`,
      success: `bg-green-600 border-green-600 text-white hover:bg-green-700 focus:ring-green-600 ${filledDisabled}`,
      neutral: `bg-gray-100 text-gray-900 border-gray-200 hover:bg-gray-200 focus:ring-gray-500 ${filledDisabled}`,
    },
    size: {
      xs: 'px-0 py-0 text-xs h-auto min-h-0 font-normal',
      sm: 'px-2 py-1 text-sm h-[28px]',
      md: 'px-3.5 py-1.5 text-sm',
      lg: 'py-3 px-8 text-lg h-[48px]',
    },
    rounded: {
      true: 'rounded-full',
      false: 'rounded-md',
    },
    variant: {
      primary: '',
      tertiary: 'bg-transparent',
      ghost: 'bg-transparent border-none',
    },
    shadow: {
      true: 'shadow',
      false: '',
      sm: 'shadow-sm',
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
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
      class: 'text-indigo-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'primary',
      class: 'text-indigo-600 hover:bg-indigo-100',
    },
    {
      variant: 'ghost',
      color: 'primary',
      size: 'xs',
      class: 'hover:bg-transparent hover:text-indigo-800',
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
      class: 'text-amber-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'warning',
      class: 'text-amber-600 hover:bg-amber-100',
    },
    {
      variant: 'tertiary',
      color: 'error',
      class: 'text-rose-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'error',
      class: 'text-rose-600 hover:bg-rose-100',
    },
    {
      variant: 'tertiary',
      color: 'success',
      class: 'text-green-600 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'success',
      class: 'text-green-600 hover:bg-green-100',
    },
    {
      variant: 'tertiary',
      color: 'light',
      class: 'text-gray-800 hover:bg-gray-800 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'light',
      class: 'text-gray-800 hover:bg-gray-100',
    },
    {
      variant: 'tertiary',
      color: 'dark',
      class: 'text-neutral-800 hover:bg-neutral-800 hover:text-white',
    },
    {
      variant: 'ghost',
      color: 'dark',
      class: 'text-neutral-800 hover:bg-neutral-100',
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
  return active
    ? 'px-4 py-2 font-medium text-sm border-b-2 transition-colors border-indigo-600 text-indigo-600'
    : 'px-4 py-2 font-medium text-sm border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700'
}

/** Segmented tab / pill switcher buttons */
export function tabButtonClasses(active: boolean): string {
  return active
    ? 'rounded-md px-4 py-2 text-sm font-medium transition-colors bg-white text-indigo-600 shadow-sm'
    : 'rounded-md px-4 py-2 text-sm font-medium transition-colors text-gray-600 hover:text-gray-900'
}

/** Underline nav tab buttons */
export function navTabButtonClasses(active: boolean): string {
  return active
    ? 'px-6 py-3 text-sm font-medium border-b-2 transition-colors border-indigo-500 text-indigo-600'
    : 'px-6 py-3 text-sm font-medium border-b-2 transition-colors border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
}

/** Inline chart tab buttons (Schrenk-style) */
export function inlineTabButtonClasses(active: boolean): string {
  return active
    ? 'rounded-md px-3 py-2 text-sm font-medium transition-colors bg-indigo-100 text-indigo-700'
    : 'rounded-md px-3 py-2 text-sm font-medium transition-colors text-gray-500 hover:text-gray-700'
}

/** Stateful toggle / toolbar buttons with active/inactive border styles */
export function toggleButtonClasses(active: boolean): string {
  return active
    ? 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-indigo-700 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100'
    : 'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
}

/** Momentary success state (e.g. copy-to-clipboard feedback) */
export function copiedButtonClasses(isCopied: boolean): string {
  const base = 'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
  return isCopied
    ? `${base} bg-green-50 text-green-700 border-green-300`
    : `${base} bg-white text-gray-700 hover:bg-gray-100 border-gray-300`
}

/** Micro filter chip buttons inside dropdowns */
export function microButtonClasses(): string {
  return 'flex-1 text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded transition-colors'
}
