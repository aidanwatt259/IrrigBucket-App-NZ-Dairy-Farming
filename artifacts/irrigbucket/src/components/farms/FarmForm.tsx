import { useState } from 'react';
import type { FarmInput, LocalFarm } from '@workspace/sync';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type FarmFormValue = {
  name: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
};

export function farmFormValue(farm?: LocalFarm | null): FarmFormValue {
  return {
    name: farm?.name ?? '',
    region: farm?.region ?? '',
    contactName: farm?.contactName ?? '',
    contactEmail: farm?.contactEmail ?? '',
    contactPhone: farm?.contactPhone ?? '',
    notes: farm?.notes ?? '',
  };
}

export function toFarmInput(value: FarmFormValue): FarmInput {
  const opt = (s: string) => s.trim() || null;
  return {
    name: value.name.trim(),
    region: opt(value.region),
    contactName: opt(value.contactName),
    contactEmail: opt(value.contactEmail),
    contactPhone: opt(value.contactPhone),
    notes: opt(value.notes),
  };
}

/** Name + region + client contact fields; used for adding and editing farms. */
export function FarmForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  full = true,
}: {
  initial?: LocalFarm | null;
  submitLabel: string;
  onSubmit: (input: FarmInput) => Promise<void> | void;
  onCancel?: () => void;
  /** Show contact and notes fields (off for the quick "add farm" dialog). */
  full?: boolean;
}) {
  const [value, setValue] = useState(() => farmFormValue(initial));
  const [saving, setSaving] = useState(false);
  const set = (key: keyof FarmFormValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValue((v) => ({ ...v, [key]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit(toFarmInput(value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="farm-name">Farm name</Label>
        <Input id="farm-name" value={value.name} onChange={set('name')} placeholder="e.g. Riverdale Dairies" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="farm-region">
          Region <span className="text-muted-foreground font-normal text-xs">(optional)</span>
        </Label>
        <Input id="farm-region" value={value.region} onChange={set('region')} placeholder="e.g. Mid Canterbury" />
      </div>
      {full && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="farm-contact">Contact name</Label>
              <Input id="farm-contact" value={value.contactName} onChange={set('contactName')} placeholder="Farm owner or manager" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="farm-phone">Phone</Label>
              <Input id="farm-phone" type="tel" value={value.contactPhone} onChange={set('contactPhone')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="farm-email">Email</Label>
            <Input id="farm-email" type="email" value={value.contactEmail} onChange={set('contactEmail')} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="farm-notes">Notes</Label>
            <Textarea id="farm-notes" value={value.notes} onChange={set('notes')} rows={3} placeholder="Gate codes, water source, anything useful for the next visit" />
          </div>
        </>
      )}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={!value.name.trim() || saving}>
          {saving ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
