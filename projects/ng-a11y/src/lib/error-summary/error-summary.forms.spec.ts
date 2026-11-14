import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncValidatorFn, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { A11yErrorSummary } from './error-summary';
import { ErrorMessages } from './error-summary.model';

/** Forms whose shape or timing the plain spec does not cover: bound names, async validators, updateOn: 'submit'. */

async function create<T>(host: new () => T): Promise<ComponentFixture<T>> {
  document.body.focus();
  await TestBed.configureTestingModule({ imports: [host as never] }).compileComponents();
  const fixture = TestBed.createComponent(host);
  fixture.detectChanges();
  await fixture.whenStable(); // lets the summary attach its submit listeners
  return fixture;
}

async function submit(fixture: ComponentFixture<unknown>): Promise<void> {
  // Real submit events bubble.
  fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  fixture.detectChanges();
  await fixture.whenStable();
}

function type(fixture: ComponentFixture<unknown>, selector: string, value: string): void {
  const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

const group = (f: ComponentFixture<unknown>) => f.nativeElement.querySelector('[role="group"]') as HTMLElement | null;
const items = (f: ComponentFixture<unknown>) =>
  Array.from(f.nativeElement.querySelectorAll('.a11y-error-summary__list li')) as HTMLLIElement[];
const texts = (f: ComponentFixture<unknown>) => items(f).map((li) => li.textContent!.trim());

@Component({
  imports: [ReactiveFormsModule, A11yErrorSummary],
  template: `
    <form [formGroup]="form" novalidate>
      <a11y-error-summary [form]="form" [messages]="messages" />
      <input id="street" formControlName="street" />
      <div formArrayName="addresses">
        @for (row of form.controls.addresses.controls; track row; let i = $index) {
          <div [formGroupName]="i">
            <input [id]="'street-' + i" formControlName="street" [attr.data-a11y-field]="marked ? 'addresses.' + i + '.street' : null" />
          </div>
        }
      </div>
      <input id="city" [formControlName]="cityName" />
    </form>
  `,
})
class ArrayHost {
  marked = true;
  cityName = 'city';
  row = () => new FormGroup({ street: new FormControl('', Validators.required) });
  form = new FormGroup({
    street: new FormControl('', Validators.required),
    addresses: new FormArray([this.row(), this.row()]),
    city: new FormControl('x', Validators.required),
  });
  messages: ErrorMessages = {
    street: 'Enter your street',
    'addresses.0.street': 'Enter the first street',
    'addresses.1.street': 'Enter the second street',
    city: 'Enter a city',
  };
}

describe('A11yErrorSummary with bound control names', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => (warn = vi.spyOn(console, 'warn').mockImplementation(() => {})));
  afterEach(() => warn.mockRestore());

  it('links each row of a FormArray to its own field when the fields are marked', async () => {
    const fixture = await create(ArrayHost);
    await submit(fixture);
    expect(texts(fixture)).toEqual(['Enter your street', 'Enter the first street', 'Enter the second street']);
    const links = items(fixture).map((li) => li.querySelector('a')!);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#street', '#street-0', '#street-1']);
    links[2].click();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#street-1'));
  });

  it('shows an entry without a link, and warns, rather than link to the wrong field', async () => {
    const fixture = await create(ArrayHost);
    fixture.componentInstance.marked = false;
    fixture.componentInstance.form.controls.city.setValue('');
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    await submit(fixture);
    const byText = (text: string) => items(fixture).find((li) => li.textContent!.trim() === text)!;
    // The top-level "street" is not confused with the rows' "street" fields.
    expect(byText('Enter your street').querySelector('a')!.getAttribute('href')).toBe('#street');
    expect(byText('Enter the first street').querySelector('a')).toBeNull();
    expect(byText('Enter the second street').querySelector('a')).toBeNull();
    expect(byText('Enter a city').querySelector('a')).toBeNull(); // [formControlName]="cityName" leaves no attribute
    expect(warn.mock.calls.map((c: unknown[]) => String(c[0])).filter((m: string) => m.includes('data-a11y-field'))).toHaveLength(3);
  });
});

