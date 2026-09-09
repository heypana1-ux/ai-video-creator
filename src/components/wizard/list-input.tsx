"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

interface Props {
  label: string;
  hint?: string;
  placeholder?: string;
  value: string[];
  max?: number;
  onChange: (values: string[]) => void;
}

/** Repeatable single-line inputs, used for features, benefits and line-ups. */
export function ListInput({ label, hint, placeholder, value, max = 8, onChange }: Props) {
  const rows = value.length > 0 ? value : [""];

  function update(index: number, next: string) {
    const copy = [...rows];
    copy[index] = next;
    onChange(copy.filter((entry, entryIndex) => entry.trim() !== "" || entryIndex < copy.length));
  }

  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {rows.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              value={entry}
              placeholder={placeholder}
              onChange={(event) => update(index, event.target.value)}
            />
            {rows.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Eintrag entfernen"
                onClick={() => onChange(rows.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {rows.length < max ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => onChange([...rows.filter(Boolean), ""])}
          >
            <Plus className="size-4" /> Eintrag hinzufügen
          </Button>
        ) : null}
      </div>
    </Field>
  );
}
