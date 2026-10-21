import { BadRequestException } from '@nestjs/common';

export function requireRadwebImageUrl(url?: string | null): string {
  const trimmed = url?.trim() ?? '';
  if (!/^https?:\/\/\S+$/i.test(trimmed)) {
    throw new BadRequestException(
      'A RadWeb / image link is required before the imaging report can be saved.',
    );
  }
  return trimmed;
}
