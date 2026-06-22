#!/usr/bin/env python3
"""Apply UI component imports and submitClinicalForm patterns to App.tsx."""

import re
from pathlib import Path

APP = Path(__file__).resolve().parents[1] / "src" / "App.tsx"
content = APP.read_text()

if "from './components/ui'" not in content:
    content = content.replace(
        "import { apiRequest } from './lib/api'\nimport { useAuthStore } from './lib/auth-store'",
        """import {
  Alert,
  Button,
  Card,
  ClinicalForm,
  EmptyState,
  Field,
  FormActions,
  FormSection,
  PageHeader,
  PatientContextBanner,
  QuickAddForm,
  SearchBar,
  Select,
  SelectField,
  TextareaField,
} from './components/ui'
import { formDataFromElement, submitClinicalForm } from './lib/form-utils'
import { apiRequest } from './lib/api'
import { useAuthStore } from './lib/auth-store'""",
    )

content = re.sub(
    r"mutationFn: \(event: FormEvent<HTMLFormElement>\) => \{\s*\n\s*const form = new FormData\(event\.currentTarget\)",
    "mutationFn: (formElement: HTMLFormElement) => {\n      const form = formDataFromElement(formElement)",
    content,
)

content = re.sub(
    r"mutationFn: \(\{\s*event,\s*encounterId,\s*\}: \{\s*event: FormEvent<HTMLFormElement>\s*encounterId: string\s*\}\) => \{\s*const form = new FormData\(event\.currentTarget\)",
    "mutationFn: ({ formElement, encounterId }: { formElement: HTMLFormElement; encounterId: string }) => {\n      const form = formDataFromElement(formElement)",
    content,
)
content = content.replace(
    "triage.mutate({ event, encounterId:",
    "triage.mutate({ formElement: event.currentTarget, encounterId:",
)

# Simple mutate(event) -> submitClinicalForm
content = re.sub(
    r"onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\)\s*(\w+)\.mutate\(event\)\s*\}\}",
    r"onSubmit={(event) => submitClinicalForm(\1, event)}",
    content,
)

# mutate(event.currentTarget)
content = re.sub(
    r"onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\)\s*(\w+)\.mutate\(event\.currentTarget\)\s*\}\}",
    r"onSubmit={(event) => submitClinicalForm(\1, event)}",
    content,
)

# mutate with reset (submitClinicalForm resets by default)
content = re.sub(
    r"onSubmit=\{\(event\) => \{\s*event\.preventDefault\(\)\s*(\w+)\.mutate\(event(?:\.currentTarget)?\)\s*event\.currentTarget\.reset\(\)\s*\}\}",
    r"onSubmit={(event) => submitClinicalForm(\1, event)}",
    content,
)

# Remove duplicate local Field component
content = re.sub(
    r"\nfunction Field\(\{[\s\S]*?\n\}\n\nfunction PatientLookup",
    "\nfunction PatientLookup",
    content,
    count=1,
)

# Remove duplicate QuickAddForm
content = re.sub(
    r"\nfunction QuickAddForm\(\{[\s\S]*?\n\}\n\nfunction ProfileSection",
    "\nfunction ProfileSection",
    content,
    count=1,
)

APP.write_text(content)
print("Polish script complete")