@Component({
  imports: [ReactiveFormsModule, A11yErrorSummary],
  template: `
    <form [formGroup]="form" novalidate>
      <a11y-error-summary [form]="form" [messages]="{ name: 'That name is taken' }" />
      <input id="name" formControlName="name" />
    </form>
  `,
})
class AsyncHost {
  finish!: (taken: boolean) => void;
  check: AsyncValidatorFn = () => new Promise((resolve) => (this.finish = (taken) => resolve(taken ? { taken: true } : null)));
  form = new FormGroup({ name: new FormControl('', { asyncValidators: this.check }) });
}

describe('A11yErrorSummary with an async validator', () => {
  async function submitWhilePending() {
    const fixture = await create(AsyncHost);
    type(fixture, '#name', 'tom');
    expect(fixture.componentInstance.form.pending).toBe(true);
    await submit(fixture);
    expect(group(fixture)).toBeNull(); // nothing to say yet
    return fixture;
  }

  it('shows the summary and moves focus to it when validation fails after the submit', async () => {
    const fixture = await submitWhilePending();
    fixture.componentInstance.finish(true);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(texts(fixture)).toEqual(['That name is taken']);
    expect(document.activeElement).toBe(group(fixture));
  });

  it('stays hidden when validation passes after the submit', async () => {
    const fixture = await submitWhilePending();
    fixture.componentInstance.finish(false);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(group(fixture)).toBeNull();
  });

  it('does not appear when validation that finished before any submit fails', async () => {
    const fixture = await create(AsyncHost);
    type(fixture, '#name', 'tom');
    fixture.componentInstance.finish(true);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(group(fixture)).toBeNull();
  });
});

@Component({
  imports: [ReactiveFormsModule, A11yErrorSummary],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <a11y-error-summary [form]="form" [messages]="{ name: 'Enter your name', email: 'Enter your email' }" />
      <input id="name" formControlName="name" />
      <input id="email" formControlName="email" />
    </form>
  `,
})
class SubmitHost {
  form = new FormGroup(
    { name: new FormControl('', Validators.required), email: new FormControl('', Validators.required) },
    { updateOn: 'submit' },
  );
  saved = 0;
  onSubmit = () => {
    if (this.form.invalid) return;
    this.saved++;
    this.form.reset();
  };
}

describe("A11yErrorSummary with updateOn: 'submit'", () => {
  it('lists the fields that are still empty, judged on what was typed', async () => {
    const fixture = await create(SubmitHost);
    type(fixture, '#name', 'Tom');
    await submit(fixture);
    expect(texts(fixture)).toEqual(['Enter your email']);
    expect(document.activeElement).toBe(group(fixture));
  });

  it('shows the summary for an untouched form', async () => {
    const fixture = await create(SubmitHost);
    await submit(fixture);
    expect(texts(fixture)).toEqual(['Enter your name', 'Enter your email']);
  });

  it('shows nothing when the typed values are valid and the app saves and resets', async () => {
    const fixture = await create(SubmitHost);
    type(fixture, '#name', 'Tom');
    type(fixture, '#email', 'tom@example.com');
    await submit(fixture);
    expect(fixture.componentInstance.saved).toBe(1);
    expect(group(fixture)).toBeNull();
  });

  it('goes away, without stranding focus, when a failed form is fixed and submitted again', async () => {
    const fixture = await create(SubmitHost);
    await submit(fixture);
    expect(document.activeElement).toBe(group(fixture));
    type(fixture, '#name', 'Tom');
    type(fixture, '#email', 'tom@example.com');
    (fixture.nativeElement.querySelector('#email') as HTMLElement).focus();
    await submit(fixture);
    expect(fixture.componentInstance.saved).toBe(1);
    expect(group(fixture)).toBeNull();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('#email'));
  });

  it('shows the summary when a form that was valid is made invalid and submitted', async () => {
    const fixture = await create(SubmitHost);
    fixture.componentInstance.onSubmit = () => {};
    type(fixture, '#name', 'Tom');
    type(fixture, '#email', 'tom@example.com');
    await submit(fixture);
    expect(group(fixture)).toBeNull();
    type(fixture, '#email', '');
    await submit(fixture);
    expect(texts(fixture)).toEqual(['Enter your email']);
  });
});
