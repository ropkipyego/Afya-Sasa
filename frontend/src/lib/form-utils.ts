import type { FormEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'

export function formDataFromElement(form: HTMLFormElement): FormData {
  return new FormData(form)
}

export function submitClinicalForm<TData>(
  mutation: Pick<
    UseMutationResult<TData, Error, HTMLFormElement>,
    'mutate' | 'isPending'
  >,
  event: FormEvent<HTMLFormElement>,
  options?: {
    resetOnSuccess?: boolean
    validate?: () => string | null
    onValidationError?: (message: string) => void
  },
) {
  event.preventDefault()
  const form = event.currentTarget

  const validationError = options?.validate?.()
  if (validationError) {
    options?.onValidationError?.(validationError)
    return
  }

  mutation.mutate(form, {
    onSuccess: () => {
      if (options?.resetOnSuccess !== false) {
        form.reset()
      }
    },
  })
}
