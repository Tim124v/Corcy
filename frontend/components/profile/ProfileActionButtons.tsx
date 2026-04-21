'use client';

import { Button } from '../ui/Button';

type ProfileActionButtonsProps = {
  onEdit?: () => void;
  onMessage?: () => void;
  isCurrentUser?: boolean;
  className?: string;
};

export function ProfileActionButtons({
  onEdit,
  onMessage,
  isCurrentUser = true,
  className = '',
}: ProfileActionButtonsProps) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {isCurrentUser && onEdit && (
        <Button type="button" onClick={onEdit}>
          Редактировать профиль
        </Button>
      )}
      {!isCurrentUser && onMessage && (
        <Button type="button" onClick={onMessage}>
          Написать
        </Button>
      )}
      <Button type="button" variant="secondary">
        Ещё
      </Button>
    </div>
  );
}
