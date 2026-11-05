import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { A11yErrorSummary } from './error-summary';
import { ErrorMessages } from './error-summary.model';

@Component({
  imports: [ReactiveFormsModule, A11yErrorSummary],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <a11y-error-summary [form]="form" [messages]="messages" [heading]="heading" [headingLevel]="level" />
      <label for="name">Full name</label>
      <input id="name" formControlName="name" />
      <label for="email">Email</label>
      <input id="email" formControlName="email" />
      <div formGroupName="address">
        <label for="zip">Postcode</label>
        <input id="zip" formControlName="zip" />
      </div>
      <input id="nick" formControlName="nick" />
      <button type="submit">Go</button>
    </form>
  `,
})
class Host {
  form = new FormGroup({
    name: new FormControl('', Validators.required),
    email: new FormControl('', [Validators.required, Validators.email]),
    address: new FormGroup({ zip: new FormControl('', Validators.required) }),
    nick: new FormControl({ value: '', disabled: true }, Validators.required),
  });
  messages: ErrorMessages = {
    name: 'Enter your name',
    email: { required: 'Enter your email address', email: 'Enter an email address like name@example.com' },
    'address.zip': 'Enter a postcode',
  };
  onSubmit: () => void = () => {};
  heading = 'There is a problem';
  level: 2 | 3 | 4 | 5 | 6 = 2;
}

describe('A11yErrorSummary', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const root = () => fixture.nativeElement as HTMLElement;
  const group = () => root().querySelector('[role="group"]') as HTMLElement | null;
  const links = () => Array.from(root().querySelectorAll<HTMLAnchorElement>('.a11y-error-summary__list a'));
  const texts = () => Array.from(root().querySelectorAll('.a11y-error-summary__list li')).map((li) => li.textContent!.trim());
  const input = (id: string) => root().querySelector<HTMLInputElement>(`#${id}`)!;

  async function submit(): Promise<void> {
    root().querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const fillValid = () => {
    host.form.patchValue({ name: 'Tom', email: 'tom@example.com', address: { zip: 'M5V' } });
  };

  beforeEach(async () => {
    document.body.focus();
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable(); // lets the summary attach its submit listener
  });

  it('shows nothing before a submit attempt, even though the form is invalid', () => {
    expect(host.form.invalid).toBe(true);
    expect(group()).toBeNull();
  });

  it('shows nothing when the form is valid', async () => {
    fillValid();
    await submit();
    expect(group()).toBeNull();
  });

  it('stays hidden when the app saves and resets the form in its own submit handler', async () => {
    fillValid();
    host.onSubmit = () => host.form.reset(); // after a save, the empty required fields are invalid again
    await submit();
    expect(group()).toBeNull();
  });

  it('judges the form as submitted, before the app\'s submit handler runs', async () => {
    host.onSubmit = () => host.form.patchValue({ name: 'Tom', email: 'tom@example.com', address: { zip: 'M5V' } });
    await submit(); // invalid when submitted, even though the handler fixes it straight away
    expect(group()).toBeNull(); // fixed by the handler, so statusChanges cleared it
    host.form.reset();
    fixture.detectChanges();
    expect(group()).toBeNull(); // does not reappear on a later reset
  });

  it('stays quiet after everything is fixed, even if a field is cleared again', async () => {
    await submit();
    fillValid();
    fixture.detectChanges();
    expect(group()).toBeNull();
    host.form.controls.name.setValue('');
    fixture.detectChanges();
    expect(group()).toBeNull();
  });

  it('lists each invalid field in page order with its message', async () => {
    await submit();
    expect(texts()).toEqual(['Enter your name', 'Enter your email address', 'Enter a postcode']);
  });

  it('uses the message for the validator that failed', async () => {
    host.form.patchValue({ name: 'Tom', email: 'nope', address: { zip: 'M5V' } });
    await submit();
    expect(texts()).toEqual(['Enter an email address like name@example.com']);
  });

  it('prefers a dotted path over a bare control name', async () => {
    host.messages = { ...host.messages, zip: 'bare name', 'address.zip': 'dotted path' };
    fixture.detectChanges();
    await submit();
    expect(texts()).toContain('dotted path');
    expect(texts()).not.toContain('bare name');
  });

  it('falls back to the field label and warns once in development when a message is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    host.messages = { email: 'x', 'address.zip': 'y' };
    fixture.detectChanges();
    await submit();
    await submit();
    expect(texts()[0]).toBe('Check Full name');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('ignores disabled controls', async () => {
    await submit();
    expect(links()).toHaveLength(3);
    expect(texts().join()).not.toContain('nick');
  });

  it('removes entries as fields are fixed, and hides when none are left', async () => {
    await submit();
    host.form.controls.name.setValue('Tom');
    fixture.detectChanges();
    expect(texts()).toEqual(['Enter your email address', 'Enter a postcode']);
    fillValid();
    fixture.detectChanges();
    expect(group()).toBeNull();
  });

  it('moves focus to the summary after a failed submit, and again on the next failed submit', async () => {
    await submit();
    expect(document.activeElement).toBe(group());
    input('name').focus();
    expect(document.activeElement).toBe(input('name'));
    await submit();
    expect(document.activeElement).toBe(group());
  });

  it('does not take focus when the form is valid', async () => {
    fillValid();
    input('name').focus();
    await submit();
    expect(document.activeElement).toBe(input('name'));
  });

  it('focuses the field when a link is activated, without following the link', async () => {
    await submit();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    links()[1].dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input('email'));
  });

  it('finds fields inside a formGroupName', async () => {
    await submit();
    links()[2].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(input('zip'));
  });

  it('is a group named by its heading, and not a live region', async () => {
    await submit();
    const heading = root().querySelector('[role="heading"]') as HTMLElement;
    expect(group()!.getAttribute('aria-labelledby')).toBe(heading.id);
    expect(heading.textContent!.trim()).toBe('There is a problem');
    expect(group()!.getAttribute('aria-live')).toBeNull();
    expect(root().querySelector('[role="alert"], [role="status"]')).toBeNull();
  });

  it('lets the app set the heading text and level', async () => {
    host.heading = 'Fix these first';
    host.level = 3;
    fixture.detectChanges();
    await submit();
    const heading = root().querySelector('[role="heading"]') as HTMLElement;
    expect(heading.textContent!.trim()).toBe('Fix these first');
    expect(heading.getAttribute('aria-level')).toBe('3');
  });

  it('hides again after clear(), until the next failed submit', async () => {
    await submit();
    fixture.debugElement.query(By.directive(A11yErrorSummary)).componentInstance.clear();
    fixture.detectChanges();
    expect(group()).toBeNull();
    await submit();
    expect(group()).not.toBeNull();
  });

  it('hides on a native form reset', async () => {
    await submit();
    root().querySelector('form')!.dispatchEvent(new Event('reset'));
    fixture.detectChanges();
    expect(group()).toBeNull();
  });

  it('shows a plain fallback line when the form is invalid but no field is to blame', async () => {
    fillValid();
    host.form.setErrors({ mismatch: true });
    await submit();
    expect(texts()).toEqual(['Check the form for errors']);
    expect(links()).toHaveLength(0);
  });
});
