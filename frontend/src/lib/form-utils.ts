import type { FormEvent } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'

/** Form element or submit event — mutations may receive either depending on call site. */
export type FormSubmitTarget = HTMLFormElement | FormEvent<HTMLFormElement>

export function formElementFromSubmit(target: FormSubmitTarget): HTMLFormElement {
  const element = target instanceof Event ? target.currentTarget : target
  if (!(element instanceof HTMLFormElement)) {
    throw new Error('Form submission must originate from an HTML form element.')
  }
  return element
}

export function formDataFromElement(target: FormSubmitTarget): FormData {
  return new FormData(formElementFromSubmit(target))
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

/** Preferred onSubmit handler when mutation expects HTMLFormElement. */
export function submitFormMutation<TData>(
  mutation: Pick<UseMutationResult<TData, Error, HTMLFormElement>, 'mutate'>,
  event: FormEvent<HTMLFormElement>,
  options?: { resetOnSuccess?: boolean },
) {
  event.preventDefault()
  const form = event.currentTarget
  mutation.mutate(form, {
    onSuccess: () => {
      if (options?.resetOnSuccess !== false) {
        form.reset()
      }
    },
  })
}
