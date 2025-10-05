import { cva, type VariantProps } from 'class-variance-authority';
import { twMerge } from 'tailwind-merge';

export const cx = (...c: (string | false | undefined)[]) => twMerge(...c.filter(Boolean));

export const button = cva(
  'inline-flex items-center justify-center rounded-2xl px-5 py-3 pressable transition',
  {
    variants: {
      intent: {
        primary: 'bg-indigo-600 text-white hover:bg-indigo-500',
        ghost: 'bg-transparent border border-white/10 hover:bg-white/5',
      },
      size: {
        sm: 'text-sm',
        md: 'text-base',
      },
    },
    defaultVariants: {
      intent: 'primary',
      size: 'md',
    },
  }
);

export type ButtonVariants = VariantProps<typeof button>;
