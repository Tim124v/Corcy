'use client';

import { useState, useCallback, forwardRef } from 'react';

export interface SecureInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  autoComplete?: string;
  name?: string;
  id?: string;
  required?: boolean;
}

export const SecureInput = forwardRef<HTMLInputElement, SecureInputProps>(function SecureInput(
  {
    value,
    onChange,
    placeholder = 'Введите пароль',
    maxLength = 128,
    className = '',
    disabled = false,
    autoComplete = 'current-password',
    name,
    id,
    required,
  },
  ref,
) {
  const [show, setShow] = useState(false);

  const blockContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="relative w-full">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        spellCheck={false}
        onContextMenu={blockContextMenu}
        name={name}
        id={id}
        required={required}
        className={className}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500 transition-colors select-none hover:text-slate-200 dark:text-slate-400 dark:hover:text-slate-200"
      >
        {show ? 'Скрыть' : 'Показать'}
      </button>
    </div>
  );
});
