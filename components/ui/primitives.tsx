'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    const variants: Record<string, string> = {
      primary:
        'bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 border border-transparent shadow-xs',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700',
      outline:
        'bg-transparent text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800',
      ghost:
        'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent',
      danger:
        'bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 border border-transparent',
    };
    const sizes: Record<string, string> = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-11 px-5 text-sm',
    };
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        'text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100',
        className
      )}
    >
      {children}
    </h2>
  );
}

export function CardContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      'w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50',
      className
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = 'Select';

export function Label({
  htmlFor,
  className,
  children,
}: {
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5',
        className
      )}
    >
      {children}
    </label>
  );
}

/**
 * Semantic status text indicator (icon + label, zero pill/capsule wrapping)
 */
export function StatusText({
  status,
  tone,
}: {
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}) {
  const s = status.toLowerCase();
  const resolved =
    tone ||
    (s.includes('quarantined') || s.includes('overdue') || s.includes('denied') || s.includes('rejected') || s.includes('critical') || s.includes('error') || s.includes('suspended') || s.includes('disabled')
      ? 'danger'
      : s.includes('pending') || s.includes('uncertain') || s.includes('review') || s.includes('escalated') || s.includes('flagged') || s.includes('warning') || s.includes('watch')
      ? 'warning'
      : s.includes('verified') || s.includes('active') || s.includes('approved') || s.includes('accepted') || s.includes('completed') || s.includes('closed') || s.includes('success') || s.includes('nominal') || s.includes('acknowledged')
      ? 'success'
      : s.includes('progress') || s.includes('assigned') || s.includes('high priority')
      ? 'info'
      : 'neutral');

  const colors: Record<string, string> = {
    success: 'text-emerald-700 dark:text-emerald-400',
    warning: 'text-amber-700 dark:text-amber-400',
    danger: 'text-red-700 dark:text-red-400',
    info: 'text-blue-700 dark:text-blue-400',
    neutral: 'text-slate-600 dark:text-slate-400',
  };

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap', colors[resolved])}>
      {resolved === 'success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {resolved === 'warning' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {resolved === 'danger' && <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      {resolved === 'info' && <Info className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
      <span>{status}</span>
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          'w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl overflow-hidden',
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 id="modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h3>
            {description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function AlertBox({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    info: 'border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100',
    warning:
      'border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100',
    danger:
      'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/30 text-red-950 dark:text-red-100',
    success:
      'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100',
  };
  return (
    <div className={cn('rounded-xl border p-4 text-sm', styles[tone])}>
      <div className="font-semibold mb-1">{title}</div>
      <div className="text-xs leading-relaxed opacity-90">{children}</div>
    </div>
  );
}
